import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Sparkles, ArrowRight } from "lucide-react";
import {
  getCachedDashboardStats,
  getAppSettings,
  getJobsTabCounts,
  getTopScoredJobs,
  getUserProfileByEmail,
  getAppliedJobsCountsLastNDays,
  getLastScrapedAt,
} from "@/lib/supabase/queries";
import DashboardHero from "@/components/dashboard/DashboardHero";
import KpiCards from "@/components/dashboard/KpiCards";
import PipelineFunnel from "@/components/dashboard/PipelineFunnel";
import TopMatchesPreview from "@/components/dashboard/TopMatchesPreview";
import ActivityChart from "@/components/dashboard/ActivityChart";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const hasSupabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  );

  if (!hasSupabase) {
    redirect("/setup");
  }

  let isSetupComplete =
    cookieStore.get("jobtrack_setup_complete")?.value === "true";

  // Server's local date in YYYY-MM-DD format (same convention as the stats RPC)
  const now = new Date();
  const localToday = `${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;

  // Fetch all dashboard data in parallel; each call fails soft so the page
  // still renders (with zeros) when a dependency is unavailable.
  const [statsData, appSettings, tabCounts, topMatches, profile, activity, lastScrapedAt] =
    await Promise.all([
      getCachedDashboardStats(localToday).catch(() => null),
      getAppSettings().catch(() => null),
      getJobsTabCounts().catch(() => null),
      getTopScoredJobs(1, 5).catch(() => [] as Awaited<ReturnType<typeof getTopScoredJobs>>),
      getUserProfileByEmail().catch(() => null),
      getAppliedJobsCountsLastNDays(14).catch(
        () => [] as { date: string; count: number }[],
      ),
      getLastScrapedAt().catch(() => null),
    ]);

  if (appSettings?.setup_completed === true) {
    isSetupComplete = true;
  }

  if (!isSetupComplete) {
    redirect("/setup");
  }

  const stats = statsData ?? {
    totalNewJobs: 0,
    totalAppliedJobs: 0,
    totalTopMatches: 0,
    expiredJobsCount: 0,
    pendingScoreJobsCount: 0,
    scoredJobsCount: 0,
    customResumeJobsCount: 0,
    noCustomResumeJobsCount: 0,
    scoredWithOriginalResumeCount: 0,
    scoredWithCustomResumeCount: 0,
    linkedInJobsCount: 0,
    careersFutureJobsCount: 0,
    appliedTodayCount: 0,
  };

  const hasApiKey = Boolean(appSettings?.llm_api_key);

  // KPI numbers mirror the jobs page tab pills so both views always agree
  const newCount = tabCounts?.newCount ?? stats.totalNewJobs;
  const matchesCount = tabCounts?.matchesCount ?? stats.totalTopMatches;
  const tailoredCount = tabCounts?.tailoredCount ?? stats.customResumeJobsCount;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {!hasApiKey && (
        <div className="mb-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-6 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-xl bg-indigo-100 p-3 text-indigo-600">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-indigo-900">
                Welcome to JobTrack! Get started in 2 minutes
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-indigo-700">
                Connect your AI API key and configure your job search
                preferences in Settings to enable automated job scoring,
                resume personalization, and scraping.
              </p>
            </div>
          </div>
          <Link
            href="/settings"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700"
          >
            Configure Settings
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <DashboardHero
        userName={profile?.name ?? null}
        newJobsCount={newCount}
        topMatchesCount={matchesCount}
        tailoredCount={tailoredCount}
        lastScrapedAt={lastScrapedAt}
      />

      <KpiCards
        newCount={newCount}
        matchesCount={matchesCount}
        tailoredCount={tailoredCount}
        appliedCount={stats.totalAppliedJobs}
      />

      <PipelineFunnel stats={stats} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TopMatchesPreview jobs={topMatches} />
        </div>
        <div className="lg:col-span-2">
          <ActivityChart data={activity} />
        </div>
      </div>
    </div>
  );
}
