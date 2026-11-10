"use client";

import { useState, useEffect } from "react";
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
  Mail,
  Flame,
  Maximize2,
  Send,
  Award,
  Banknote,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import Toast, { ToastData } from "./applied/Toast";
import { OutreachDrawer } from "./OutreachDrawer";
import { InterviewPrepModal } from "./InterviewPrepModal";
import { CompanyIntelModal } from "./CompanyIntelModal";
import { Job } from "@/types";
import { useRouter, useSearchParams } from "next/navigation";

interface TopMatchesListProps {
  jobs: Job[];
  currentPage: number;
  totalPages: number;
  currentSort?: "total" | "dream" | "ats";
  title?: string;
  emptyTitle?: string;
  emptyMessage?: string;
}

export default function TopMatchesList({
  jobs,
  currentPage,
  totalPages,
  currentSort = "total",
  title = "Job Matches",
  emptyTitle = "No jobs found",
  emptyMessage = "No jobs found for this view. Try adjusting your search or checking back later.",
}: TopMatchesListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const handleSortChange = (newSort: string) => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    if (newSort === "total") {
      params.delete("sort");
    } else {
      params.set("sort", newSort);
    }
    params.set("page", "1");
    router.push(`/jobs/top-matches?${params.toString()}`);
  };
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingInterest, setIsUpdatingInterest] = useState(false);
  const [isGeneratingResume, setIsGeneratingResume] = useState(false);
  const [isRescoring, setIsRescoring] = useState(false);
  const [isOutreachOpen, setIsOutreachOpen] = useState(false);
  const [isInterviewPrepOpen, setIsInterviewPrepOpen] = useState(false);
  const [isCompanyIntelOpen, setIsCompanyIntelOpen] = useState(false);

  const hasCustomResume = Boolean(
    selectedJob?.customized_resume_id ||
      selectedJob?.resume_link ||
      (selectedJob?.customized_resumes &&
        ((Array.isArray(selectedJob.customized_resumes) &&
          selectedJob.customized_resumes.length > 0) ||
          typeof selectedJob.customized_resumes === "object"))
  );

  const hasCoverLetter = Boolean(
    Array.isArray(selectedJob?.cover_letters)
      ? selectedJob.cover_letters.length > 0
      : selectedJob?.cover_letters?.id
  );

  const canRescore = Boolean(
    hasCustomResume && selectedJob?.resume_score_stage === "initial"
  );

  const handleGenerateCustomResume = async () => {
    if (!selectedJob) return;
    if (selectedJob.is_interested === false) {
      showToast("Cannot customize resume: this job is marked as Not Interested.", "error");
      return;
    }
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
              dream_score: data.dream_score,
              total_score: data.total_score,
              score_breakdown: data.score_breakdown,
              resume_score_stage: data.resume_score_stage,
            }
          : null
      );
      const scoreDetail = data.dream_score !== null
        ? `Overall: ${data.total_score ?? data.resume_score}% (ATS: ${data.resume_score}, Dream: ${data.dream_score})`
        : `ATS Score: ${data.resume_score}/100`;
      showToast(`Job rescored with latest company intel! ${scoreDetail}`, "success");
      setIsCompanyIntelOpen(true);
      router.refresh();
    } catch (err: any) {
      console.error("Error rescoring job:", err);
      showToast(err.message, "error");
    } finally {
      setIsRescoring(false);
    }
  };

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
    params.set("selectedJobId", job_id);
    const queryString = params.toString();
    const sourcePath =
      typeof window !== "undefined"
        ? (queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname)
        : `/jobs/new?selectedJobId=${job_id}`;
    params.set("source", sourcePath);
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
      // Toast with Undo so accidental applications can be reverted
      showToast("Job marked as applied successfully!", "success", () =>
        handleUndoApplied(updatedJob)
      );
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

  // Toast state: real notifications with optional Undo action
  const [toast, setToast] = useState<ToastData | null>(null);
  const showToast = (
    message: string,
    type: "success" | "error",
    onUndo?: () => void
  ) => {
    setToast({ id: Date.now(), message, type, onUndo });
  };

  // Revert a job out of the applied pipeline (toast Undo action)
  const handleUndoApplied = async (job: Job) => {
    try {
      const response = await fetch(`/api/jobs/${job.job_id}`, {
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
      showToast("Application reverted — job is back in your pipeline", "success");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unknown error occurred.";
      showToast(`Error: ${message}`, "error");
    }
  };

  // Function to determine badge color based on resume score (0 - 100)
  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return "bg-emerald-100 text-emerald-800 border-emerald-300";
    if (score >= 60) return "bg-blue-100 text-blue-800 border-blue-300";
    if (score >= 40) return "bg-amber-100 text-amber-800 border-amber-300";
    return "bg-rose-100 text-rose-800 border-rose-300";
  };

  // Placeholder for empty state
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="bg-gray-100 p-6 rounded-full mb-4">
        <BuildingIcon className="h-12 w-12 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{emptyTitle}</h3>
      <p className="text-gray-500 max-w-sm">{emptyMessage}</p>
    </div>
  );

  const currentPathWithSearch = (() => {
    if (typeof window === "undefined") {
      return `/jobs/new?selectedJobId=${selectedJob?.job_id || ""}`;
    }
    const params = new URLSearchParams(searchParams.toString());
    if (selectedJob?.job_id) {
      params.set("selectedJobId", selectedJob.job_id);
    }
    const qs = params.toString();
    return qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  })();

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-17.5rem)] bg-gray-50 rounded-lg overflow-hidden shadow-sm">
      {/* Left Column: Job List */}
      <div className="w-full md:w-1/3 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-3.5 border-b border-gray-100 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-gray-900">{title}</h2>
            <p className="text-[11px] text-gray-500">
              {jobs.length} {jobs.length === 1 ? "result" : "results"}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-400 font-medium">Rank:</span>
            <select
              value={currentSort || "total"}
              onChange={(e) => handleSortChange(e.target.value)}
              className="px-2 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              <option value="total">⭐ Overall Fit</option>
              <option value="dream">🔥 Dream First</option>
              <option value="ats">📄 ATS First</option>
            </select>
          </div>
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
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
                        <span className="capitalize truncate">
                          {job.provider === "careers_future"
                            ? "MyCareersFuture"
                            : job.provider === "remote_ok"
                              ? "RemoteOK"
                              : job.provider}
                        </span>
                        {job.workplace_type && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-gray-100 text-gray-700 capitalize">
                            {job.workplace_type}
                          </span>
                        )}
                        {(job.salary_min || job.salary_max) && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {job.salary_currency || "$"}{job.salary_min ? (job.salary_min > 1000 ? `${Math.round(job.salary_min / 1000)}k` : job.salary_min) : ""}{job.salary_min && job.salary_max ? "-" : ""}{job.salary_max ? (job.salary_max > 1000 ? `${Math.round(job.salary_max / 1000)}k` : job.salary_max) : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                      {job.resume_score !== undefined && job.resume_score !== null ? (
                        <>
                          <div
                            className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getScoreBadgeColor(
                              job.total_score ?? job.resume_score,
                            )}`}
                          >
                            {job.total_score ?? job.resume_score}%
                          </div>
                          <div className="flex items-center gap-1 text-[10px]">
                            <span className="text-gray-500 font-medium" title="ATS Resume Score">
                              📄 {job.resume_score}%
                            </span>
                            {job.dream_score !== undefined && job.dream_score !== null && (
                              <span
                                className="inline-flex items-center gap-0.5 font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded"
                                title="Dream Match Score"
                              >
                                <Flame size={9} className="text-amber-600" />
                                {job.dream_score}%
                              </span>
                            )}
                            {job.score_breakdown?.company_intel?.glassdoor_rating && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[9px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-1 py-0.2 rounded"
                                title={`Glassdoor Rating: ${job.score_breakdown.company_intel.glassdoor_rating}/5.0`}
                              >
                                ★ {job.score_breakdown.company_intel.glassdoor_rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full whitespace-nowrap">
                          ⏳ Pending
                        </span>
                      )}
                    </div>
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
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {selectedJob.job_title}
                    </h2>
                    <Link
                      href={`/jobs/${selectedJob.job_id}?source=${encodeURIComponent(currentPathWithSearch)}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200 shadow-2xs shrink-0 cursor-pointer"
                      title="Open full page view for this job"
                    >
                      <Maximize2 size={13} />
                      <span className="hidden sm:inline">Full Page</span>
                    </Link>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center text-gray-600 gap-y-1.5 gap-x-4 text-sm">
                    <div className="flex items-center">
                      <BuildingIcon className="h-4 w-4 mr-1.5 text-gray-500 shrink-0" />
                      <span>{selectedJob.company}</span>
                    </div>
                    <div className="flex items-center">
                      <MapPinIcon className="h-4 w-4 mr-1.5 text-gray-500 shrink-0" />
                      <span>{selectedJob.location}</span>
                    </div>
                    {selectedJob.workplace_type && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider ${
                        selectedJob.workplace_type === "remote"
                          ? "bg-purple-100 text-purple-800 border border-purple-200"
                          : selectedJob.workplace_type === "hybrid"
                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                            : "bg-gray-100 text-gray-800 border border-gray-200"
                      }`}>
                        {selectedJob.workplace_type === "remote" ? "🌐 100% Remote" : selectedJob.workplace_type === "hybrid" ? "🏢 Hybrid" : "📍 On-Site"}
                      </span>
                    )}
                    {(selectedJob.salary_min || selectedJob.salary_max) && (
                      <div className="flex items-center text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-xs">
                        <Banknote className="h-3.5 w-3.5 mr-1 text-emerald-600 shrink-0" />
                        <span>
                          {selectedJob.salary_currency || "USD"}{" "}
                          {selectedJob.salary_min ? selectedJob.salary_min.toLocaleString() : ""}
                          {selectedJob.salary_min && selectedJob.salary_max ? " - " : ""}
                          {selectedJob.salary_max ? selectedJob.salary_max.toLocaleString() : ""}{" "}
                          / {selectedJob.salary_period || "mo"}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center">
                      <SocialLink className="h-4 w-4 mr-1.5 text-gray-500 shrink-0" />
                      <span className="capitalize truncate">
                        {selectedJob.provider === "careers_future"
                          ? "MyCareersFuture"
                          : selectedJob.provider === "remote_ok"
                            ? "RemoteOK"
                            : selectedJob.provider || "LinkedIn"}
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
                        <div className="flex items-baseline space-x-1.5">
                          <span className="text-xl font-bold text-gray-900">
                            {selectedJob.total_score ?? selectedJob.resume_score}%
                          </span>
                          <span className="text-xs font-semibold text-gray-500">
                            Match
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
                          <span className="text-gray-500 font-medium">📄 ATS: {selectedJob.resume_score}%</span>
                          {selectedJob.dream_score !== undefined && selectedJob.dream_score !== null && (
                            <button
                              type="button"
                              onClick={() => setIsCompanyIntelOpen(true)}
                              className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 hover:border-amber-300 px-1.5 py-0.5 rounded cursor-pointer transition-colors group"
                              title="Click to view transparent Dream Match breakdown & company reviews"
                            >
                              🔥 Dream: {selectedJob.dream_score}%
                              <span className="text-[9px] text-amber-600 font-normal underline underline-offset-1 group-hover:text-amber-900">
                                Intel →
                              </span>
                            </button>
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
                ) : selectedJob.is_interested === false ? (
                  <button
                    disabled
                    className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-400 text-sm font-medium rounded-md cursor-not-allowed border border-gray-200"
                    title="This job is marked as Not Interested. Mark as Interested or unmark to enable resume customization."
                  >
                    <ThumbsDown size={16} className="mr-2 text-red-400" />
                    Excluded (Not Interested)
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

                {/* Custom Cover Letter (On-Demand) */}
                <Link
                  href={`/jobs/${selectedJob.job_id}/cover-letter?source=${encodeURIComponent(currentPathWithSearch)}`}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer ${
                    hasCoverLetter
                      ? "bg-purple-100 text-purple-800 hover:bg-purple-200 border border-purple-300 focus:ring-purple-500"
                      : "bg-indigo-600 text-white hover:bg-indigo-700 border border-transparent focus:ring-indigo-500 shadow-sm"
                  }`}
                  title={hasCoverLetter ? "View and edit tailored cover letter" : "Generate a custom cover letter with AI"}
                >
                  {hasCoverLetter ? (
                    <>
                      <Mail size={16} className="mr-2 text-purple-700" />
                      View Cover Letter
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} className="mr-2" />
                      Generate Cover Letter
                    </>
                  )}
                </Link>

                {/* Outreach Copilot (On-Demand Networking) */}
                <button
                  onClick={() => setIsOutreachOpen(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
                  title="Generate personalized LinkedIn connection note or cold inmail"
                >
                  <Send size={16} className="mr-2" />
                  Outreach Note
                </button>

                {/* Interview Prep Copilot (On-Demand Preparation) */}
                <button
                  onClick={() => setIsInterviewPrepOpen(true)}
                  className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition-colors shadow-2xs cursor-pointer"
                  title="Generate role-specific technical questions and STAR answers"
                >
                  <Award size={16} className="mr-2" />
                  Interview Prep
                </button>

                {/* Company Intelligence & Live Rescore Companion Group */}
                <div className="inline-flex items-center rounded-xl p-1 bg-slate-900 border border-slate-800 shadow-2xs">
                  <button
                    onClick={() => setIsCompanyIntelOpen(true)}
                    className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/90 hover:bg-slate-700/90 text-white transition-all shadow-xs cursor-pointer gap-2"
                    title="Inspect Glassdoor ratings, employee review sentiment, and transparent Dream Score rubric"
                  >
                    <BuildingIcon size={15} className="text-indigo-400" />
                    <span>Company Intel</span>
                    {selectedJob.score_breakdown?.company_intel?.glassdoor_rating ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-bold border border-amber-400/30">
                        ★ {selectedJob.score_breakdown.company_intel.glassdoor_rating.toFixed(1)}
                      </span>
                    ) : selectedJob.score_breakdown?.company_intel?.source_snippets?.length ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-semibold border border-emerald-400/30">
                        Indexed
                      </span>
                    ) : null}
                  </button>

                  <div className="h-4 w-px bg-slate-700/80 mx-1" />

                  <button
                    onClick={handleRescore}
                    disabled={isRescoring}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-300 hover:text-amber-200 hover:bg-slate-800/80 transition-all disabled:opacity-50 cursor-pointer gap-1.5"
                    title="Fetch fresh live employer reviews from the web and rescore this job immediately"
                  >
                    <RefreshCw
                      size={14}
                      className={`text-amber-400 ${isRescoring ? "animate-spin" : ""}`}
                    />
                    <span>{isRescoring ? "Rescoring..." : "Live Rescore"}</span>
                  </button>
                </div>

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

            {/* AI Match Analysis & Skill Gap Drawer */}
            {selectedJob.score_breakdown && (
              <div className="bg-gradient-to-r from-gray-50 to-indigo-50/20 border-b border-gray-200 p-6 space-y-4">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-base font-bold text-gray-900">AI Match Analysis & Skill Insights</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Matched Skills */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Matched Core Skills ({selectedJob.score_breakdown.matched_skills?.length || 0})
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(selectedJob.score_breakdown.matched_skills || []).length > 0 ? (
                        selectedJob.score_breakdown.matched_skills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200"
                          >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500">No direct skill keywords extracted</span>
                      )}
                    </div>
                  </div>

                  {/* Skill Gaps */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      Missing / Skill Gaps ({selectedJob.score_breakdown.skill_gaps?.length || 0})
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(selectedJob.score_breakdown.skill_gaps || []).length > 0 ? (
                        selectedJob.score_breakdown.skill_gaps.map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 text-amber-800 border border-amber-200"
                          >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-emerald-600 font-medium">No major missing skills identified!</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Red flags warning if any */}
                {selectedJob.score_breakdown.red_flags && selectedJob.score_breakdown.red_flags.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start space-x-2.5">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-1">Detected Job Red Flags:</span>
                      <ul className="list-disc list-inside space-y-0.5">
                        {selectedJob.score_breakdown.red_flags.map((rf, idx) => (
                          <li key={idx}>{rf}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Actionable Advice */}
                {selectedJob.score_breakdown.actionable_advice && (
                  <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-100 text-xs text-indigo-900 leading-relaxed flex items-start space-x-2.5">
                    <Sparkles className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Career Coach Recommendation: </span>
                      <span>{selectedJob.score_breakdown.actionable_advice}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

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

      {/* Modals & Drawers */}
      {selectedJob && (
        <>
          <OutreachDrawer
            job={selectedJob}
            isOpen={isOutreachOpen}
            onClose={() => setIsOutreachOpen(false)}
          />
          <InterviewPrepModal
            job={selectedJob}
            isOpen={isInterviewPrepOpen}
            onClose={() => setIsInterviewPrepOpen(false)}
          />
          <CompanyIntelModal
            job={selectedJob}
            isOpen={isCompanyIntelOpen}
            onClose={() => setIsCompanyIntelOpen(false)}
            onRescore={handleRescore}
            isRescoring={isRescoring}
          />
        </>
      )}

      {/* Toast notifications */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
