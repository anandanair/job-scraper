import { Suspense } from "react";
import { getAppliedJobs, getAppliedJobsCount, getAppliedStatusCounts } from "@/lib/supabase/queries";
import AppliedJobsList from "@/components/jobs/AppliedJobsList";
import JobListSkeleton from "@/components/jobs/JobListSkeleton";
import SearchComponent from "@/components/jobs/SearchComponent";
import FilterButton from "@/components/jobs/FilterButton";
import RefreshButton from "@/components/jobs/RefreshButton";

const PAGE_SIZE = 10;
/** Days an "applied" application can sit untouched before a follow-up hint appears */
const FOLLOW_UP_THRESHOLD_DAYS = 7;

export default async function AppliedJobsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const currentPage = parseInt(params?.page as string) || 1;
  const searchQuery = params?.query as string;

  const provider = params?.provider as string;
  const providerFilter = provider && provider !== "all" ? provider : undefined;

  const applicationStatus = params?.applicationStatus as string;
  const applicationStatusFilter =
    applicationStatus && applicationStatus !== "all"
      ? applicationStatus
      : undefined;

  const sortBy = params?.sortBy as string;
  const sortOrder = params?.sortOrder as string;

  const [appliedJobs, totalCount, statusCounts] = await Promise.all([
    getAppliedJobs(
      currentPage,
      PAGE_SIZE,
      providerFilter,
      searchQuery,
      applicationStatusFilter,
      sortBy,
      sortOrder
    ),
    getAppliedJobsCount(providerFilter, searchQuery, applicationStatusFilter),
    getAppliedStatusCounts(),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Page header with actions */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Application Tracker
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Track every application, follow up on time, and never miss an
            interview
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <SearchComponent />
          <FilterButton
            interestOptions={false}
            scoreOptions={false}
            applicationStatusOptions={true}
          />
          <RefreshButton currentPage={currentPage} />
        </div>
      </div>

      {/* Main content with loading state */}
      <Suspense fallback={<JobListSkeleton />}>
        <AppliedJobsList
          jobs={appliedJobs}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          statusCounts={statusCounts}
          followUpThresholdDays={FOLLOW_UP_THRESHOLD_DAYS}
        />
      </Suspense>
    </div>
  );
}

export const dynamic = "force-dynamic";
