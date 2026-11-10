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
  MapPinIcon,
  BarChart3Icon,
  FileText,
  Link as SocialLink,
  Sparkles,
  RefreshCw,
  ArrowLeft,
  Mail,
  Send,
  Award,
  Banknote,
  CheckCircle2,
  AlertTriangle,
  Flame,
} from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import Toast, { ToastData } from "./applied/Toast";
import { OutreachDrawer } from "./OutreachDrawer";
import { InterviewPrepModal } from "./InterviewPrepModal";
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

  // Rescore is ONLY available if a custom resume exists and the score is still based on the initial base resume
  const canRescore = Boolean(hasCustomResume && job.resume_score_stage === "initial");

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
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
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
            <div className="mt-3 flex flex-wrap items-center text-gray-600 gap-y-2 gap-x-6">
              <div className="flex items-center">
                <BuildingIcon className="h-5 w-5 mr-2 text-gray-500" />
                <span>{job.company}</span>
              </div>
              <div className="flex items-center">
                <MapPinIcon className="h-5 w-5 mr-2 text-gray-500" />
                <span>{job.location}</span>
              </div>
              {job.workplace_type && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider ${
                  job.workplace_type === "remote"
                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                    : job.workplace_type === "hybrid"
                      ? "bg-blue-100 text-blue-800 border border-blue-200"
                      : "bg-gray-100 text-gray-800 border border-gray-200"
                }`}>
                  {job.workplace_type === "remote" ? "🌐 100% Remote" : job.workplace_type === "hybrid" ? "🏢 Hybrid" : "📍 On-Site"}
                </span>
              )}
              {(job.salary_min || job.salary_max) && (
                <div className="flex items-center text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 text-xs">
                  <Banknote className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                  <span>
                    {job.salary_currency || "USD"}{" "}
                    {job.salary_min ? job.salary_min.toLocaleString() : ""}
                    {job.salary_min && job.salary_max ? " - " : ""}
                    {job.salary_max ? job.salary_max.toLocaleString() : ""}{" "}
                    / {job.salary_period || "mo"}
                  </span>
                </div>
              )}
              <div className="flex items-center">
                <SocialLink className="h-5 w-5 mr-2 text-gray-500" />
                <span className="capitalize">
                  {job.provider === "careers_future"
                    ? "MyCareersFuture"
                    : job.provider === "remote_ok"
                      ? "RemoteOK"
                      : job.provider}
                </span>
              </div>
            </div>
          </div>

          {/* Prominent Multi-Score Display */}
          <div className="flex-shrink-0 mt-4 sm:mt-0 flex flex-wrap items-center gap-3">
            {/* Overall Composite Score */}
            {job.resume_score !== undefined && job.resume_score !== null ? (
              <div className="flex items-center space-x-3 bg-white px-3.5 py-2.5 rounded-xl border border-emerald-300 shadow-xs bg-gradient-to-r from-emerald-50/50 to-teal-50/40">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-xl font-bold text-emerald-950">
                      {job.total_score ?? job.resume_score}
                    </span>
                    <span className="text-xs font-semibold text-emerald-600">%</span>
                  </div>
                  <div className="text-[11px] font-bold text-emerald-800">
                    Overall Match
                  </div>
                </div>
              </div>
            ) : null}

            {/* ATS Score */}
            {job.resume_score !== undefined && job.resume_score !== null ? (
              <div className="flex items-center space-x-3 bg-white px-3.5 py-2.5 rounded-xl border border-gray-200 shadow-xs">
                <div
                  className={`p-2 rounded-lg ${
                    job.resume_score_stage === "custom"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-indigo-50 text-indigo-600"
                  }`}
                >
                  <BarChart3Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-xl font-bold text-gray-900">
                      {job.resume_score}
                    </span>
                    <span className="text-xs font-medium text-gray-400">/100</span>
                  </div>
                  <div className="text-[11px] font-semibold text-gray-500">
                    {job.resume_score_stage === "custom" ? "Tailored Score" : "ATS Fit Score"}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Dream Score */}
            {job.dream_score !== undefined && job.dream_score !== null ? (
              <div className="flex items-center space-x-3 bg-white px-3.5 py-2.5 rounded-xl border border-amber-200 shadow-xs bg-gradient-to-r from-amber-50/40 to-orange-50/30">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                  <Flame className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-xl font-bold text-amber-900">
                      {job.dream_score}
                    </span>
                    <span className="text-xs font-medium text-amber-500">/100</span>
                  </div>
                  <div className="text-[11px] font-semibold text-amber-700">
                    Dream Match
                  </div>
                </div>
              </div>
            ) : null}

            {job.resume_score === null && job.dream_score === null && (
              <div className="flex items-center space-x-2 bg-gray-50 px-4 py-3 rounded-xl border border-gray-200">
                <BarChart3Icon className="h-5 w-5 text-gray-400" />
                <span className="text-xs font-medium text-gray-500">Not Scored</span>
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

          {/* Custom Cover Letter (On-Demand) */}
          <Link
            href={`/jobs/${job.job_id}/cover-letter?source=${encodeURIComponent(
              source || `/jobs/${job.job_id}`
            )}`}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
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
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-xs"
            title="Generate personalized LinkedIn connection note or cold inmail"
          >
            <Send size={16} className="mr-2" />
            Outreach Note
          </button>

          {/* Interview Prep Copilot (On-Demand Preparation) */}
          <button
            onClick={() => setIsInterviewPrepOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition-colors shadow-xs"
            title="Generate role-specific technical questions and STAR answers"
          >
            <Award size={16} className="mr-2" />
            Interview Prep
          </button>

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

      {/* AI Match Analysis & Skill Gap Drawer */}
      {job.score_breakdown && (
        <div className="bg-gradient-to-r from-gray-50 to-indigo-50/20 border-b border-gray-200 p-6 space-y-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-bold text-gray-900">AI Match Analysis & Skill Insights</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Matched Skills */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Matched Core Skills ({job.score_breakdown.matched_skills?.length || 0})
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(job.score_breakdown.matched_skills || []).length > 0 ? (
                  job.score_breakdown.matched_skills.map((skill, idx) => (
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
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Missing / Skill Gaps ({job.score_breakdown.skill_gaps?.length || 0})
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(job.score_breakdown.skill_gaps || []).length > 0 ? (
                  job.score_breakdown.skill_gaps.map((skill, idx) => (
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
          {job.score_breakdown.red_flags && job.score_breakdown.red_flags.length > 0 && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start space-x-2.5">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-1">Detected Job Red Flags:</span>
                <ul className="list-disc list-inside space-y-0.5">
                  {job.score_breakdown.red_flags.map((rf, idx) => (
                    <li key={idx}>{rf}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Actionable Advice */}
          {job.score_breakdown.actionable_advice && (
            <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-100 text-xs text-indigo-900 leading-relaxed flex items-start space-x-2.5">
              <Sparkles className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Career Coach Recommendation: </span>
                <span>{job.score_breakdown.actionable_advice}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Job Description
        </h2>
        <div className="prose max-w-none text-gray-700">
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

      {/* Toast notifications */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
