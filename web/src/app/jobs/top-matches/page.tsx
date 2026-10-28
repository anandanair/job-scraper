import {
  getTopScoredJobs,
  getTopScoredJobsCount,
} from "@/lib/supabase/queries";
import TopMatchesList from "@/components/jobs/TopMatchesList";
import { Suspense } from "react";
import RefreshButton from "@/components/jobs/RefreshButton";
import FilterButton from "@/components/jobs/FilterButton";
import { Job } from "@/types";
import JobListSkeleton from "@/components/jobs/JobListSkeleton";
import SearchComponent from "@/components/jobs/SearchComponent"; // Added import

const PAGE_SIZE = 10; // Define page size

export default async function TopMatchesPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  // Get current page from search params, default to 1
  const currentPage = parseInt(params?.page as string) || 1;

  // Get search query from search params
  const searchQuery = params?.query as string;

  // Get provider filter from search params
  const provider = params?.provider as string;
  const providerFilter = provider && provider !== "all" ? provider : undefined;

  // Get interest filter from search params
  const interestParam = params?.interest as string;
  let interestFilter: boolean | null | undefined = undefined;
  if (interestParam === "true") {
    interestFilter = true;
  } else if (interestParam === "false") {
    interestFilter = false;
  } else if (interestParam === "null") {
    interestFilter = null;
  }

  // Get resume score filter from search params
  const minScoreParam = params?.minScore as string;
  const maxScoreParam = params?.maxScore as string;

  const minScore = minScoreParam ? parseInt(minScoreParam) : undefined;
  const maxScore = maxScoreParam ? parseInt(maxScoreParam) : undefined;

  // Fetch the jobs for the current page with filters and total count in parallel
  const [topJobs, totalCount] = await Promise.all([
    getTopScoredJobs(
      currentPage,
      PAGE_SIZE,
      providerFilter,
      minScore,
      maxScore,
      interestFilter,
      searchQuery
    ),
    getTopScoredJobsCount(
      providerFilter,
      minScore,
      maxScore,
      interestFilter,
      searchQuery
    ),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Display filter status
  const getFilterStatusText = () => {
    let statusText = "Showing jobs that best match your resume";
    const filtersApplied = [];

    if (searchQuery) {
      filtersApplied.push(`for "${searchQuery}"`);
    }

    if (providerFilter) {
      const providerName =
        providerFilter === "linkedin" ? "LinkedIn" : "Careers Future";
      filtersApplied.push(`${providerName} jobs`);
    }

    if (interestFilter !== undefined) {
      if (interestFilter === true) {
        filtersApplied.push("marked as Interested");
      } else if (interestFilter === false) {
        filtersApplied.push("marked as Not Interested");
      } else if (interestFilter === null) {
        filtersApplied.push("not yet marked for interest");
      }
    }

    if (minScore !== undefined && maxScore !== undefined) {
      filtersApplied.push(
        `with resume scores between ${minScore} and ${maxScore}`
      );
    } else if (minScore !== undefined) {
      filtersApplied.push(`with resume scores >= ${minScore}`);
    } else if (maxScore !== undefined) {
      filtersApplied.push(`with resume scores <= ${maxScore}`);
    }

    if (filtersApplied.length > 0) {
      statusText = `Showing ${filtersApplied.join(
        " "
      )} that best match your resume`;
    }

    return `${statusText} (${totalCount} total)`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Page header with actions */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Top Job Matches</h1>
          <p className="mt-1 text-sm text-gray-500">{getFilterStatusText()}</p>
        </div>

        <div className="flex items-center space-x-3">
          <SearchComponent /> {/* Added SearchComponent */}
          <FilterButton />
          <RefreshButton currentPage={currentPage} />
        </div>
      </div>

      {/* Main content with loading state */}
      <Suspense fallback={<JobListSkeleton />}>
        <TopMatchesList
          jobs={topJobs}
          currentPage={currentPage}
          totalPages={totalPages}
        />
      </Suspense>
    </div>
  );
}

// Optional: Add revalidation if needed
export const revalidate = 3600; // Revalidate once per hour
