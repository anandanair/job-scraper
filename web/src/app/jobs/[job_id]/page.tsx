import { getJobById } from "@/lib/supabase/queries";
import { Job } from "@/types";
import { notFound } from "next/navigation";
import JobDetailsClient from "@/components/jobs/JobDetailsClient"; // Import the new client component
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

type PageProps = {
  params: Promise<{ job_id: string }>;
};

export default async function JobDetailPage({ params }: PageProps) {
  const { job_id } = await params;

  if (!job_id) {
    // This case should ideally be handled by Next.js routing if job_id is missing in URL
    console.error("Job ID is missing from params.");
    notFound(); // Or return a more specific error component
  }

  try {
    const jobDetails: Job | null = await getJobById(job_id);

    if (!jobDetails) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-8">
          <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Job Not Found
          </h1>
          <p className="text-gray-600">
            The job you are looking for with ID:{" "}
            <span className="font-mono bg-gray-100 px-1 rounded">{job_id}</span>{" "}
            could not be found.
          </p>
          <Link
            href="/jobs/top-matches"
            className="mt-6 inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
          >
            Back to Top Matches
          </Link>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <JobDetailsClient initialJob={jobDetails} />
      </div>
    );
  } catch (error) {
    console.error(`Error fetching job details for ID ${job_id}:`, error);
    // Render a more user-friendly error page or component
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-8">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Error Loading Job
        </h1>
        <p className="text-gray-600 mb-4">
          There was an error trying to load the job details. Please try again
          later.
        </p>
        <p className="text-sm text-gray-500">
          If the issue persists, contact support with Job ID:{" "}
          <span className="font-mono bg-gray-100 px-1 rounded">{job_id}</span>.
        </p>
        <Link
          href="/jobs/top-matches"
          className="mt-6 inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
        >
          Back to Top Matches
        </Link>
      </div>
    );
  }
}

// Optional: Add revalidation if job data can change frequently
// export const revalidate = 3600; // Revalidate every hour
