"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building,
  MapPin,
  ExternalLink,
  FileText,
  Info,
  Bell,
  CalendarClock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Gauge,
  Undo2,
} from "lucide-react";
import { Job } from "@/types";
import {
  APPLIED_STATUS_META,
  AppliedStatus,
  getCompanyAvatarClass,
  getCompanyInitials,
  getEventUrgency,
  getFollowUpState,
  getStatusMeta,
  formatAppliedAgo,
  formatDateTime,
  jobPostingUrl,
  needsFollowUp,
} from "@/lib/applied-status";
import StatusTimeline from "./StatusTimeline";
import NotesEditor from "./NotesEditor";

interface AppliedJobCardProps {
  job: Job;
  isUpdating: boolean;
  followUpThresholdDays: number;
  onStatusChange: (
    job: Job,
    payload: {
      status: AppliedStatus;
      next_event_at: string | null;
      next_event_label: string | null;
      follow_up_at: string | null;
      note: string;
    }
  ) => Promise<void>;
  onQuickFollowUp: (job: Job, days: number) => Promise<void>;
  onSaveNotes: (jobId: string, notes: string) => Promise<void>;
  /** Opens the contextual status-change modal for this job */
  onOpenStatusModal: (job: Job, status: AppliedStatus) => void;
  /**
   * Reverts the job's status. When `toStatus` is omitted, restores the
   * previous status from the history timeline; falls back to "new".
   */
  onUndo: (job: Job, toStatus?: string) => void;
}

const EVENT_URGENCY_STYLES: Record<string, string> = {
  past: "bg-gray-100 text-gray-500 border-gray-200",
  today: "bg-rose-50 text-rose-700 border-rose-200",
  soon: "bg-amber-50 text-amber-700 border-amber-200",
  later: "bg-violet-50 text-violet-700 border-violet-200",
};

export default function AppliedJobCard({
  job,
  isUpdating,
  followUpThresholdDays,
  onStatusChange,
  onQuickFollowUp,
  onSaveNotes,
  onOpenStatusModal,
  onUndo,
}: AppliedJobCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const openStatusModal = (status: AppliedStatus) => {
    setIsMenuOpen(false);
    onOpenStatusModal(job, status);
  };

  const meta = getStatusMeta(job.status);
  const followUpState = getFollowUpState(job);
  const showFollowUpHint = needsFollowUp(job, followUpThresholdDays);
  const eventUrgency = getEventUrgency(job.next_event_at);
  const hasHistory = (job.status_history?.length ?? 0) > 0;
  const hasNotes = Boolean(job.notes && job.notes.trim());
  const score = job.resume_score;

  return (
    <div
      className={`group relative rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:shadow-md ${
        showFollowUpHint ? "border-amber-200" : "border-gray-100"
      }`}
    >
      {/* Left status accent bar */}
      <span
        aria-hidden
        className={`absolute left-0 top-6 h-[calc(100%-3rem)] w-1 rounded-r-full ${meta.barClass} opacity-60`}
      />

      <div className="p-5 pl-6">
        <div className="flex items-start gap-4">
          {/* Company avatar */}
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-sm ${getCompanyAvatarClass(
              job.company
            )}`}
          >
            {getCompanyInitials(job.company)}
          </div>

          {/* Main info */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-gray-900">
                {job.job_title}
              </h3>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.pillClass}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
                {meta.label}
              </span>
              {showFollowUpHint && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  {followUpState === "overdue"
                    ? "Follow-up overdue"
                    : followUpState === "due"
                      ? "Follow up now"
                      : "Consider following up"}
                </span>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" />
                {job.company}
              </span>
              {job.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {job.location}
                </span>
              )}
              <span>{formatAppliedAgo(job)}</span>
              {typeof score === "number" && (
                <span className="inline-flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5" />
                  <span
                    className={`font-semibold tabular-nums ${
                      score >= 70
                        ? "text-emerald-600"
                        : score >= 50
                          ? "text-indigo-600"
                          : "text-gray-500"
                    }`}
                  >
                    {score}
                  </span>
                  match
                </span>
              )}
            </div>

            {/* Next event banner */}
            {job.next_event_at && (
              <div
                className={`mt-3 inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                  EVENT_URGENCY_STYLES[eventUrgency ?? "later"]
                }`}
              >
                <CalendarClock className="h-4 w-4 shrink-0" />
                <span className="truncate font-medium">
                  {job.next_event_label || "Interview"}
                </span>
                <span className="shrink-0 text-xs opacity-75">
                  {formatDateTime(job.next_event_at)}
                </span>
              </div>
            )}

            {/* Follow-up reminder banner */}
            {!job.next_event_at && job.follow_up_at && followUpState && (
              <div
                className={`mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                  followUpState === "upcoming"
                    ? "border-sky-200 bg-sky-50 text-sky-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                <Bell className="h-4 w-4 shrink-0" />
                <span>
                  {followUpState === "overdue"
                    ? `Follow-up overdue — due ${formatDateTime(job.follow_up_at)}`
                    : followUpState === "due"
                      ? "Follow up today"
                      : `Follow up on ${formatDateTime(job.follow_up_at)}`}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Status quick-change menu */}
            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                disabled={isUpdating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                aria-label="Change application status"
              >
                {isUpdating ? (
                  "Saving..."
                ) : (
                  <>
                    <span className={`h-2 w-2 rounded-full ${meta.dotClass}`} />
                    <MoreHorizontal className="h-4 w-4" />
                  </>
                )}
              </button>
              {isMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsMenuOpen(false)}
                  />
                  <div className="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
                    <div className="border-b border-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      Move to
                    </div>
                    {(Object.keys(APPLIED_STATUS_META) as AppliedStatus[])
                      .filter((key) => key !== job.status)
                      .map((key) => {
                        const optionMeta = APPLIED_STATUS_META[key];
                        return (
                          <button
                            key={key}
                            onClick={() => openStatusModal(key)}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${optionMeta.dotClass}`}
                            />
                            {optionMeta.label}
                          </button>
                        );
                      })}
                  </div>
                </>
              )}
            </div>

            {/* Expand toggle */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {isExpanded ? "Hide" : "Details"}
            </button>
          </div>
        </div>

        {/* Expanded section */}
        {isExpanded && (
          <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
            <NotesEditor
              jobId={job.job_id}
              initialNotes={job.notes || ""}
              onSave={onSaveNotes}
            />
            {hasHistory && <StatusTimeline history={job.status_history || []} />}
            {!hasHistory && (
              <p className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5 text-xs text-gray-400">
                Status changes will appear here as a timeline.
              </p>
            )}

            {/* Action links */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href={`/jobs/${job.job_id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                <Info className="h-3.5 w-3.5" />
                Job details
              </Link>
              <a
                href={jobPostingUrl(job)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Original posting
              </a>
              {job.customized_resume_id && (
                <Link
                  href={`/jobs/${job.job_id}/resumes/${job.customized_resume_id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Tailored resume
                </Link>
              )}
              {job.status === "applied" && !job.follow_up_at && (
                <button
                  onClick={() => onQuickFollowUp(job, 7)}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
                >
                  <Bell className="h-3.5 w-3.5" />
                  Remind me in 7 days
                </button>
              )}
              {/* Undo: revert an accidental application back to the pipeline */}
              <button
                onClick={() =>
                  onUndo(
                    job,
                    job.status_history?.length ? undefined : "new"
                  )
                }
                disabled={isUpdating}
                title="Revert this application — the job goes back to its previous state"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Undo application
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
