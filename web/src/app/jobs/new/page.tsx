import { Suspense } from "react";
import JobListSkeleton from "@/components/jobs/JobListSkeleton";
import {
  getAllActiveJobsCount,
  getNewJobs,
  getJobsTabCounts,
} from "@/lib/supabase/queries";
import TopMatchesList from "@/components/jobs/TopMatchesList";
import JobsNavigationHeader from "@/components/jobs/JobsNavigationHeader";

const PAGE_SIZE = 10;

export default async function NewJobsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const currentPage = parseInt(params?.page as string) || 1;
  const searchQuery = params?.query as string;
  const provider = params?.provider as string;
  const providerFilter = provider && provider !== "all" ? provider : undefined;

  const interestParam = params?.interest as string;
  let interestFilter: boolean | null | undefined = undefined;
  if (interestParam === "true") {
    interestFilter = true;
  } else if (interestParam === "false") {
    interestFilter = false;
  } else if (interestParam === "null") {
    interestFilter = null;
  }

  const minScoreParam = params?.minScore as string;
  const maxScoreParam = params?.maxScore as string;
  const minScore = minScoreParam ? parseInt(minScoreParam) : undefined;
  const maxScore = maxScoreParam ? parseInt(maxScoreParam) : undefined;

  // Fetch the jobs for the current page, total count, and tab pill counts in parallel
  const [newJobs, totalCount, tabCounts] = await Promise.all([
    getNewJobs(
      currentPage,
      PAGE_SIZE,
      providerFilter,
      minScore,
      maxScore,
      interestFilter,
      searchQuery,
    ),
    getAllActiveJobsCount(
      providerFilter,
      minScore,
      maxScore,
      interestFilter,
      searchQuery,
    ),
    getJobsTabCounts(),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <JobsNavigationHeader
        activeTab="new"
        tabCounts={tabCounts}
        currentPage={currentPage}
        title="New Jobs"
        subtitle={`Freshly scraped opportunities in chronological order (${totalCount} total)`}
      />

      <Suspense fallback={<JobListSkeleton />}>
        <TopMatchesList
          jobs={newJobs}
          currentPage={currentPage}
          totalPages={totalPages}
          title="New Jobs Feed"
          emptyTitle="No new jobs found"
          emptyMessage="No new jobs found matching your filters. Run a scrape or check back soon."
        />
      </Suspense>
    </div>
  );
}

export const dynamic = "force-dynamic";
