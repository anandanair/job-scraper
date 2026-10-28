"use client";

import { useState, useEffect } from "react"; // Added useEffect
import Link from "next/link";
import PaginationControls from "./PaginationControls";
import {
  ExternalLink,
  CheckCircle,
  ThumbsUp,
  ThumbsDown,
  BuildingIcon,
  MapPinIcon,
  BarChart3Icon,
  FileText,
  Link as SocialLink,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import { Job } from "@/types";
import { useRouter, useSearchParams } from "next/navigation"; // Added useSearchParams

interface TopMatchesListProps {
  jobs: Job[];
  currentPage: number;
  totalPages: number;
}

export default function TopMatchesList({
  jobs,
  currentPage,
  totalPages,
}: TopMatchesListProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null); // Initialize as null
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingInterest, setIsUpdatingInterest] = useState(false);
  const [isGeneratingResume, setIsGeneratingResume] = useState(false);
  const [isRescoring, setIsRescoring] = useState(false);

  const hasCustomResume = Boolean(
    selectedJob?.customized_resume_id ||
      selectedJob?.resume_link ||
      (selectedJob?.customized_resumes &&
        ((Array.isArray(selectedJob.customized_resumes) &&
          selectedJob.customized_resumes.length > 0) ||
          typeof selectedJob.customized_resumes === "object"))
  );

  const canRescore = Boolean(
    hasCustomResume && selectedJob?.resume_score_stage === "initial"
  );

  const handleGenerateCustomResume = async () => {
    if (!selectedJob) return;
    setIsGeneratingResume(true);
    try {
      const res = await fetch(`/api/jobs/${selectedJob.job_id}/customize-resume`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to customize resume");
      }
      setSelectedJob((prev) =>
        prev
          ? {
              ...prev,
              customized_resume_id: data.customized_resume_id,
              resume_link: data.resume_link,
              resume_score: data.resume_score ?? prev.resume_score,
              resume_score_stage: data.resume_score_stage ?? prev.resume_score_stage,
            }
          : null
      );
      showToast("Custom resume generated and job rescored successfully!", "success");
      router.refresh();
    } catch (err: any) {
      console.error("Error generating resume:", err);
      showToast(err.message, "error");
    } finally {
      setIsGeneratingResume(false);
    }
  };

  const handleRescore = async () => {
    if (!selectedJob) return;
    setIsRescoring(true);
    try {
      const res = await fetch(`/api/jobs/${selectedJob.job_id}/rescore`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to rescore job");
      }
      setSelectedJob((prev) =>
        prev
          ? {
              ...prev,
              resume_score: data.resume_score,
              resume_score_stage: data.resume_score_stage,
            }
          : null
      );
      showToast(`Job rescored! New score: ${data.resume_score}/100 (${data.resume_score_stage})`, "success");
      router.refresh();
    } catch (err: any) {
      console.error("Error rescoring job:", err);
      showToast(err.message, "error");
    } finally {
      setIsRescoring(false);
    }
  };
  const router = useRouter();
  const searchParams = useSearchParams(); // Get searchParams

  useEffect(() => {
    const selectedJobIdFromUrl = searchParams.get("selectedJobId");
    let jobToSelect: Job | null = null;

    if (selectedJobIdFromUrl) {
      // Try to find the job from the URL ID in the *current* jobs list
      jobToSelect =
        jobs.find((job) => job.job_id === selectedJobIdFromUrl) || null;
    }

    // If job from URL ID is not found (jobToSelect is null) or no ID in URL,
    // and there are jobs in the list, default to the first job.
    if (!jobToSelect && jobs.length > 0) {
      jobToSelect = jobs[0];
      // Update URL with the default selected job ID if it's missing
      if (!selectedJobIdFromUrl) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("selectedJobId", jobToSelect.job_id);
        router.replace(`${window.location.pathname}?${params.toString()}`, {
          scroll: false,
        });
      }
    }
    // If jobs list is empty, ensure jobToSelect is null.
    else if (jobs.length === 0) {
      jobToSelect = null;
    }

    // Update state only if the selected job (by ID) is different,
    // or if jobToSelect is null and selectedJob is not (or vice-versa).
    if (selectedJob?.job_id !== jobToSelect?.job_id) {
      setSelectedJob(jobToSelect);
    }
  }, [jobs, searchParams]); // Dependencies are jobs and searchParams

  const handleViewResume = (
    job_id: string,
    resume_id: string | null | undefined,
  ) => {
    // Preserve current search params and add source page info
    const params = new URLSearchParams(searchParams.toString());
    if (selectedJob) {
      params.set("selectedJobId", selectedJob.job_id);
    }
    params.set("source", window.location.pathname);
    router.push(`/jobs/${job_id}/resumes/${resume_id}?${params.toString()}`);
  };

  const handleJobSelect = (job: Job) => {
    setSelectedJob(job);
    // Update URL with selected job ID without adding to history
    const params = new URLSearchParams(searchParams.toString());
    params.set("selectedJobId", job.job_id);
    // Use replace to avoid polluting browser history for selections on the same page
    router.replace(`${window.location.pathname}?${params.toString()}`, {
      scroll: false,
    });
  };

  const handleMarkAsApplied = async () => {
    if (!selectedJob || selectedJob.status === "applied") {
      return;
    }

    setIsUpdating(true);
    try {
      const currentDate = new Date().toISOString();
      const response = await fetch(`/api/jobs/${selectedJob.job_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "applied",
          application_date: currentDate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage =
          errorData?.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      const updatedJob: Job = await response.json();
      setSelectedJob(updatedJob);
      // Toast notification instead of alert
      showToast("Job marked as applied successfully!", "success");
      router.refresh(); // Refresh the page to show updated jobs
    } catch (error) {
      console.error("Error marking job as applied:", error);
      const message =
        error instanceof Error ? error.message : "An unknown error occurred.";
      showToast(`Error: ${message}`, "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetInterest = async (newInterestValue: boolean | null) => {
    if (!selectedJob) {
      return;
    }

    setIsUpdatingInterest(true);
    let finalInterestValue: boolean | null;

    // If the button clicked matches the current state, set to null (toggle off)
    if (selectedJob.is_interested === newInterestValue) {
      finalInterestValue = null;
    } else {
      finalInterestValue = newInterestValue;
    }

    try {
      const response = await fetch(`/api/jobs/${selectedJob.job_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_interested: finalInterestValue,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage =
          errorData?.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      const updatedJob: Job = await response.json();
      setSelectedJob(updatedJob);

      // Show toast instead of alert
      const message =
        finalInterestValue === true
          ? "Marked as interested"
          : finalInterestValue === false
            ? "Marked as not interested"
            : "Interest status cleared";
      showToast(message, "success");
      router.refresh(); // Refresh the page to show updated jobs
    } catch (error) {
      console.error("Error updating job interest:", error);
      const message =
        error instanceof Error ? error.message : "An unknown error occurred.";
      showToast(`Error: ${message}`, "error");
    } finally {
      setIsUpdatingInterest(false);
    }
  };

  // Simple toast notification function (you may want to replace with a proper toast library)
  const showToast = (message: string, type: "success" | "error") => {
    // This is a placeholder - you would implement a proper toast notification
    // Consider using react-hot-toast, react-toastify, or a similar library
    console.log(`Toast (${type}): ${message}`);
    // For now, we'll use a simple alert as a fallback
    if (type === "error") {
      alert(message);
    }
  };

  // Function to determine badge color based on resume score
  const getScoreBadgeColor = (score: number) => {
    if (score >= 0.8) return "bg-green-100 text-green-800 border-green-300";
    if (score >= 0.6) return "bg-blue-100 text-blue-800 border-blue-300";
    if (score >= 0.4) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-gray-100 text-gray-800 border-gray-300";
  };

  // Placeholder for empty state
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="bg-gray-100 p-6 rounded-full mb-4">
        <BuildingIcon className="h-12 w-12 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
      <p className="text-gray-500 max-w-sm">
        No top-matched jobs found for this page. Try adjusting your search or
        checking back later.
      </p>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-17.5rem)] bg-gray-50 rounded-lg overflow-hidden shadow-sm">
      {/* Left Column: Job List */}
      <div className="w-full md:w-1/3 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Job Matches</h2>
          <p className="text-sm text-gray-500">
            {jobs.length} {jobs.length === 1 ? "result" : "results"} found
          </p>
        </div>

        {jobs.length > 0 ? (
          <>
            <ul className="divide-y divide-gray-100 overflow-y-auto flex-grow">
              {jobs.map((job) => (
                <li
                  key={job.job_id}
                  onClick={() => handleJobSelect(job)}
                  className={`p-4 cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                    selectedJob?.job_id === job.job_id
                      ? "bg-indigo-50 border-l-4 border-indigo-500"
                      : "border-l-4 border-transparent"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-md font-medium text-gray-900 truncate">
                        {job.job_title}
                      </h3>
                      <div className="mt-1 flex items-center text-sm text-gray-500">
                        <BuildingIcon className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                        <span className="truncate">{job.company}</span>
                      </div>
                      <div className="mt-1 flex items-center text-sm text-gray-500">
                        <MapPinIcon className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                        <span className="truncate">{job.location}</span>
                      </div>
                      <div className="mt-1 flex items-center text-xs text-gray-400">
                        <SocialLink className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="capitalize truncate">
                          {job.provider === "careers_future"
                            ? "MyCareersFuture"
                            : "LinkedIn"}
                        </span>
                      </div>
                    </div>

                    {job.resume_score !== undefined && job.resume_score !== null && (
                      <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                        <div
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getScoreBadgeColor(
                            job.resume_score,
                          )}`}
                        >
                          {job.resume_score}
                        </div>
                        {job.resume_score_stage === "custom" ? (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                            ✨ Tailored
                          </span>
                        ) : job.resume_score_stage === "initial" ? (
                          <span className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                            📄 Base
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* Status indicators */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Boolean(
                      job.customized_resume_id ||
                        job.resume_link ||
                        (job.customized_resumes &&
                          ((Array.isArray(job.customized_resumes) &&
                            job.customized_resumes.length > 0) ||
                            typeof job.customized_resumes === "object"))
                    ) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Custom Resume
                      </span>
                    )}
                    {job.status === "applied" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Applied
                      </span>
                    )}
                    {job.is_interested === true && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <ThumbsUp className="h-3 w-3 mr-1" />
                        Interested
                      </span>
                    )}
                    {job.is_interested === false && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <ThumbsDown className="h-3 w-3 mr-1" />
                        Not Interested
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-100 bg-white">
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                />
              </div>
            )}
          </>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Right Column: Job Details */}
      <div className="w-full md:w-2/3 bg-white overflow-y-auto">
        {selectedJob ? (
          <div className="h-full flex flex-col">
            {/* Header section with fixed position */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedJob.job_title}
                  </h2>
                  <div className="mt-2 flex items-center text-gray-700 space-x-4">
                    <div className="flex items-center">
                      <BuildingIcon className="h-4 w-4 mr-1.5 text-gray-500" />
                      <span>{selectedJob.company}</span>
                    </div>
                    <div className="flex items-center">
                      <MapPinIcon className="h-4 w-4 mr-1.5 text-gray-500" />
                      <span>{selectedJob.location}</span>
                    </div>
                    <div className="flex items-center">
                      <SocialLink className="h-4 w-4 mr-1.5 text-gray-500" />
                      <span className="capitalize truncate">
                        {selectedJob.provider === "careers_future"
                          ? "MyCareersFuture"
                          : "LinkedIn"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Prominent Score & Stage Display */}
                <div className="flex-shrink-0 flex items-center space-x-3">
                  {selectedJob.resume_score !== undefined &&
                  selectedJob.resume_score !== null ? (
                    <div className="flex items-center space-x-3 bg-white px-3.5 py-2 rounded-xl border border-gray-200 shadow-sm">
                      <div
                        className={`p-2 rounded-lg ${
                          selectedJob.resume_score_stage === "custom"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-indigo-50 text-indigo-600"
                        }`}
                      >
                        <BarChart3Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-baseline space-x-1">
                          <span className="text-xl font-bold text-gray-900">
                            {selectedJob.resume_score}
                          </span>
                          <span className="text-xs font-medium text-gray-400">
                            /100
                          </span>
                        </div>
                        <div className="mt-0.5">
                          {selectedJob.resume_score_stage === "custom" ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ✨ Tailored Resume Score
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                              📄 Base Resume Score
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
                      <BarChart3Icon className="h-5 w-5 text-gray-400" />
                      <span className="text-xs font-medium text-gray-500">
                        Not Scored
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 mt-5">
                {(() => {
                  // Determine the job listing URL based on the provider
                  let jobUrl;
                  if (selectedJob.provider === "careers_future") {
                    jobUrl = `https://www.mycareersfuture.gov.sg/job/${selectedJob.job_id}`;
                  } else {
                    // Default to LinkedIn for "linkedin" provider or any other/undefined provider
                    jobUrl = `https://www.linkedin.com/jobs/view/${selectedJob.job_id}`;
                  }

                  return (
                    <Link
                      href={jobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      View Job Listing
                      <ExternalLink size={16} className="ml-2" />
                    </Link>
                  );
                })()}

                {hasCustomResume ? (
                  <button
                    onClick={() =>
                      handleViewResume(
                        selectedJob.job_id,
                        selectedJob.customized_resume_id ||
                          (selectedJob.customized_resumes as any)?.id,
                      )
                    }
                    className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    View Customized Resume
                    <FileText size={16} className="ml-2" />
                  </button>
                ) : (
                  <button
                    onClick={handleGenerateCustomResume}
                    disabled={isGeneratingResume}
                    className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles
                      size={16}
                      className={`mr-2 ${isGeneratingResume ? "animate-spin" : ""}`}
                    />
                    {isGeneratingResume
                      ? "Tailoring..."
                      : "Generate Custom Resume"}
                  </button>
                )}

                {canRescore && (
                  <button
                    onClick={handleRescore}
                    disabled={isRescoring}
                    className="inline-flex items-center px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 cursor-pointer"
                    title="Rescore this job against your customized resume"
                  >
                    <RefreshCw
                      size={16}
                      className={`mr-2 ${isRescoring ? "animate-spin" : ""}`}
                    />
                    {isRescoring
                      ? "Rescoring with Custom Resume..."
                      : "Rescore with Custom Resume"}
                  </button>
                )}

                {selectedJob.status !== "applied" ? (
                  <button
                    onClick={handleMarkAsApplied}
                    disabled={isUpdating}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <CheckCircle size={16} className="mr-2" />
                    {isUpdating ? "Updating..." : "Mark as Applied"}
                  </button>
                ) : (
                  <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 text-sm font-medium rounded-md">
                    <CheckCircle size={16} className="mr-2" />
                    Applied
                  </div>
                )}

                {/* Interest buttons */}
                <div className="inline-flex rounded-md shadow-sm">
                  <button
                    onClick={() => handleSetInterest(true)}
                    disabled={isUpdatingInterest}
                    className={`relative cursor-pointer inline-flex items-center px-3 py-2 rounded-l-md text-sm font-medium focus:z-10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed
                      ${
                        selectedJob.is_interested === true
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                  >
                    <ThumbsUp
                      size={16}
                      className="mr-2"
                      fill={
                        selectedJob.is_interested === true
                          ? "currentColor"
                          : "none"
                      }
                    />
                    Interested
                  </button>

                  <button
                    onClick={() => handleSetInterest(false)}
                    disabled={isUpdatingInterest}
                    className={`relative cursor-pointer inline-flex items-center px-3 py-2 rounded-r-md text-sm font-medium focus:z-10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed border-l border-gray-300
                      ${
                        selectedJob.is_interested === false
                          ? "bg-red-600 text-white hover:bg-red-700"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                  >
                    <ThumbsDown
                      size={16}
                      className="mr-2"
                      fill={
                        selectedJob.is_interested === false
                          ? "currentColor"
                          : "none"
                      }
                    />
                    Not Interested
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable content for description */}
            <div className="p-6 flex-grow">
              <div className="prose max-w-none">
                <MarkdownRenderer content={selectedJob.description} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <EmptyState />
          </div>
        )}
      </div>
    </div>
  );
}
