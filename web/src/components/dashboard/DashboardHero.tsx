import Link from "next/link";
import { Sparkles, ArrowRight, RefreshCw } from "lucide-react";

interface DashboardHeroProps {
  userName: string | null;
  newJobsCount: number;
  topMatchesCount: number;
  tailoredCount: number;
  lastScrapedAt: string | null;
}

function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getRelativeTime(iso: string, now: Date): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export default function DashboardHero({
  userName,
  newJobsCount,
  topMatchesCount,
  tailoredCount,
  lastScrapedAt,
}: DashboardHeroProps) {
  const now = new Date();
  const greeting = getGreeting(now);
  const displayName = userName?.trim() ? userName.trim().split(" ")[0] : "there";
  const formattedDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const summaryParts: string[] = [];
  if (newJobsCount > 0) {
    summaryParts.push(
      `${newJobsCount} new job${newJobsCount === 1 ? "" : "s"} to review`,
    );
  }
  if (topMatchesCount > 0) {
    summaryParts.push(
      `${topMatchesCount} top match${topMatchesCount === 1 ? "" : "es"}`,
    );
  }
  if (tailoredCount > 0) {
    summaryParts.push(
      `${tailoredCount} tailored resume${tailoredCount === 1 ? "" : "s"} ready`,
    );
  }
  const summary =
    summaryParts.length > 0
      ? summaryParts.join(" · ")
      : "Your pipeline is set up — run a scrape to find opportunities";

  const hoursSinceScrape = lastScrapedAt
    ? (now.getTime() - new Date(lastScrapedAt).getTime()) / (1000 * 60 * 60)
    : Infinity;
  const isStale = hoursSinceScrape >= 24;

  return (
    <section className="mb-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">{formattedDate}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {greeting}, {displayName} 👋
          </h1>
          <p className="mt-2 text-base text-gray-500">{summary}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {lastScrapedAt ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                isStale
                  ? "bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isStale ? "text-amber-600" : ""}`} />
              <span>
                {isStale
                  ? `Last scraped ${getRelativeTime(lastScrapedAt, now)}`
                  : `Updated ${getRelativeTime(lastScrapedAt, now)}`}
              </span>
              {isStale && (
                <Link
                  href="/settings?tab=cloud"
                  className="ml-1 font-bold underline hover:no-underline text-amber-900"
                  title="Open Cloud Workflows to run scraper locally or inspect execution"
                >
                  Run Now
                </Link>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 px-3 py-1.5 text-xs font-medium shadow-2xs">
              <RefreshCw className="h-3.5 w-3.5 text-amber-600" />
              <span>No scrapes recorded</span>
              <Link
                href="/settings?tab=cloud"
                className="ml-1 font-bold underline hover:no-underline text-amber-900"
              >
                Run Now
              </Link>
            </span>
          )}
          <Link
            href="/jobs/top-matches"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md"
          >
            <Sparkles className="h-4 w-4" />
            View Top Matches
          </Link>
          <Link
            href="/resume-studio"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50"
          >
            Resume Studio
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
