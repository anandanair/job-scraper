"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import PaginationControls from "./PaginationControls";
import {
  ExternalLink,
  CheckCircle,
  ThumbsUp,
  ThumbsDown,
  BuildingIcon,
  FileText,
  RefreshCw,
  Mail,
  Maximize2,
  Send,
  Award,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Sparkles,
  Banknote,
} from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import Toast, { ToastData } from "./applied/Toast";
import { OutreachDrawer } from "./OutreachDrawer";
import { InterviewPrepModal } from "./InterviewPrepModal";
import { CompanyIntelModal } from "./CompanyIntelModal";
import { Job } from "@/types";
import { useRouter, useSearchParams } from "next/navigation";
import { useRealtimeJobs } from "@/components/providers/RealtimeJobsProvider";

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
  const { markJobMutated } = useRealtimeJobs();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isInsightsExpanded, setIsInsightsExpanded] = useState(true);

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

  const [generatingResumeJobIds, setGeneratingResumeJobIds] = useState<Record<string, boolean>>({});
  const [rescoringJobIds, setRescoringJobIds] = useState<Record<string, boolean>>({});
  const [updatingAppliedJobIds, setUpdatingAppliedJobIds] = useState<Record<string, boolean>>({});
  const [updatingInterestJobIds, setUpdatingInterestJobIds] = useState<Record<string, boolean>>({});
  const [jobOverrides, setJobOverrides] = useState<Record<string, Partial<Job>>>({});

  const [isOutreachOpen, setIsOutreachOpen] = useState(false);
  const [isInterviewPrepOpen, setIsInterviewPrepOpen] = useState(false);
  const [isCompanyIntelOpen, setIsCompanyIntelOpen] = useState(false);

  const mergedJob = useCallback(
    (job: Job): Job => {
      const override = jobOverrides[job.job_id];
      return override ? { ...job, ...override } : job;
    },
    [jobOverrides]
  );

  const activeInterestFilter = searchParams.get("interest");

  const visibleJobs = useMemo(() => {
    return jobs
      .map(mergedJob)
      .filter((job) => {
        if (activeInterestFilter === "false") {
          return job.is_interested === false;
        }
        if (activeInterestFilter === "true") {
          return job.is_interested === true;
        }
        if (activeInterestFilter === "null") {
          return job.is_interested === null;
        }

        if (job.is_interested === false) {
          return false;
        }

        if (job.status === "applied") {
          return false;
        }

        return true;
      });
  }, [jobs, mergedJob, activeInterestFilter]);

  const isSelectedJobGeneratingResume = Boolean(
    selectedJob?.job_id && generatingResumeJobIds[selectedJob.job_id]
  );
  const isSelectedJobRescoring = Boolean(
    selectedJob?.job_id && rescoringJobIds[selectedJob.job_id]
  );
  const isSelectedJobUpdatingApplied = Boolean(
    selectedJob?.job_id && updatingAppliedJobIds[selectedJob.job_id]
  );
  const isSelectedJobUpdatingInterest = Boolean(
    selectedJob?.job_id && updatingInterestJobIds[selectedJob.job_id]
  );

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

  const handleGenerateCustomResume = async () => {
    if (!selectedJob) return;
    const targetJobId = selectedJob.job_id;
    if (selectedJob.is_interested === false) {
      showToast("Cannot customize resume: this job is marked as Not Interested.", "error");
      return;
    }
    if (generatingResumeJobIds[targetJobId]) return;

    markJobMutated(targetJobId);
    setGeneratingResumeJobIds((prev) => ({ ...prev, [targetJobId]: true }));
    try {
      const res = await fetch(`/api/jobs/${targetJobId}/customize-resume`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to customize resume");
      }

      const patch: Partial<Job> = {
        customized_resume_id: data.customized_resume_id,
        resume_link: data.resume_link,
        customized_resumes: {
          id: data.customized_resume_id,
          resume_link: data.resume_link,
        } as any,
        resume_score: data.resume_score,
        resume_score_stage: data.resume_score_stage,
        dream_score: data.dream_score,
        total_score: data.total_score,
        score_breakdown: data.score_breakdown,
      };

      setJobOverrides((prev) => ({
        ...prev,
        [targetJobId]: {
          ...prev[targetJobId],
          ...patch,
        },
      }));

      setSelectedJob((prev) =>
        prev && prev.job_id === targetJobId
          ? {
              ...prev,
              ...patch,
              resume_score: patch.resume_score ?? prev.resume_score,
              resume_score_stage: patch.resume_score_stage ?? prev.resume_score_stage,
              dream_score: patch.dream_score !== undefined ? patch.dream_score : prev.dream_score,
              total_score: patch.total_score !== undefined ? patch.total_score : prev.total_score,
              score_breakdown: patch.score_breakdown ?? prev.score_breakdown,
            }
          : prev
      );

      showToast("Custom resume generated and job rescored successfully!", "success");
      router.refresh();
    } catch (err: any) {
      console.error("Error generating resume:", err);
      showToast(err.message, "error");
    } finally {
      setGeneratingResumeJobIds((prev) => {
        const next = { ...prev };
        delete next[targetJobId];
        return next;
      });
    }
  };

  const handleRescore = async () => {
    if (!selectedJob) return;
    const targetJobId = selectedJob.job_id;
    if (rescoringJobIds[targetJobId]) return;

    markJobMutated(targetJobId);
    setRescoringJobIds((prev) => ({ ...prev, [targetJobId]: true }));
    try {
      const res = await fetch(`/api/jobs/${targetJobId}/rescore`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to rescore job");
      }

      const patch: Partial<Job> = {
        resume_score: data.resume_score,
        dream_score: data.dream_score,
        total_score: data.total_score,
        score_breakdown: data.score_breakdown,
        resume_score_stage: data.resume_score_stage,
      };

      setJobOverrides((prev) => ({
        ...prev,
        [targetJobId]: {
          ...prev[targetJobId],
          ...patch,
        },
      }));

      setSelectedJob((prev) =>
        prev && prev.job_id === targetJobId
          ? {
              ...prev,
              ...patch,
            }
          : prev
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
      setRescoringJobIds((prev) => {
        const next = { ...prev };
        delete next[targetJobId];
        return next;
      });
    }
  };

  useEffect(() => {
    const selectedJobIdFromUrl = searchParams.get("selectedJobId");
    let jobToSelect: Job | null = null;

    if (selectedJobIdFromUrl) {
      jobToSelect =
        visibleJobs.find((job) => job.job_id === selectedJobIdFromUrl) || null;
    }

    if (!jobToSelect && visibleJobs.length > 0) {
      jobToSelect = visibleJobs[0];
      if (!selectedJobIdFromUrl || selectedJobIdFromUrl !== jobToSelect.job_id) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("selectedJobId", jobToSelect.job_id);
        router.replace(`${window.location.pathname}?${params.toString()}`, {
          scroll: false,
        });
      }
    } else if (visibleJobs.length === 0) {
      jobToSelect = null;
      if (selectedJobIdFromUrl) {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("selectedJobId");
        router.replace(`${window.location.pathname}?${params.toString()}`, {
          scroll: false,
        });
      }
    }

    if (jobToSelect) {
      const merged = mergedJob(jobToSelect);
      setSelectedJob((prev) => {
        if (
          !prev ||
          prev.job_id !== merged.job_id ||
          prev.customized_resume_id !== merged.customized_resume_id ||
          prev.resume_score !== merged.resume_score ||
          prev.total_score !== merged.total_score ||
          prev.dream_score !== merged.dream_score ||
          prev.status !== merged.status ||
          prev.is_interested !== merged.is_interested
        ) {
          return merged;
        }
        return prev;
      });
    } else {
      setSelectedJob((prev) => (prev !== null ? null : prev));
    }
  }, [visibleJobs, searchParams, mergedJob, router]);

  const handleViewResume = (
    job_id: string,
    resume_id: string | null | undefined,
  ) => {
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
    setSelectedJob(mergedJob(job));
    const params = new URLSearchParams(searchParams.toString());
    params.set("selectedJobId", job.job_id);
    router.replace(`${window.location.pathname}?${params.toString()}`, {
      scroll: false,
    });
  };

  const handleMarkAsApplied = async () => {
    if (!selectedJob || selectedJob.status === "applied") {
      return;
    }
    const targetJobId = selectedJob.job_id;
    if (updatingAppliedJobIds[targetJobId]) return;

    markJobMutated(targetJobId);
    setUpdatingAppliedJobIds((prev) => ({ ...prev, [targetJobId]: true }));

    const currentIndex = visibleJobs.findIndex((j) => j.job_id === targetJobId);
    const nextCandidate =
      currentIndex !== -1
        ? (visibleJobs[currentIndex + 1] ?? visibleJobs[currentIndex - 1] ?? null)
        : null;

    const currentDate = new Date().toISOString();
    setJobOverrides((prev) => ({
      ...prev,
      [targetJobId]: {
        ...prev[targetJobId],
        status: "applied",
        application_date: currentDate,
      },
    }));

    if (nextCandidate) {
      handleJobSelect(nextCandidate);
    } else {
      setSelectedJob(null);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("selectedJobId");
      router.replace(`${window.location.pathname}?${params.toString()}`, {
        scroll: false,
      });
    }

    try {
      const response = await fetch(`/api/jobs/${targetJobId}`, {
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
      setJobOverrides((prev) => ({
        ...prev,
        [targetJobId]: {
          ...prev[targetJobId],
          status: updatedJob.status,
          application_date: updatedJob.application_date,
        },
      }));

      showToast("Job marked as applied successfully!", "success", () =>
        handleUndoApplied(updatedJob)
      );
      router.refresh();
    } catch (error) {
      console.error("Error marking job as applied:", error);
      setJobOverrides((prev) => {
        const copy = { ...prev };
        delete copy[targetJobId];
        return copy;
      });
      const message =
        error instanceof Error ? error.message : "An unknown error occurred.";
      showToast(`Error: ${message}`, "error");
    } finally {
      setUpdatingAppliedJobIds((prev) => {
        const next = { ...prev };
        delete next[targetJobId];
        return next;
      });
    }
  };

  const handleSetInterest = async (
    newInterestValue: boolean | null,
    specificJobId?: string
  ) => {
    const targetJob = specificJobId
      ? visibleJobs.find((j) => j.job_id === specificJobId) ||
        jobs.map(mergedJob).find((j) => j.job_id === specificJobId) ||
        selectedJob
      : selectedJob;

    if (!targetJob) return;
    const targetJobId = targetJob.job_id;
    if (updatingInterestJobIds[targetJobId]) return;

    markJobMutated(targetJobId);
    setUpdatingInterestJobIds((prev) => ({ ...prev, [targetJobId]: true }));
    let finalInterestValue: boolean | null;

    if (targetJob.is_interested === newInterestValue) {
      finalInterestValue = null;
    } else {
      finalInterestValue = newInterestValue;
    }

    const willBeExcluded =
      (finalInterestValue === false && activeInterestFilter !== "false") ||
      (finalInterestValue === true && activeInterestFilter === "false") ||
      (finalInterestValue === null && (activeInterestFilter === "true" || activeInterestFilter === "false"));

    let nextJobToSelect: Job | null = null;
    if (willBeExcluded && selectedJob?.job_id === targetJobId) {
      const currentIndex = visibleJobs.findIndex((j) => j.job_id === targetJobId);
      if (currentIndex !== -1) {
        nextJobToSelect =
          visibleJobs[currentIndex + 1] ?? visibleJobs[currentIndex - 1] ?? null;
      }
    }

    setJobOverrides((prev) => ({
      ...prev,
      [targetJobId]: {
        ...prev[targetJobId],
        is_interested: finalInterestValue,
      },
    }));

    if (willBeExcluded && selectedJob?.job_id === targetJobId) {
      if (nextJobToSelect) {
        handleJobSelect(nextJobToSelect);
      } else {
        setSelectedJob(null);
        const params = new URLSearchParams(searchParams.toString());
        params.delete("selectedJobId");
        router.replace(`${window.location.pathname}?${params.toString()}`, {
          scroll: false,
        });
      }
    } else {
      setSelectedJob((prev) =>
        prev && prev.job_id === targetJobId
          ? { ...prev, is_interested: finalInterestValue }
          : prev
      );
    }

    try {
      const response = await fetch(`/api/jobs/${targetJobId}`, {
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
      setJobOverrides((prev) => ({
        ...prev,
        [targetJobId]: {
          ...prev[targetJobId],
          is_interested: updatedJob.is_interested,
        },
      }));

      if (finalInterestValue === false) {
        showToast("Marked as not interested", "success", () =>
          handleUndoInterest(targetJobId)
        );
      } else if (finalInterestValue === true) {
        showToast("Marked as interested", "success");
      } else {
        showToast("Interest status cleared", "success");
      }

      router.refresh();
    } catch (error) {
      console.error("Error updating job interest:", error);
      setJobOverrides((prev) => {
        const copy = { ...prev };
        delete copy[targetJobId];
        return copy;
      });
      const message =
        error instanceof Error ? error.message : "An unknown error occurred.";
      showToast(`Error: ${message}`, "error");
    } finally {
      setUpdatingInterestJobIds((prev) => {
        const next = { ...prev };
        delete next[targetJobId];
        return next;
      });
    }
  };

  const [toast, setToast] = useState<ToastData | null>(null);
  const showToast = (
    message: string,
    type: "success" | "error",
    onUndo?: () => void
  ) => {
    setToast({ id: Date.now(), message, type, onUndo });
  };

  const handleUndoInterest = async (jobId: string) => {
    markJobMutated(jobId);
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_interested: null }),
      });
      if (!response.ok) {
        throw new Error("Failed to restore job interest");
      }
      const updatedJob: Job = await response.json();
      setJobOverrides((prev) => ({
        ...prev,
        [jobId]: {
          ...prev[jobId],
          is_interested: null,
        },
      }));
      handleJobSelect(updatedJob);
      showToast("Job restored to your active matches", "success");
      router.refresh();
    } catch (err: any) {
      showToast(err.message || "Failed to restore job", "error");
    }
  };

  const handleUndoApplied = async (job: Job) => {
    const targetJobId = job.job_id;
    markJobMutated(targetJobId);
    try {
      const response = await fetch(`/api/jobs/${targetJobId}`, {
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
      const updatedJob: Job = await response.json();
      setJobOverrides((prev) => ({
        ...prev,
        [targetJobId]: {
          ...prev[targetJobId],
          status: updatedJob.status ?? "new",
          application_date: updatedJob.application_date,
          follow_up_at: updatedJob.follow_up_at ?? null,
          next_event_at: updatedJob.next_event_at ?? null,
          next_event_label: updatedJob.next_event_label ?? null,
        },
      }));
      handleJobSelect(updatedJob);
      showToast("Application reverted — job is back in your pipeline", "success");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unknown error occurred.";
      showToast(`Error: ${message}`, "error");
    }
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return "bg-emerald-50 text-emerald-800 border-emerald-300";
    if (score >= 60) return "bg-blue-50 text-blue-800 border-blue-300";
    if (score >= 40) return "bg-amber-50 text-amber-900 border-amber-300";
    return "bg-rose-50 text-rose-800 border-rose-300";
  };

  const getJobListingUrl = (job: Job): string => {
    if (job.application_url && job.application_url.startsWith("http")) {
      return job.application_url;
    }
    if (job.provider === "careers_future") {
      return `https://www.mycareersfuture.gov.sg/job/${job.job_id}`;
    }
    if (job.provider === "remote_ok") {
      return `https://remoteok.com/remote-jobs/${job.job_id}`;
    }
    return `https://www.linkedin.com/jobs/view/${job.job_id}`;
  };

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="bg-indigo-50 p-5 rounded-2xl mb-3 border border-indigo-100">
        <BuildingIcon className="h-8 w-8 text-indigo-400" />
      </div>
      <h3 className="text-sm font-semibold text-zinc-900 mb-1">{emptyTitle}</h3>
      <p className="text-xs text-zinc-500 max-w-xs">{emptyMessage}</p>
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
    <div className="flex flex-col lg:flex-row h-[calc(100vh-13.5rem)] min-h-[620px] bg-white border border-zinc-200/90 rounded-2xl shadow-xs overflow-hidden">
      {/* Left Column: Job List Feed */}
      <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-200/80 flex flex-col bg-zinc-50/50">
        <div className="px-4 py-3 border-b border-zinc-200/70 bg-white flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-900/80">{title}</h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {visibleJobs.length} {visibleJobs.length === 1 ? "listing" : "listings"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="font-medium text-[11px] text-zinc-400">Sort:</span>
            <select
              value={currentSort || "total"}
              onChange={(e) => handleSortChange(e.target.value)}
              className="px-2 py-1 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="total">Overall Match</option>
              <option value="dream">Dream Alignment</option>
              <option value="ats">ATS Resume Fit</option>
            </select>
          </div>
        </div>

        {visibleJobs.length > 0 ? (
          <>
            <ul className="divide-y divide-zinc-100 overflow-y-auto flex-grow">
              {visibleJobs.map((job) => {
                const isSelected = selectedJob?.job_id === job.job_id;
                const totalScore = job.total_score ?? job.resume_score;

                return (
                  <li
                    key={job.job_id}
                    onClick={() => handleJobSelect(job)}
                    className={`p-3.5 sm:p-4 cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? "bg-indigo-50/40 border-l-[3px] border-l-indigo-600 shadow-2xs"
                        : "hover:bg-zinc-100/70 border-l-[3px] border-l-transparent"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-sm font-semibold truncate ${isSelected ? "text-indigo-950" : "text-zinc-900"}`}>
                          {job.job_title}
                        </h3>
                        <p className="mt-0.5 text-xs text-zinc-500 truncate">
                          <span className="font-medium text-zinc-700">{job.company}</span>
                          <span className="text-zinc-300 mx-1.5">·</span>
                          <span>{job.location || "Remote"}</span>
                        </p>

                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="text-[11px] text-indigo-700/80 font-medium capitalize">
                            {job.provider === "careers_future"
                              ? "CareersFuture"
                              : job.provider === "remote_ok"
                                ? "RemoteOK"
                                : job.provider}
                          </span>
                          {job.workplace_type && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize ${
                              job.workplace_type === "remote"
                                ? "bg-purple-50 text-purple-700 border border-purple-200/70"
                                : job.workplace_type === "hybrid"
                                  ? "bg-sky-50 text-sky-700 border border-sky-200/70"
                                  : "bg-slate-100 text-slate-700"
                            }`}>
                              {job.workplace_type}
                            </span>
                          )}
                          {(job.salary_min || job.salary_max) && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                              {job.salary_currency || "$"}{job.salary_min ? (job.salary_min > 1000 ? `${Math.round(job.salary_min / 1000)}k` : job.salary_min) : ""}{job.salary_min && job.salary_max ? "-" : ""}{job.salary_max ? (job.salary_max > 1000 ? `${Math.round(job.salary_max / 1000)}k` : job.salary_max) : ""}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Color-Coded Score Badge */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {totalScore !== undefined && totalScore !== null ? (
                          <>
                            <div
                              className={`px-2 py-0.5 rounded-md text-xs font-bold tabular-nums border shadow-2xs ${getScoreBadgeColor(
                                totalScore
                              )}`}
                            >
                              {totalScore}%
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-zinc-500 font-medium" title="ATS Resume Score">
                                ATS {job.resume_score}%
                              </span>
                              {job.dream_score !== undefined && job.dream_score !== null && (
                                <span
                                  className="text-amber-800 font-bold bg-amber-50 border border-amber-200/80 px-1 py-0.2 rounded"
                                  title="Dream Match Score"
                                >
                                  ★ {job.dream_score}%
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full whitespace-nowrap">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status badges */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {generatingResumeJobIds[job.job_id] ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-300 animate-pulse">
                          <RefreshCw size={10} className="animate-spin text-purple-500" />
                          Tailoring...
                        </span>
                      ) : Boolean(
                        job.customized_resume_id ||
                          job.resume_link ||
                          (job.customized_resumes &&
                            ((Array.isArray(job.customized_resumes) &&
                              job.customized_resumes.length > 0) ||
                              typeof job.customized_resumes === "object"))
                      ) ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-800 border border-purple-200">
                          <FileText size={10} className="text-purple-600" />
                          Tailored
                        </span>
                      ) : null}
                      {rescoringJobIds[job.job_id] && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                          <RefreshCw size={10} className="animate-spin text-amber-600" />
                          Rescoring...
                        </span>
                      )}
                      {job.status === "applied" && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle size={10} className="text-emerald-600" />
                          Applied
                        </span>
                      )}
                      {job.is_interested === true && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <ThumbsUp size={10} className="text-blue-600" />
                          Interested
                        </span>
                      )}
                      {job.is_interested === false && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <ThumbsDown size={10} className="text-rose-600" />
                          Not Interested
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {totalPages > 1 && (
              <div className="p-3 border-t border-zinc-200/70 bg-white">
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

      {/* Right Column: Clean Job Details & Action Center */}
      <div className="w-full lg:flex-1 bg-white overflow-y-auto">
        {selectedJob ? (
          <div className="h-full flex flex-col">
            {/* Sticky Header: Metadata & Clean Actions */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-xs border-b border-zinc-200/80 p-5 sm:p-6 z-10 space-y-4">
              {/* Row 1: Title, Meta and Color-Coded Match Score */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight leading-snug truncate">
                      {selectedJob.job_title}
                    </h1>
                    <Link
                      href={`/jobs/${selectedJob.job_id}?source=${encodeURIComponent(currentPathWithSearch)}`}
                      className="p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors shrink-0"
                      title="Open full page view"
                    >
                      <Maximize2 size={16} />
                    </Link>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center text-xs text-zinc-600 gap-y-1.5 gap-x-2">
                    <span className="font-semibold text-zinc-900">{selectedJob.company}</span>
                    <span className="text-zinc-300">·</span>
                    <span>{selectedJob.location || "Remote"}</span>
                    {selectedJob.workplace_type && (
                      <>
                        <span className="text-zinc-300">·</span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                          selectedJob.workplace_type === "remote"
                            ? "bg-purple-50 text-purple-700 border border-purple-200/70"
                            : selectedJob.workplace_type === "hybrid"
                              ? "bg-sky-50 text-sky-700 border border-sky-200/70"
                              : "bg-slate-100 text-slate-700"
                        }`}>
                          {selectedJob.workplace_type}
                        </span>
                      </>
                    )}
                    {(selectedJob.salary_min || selectedJob.salary_max) && (
                      <>
                        <span className="text-zinc-300">·</span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Banknote size={12} className="inline mr-1 text-emerald-600" />
                          {selectedJob.salary_currency || "USD"}{" "}
                          {selectedJob.salary_min ? selectedJob.salary_min.toLocaleString() : ""}
                          {selectedJob.salary_min && selectedJob.salary_max ? " - " : ""}
                          {selectedJob.salary_max ? selectedJob.salary_max.toLocaleString() : ""}{" "}
                          / {selectedJob.salary_period || "mo"}
                        </span>
                      </>
                    )}
                    <span className="text-zinc-300">·</span>
                    <span className="text-indigo-700/80 font-medium capitalize">
                      via {selectedJob.provider === "careers_future" ? "CareersFuture" : selectedJob.provider === "remote_ok" ? "RemoteOK" : selectedJob.provider || "LinkedIn"}
                    </span>
                  </div>
                </div>

                {/* Score Card with Tinted Palette */}
                {selectedJob.resume_score !== undefined && selectedJob.resume_score !== null ? (
                  <div className={`flex-shrink-0 flex items-center gap-3 px-3.5 py-2 rounded-xl border shadow-xs ${
                    (selectedJob.total_score ?? selectedJob.resume_score) >= 80
                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                      : (selectedJob.total_score ?? selectedJob.resume_score) >= 60
                        ? "bg-indigo-50/70 border-indigo-200 text-indigo-950"
                        : "bg-amber-50/70 border-amber-200 text-amber-950"
                  }`}>
                    <div className="text-right">
                      <div className="text-lg font-bold leading-tight flex items-baseline justify-end gap-1">
                        <span>{selectedJob.total_score ?? selectedJob.resume_score}%</span>
                        <span className="text-xs font-semibold opacity-75">Match</span>
                      </div>
                      <div className="text-[10px] font-medium mt-0.5 flex items-center gap-1.5 justify-end">
                        <span className="text-blue-700 font-semibold">ATS {selectedJob.resume_score}%</span>
                        {selectedJob.dream_score !== null && selectedJob.dream_score !== undefined && (
                          <button
                            type="button"
                            onClick={() => setIsCompanyIntelOpen(true)}
                            className="text-amber-800 font-bold hover:underline cursor-pointer"
                            title="Click to view transparent Dream Match breakdown & company reviews"
                          >
                            ★ Dream {selectedJob.dream_score}%
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800">
                    Pending Score
                  </div>
                )}
              </div>

              {/* Row 2: Primary Workflow Actions (Distinct Functional Colors) */}
              <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Primary Action: View / Apply on Job Listing (Indigo Brand) */}
                  <Link
                    href={getJobListingUrl(selectedJob)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors shadow-xs"
                  >
                    <span>View Job Listing</span>
                    <ExternalLink size={14} />
                  </Link>

                  {/* Tailored Resume Action (Emerald when ready / Purple when tailor available) */}
                  {hasCustomResume ? (
                    <button
                      onClick={() =>
                        handleViewResume(
                          selectedJob.job_id,
                          selectedJob.customized_resume_id ||
                            (selectedJob.customized_resumes as any)?.id
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
                    >
                      <FileText size={15} />
                      <span>View Custom Resume</span>
                    </button>
                  ) : selectedJob.is_interested === false ? (
                    <button
                      disabled
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-100 text-zinc-400 text-xs sm:text-sm font-medium rounded-lg cursor-not-allowed border border-zinc-200"
                    >
                      <ThumbsDown size={14} className="text-zinc-400" />
                      <span>Excluded (Pass)</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleGenerateCustomResume}
                      disabled={isSelectedJobGeneratingResume}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs sm:text-sm font-semibold rounded-lg transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                    >
                      {isSelectedJobGeneratingResume ? (
                        <>
                          <RefreshCw size={14} className="animate-spin text-purple-600" />
                          <span>Tailoring...</span>
                        </>
                      ) : (
                        <>
                          <FileText size={14} className="text-purple-600" />
                          <span>Tailor Resume</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Mark as Applied Action (Blue when unapplied / Emerald when applied) */}
                  {selectedJob.status !== "applied" ? (
                    <button
                      onClick={handleMarkAsApplied}
                      disabled={isSelectedJobUpdatingApplied}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs sm:text-sm font-semibold rounded-lg transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle size={15} className="text-blue-500" />
                      <span>{isSelectedJobUpdatingApplied ? "Updating..." : "Mark Applied"}</span>
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-xs sm:text-sm rounded-lg">
                      <CheckCircle size={15} className="text-emerald-600" />
                      <span>Applied</span>
                    </div>
                  )}
                </div>

                {/* Right: Interested / Pass toggle */}
                <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 shadow-2xs">
                  <button
                    onClick={() => handleSetInterest(true)}
                    disabled={isSelectedJobUpdatingInterest}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      selectedJob.is_interested === true
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "text-zinc-600 hover:text-blue-700 hover:bg-blue-50"
                    }`}
                    title="Mark as Interested"
                  >
                    <ThumbsUp
                      size={13}
                      fill={selectedJob.is_interested === true ? "currentColor" : "none"}
                    />
                    <span>Interested</span>
                  </button>
                  <button
                    onClick={() => handleSetInterest(false)}
                    disabled={isSelectedJobUpdatingInterest}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      selectedJob.is_interested === false
                        ? "bg-rose-600 text-white shadow-2xs"
                        : "text-zinc-600 hover:text-rose-700 hover:bg-rose-50"
                    }`}
                    title="Mark as Not Interested"
                  >
                    <ThumbsDown
                      size={13}
                      fill={selectedJob.is_interested === false ? "currentColor" : "none"}
                    />
                    <span>Pass</span>
                  </button>
                </div>
              </div>

              {/* Row 3: Tinted Secondary Preparation Toolkit */}
              <div className="flex items-center gap-2 pt-2.5 border-t border-zinc-100 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mr-1">
                  Tools:
                </span>

                {/* Cover Letter (Violet) */}
                <Link
                  href={`/jobs/${selectedJob.job_id}/cover-letter?source=${encodeURIComponent(currentPathWithSearch)}`}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors shadow-2xs ${
                    hasCoverLetter
                      ? "border-violet-300 bg-violet-100 text-violet-900 hover:bg-violet-200"
                      : "border-violet-200/80 bg-violet-50/70 hover:bg-violet-100 text-violet-700"
                  }`}
                  title={hasCoverLetter ? "View and edit tailored cover letter" : "Draft a tailored cover letter"}
                >
                  <Mail size={13} className="text-violet-600" />
                  <span>{hasCoverLetter ? "Cover Letter ✓" : "Cover Letter"}</span>
                </Link>

                {/* Outreach Note (Sky/Blue) */}
                <button
                  onClick={() => setIsOutreachOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-sky-200/80 bg-sky-50/70 hover:bg-sky-100 text-sky-700 transition-colors shadow-2xs cursor-pointer"
                  title="Generate personalized networking message"
                >
                  <Send size={13} className="text-sky-600" />
                  <span>Outreach Note</span>
                </button>

                {/* Interview Prep (Amber) */}
                <button
                  onClick={() => setIsInterviewPrepOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-amber-200/80 bg-amber-50/70 hover:bg-amber-100 text-amber-800 transition-colors shadow-2xs cursor-pointer"
                  title="Generate technical questions and STAR preparation"
                >
                  <Award size={13} className="text-amber-600" />
                  <span>Interview Prep</span>
                </button>

                {/* Company Intel (Slate with Gold Rating) */}
                <button
                  onClick={() => setIsCompanyIntelOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors shadow-2xs cursor-pointer"
                  title="Inspect employer reviews and ratings"
                >
                  <BuildingIcon size={13} className="text-slate-600" />
                  <span>Company Intel</span>
                  {selectedJob.score_breakdown?.company_intel?.glassdoor_rating && (
                    <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-200 px-1 py-0.2 rounded">
                      ★ {selectedJob.score_breakdown.company_intel.glassdoor_rating.toFixed(1)}
                    </span>
                  )}
                </button>

                {/* Live Rescore (Orange) */}
                <button
                  onClick={handleRescore}
                  disabled={isSelectedJobRescoring}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-orange-200/80 bg-orange-50/70 hover:bg-orange-100 text-orange-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                  title="Re-evaluate score against your resume and fresh intel"
                >
                  <RefreshCw
                    size={13}
                    className={`text-orange-500 ${isSelectedJobRescoring ? "animate-spin" : ""}`}
                  />
                  <span>{isSelectedJobRescoring ? "Rescoring..." : "Rescore"}</span>
                </button>
              </div>
            </div>

            {/* Collapsible Match Analysis & Skill Insights Section */}
            {selectedJob.score_breakdown && (
              <div className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50/20 via-white to-purple-50/20 p-5 sm:p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                      Match Insights & Skill Analysis
                    </span>
                  </div>
                  <button
                    onClick={() => setIsInsightsExpanded(!isInsightsExpanded)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-900 transition-colors cursor-pointer"
                  >
                    <span>{isInsightsExpanded ? "Hide Details" : "Show Details"}</span>
                    {isInsightsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {isInsightsExpanded && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Matched Skills */}
                      <div className="bg-white p-3.5 rounded-xl border border-emerald-200/80 shadow-2xs space-y-2">
                        <span className="text-xs font-bold text-emerald-800 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 size={13} className="text-emerald-600" />
                            Matched Core Skills
                          </span>
                          <span className="text-[11px] text-emerald-600 font-semibold">
                            {selectedJob.score_breakdown.matched_skills?.length || 0} found
                          </span>
                        </span>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {(selectedJob.score_breakdown.matched_skills || []).length > 0 ? (
                            selectedJob.score_breakdown.matched_skills.map((skill, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 text-xs font-semibold rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200"
                              >
                                {skill}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-zinc-400">No direct skills extracted</span>
                          )}
                        </div>
                      </div>

                      {/* Skill Gaps */}
                      <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 shadow-2xs space-y-2">
                        <span className="text-xs font-bold text-amber-900 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <AlertTriangle size={13} className="text-amber-600" />
                            Missing / Skill Gaps
                          </span>
                          <span className="text-[11px] text-amber-700 font-semibold">
                            {selectedJob.score_breakdown.skill_gaps?.length || 0} gaps
                          </span>
                        </span>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {(selectedJob.score_breakdown.skill_gaps || []).length > 0 ? (
                            selectedJob.score_breakdown.skill_gaps.map((skill, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 text-xs font-semibold rounded-md bg-amber-50 text-amber-900 border border-amber-200"
                              >
                                {skill}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-emerald-700 font-semibold">
                              No major missing skills identified
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Red flags warning if any */}
                    {selectedJob.score_breakdown.red_flags &&
                      selectedJob.score_breakdown.red_flags.length > 0 && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2 shadow-2xs">
                          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block mb-0.5">Detected Red Flags:</span>
                            <ul className="list-disc list-inside space-y-0.5">
                              {selectedJob.score_breakdown.red_flags.map((rf, idx) => (
                                <li key={idx}>{rf}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                    {/* Recommendation */}
                    {selectedJob.score_breakdown.actionable_advice && (
                      <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950 leading-relaxed shadow-2xs">
                        <span className="font-bold text-indigo-900 block mb-0.5">Recommendation:</span>
                        <span>{selectedJob.score_breakdown.actionable_advice}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Scrollable Job Description */}
            <div className="p-6 sm:p-8 flex-grow">
              <div className="prose prose-zinc prose-sm sm:prose-base max-w-none text-zinc-700 leading-relaxed">
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
            isRescoring={isSelectedJobRescoring}
          />
        </>
      )}

      {/* Toast notifications */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
