"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PaginationControls from "./PaginationControls";
import {
  Briefcase,
  Star,
  ArrowUpDown,
  AlertTriangle,
} from "lucide-react";
import { Job } from "@/types";
import {
  APPLIED_STATUS_META,
  APPLIED_STATUSES,
  AppliedStatus,
  formatDateTimeForInput,
  needsFollowUp,
} from "@/lib/applied-status";
import AppliedJobCard from "./applied/AppliedJobCard";
import AppliedStatsBar, { FollowUpBanner } from "./applied/AppliedStatsBar";
import StatusChangeModal from "./applied/StatusChangeModal";
import Toast, { ToastData } from "./applied/Toast";
import { AppliedStatusCounts } from "@/lib/supabase/queries";

interface AppliedJobsListProps {
  jobs: Job[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  statusCounts: AppliedStatusCounts;
  followUpThresholdDays: number;
}

type SortField = "application_date" | "resume_score" | "follow_up_at";

export default function AppliedJobsList({
  jobs,
  currentPage,
  totalPages,
  totalCount,
  statusCounts,
  followUpThresholdDays,
}: AppliedJobsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null);
  const [modalJob, setModalJob] = useState<Job | null>(null);
  const [modalStatus, setModalStatus] = useState<AppliedStatus>("applied");
  const [toast, setToast] = useState<ToastData | null>(null);

  const activeStatusFilter = searchParams.get("applicationStatus") || "all";
  const followUpOnly = searchParams.get("followUpOnly") === "true";
  const sortBy = searchParams.get("sortBy");

  const showToast = useCallback(
    (message: string, type: "success" | "error", onUndo?: () => void) => {
      setToast({ id: Date.now(), message, type, onUndo });
    },
    []
  );

  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "" || value === "all") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      params.delete("page");
      const qs = params.toString();
      router.push(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    },
    [searchParams, router]
  );

  /**
   * Reverts a job's status. When `toStatus` is omitted, restores the previous
   * status from the history timeline (falling back to "new"), resetting
   * tracking fields when leaving the applied pipeline entirely.
   */
  const handleUndoStatus = useCallback(
    async (job: Job, toStatus?: string) => {
      const history = job.status_history ?? [];
      const previousStatus =
        toStatus ??
        (history.length >= 2
          ? history[history.length - 2].to
          : history[0]?.from) ??
        "new";
      setUpdatingJobId(job.job_id);
      try {
        const leavingPipeline = !APPLIED_STATUSES.includes(
          previousStatus as AppliedStatus
        );
        const response = await fetch(`/api/jobs/${job.job_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: previousStatus,
            // Reset tracking fields when reverting out of the applied pipeline
            ...(leavingPipeline
              ? {
                  application_date: null,
                  follow_up_at: null,
                  next_event_at: null,
                  next_event_label: null,
                }
              : {}),
          }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            errorData?.error || `HTTP error! status: ${response.status}`
          );
        }
        showToast(`Reverted to ${previousStatus}`, "success");
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "An unknown error occurred.";
        showToast(`Error: ${message}`, "error");
      } finally {
        setUpdatingJobId(null);
      }
    },
    [router, showToast]
  );

  const handleStatusChange = useCallback(
    async (
      job: Job,
      payload: {
        status: AppliedStatus;
        next_event_at: string | null;
        next_event_label: string | null;
        follow_up_at: string | null;
        note: string;
      }
    ) => {
      setUpdatingJobId(job.job_id);
      try {
        const response = await fetch(`/api/jobs/${job.job_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: payload.status,
            next_event_at: payload.next_event_at,
            next_event_label: payload.next_event_label,
            follow_up_at: payload.follow_up_at,
            note: payload.note || undefined,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            errorData?.error || `HTTP error! status: ${response.status}`
          );
        }

        setModalJob(null);
        const previousStatus = job.status;
        showToast(
          `Moved to ${APPLIED_STATUS_META[payload.status].label}`,
          "success",
          () => handleUndoStatus(job, previousStatus)
        );
        router.refresh();
      } catch (error) {
        console.error("Error updating job status:", error);
        const message =
          error instanceof Error ? error.message : "An unknown error occurred.";
        showToast(`Error: ${message}`, "error");
        throw error instanceof Error ? error : new Error(message);
      } finally {
        setUpdatingJobId(null);
      }
    },
    [router, showToast, handleUndoStatus]
  );

  const handleQuickFollowUp = useCallback(
    async (job: Job, days: number) => {
      const due = new Date();
      due.setDate(due.getDate() + days);
      setUpdatingJobId(job.job_id);
      try {
        const response = await fetch(`/api/jobs/${job.job_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            follow_up_at: due.toISOString(),
          }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            errorData?.error || `HTTP error! status: ${response.status}`
          );
        }
        showToast(`Reminder set for ${days} days from now`, "success");
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "An unknown error occurred.";
        showToast(`Error: ${message}`, "error");
      } finally {
        setUpdatingJobId(null);
      }
    },
    [router, showToast]
  );

  const handleSaveNotes = useCallback(
    async (jobId: string, notes: string) => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            errorData?.error || `HTTP error! status: ${response.status}`
          );
        }
        showToast("Note saved", "success");
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "An unknown error occurred.";
        showToast(`Error: ${message}`, "error");
        throw error;
      }
    },
    [router, showToast]
  );

  const openStatusModal = useCallback((job: Job, status: AppliedStatus) => {
    setModalJob(job);
    setModalStatus(status);
  }, []);

  const sortOptions: { field: SortField; label: string }[] = [
    { field: "application_date", label: "Date applied" },
    { field: "resume_score", label: "Match score" },
    { field: "follow_up_at", label: "Follow-up" },
  ];

  const EmptyState = () => {
    const isFiltered = activeStatusFilter !== "all" || followUpOnly;
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
        <div className="mb-4 rounded-full bg-gray-100 p-5">
          {isFiltered ? (
            <AlertTriangle className="h-8 w-8 text-gray-400" />
          ) : (
            <Briefcase className="h-8 w-8 text-gray-400" />
          )}
        </div>
        <h3 className="text-base font-semibold text-gray-900">
          {isFiltered ? "No applications match this filter" : "No applications yet"}
        </h3>
        <p className="mt-1 max-w-sm text-sm text-gray-500">
          {isFiltered
            ? "Try a different status filter or clear your search."
            : "Mark jobs as applied from the Top Matches or Tailored lists and they will show up here for tracking."}
        </p>
        {isFiltered ? (
          <button
            onClick={() => updateSearchParams({ applicationStatus: null, followUpOnly: null, query: null })}
            className="mt-5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Clear filters
          </button>
        ) : (
          <Link
            href="/jobs/top-matches"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <Star className="h-4 w-4" />
            Browse Top Matches
          </Link>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <AppliedStatsBar
        counts={statusCounts}
        activeFilter={activeStatusFilter}
        onSelectFilter={(key) =>
          updateSearchParams({
            applicationStatus: key === "all" ? null : key,
            followUpOnly: null,
          })
        }
      />

      {/* Follow-up banner */}
      <FollowUpBanner
        count={statusCounts.needsFollowUp}
        active={followUpOnly}
        onClick={() =>
          updateSearchParams({
            followUpOnly: followUpOnly ? null : "true",
            applicationStatus: null,
          })
        }
      />

      {/* Toolbar: sort + result count */}
      {totalCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            {totalCount} application{totalCount === 1 ? "" : "s"}
            {activeStatusFilter !== "all" &&
              ` · ${
                APPLIED_STATUS_META[activeStatusFilter as AppliedStatus]?.label ??
                activeStatusFilter
              }`}
            {followUpOnly && " · needs attention"}
          </p>
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
            {sortOptions.map((opt) => (
              <button
                key={opt.field}
                onClick={() => {
                  const newOrder =
                    sortBy === opt.field &&
                    searchParams.get("sortOrder") === "asc"
                      ? "desc"
                      : "asc";
                  updateSearchParams({
                    sortBy: opt.field,
                    sortOrder: newOrder,
                    page: null,
                  });
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  sortBy === opt.field
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Job cards */}
      {jobs.length > 0 ? (
        <div className="space-y-3">
          {jobs.map((job) => (
            <AppliedJobCard
              key={job.job_id}
              job={job}
              isUpdating={updatingJobId === job.job_id}
              followUpThresholdDays={followUpThresholdDays}
              onStatusChange={handleStatusChange}
              onQuickFollowUp={handleQuickFollowUp}
              onSaveNotes={handleSaveNotes}
              onOpenStatusModal={openStatusModal}
              onUndo={handleUndoStatus}
            />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <PaginationControls currentPage={currentPage} totalPages={totalPages} />
        </div>
      )}

      {/* Status change modal */}
      {modalJob && (
        <StatusChangeModal
          job={modalJob}
          targetStatus={modalStatus}
          initialEventAt={modalJob.next_event_at ?? null}
          initialEventLabel={modalJob.next_event_label ?? null}
          initialFollowUpAt={
            modalJob.follow_up_at
              ? formatDateTimeForInput(modalJob.follow_up_at)
              : null
          }
          onClose={() => setModalJob(null)}
          onSubmit={(payload) => handleStatusChange(modalJob, payload)}
        />
      )}

      {/* Toast */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}