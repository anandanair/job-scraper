"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  ArrowLeft,
} from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import Toast, { ToastData } from "./applied/Toast";
import { Job } from "@/types";

interface JobDetailsClientProps {
  initialJob: Job;
}

export default function JobDetailsClient({
  initialJob,
}: JobDetailsClientProps) {
  const [job, setJob] = useState<Job>(initialJob);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingInterest, setIsUpdatingInterest] = useState(false);
  const [isGeneratingResume, setIsGeneratingResume] = useState(false);
  const [isRescoring, setIsRescoring] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const hasCustomResume = Boolean(
    job.customized_resume_id ||
    job.resume_link ||
    job.customized_resumes?.resume_link
  );

  // Rescore is ONLY available if a custom resume exists and the score is still based on the initial base resume
  const canRescore = Boolean(hasCustomResume && job.resume_score_stage === "initial");

  const handleViewResume = (
    job_id: string,
    resume_id: string | null | undefined
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("source", window.location.pathname);
    router.push(`/jobs/${job_id}/resumes/${resume_id}?${params.toString()}`);
  };

  const handleGenerateCustomResume = async () => {
    if (job.is_interested === false) {
      showToast("Cannot customize resume: this job is marked as Not Interested.", "error");
      return;
    }
    setIsGeneratingResume(true);
    try {
      const res = await fetch(`/api/jobs/${job.job_id}/customize-resume`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to customize resume");
      }

      setJob((prev) => ({
        ...prev,
        customized_resume_id: data.customized_resume_id,
        customized_resumes: {
          ...(prev.customized_resumes || ({} as any)),
          resume_link: data.resume_link,
        },
        resume_score: data.resume_score ?? prev.resume_score,
        resume_score_stage: data.resume_score_stage ?? prev.resume_score_stage,
      }));

      showToast("Custom resume generated and job rescored successfully!", "success");
      router.refresh();
    } catch (err: any) {
      console.error("Error generating custom resume:", err);
      showToast(err.message, "error");
    } finally {
      setIsGeneratingResume(false);
    }
  };

  const handleRescore = async () => {
    if (!canRescore) return;
    setIsRescoring(true);
    try {
      const res = await fetch(`/api/jobs/${job.job_id}/rescore`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to rescore job");
      }

      setJob((prev) => ({
        ...prev,
        resume_score: data.resume_score,
        resume_score_stage: data.resume_score_stage,
      }));

      showToast(`Job rescored with custom resume! New score: ${data.resume_score}/100`, "success");
      router.refresh();
    } catch (err: any) {
      console.error("Error rescoring job:", err);
      showToast(err.message, "error");
    } finally {
      setIsRescoring(false);
    }
  };

  const handleMarkAsApplied = async () => {
    if (job.status === "applied") {
      return;
    }

    setIsUpdating(true);
    try {
      const currentDate = new Date().toISOString();
      const response = await fetch(`/api/jobs/${job.job_id}`, {
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
      setJob(updatedJob);
      showToast("Job marked as applied successfully!", "success", () =>
        handleUndoApplied(updatedJob)
      );
      router.refresh();
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
    setIsUpdatingInterest(true);
    let finalInterestValue: boolean | null;

    if (job.is_interested === newInterestValue) {
      finalInterestValue = null;
    } else {
      finalInterestValue = newInterestValue;
    }

    try {
      const response = await fetch(`/api/jobs/${job.job_id}`, {
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
      setJob(updatedJob);

      const message =
        finalInterestValue === true
          ? "Job marked as Interested!"
          : finalInterestValue === false
            ? "Job marked as Not Interested. Excluded from resume tailoring."
            : "Interest preference cleared.";
      showToast(message, "success");
      router.refresh();
    } catch (error) {
      console.error("Error setting job interest:", error);
      const message =
        error instanceof Error ? error.message : "An unknown error occurred.";
      showToast(`Error: ${message}`, "error");
    } finally {
      setIsUpdatingInterest(false);
    }
  };

  const showToast = (
    message: string,
    type: "success" | "error",
    onUndo?: () => void
  ) => {
    setToast({ id: Date.now(), message, type, onUndo });
  };

  // Revert the job out of the applied pipeline (toast Undo action)
  const handleUndoApplied = async (jobToUndo: Job) => {
    try {
      const response = await fetch(`/api/jobs/${jobToUndo.job_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "new",
          application_date: null,
          follow_up_at: null,
          next_event_at: null,
          next_event_label: null,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error || `HTTP error! status: ${response.status}`
        );
      }
      setJob((prev) => ({ ...prev, status: "new", application_date: "" }));
      showToast("Application reverted — job is back in your pipeline", "success");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unknown error occurred.";
      showToast(`Error: ${message}`, "error");
    }
  };

  let jobUrl;
  if (job.provider === "careers_future") {
    jobUrl = `https://www.mycareersfuture.gov.sg/job/${job.job_id}`;
  } else {
    jobUrl = `https://www.linkedin.com/jobs/view/${job.job_id}`;
  }

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden">
      {/* Back navigation */}
      <div className="px-6 pt-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      {/* Header section */}
      <div className="bg-gray-50 border-b border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">
              {job.job_title}
              </h1>
              {job.is_interested === true && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                  <ThumbsUp className="h-3 w-3 mr-1" />
                  Interested
                </span>
              )}
              {job.is_interested === false && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                  <ThumbsDown className="h-3 w-3 mr-1" />
                  Not Interested
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center text-gray-600 space-y-2 sm:space-y-0 sm:space-x-6">
              <div className="flex items-center">
                <BuildingIcon className="h-5 w-5 mr-2 text-gray-500" />
                <span>{job.company}</span>
              </div>
              <div className="flex items-center">
                <MapPinIcon className="h-5 w-5 mr-2 text-gray-500" />
                <span>{job.location}</span>
              </div>
              <div className="flex items-center">
                <SocialLink className="h-5 w-5 mr-2 text-gray-500" />
                <span className="capitalize">
                  {job.provider === "careers_future"
                    ? "MyCareersFuture"
                    : "LinkedIn"}
                </span>
              </div>
            </div>
          </div>

          {/* Prominent Score & Stage Display */}
          <div className="flex-shrink-0 mt-4 sm:mt-0 flex items-center space-x-3">
            {job.resume_score !== undefined && job.resume_score !== null ? (
              <div className="flex items-center space-x-3 bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm">
                <div
                  className={`p-2.5 rounded-lg ${
                    job.resume_score_stage === "custom"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-indigo-50 text-indigo-600"
                  }`}
                >
                  <BarChart3Icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-baseline space-x-1.5">
                    <span className="text-2xl font-bold text-gray-900">
                      {job.resume_score}
                    </span>
                    <span className="text-sm font-medium text-gray-400">/100</span>
                  </div>
                  <div className="mt-1">
                    {job.resume_score_stage === "custom" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        ✨ Tailored Resume Score
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                        📄 Base Resume Score
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2 bg-gray-50 px-4 py-3 rounded-xl border border-gray-200">
                <BarChart3Icon className="h-6 w-6 text-gray-400" />
                <div>
                  <span className="text-sm font-medium text-gray-500">Not Scored</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mt-6">
          <Link
            href={jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            View Job Listing
            <ExternalLink size={16} className="ml-2" />
          </Link>

          {/* View Customized Resume (if available) */}
          {hasCustomResume ? (
            <button
              onClick={() =>
                handleViewResume(
                  job.job_id,
                  job.customized_resume_id || (job.customized_resumes as any)?.id
                )
              }
              className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
            >
              View Customized Resume
              <FileText size={16} className="ml-2" />
            </button>
          ) : job.is_interested === false ? (
            <button
              disabled
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-400 text-sm font-medium rounded-md cursor-not-allowed border border-gray-200"
              title="This job is marked as Not Interested. Mark as Interested or clear preference to enable resume customization."
            >
              <ThumbsDown size={16} className="mr-2 text-red-400" />
              Excluded (Not Interested)
            </button>
          ) : (
            <button
              onClick={handleGenerateCustomResume}
              disabled={isGeneratingResume}
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
            >
              <Sparkles
                size={16}
                className={`mr-2 ${isGeneratingResume ? "animate-spin" : ""}`}
              />
              {isGeneratingResume
                ? "Tailoring Resume..."
                : "Generate Custom Resume"}
            </button>
          )}

          {/* Rescore with Custom Resume: ONLY rendered if custom resume exists AND score stage is still initial */}
          {canRescore && (
            <button
              onClick={handleRescore}
              disabled={isRescoring}
              className="inline-flex items-center px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50"
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

          {/* Mark as Applied */}
          {job.status !== "applied" ? (
            <button
              onClick={handleMarkAsApplied}
              disabled={isUpdating}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="inline-flex rounded-md shadow-sm sm:ml-auto">
            <button
              onClick={() => handleSetInterest(true)}
              disabled={isUpdatingInterest}
              className={`relative cursor-pointer inline-flex items-center px-3 py-2 rounded-l-md text-sm font-medium focus:z-10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  job.is_interested === true
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
            >
              <ThumbsUp
                size={16}
                className="mr-2"
                fill={job.is_interested === true ? "currentColor" : "none"}
              />
              Interested
            </button>

            <button
              onClick={() => handleSetInterest(false)}
              disabled={isUpdatingInterest}
              className={`relative cursor-pointer inline-flex items-center px-3 py-2 rounded-r-md text-sm font-medium focus:z-10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed border-l border-gray-300
                ${
                  job.is_interested === false
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
            >
              <ThumbsDown
                size={16}
                className="mr-2"
                fill={job.is_interested === false ? "currentColor" : "none"}
              />
              Not Interested
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Job Description
        </h2>
        <div className="prose max-w-none text-gray-700">
          <MarkdownRenderer content={job.description} />
        </div>
      </div>

      {/* Toast notifications */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
