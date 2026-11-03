import { notFound } from "next/navigation";
import {
  getJobById,
  getUserProfileByEmail,
  getCoverLetterByJobId,
} from "@/lib/supabase/queries";
import CoverLetterStudioClient from "@/components/jobs/CoverLetterStudioClient";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ job_id: string }>;
};

export default async function JobCoverLetterPage({ params }: PageProps) {
  const { job_id } = await params;

  if (!job_id) {
    notFound();
  }

  try {
    const [job, baseResume, coverLetter] = await Promise.all([
      getJobById(job_id),
      getUserProfileByEmail(),
      getCoverLetterByJobId(job_id),
    ]);

    if (!job) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-8">
          <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Job Not Found</h1>
          <p className="text-gray-600 mb-6">
            The job listing with ID <span className="font-mono bg-gray-100 px-1 rounded">{job_id}</span> could not be found.
          </p>
          <Link
            href="/jobs/top-matches"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
          >
            Back to Top Matches
          </Link>
        </div>
      );
    }

    return (
      <CoverLetterStudioClient
        job={job}
        baseResume={baseResume}
        initialCoverLetter={coverLetter}
      />
    );
  } catch (error) {
    console.error(`Error loading cover letter for job ${job_id}:`, error);
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-8">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Cover Letter</h1>
        <p className="text-gray-600 mb-6">There was an unexpected error retrieving this cover letter.</p>
        <Link
          href={`/jobs/${job_id}`}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
        >
          Back to Job Details
        </Link>
      </div>
    );
  }
}
