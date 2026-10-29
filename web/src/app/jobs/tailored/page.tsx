import { Suspense } from "react";
import JobListSkeleton from "@/components/jobs/JobListSkeleton";
import {
  getTailoredJobs,
  getTailoredJobsCount,
  getJobsTabCounts,
} from "@/lib/supabase/queries";
import TopMatchesList from "@/components/jobs/TopMatchesList";
import JobsNavigationHeader from "@/components/jobs/JobsNavigationHeader";

const PAGE_SIZE = 10;

export default async function TailoredJobsPage({
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

  // Fetch tailored jobs, total count, and tab pill counts in parallel
  const [tailoredJobs, totalCount, tabCounts] = await Promise.all([
    getTailoredJobs(
      currentPage,
      PAGE_SIZE,
      providerFilter,
      minScore,
      maxScore,
      interestFilter,
      searchQuery,
    ),
    getTailoredJobsCount(
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
        activeTab="tailored"
        tabCounts={tabCounts}
        currentPage={currentPage}
        title="Tailored & Ready"
        subtitle={`Custom ATS-tailored resumes generated and ready to submit (${totalCount} total)`}
      />

      <Suspense fallback={<JobListSkeleton />}>
        <TopMatchesList
          jobs={tailoredJobs}
          currentPage={currentPage}
          totalPages={totalPages}
          title="Tailored Resumes"
          emptyTitle="No tailored resumes yet"
          emptyMessage="No customized resumes found for this filter. Go to Top Matches to tailor your first resume for a high-matching job."
        />
      </Suspense>
    </div>
  );
}

export const dynamic = "force-dynamic";
