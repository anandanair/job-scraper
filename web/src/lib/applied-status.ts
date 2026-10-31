import { Job, StatusHistoryEntry } from "@/types";

/** Canonical application statuses stored in jobs.status */
export type AppliedStatus = "applied" | "interviewing" | "offer" | "rejected";

export const APPLIED_STATUSES: AppliedStatus[] = [
  "applied",
  "interviewing",
  "offer",
  "rejected",
];

export const APPLIED_STATUS_META: Record<
  AppliedStatus,
  {
    label: string;
    dotClass: string;
    pillClass: string;
    pillActiveClass: string;
    barClass: string;
    description: string;
  }
> = {
  applied: {
    label: "Applied",
    dotClass: "bg-sky-500",
    pillClass: "bg-sky-50 text-sky-700 border-sky-200",
    pillActiveClass: "bg-sky-600 text-white border-sky-600",
    barClass: "bg-sky-500",
    description: "Application submitted, awaiting response",
  },
  interviewing: {
    label: "Interviewing",
    dotClass: "bg-violet-500",
    pillClass: "bg-violet-50 text-violet-700 border-violet-200",
    pillActiveClass: "bg-violet-600 text-white border-violet-600",
    barClass: "bg-violet-500",
    description: "In the interview process",
  },
  offer: {
    label: "Offer",
    dotClass: "bg-emerald-500",
    pillClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pillActiveClass: "bg-emerald-600 text-white border-emerald-600",
    barClass: "bg-emerald-500",
    description: "Offer received",
  },
  rejected: {
    label: "Rejected",
    dotClass: "bg-rose-400",
    pillClass: "bg-rose-50 text-rose-600 border-rose-200",
    pillActiveClass: "bg-rose-500 text-white border-rose-500",
    barClass: "bg-rose-400",
    description: "Application was not successful",
  },
};

export function isAppliedStatus(value: unknown): value is AppliedStatus {
  return typeof value === "string" && APPLIED_STATUSES.includes(value as AppliedStatus);
}

export function getStatusMeta(status: string | null | undefined) {
  if (isAppliedStatus(status)) return APPLIED_STATUS_META[status];
  return APPLIED_STATUS_META.applied;
}

/** Deterministic pastel avatar gradient from a company name */
export function getCompanyAvatarClass(company: string | null | undefined): string {
  const gradients = [
    "from-indigo-500 to-violet-500",
    "from-sky-500 to-cyan-500",
    "from-emerald-500 to-teal-500",
    "from-amber-500 to-orange-500",
    "from-rose-500 to-pink-500",
    "from-blue-500 to-indigo-500",
    "from-fuchsia-500 to-purple-500",
    "from-teal-500 to-emerald-500",
  ];
  const name = (company || "?").trim();
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return gradients[hash % gradients.length];
}

export function getCompanyInitials(company: string | null | undefined): string {
  const words = (company || "?").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Days since the application was submitted (0 for today, null when unknown) */
export function daysSinceApplication(job: Job): number | null {
  if (!job.application_date) return null;
  const applied = new Date(job.application_date);
  if (isNaN(applied.getTime())) return null;
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - applied.getTime()) / 86_400_000));
}

export type FollowUpState = "overdue" | "due" | "upcoming" | null;

/** Whether a follow-up reminder is due/overdue for this job */
export function getFollowUpState(job: Job): FollowUpState {
  if (!job.follow_up_at) return null;
  const due = new Date(job.follow_up_at);
  if (isNaN(due.getTime())) return null;
  const now = new Date();
  const diffDays = (due.getTime() - now.getTime()) / 86_400_000;
  if (diffDays < 0) return "overdue";
  if (diffDays <= 1) return "due";
  return "upcoming";
}

/**
 * Whether the user should consider following up: a follow-up reminder is
 * due/overdue, or the application has been sitting in "applied" with no
 * movement beyond the given threshold.
 */
export function needsFollowUp(job: Job, thresholdDays: number): boolean {
  const state = getFollowUpState(job);
  if (state === "overdue" || state === "due") return true;
  if (job.status === "applied") {
    const days = daysSinceApplication(job);
    if (days !== null && days >= thresholdDays) return true;
  }
  return false;
}

export type EventUrgency = "past" | "today" | "soon" | "later";

/** Urgency of the next scheduled event (interview etc.) */
export function getEventUrgency(nextEventAt: string | null | undefined): EventUrgency | null {
  if (!nextEventAt) return null;
  const event = new Date(nextEventAt);
  if (isNaN(event.getTime())) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEventDay = new Date(event.getFullYear(), event.getMonth(), event.getDate());
  const dayDiff = Math.round((startOfEventDay.getTime() - startOfToday.getTime()) / 86_400_000);
  if (dayDiff < 0) return "past";
  if (dayDiff === 0) return "today";
  if (dayDiff <= 3) return "soon";
  return "later";
}

/** "Applied 5d ago" / "Applied today" style label */
export function formatAppliedAgo(job: Job): string {
  const days = daysSinceApplication(job);
  if (days === null) return "Applied date unknown";
  if (days === 0) return "Applied today";
  if (days === 1) return "Applied yesterday";
  return `Applied ${days}d ago`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateTimeForInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Safely parse the status_history JSONB column */
export function parseStatusHistory(raw: unknown): StatusHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is StatusHistoryEntry =>
      entry !== null &&
      typeof entry === "object" &&
      typeof (entry as StatusHistoryEntry).to === "string" &&
      typeof (entry as StatusHistoryEntry).at === "string"
  );
}

export function jobPostingUrl(job: Pick<Job, "job_id" | "provider">): string {
  return job.provider === "careers_future"
    ? `https://www.mycareersfuture.gov.sg/job/${job.job_id}`
    : `https://www.linkedin.com/jobs/view/${job.job_id}`;
}
