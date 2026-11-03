import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// 1. Load env files
const webEnv = path.resolve(process.cwd(), ".env.local");
const rootEnv = path.resolve(process.cwd(), "..", ".env");
if (fs.existsSync(webEnv)) dotenv.config({ path: webEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });

import { createSupabaseStaticClient, isSupabaseConfigured } from "../src/utils/supabase/server";
import { evaluateSchedule } from "../src/lib/schedule-utils";
import { AppSettings } from "../src/types";

/**
 * Schedule Gatekeeper Script
 *
 * Runs once every hour in GitHub Actions (0 * * * *).
 * Evaluates whether the scraper should run right now for the user's configured local timezone.
 *
 * If triggered by `workflow_dispatch`, it runs immediately regardless of schedule.
 * If scheduled, it compares the user's local time against `schedule_hour` and verifies
 * that the scraper has not already completed for today.
 */
async function main() {
  console.log("============================================================");
  console.log("            JobTrack Schedule Gatekeeper Check             ");
  console.log("============================================================");

  const eventName = process.env.GITHUB_EVENT_NAME || "schedule";
  console.log(`Trigger Event:   ${eventName}`);

  let settings: Partial<AppSettings> | null = null;

  if (isSupabaseConfigured()) {
    try {
      const supabase = createSupabaseStaticClient();
      const { data, error } = await supabase
        .from("app_settings")
        .select("schedule_timezone, schedule_hour, schedule_minute, last_scraped_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("[WARN] Could not read app_settings from Supabase:", error.message);
      } else if (data) {
        settings = data;
      }
    } catch (err: any) {
      console.warn("[WARN] Failed to query Supabase:", err?.message || err);
    }
  } else {
    console.log("[INFO] Supabase not configured on runner. Using defaults (Asia/Singapore, 19:00).");
  }

  const evaluation = evaluateSchedule(settings, eventName);

  console.log(`User Timezone:   ${evaluation.timezone}`);
  console.log(`Current Local:   ${evaluation.localTimeStr}`);
  console.log(
    `Target Schedule: ${evaluation.targetHour.toString().padStart(2, "0")}:${evaluation.targetMinute
      .toString()
      .padStart(2, "0")}`
  );
  console.log(`Last Scraped At: ${settings?.last_scraped_at || "Never"}`);
  console.log("------------------------------------------------------------");
  console.log(`Decision:        ${evaluation.shouldRun ? ">>> RUN SCRAPER <<<" : ">>> SKIP SCRAPER <<<"}`);
  console.log(`Reason:          ${evaluation.reason}`);
  console.log("============================================================\n");

  // Write outputs for GitHub Actions
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    try {
      const lines = [
        `should_run=${evaluation.shouldRun ? "true" : "false"}`,
        `reason=${evaluation.reason.replace(/\n/g, " ")}`,
        `local_time=${evaluation.localTimeStr}`,
        `timezone=${evaluation.timezone}`,
      ].join("\n");
      fs.appendFileSync(githubOutput, lines + "\n");
    } catch (writeErr) {
      console.warn("[WARN] Could not write to GITHUB_OUTPUT:", writeErr);
    }
  }
}

main().catch((err) => {
  console.error("[ERROR] Gatekeeper check failed with error:", err);
  // Default to true on unhandled gatekeeper crash so automated scraping is not permanently blocked
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    try {
      fs.appendFileSync(githubOutput, "should_run=true\nreason=Fallback due to gatekeeper error\n");
    } catch {}
  }
  process.exit(0);
});
