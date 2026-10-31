"use client";

import { useEffect, useRef, useState } from "react";
import { X, CalendarClock, Bell, StickyNote, ChevronRight } from "lucide-react";
import { Job } from "@/types";
import {
  APPLIED_STATUS_META,
  AppliedStatus,
  formatDateTimeForInput,
  getStatusMeta,
} from "@/lib/applied-status";

interface StatusChangeModalProps {
  job: Job;
  targetStatus: AppliedStatus;
  /** Pre-fill the interview/event fields from the job's current values */
  initialEventAt: string | null;
  initialEventLabel: string | null;
  initialFollowUpAt: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    status: AppliedStatus;
    next_event_at: string | null;
    next_event_label: string | null;
    follow_up_at: string | null;
    note: string;
  }) => Promise<void>;
}

const QUICK_FOLLOW_UPS = [
  { label: "3 days", days: 3 },
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
];

export default function StatusChangeModal({
  job,
  targetStatus,
  initialEventAt,
  initialEventLabel,
  initialFollowUpAt,
  onClose,
  onSubmit,
}: StatusChangeModalProps) {
  const [status, setStatus] = useState<AppliedStatus>(targetStatus);
  const [eventAt, setEventAt] = useState(
    formatDateTimeForInput(initialEventAt)
  );
  const [eventLabel, setEventLabel] = useState(initialEventLabel || "");
  const [followUpAt, setFollowUpAt] = useState(
    formatDateTimeForInput(initialFollowUpAt)
  );
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const setQuickFollowUp = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setFollowUpAt(formatDateTimeForInput(d.toISOString()));
  };

  const handleSubmit = async () => {
    setError(null);
    if (status === "interviewing" && eventAt && !eventLabel.trim()) {
      setError("Give the interview a label (e.g. Technical Interview).");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        status,
        next_event_at: eventAt ? new Date(eventAt).toISOString() : null,
        next_event_label: eventAt ? eventLabel.trim() || "Interview" : null,
        follow_up_at: followUpAt ? new Date(followUpAt).toISOString() : null,
        note: note.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
      setIsSubmitting(false);
    }
  };

  const currentMeta = getStatusMeta(job.status);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Update application status"
        className="max-h-[90vh] w-full max-w-lg animate-slide-up overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-gray-100 bg-white px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">
              Update application status
            </h2>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {job.job_title} · {job.company}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Status picker */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(APPLIED_STATUS_META) as AppliedStatus[]).map(
                (key) => {
                  const meta = APPLIED_STATUS_META[key];
                  const isSelected = status === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setStatus(key)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                        isSelected
                          ? meta.pillActiveClass + " shadow-sm"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isSelected ? "bg-white" : meta.dotClass
                        }`}
                      />
                      {meta.label}
                      {job.status === key && (
                        <span
                          className={`ml-auto text-[10px] font-semibold uppercase tracking-wide ${
                            isSelected ? "text-white/80" : "text-gray-400"
                          }`}
                        >
                          Current
                        </span>
                      )}
                    </button>
                  );
                }
              )}
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {APPLIED_STATUS_META[status].description}
            </p>
          </div>

          {/* Interview scheduling (contextual) */}
          {status === "interviewing" && (
            <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-violet-800">
                <CalendarClock className="h-4 w-4" />
                Schedule interview
              </div>
              <div className="space-y-3">
                <input
                  type="datetime-local"
                  value={eventAt}
                  onChange={(e) => setEventAt(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
                <input
                  type="text"
                  value={eventLabel}
                  onChange={(e) => setEventLabel(e.target.value)}
                  placeholder="e.g. Technical Interview Round 2"
                  maxLength={120}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
            </div>
          )}

          {/* Follow-up reminder */}
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-800">
              <Bell className="h-4 w-4" />
              Follow-up reminder
              <span className="text-xs font-normal text-amber-600">
                (optional)
              </span>
            </div>
            <input
              type="datetime-local"
              value={followUpAt}
              onChange={(e) => setFollowUpAt(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_FOLLOW_UPS.map((q) => (
                <button
                  key={q.days}
                  type="button"
                  onClick={() => setQuickFollowUp(q.days)}
                  className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
                >
                  in {q.label}
                </button>
              ))}
              {followUpAt && (
                <button
                  type="button"
                  onClick={() => setFollowUpAt("")}
                  className="rounded-full px-3 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              <StickyNote className="h-4 w-4 text-gray-400" />
              Note
              <span className="text-xs font-normal text-gray-400">
                (added to the timeline)
              </span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="e.g. Recruiter Sarah said decision expected next week"
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-gray-100 bg-white px-6 py-4">
          <p className="hidden text-xs text-gray-400 sm:block">
            {currentMeta.label} → {APPLIED_STATUS_META[status].label}
          </p>
          <div className="flex flex-1 justify-end gap-3 sm:flex-none">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : "Save"}
              {!isSubmitting && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
