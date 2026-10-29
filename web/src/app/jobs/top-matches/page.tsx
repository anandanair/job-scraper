import { Suspense } from "react";
import JobListSkeleton from "@/components/jobs/JobListSkeleton";
import {
  getTopScoredJobs,
  getTopScoredJobsCount,
  getJobsTabCounts,
} from "@/lib/supabase/queries";
import TopMatchesList from "@/components/jobs/TopMatchesList";
import JobsNavigationHeader from "@/components/jobs/JobsNavigationHeader";

const PAGE_SIZE = 10;

export default async function TopMatchesPage({
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

  // Fetch top scored jobs, total count, and tab counts in parallel
  const [topJobs, totalCount, tabCounts] = await Promise.all([
    getTopScoredJobs(
      currentPage,
      PAGE_SIZE,
      providerFilter,
      minScore,
      maxScore,
      interestFilter,
      searchQuery,
    ),
    getTopScoredJobsCount(
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
        activeTab="top-matches"
        tabCounts={tabCounts}
        currentPage={currentPage}
        title="Top Matches"
        subtitle={`Jobs ranked by suitability score against your master resume (${totalCount} total)`}
      />

      <Suspense fallback={<JobListSkeleton />}>
        <TopMatchesList
          jobs={topJobs}
          currentPage={currentPage}
          totalPages={totalPages}
          title="Top Match Listings"
          emptyTitle="No matches found"
          emptyMessage="No top matching jobs found for this filter. Try lowering your minimum score filter or scoring more pending jobs."
        />
      </Suspense>
    </div>
  );
}

export const revalidate = 3600;
