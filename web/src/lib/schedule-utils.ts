import { AppSettings } from "../types";

export interface AllowedTimeOption {
  utcHour: number;
  hour24: number;
  minute: number;
  label: string; // e.g. "7:00 PM" or "7:30 PM"
  isRecommended: boolean; // closest to 19:00 (7:00 PM) local time
}

/**
 * Validates whether an IANA timezone string is recognized by Intl.
 */
export function isValidTimezone(tz?: string | null): boolean {
  if (!tz) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a normalized, safe IANA timezone, defaulting to 'Asia/Singapore'.
 */
export function normalizeTimezone(tz?: string | null): string {
  if (tz && isValidTimezone(tz)) {
    return tz;
  }
  return "Asia/Singapore";
}

/**
 * Calculates all 24 valid local execution times for a given timezone,
 * corresponding to GitHub Actions running once every hour on the hour (0 * * * *).
 *
 * For whole-hour timezones (Singapore, US, Europe), minute is 00 (e.g. 7:00 PM).
 * For half-hour timezones (India), minute is 30 (e.g. 7:30 PM).
 * For 45-min timezones (Nepal), minute is 45 (e.g. 7:45 PM).
 */
export function getAllowedExecutionTimes(timezone: string): AllowedTimeOption[] {
  const safeTz = normalizeTimezone(timezone);
  const options: AllowedTimeOption[] = [];

  // Anchor to a known reference date (Jan 15, 2026) to calculate hour offsets cleanly
  const now = new Date();
  const refYear = now.getUTCFullYear();
  const refMonth = now.getUTCMonth();
  const refDate = now.getUTCDate();

  for (let utcHour = 0; utcHour < 24; utcHour++) {
    const d = new Date(Date.UTC(refYear, refMonth, refDate, utcHour, 0, 0));

    const timeFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: safeTz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const parts = timeFormatter.formatToParts(d);
    const hourPart = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    const minutePart = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
    const dayPeriod = (parts.find((p) => p.type === "dayPeriod")?.value || "").toUpperCase();

    let hour24 = hourPart;
    if (dayPeriod === "PM" && hourPart !== 12) {
      hour24 = hourPart + 12;
    } else if (dayPeriod === "AM" && hourPart === 12) {
      hour24 = 0;
    }

    options.push({
      utcHour,
      hour24,
      minute: minutePart,
      label: timeFormatter.format(d),
      isRecommended: false,
    });
  }

  // Sort chronologically by local hour and minute (00:00 -> 23:59)
  options.sort((a, b) => a.hour24 * 60 + a.minute - (b.hour24 * 60 + b.minute));

  // Determine closest slot to 19:00 (7:00 PM local time)
  let bestIdx = 0;
  let minDiff = Infinity;
  for (let i = 0; i < options.length; i++) {
    const totalMinutes = options[i].hour24 * 60 + options[i].minute;
    const targetMinutes = 19 * 60; // 19:00 = 1140 minutes
    const diff = Math.abs(totalMinutes - targetMinutes);
    if (diff < minDiff || (diff === minDiff && options[i].hour24 >= 19)) {
      minDiff = diff;
      bestIdx = i;
    }
  }

  if (options[bestIdx]) {
    options[bestIdx].isRecommended = true;
  }

  return options;
}

/**
 * Returns the recommended schedule time for a timezone (closest to 7:00 PM).
 */
export function getDefaultScheduleTime(timezone: string): { hour: number; minute: number } {
  const allowed = getAllowedExecutionTimes(timezone);
  const rec = allowed.find((o) => o.isRecommended) || allowed[0];
  return {
    hour: rec ? rec.hour24 : 19,
    minute: rec ? rec.minute : 0,
  };
}

export interface ScheduleEvaluationResult {
  shouldRun: boolean;
  reason: string;
  localTimeStr: string;
  currentLocalHour: number;
  currentLocalMinute: number;
  targetHour: number;
  targetMinute: number;
  timezone: string;
}

/**
 * Converts a given year, month (1-12), day, hour, and minute in a specific IANA timezone
 * into its exact UTC Date representation.
 */
export function zonedDateToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(guess);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || "0", 10);
  const gh = get("hour") === 24 ? 0 : get("hour");
  const guessUtc = Date.UTC(get("year"), get("month") - 1, get("day"), gh, get("minute"));
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute);
  const diff = guessUtc - targetUtc;
  return new Date(guess.getTime() - diff);
}

/**
 * Extracts numeric date and time parts for a Date in a specific IANA timezone.
 */
export function getZonedParts(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || "0", 10);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") === 24 ? 0 : get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * Evaluates whether the scraper should execute right now based on user settings
 * and the triggering event.
 *
 * Supports catch-up execution if GitHub Actions drops or delays scheduled runs
 * past the target execution window.
 */
export function evaluateSchedule(
  settings: Partial<AppSettings> | null | undefined,
  eventName: string = "schedule",
  referenceDate?: Date
): ScheduleEvaluationResult {
  const now = referenceDate || new Date();
  const tz = normalizeTimezone(settings?.schedule_timezone);
  const targetHour = typeof settings?.schedule_hour === "number" ? settings.schedule_hour : 19;
  const targetMinute = typeof settings?.schedule_minute === "number" ? settings.schedule_minute : 0;

  const fullFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "medium",
  });
  const localTimeStr = fullFmt.format(now);

  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayStr = dateFmt.format(now);
  const nowParts = getZonedParts(now, tz);
  const currentLocalHour = nowParts.hour;
  const currentLocalMinute = nowParts.minute;

  // Manual dispatch always runs immediately
  if (eventName === "workflow_dispatch") {
    return {
      shouldRun: true,
      reason: "Manual workflow dispatch trigger",
      localTimeStr,
      currentLocalHour,
      currentLocalMinute,
      targetHour,
      targetMinute,
      timezone: tz,
    };
  }

  // 1. Initial setup: no previous scrape recorded yet
  if (!settings?.last_scraped_at) {
    return {
      shouldRun: true,
      reason: "Initial run: no previous scrape recorded",
      localTimeStr,
      currentLocalHour,
      currentLocalMinute,
      targetHour,
      targetMinute,
      timezone: tz,
    };
  }

  const lastDate = new Date(settings.last_scraped_at);
  if (isNaN(lastDate.getTime())) {
    return {
      shouldRun: true,
      reason: "Initial run: invalid last_scraped_at timestamp",
      localTimeStr,
      currentLocalHour,
      currentLocalMinute,
      targetHour,
      targetMinute,
      timezone: tz,
    };
  }

  const lastDateStr = dateFmt.format(lastDate);
  const hoursSince = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);

  // 2. Already completed on the same local calendar day in the user's timezone
  if (lastDateStr === todayStr) {
    return {
      shouldRun: false,
      reason: `Already completed today (${todayStr}) in timezone ${tz}`,
      localTimeStr,
      currentLocalHour,
      currentLocalMinute,
      targetHour,
      targetMinute,
      timezone: tz,
    };
  }

  // 3. Minimum spacing safeguard (at least 4 hours between any executions)
  if (hoursSince < 4) {
    return {
      shouldRun: false,
      reason: `Recently executed ${hoursSince.toFixed(1)} hours ago (minimum 4h spacing)`,
      localTimeStr,
      currentLocalHour,
      currentLocalMinute,
      targetHour,
      targetMinute,
      timezone: tz,
    };
  }

  // 4. Determine the most recent scheduled target window
  const todayTarget = zonedDateToUtc(nowParts.year, nowParts.month, nowParts.day, targetHour, targetMinute, tz);
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yParts = getZonedParts(yesterdayDate, tz);
  const yesterdayTarget = zonedDateToUtc(yParts.year, yParts.month, yParts.day, targetHour, targetMinute, tz);

  const mostRecentTarget = now.getTime() >= todayTarget.getTime() ? todayTarget : yesterdayTarget;

  // 5. Check if the most recent target window was missed
  if (lastDate.getTime() < mostRecentTarget.getTime()) {
    const isTodayWindow = mostRecentTarget.getTime() === todayTarget.getTime();
    if (isTodayWindow) {
      return {
        shouldRun: true,
        reason: `Local time matches target window (${targetHour}:${targetMinute.toString().padStart(2, "0")}) and has not run today`,
        localTimeStr,
        currentLocalHour,
        currentLocalMinute,
        targetHour,
        targetMinute,
        timezone: tz,
      };
    } else {
      return {
        shouldRun: true,
        reason: `Catch-up run: missed previous scheduled window (last scrape was ${hoursSince.toFixed(1)}h ago on ${lastDateStr})`,
        localTimeStr,
        currentLocalHour,
        currentLocalMinute,
        targetHour,
        targetMinute,
        timezone: tz,
      };
    }
  }

  // 6. Yesterday's window was satisfied and today's target window hasn't arrived yet
  return {
    shouldRun: false,
    reason: `Current local hour (${currentLocalHour}:00) is before target hour (${targetHour}:00)`,
    localTimeStr,
    currentLocalHour,
    currentLocalMinute,
    targetHour,
    targetMinute,
    timezone: tz,
  };
}
