"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ExternalLink,
  CheckCircle,
  ThumbsUp,
  ThumbsDown,
  BuildingIcon,
  FileText,
  RefreshCw,
  ArrowLeft,
  Mail,
  Send,
  Award,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import Toast, { ToastData } from "./applied/Toast";
import { OutreachDrawer } from "./OutreachDrawer";
import { InterviewPrepModal } from "./InterviewPrepModal";
import { CompanyIntelModal } from "./CompanyIntelModal";
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
  const [isOutreachOpen, setIsOutreachOpen] = useState(false);
  const [isInterviewPrepOpen, setIsInterviewPrepOpen] = useState(false);
  const [isCompanyIntelOpen, setIsCompanyIntelOpen] = useState(false);
  const [isInsightsExpanded, setIsInsightsExpanded] = useState(true);
  const [toast, setToast] = useState<ToastData | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get("source");

  const handleBack = () => {
    if (source) {
      router.push(source);
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/jobs/top-matches");
    }
  };

  const backLabel = useMemo(() => {
    if (!source) return "Back";
    if (source.includes("/applied")) return "Back to Applications";
    if (
      source.includes("/jobs/new") ||
      source.includes("/jobs/top-matches") ||
      source.includes("/jobs/tailored")
    ) {
      return "Back to Jobs";
    }
    return "Back";
  }, [source]);

  const hasCustomResume = Boolean(
    job.customized_resume_id ||
    job.resume_link ||
    job.customized_resumes?.resume_link
  );

  const hasCoverLetter = Boolean(
    Array.isArray(job.cover_letters)
      ? job.cover_letters.length > 0
      : job.cover_letters?.id
  );

  const handleViewResume = (
    job_id: string,
    resume_id: string | null | undefined
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    const sourceParam = searchParams.get("source");
    if (!sourceParam) {
      params.set("source", `/jobs/${job_id}`);
    }
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
        resume_link: data.resume_link,
        customized_resumes: {
          id: data.customized_resume_id,
          resume_link: data.resume_link,
        } as any,
        resume_score: data.resume_score ?? prev.resume_score,
        resume_score_stage: data.resume_score_stage ?? prev.resume_score_stage,
        dream_score: data.dream_score !== undefined ? data.dream_score : prev.dream_score,
        total_score: data.total_score !== undefined ? data.total_score : prev.total_score,
        score_breakdown: data.score_breakdown ?? prev.score_breakdown,
      }));
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
        dream_score: data.dream_score,
        total_score: data.total_score,
        score_breakdown: data.score_breakdown,
        resume_score_stage: data.resume_score_stage,
      }));
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

  const handleMarkAsApplied = async () => {
    if (job.status === "applied") return;
    setIsUpdating(true);
    const currentDate = new Date().toISOString();
    try {
      const response = await fetch(`/api/jobs/${job.job_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "applied",
          application_date: currentDate,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
      }
      const updatedJob: Job = await response.json();
      setJob(updatedJob);
      showToast("Job marked as applied successfully!", "success", () =>
        handleUndoApplied(updatedJob)
      );
      router.refresh();
    } catch (error) {
      console.error("Error marking job as applied:", error);
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_interested: finalInterestValue }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
      }
      const updatedJob: Job = await response.json();
      setJob((prev) => ({ ...prev, is_interested: updatedJob.is_interested }));
      const message =
        finalInterestValue === true
          ? "Job marked as Interested."
          : finalInterestValue === false
            ? "Job marked as Not Interested."
            : "Interest preference cleared.";
      showToast(message, "success");
      router.refresh();
    } catch (error) {
      console.error("Error setting job interest:", error);
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
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
        throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
      }
      setJob((prev) => ({ ...prev, status: "new", application_date: "" }));
      showToast("Application reverted — job is back in your pipeline", "success");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      showToast(`Error: ${message}`, "error");
    }
  };

  const getJobListingUrl = (currentJob: Job): string => {
    if (currentJob.application_url && currentJob.application_url.startsWith("http")) {
      return currentJob.application_url;
    }
    if (currentJob.provider === "careers_future") {
      return `https://www.mycareersfuture.gov.sg/job/${currentJob.job_id}`;
    }
    if (currentJob.provider === "remote_ok") {
      return `https://remoteok.com/remote-jobs/${currentJob.job_id}`;
    }
    return `https://www.linkedin.com/jobs/view/${currentJob.job_id}`;
  };

  return (
    <div className="bg-white border border-zinc-200/90 rounded-2xl shadow-xs overflow-hidden">
      {/* Back Navigation Bar */}
      <div className="px-6 pt-4 pb-2 border-b border-zinc-100 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-indigo-600 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </button>

        <span className="text-xs text-indigo-700/80 font-medium capitalize">
          Posted via {job.provider === "careers_future" ? "CareersFuture" : job.provider === "remote_ok" ? "RemoteOK" : job.provider || "LinkedIn"}
        </span>
      </div>

      {/* Header section */}
      <div className="bg-white border-b border-zinc-200/80 p-6 space-y-4">
        {/* Row 1: Title and Match Score */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
              {job.job_title}
            </h1>

            <div className="mt-2 flex flex-wrap items-center text-xs text-zinc-600 gap-y-1.5 gap-x-2.5">
              <span className="font-semibold text-zinc-900">{job.company}</span>
              <span className="text-zinc-300">·</span>
              <span>{job.location || "Remote"}</span>
              {job.workplace_type && (
                <>
                  <span className="text-zinc-300">·</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                    job.workplace_type === "remote"
                      ? "bg-purple-50 text-purple-700 border border-purple-200/70"
                      : job.workplace_type === "hybrid"
                        ? "bg-sky-50 text-sky-700 border border-sky-200/70"
                        : "bg-slate-100 text-slate-700"
                  }`}>
                    {job.workplace_type}
                  </span>
                </>
              )}
              {(job.salary_min || job.salary_max) && (
                <>
                  <span className="text-zinc-300">·</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <Banknote size={12} className="inline mr-1 text-emerald-600" />
                    {job.salary_currency || "USD"}{" "}
                    {job.salary_min ? job.salary_min.toLocaleString() : ""}
                    {job.salary_min && job.salary_max ? " - " : ""}
                    {job.salary_max ? job.salary_max.toLocaleString() : ""}{" "}
                    / {job.salary_period || "mo"}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Color-Coded Score Display */}
          {job.resume_score !== undefined && job.resume_score !== null ? (
            <div className={`flex-shrink-0 flex items-center gap-3 px-4 py-2.5 rounded-xl border shadow-xs ${
              (job.total_score ?? job.resume_score) >= 80
                ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                : (job.total_score ?? job.resume_score) >= 60
                  ? "bg-indigo-50/70 border-indigo-200 text-indigo-950"
                  : "bg-amber-50/70 border-amber-200 text-amber-950"
            }`}>
              <div className="text-right">
                <div className="text-xl font-bold leading-tight flex items-baseline justify-end gap-1">
                  <span>{job.total_score ?? job.resume_score}%</span>
                  <span className="text-xs font-semibold opacity-75">Match</span>
                </div>
                <div className="text-[11px] font-medium mt-0.5 flex items-center gap-1.5 justify-end">
                  <span className="text-blue-700 font-semibold">ATS {job.resume_score}%</span>
                  {job.dream_score !== null && job.dream_score !== undefined && (
                    <button
                      type="button"
                      onClick={() => setIsCompanyIntelOpen(true)}
                      className="text-amber-800 font-bold hover:underline cursor-pointer"
                      title="Click to view transparent Dream Match breakdown & company reviews"
                    >
                      ★ Dream {job.dream_score}%
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

        {/* Row 2: Primary Workflow Actions (Functional Colors) */}
        <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={getJobListingUrl(job)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors shadow-xs"
            >
              <span>View Job Listing</span>
              <ExternalLink size={14} />
            </Link>

            {hasCustomResume ? (
              <button
                onClick={() =>
                  handleViewResume(
                    job.job_id,
                    job.customized_resume_id || (job.customized_resumes as any)?.id
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                <FileText size={15} />
                <span>View Custom Resume</span>
              </button>
            ) : job.is_interested === false ? (
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
                disabled={isGeneratingResume}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs sm:text-sm font-semibold rounded-lg transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {isGeneratingResume ? (
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

            {job.status !== "applied" ? (
              <button
                onClick={handleMarkAsApplied}
                disabled={isUpdating}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs sm:text-sm font-semibold rounded-lg transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle size={15} className="text-blue-500" />
                <span>{isUpdating ? "Updating..." : "Mark Applied"}</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-xs sm:text-sm rounded-lg">
                <CheckCircle size={15} className="text-emerald-600" />
                <span>Applied</span>
              </div>
            )}
          </div>

          {/* Interest Toggle */}
          <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 shadow-2xs">
            <button
              onClick={() => handleSetInterest(true)}
              disabled={isUpdatingInterest}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                job.is_interested === true
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-zinc-600 hover:text-blue-700 hover:bg-blue-50"
              }`}
              title="Mark as Interested"
            >
              <ThumbsUp
                size={13}
                fill={job.is_interested === true ? "currentColor" : "none"}
              />
              <span>Interested</span>
            </button>
            <button
              onClick={() => handleSetInterest(false)}
              disabled={isUpdatingInterest}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                job.is_interested === false
                  ? "bg-rose-600 text-white shadow-2xs"
                  : "text-zinc-600 hover:text-rose-700 hover:bg-rose-50"
              }`}
              title="Mark as Not Interested"
            >
              <ThumbsDown
                size={13}
                fill={job.is_interested === false ? "currentColor" : "none"}
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

          <Link
            href={`/jobs/${job.job_id}/cover-letter?source=${encodeURIComponent(
              source || `/jobs/${job.job_id}`
            )}`}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors shadow-2xs ${
              hasCoverLetter
                ? "border-violet-300 bg-violet-100 text-violet-900 hover:bg-violet-200"
                : "border-violet-200/80 bg-violet-50/70 hover:bg-violet-100 text-violet-700"
            }`}
          >
            <Mail size={13} className="text-violet-600" />
            <span>{hasCoverLetter ? "Cover Letter ✓" : "Cover Letter"}</span>
          </Link>

          <button
            onClick={() => setIsOutreachOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-sky-200/80 bg-sky-50/70 hover:bg-sky-100 text-sky-700 transition-colors shadow-2xs cursor-pointer"
          >
            <Send size={13} className="text-sky-600" />
            <span>Outreach Note</span>
          </button>

          <button
            onClick={() => setIsInterviewPrepOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-amber-200/80 bg-amber-50/70 hover:bg-amber-100 text-amber-800 transition-colors shadow-2xs cursor-pointer"
          >
            <Award size={13} className="text-amber-600" />
            <span>Interview Prep</span>
          </button>

          <button
            onClick={() => setIsCompanyIntelOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors shadow-2xs cursor-pointer"
          >
            <BuildingIcon size={13} className="text-slate-600" />
            <span>Company Intel</span>
            {job.score_breakdown?.company_intel?.glassdoor_rating && (
              <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-200 px-1 py-0.2 rounded">
                ★ {job.score_breakdown.company_intel.glassdoor_rating.toFixed(1)}
              </span>
            )}
          </button>

          <button
            onClick={handleRescore}
            disabled={isRescoring}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-orange-200/80 bg-orange-50/70 hover:bg-orange-100 text-orange-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              size={13}
              className={`text-orange-500 ${isRescoring ? "animate-spin" : ""}`}
            />
            <span>{isRescoring ? "Rescoring..." : "Rescore"}</span>
          </button>
        </div>
      </div>

      {/* Collapsible Match Analysis & Skill Insights */}
      {job.score_breakdown && (
        <div className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50/20 via-white to-purple-50/20 p-6 space-y-3">
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
                <div className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-2xs space-y-2">
                  <span className="text-xs font-bold text-emerald-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-600" />
                      Matched Core Skills
                    </span>
                    <span className="text-[11px] text-emerald-600 font-semibold">
                      {job.score_breakdown.matched_skills?.length || 0} found
                    </span>
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {(job.score_breakdown.matched_skills || []).length > 0 ? (
                      job.score_breakdown.matched_skills.map((skill, idx) => (
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
                <div className="bg-white p-4 rounded-xl border border-amber-200/80 shadow-2xs space-y-2">
                  <span className="text-xs font-bold text-amber-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle size={13} className="text-amber-600" />
                      Missing / Skill Gaps
                    </span>
                    <span className="text-[11px] text-amber-700 font-semibold">
                      {job.score_breakdown.skill_gaps?.length || 0} gaps
                    </span>
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {(job.score_breakdown.skill_gaps || []).length > 0 ? (
                      job.score_breakdown.skill_gaps.map((skill, idx) => (
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
              {job.score_breakdown.red_flags && job.score_breakdown.red_flags.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2 shadow-2xs">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">Detected Red Flags:</span>
                    <ul className="list-disc list-inside space-y-0.5">
                      {job.score_breakdown.red_flags.map((rf, idx) => (
                        <li key={idx}>{rf}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Recommendation */}
              {job.score_breakdown.actionable_advice && (
                <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950 leading-relaxed shadow-2xs">
                  <span className="font-bold text-indigo-900 block mb-0.5">Recommendation:</span>
                  <span>{job.score_breakdown.actionable_advice}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Description Content */}
      <div className="p-6 sm:p-8">
        <div className="prose prose-zinc prose-sm sm:prose-base max-w-none text-zinc-700 leading-relaxed">
          <MarkdownRenderer content={job.description} />
        </div>
      </div>

      {/* Modals & Drawers */}
      <OutreachDrawer
        job={job}
        isOpen={isOutreachOpen}
        onClose={() => setIsOutreachOpen(false)}
      />
      <InterviewPrepModal
        job={job}
        isOpen={isInterviewPrepOpen}
        onClose={() => setIsInterviewPrepOpen(false)}
      />
      <CompanyIntelModal
        job={job}
        isOpen={isCompanyIntelOpen}
        onClose={() => setIsCompanyIntelOpen(false)}
        onRescore={handleRescore}
        isRescoring={isRescoring}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
