"use client";

import { StatusHistoryEntry } from "@/types";
import { getStatusMeta, formatDateTime } from "@/lib/applied-status";
import { History } from "lucide-react";

export default function StatusTimeline({
  history,
}: {
  history: StatusHistoryEntry[];
}) {
  if (history.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <History className="h-3.5 w-3.5" />
        Timeline
      </div>
      <ol className="space-y-0">
        {history.map((entry, idx) => {
          const meta = getStatusMeta(entry.to);
          const isLast = idx === history.length - 1;
          return (
            <li key={`${entry.at}-${idx}`} className="relative flex gap-3 pb-3 last:pb-0">
              {/* Connector line */}
              {!isLast && (
                <span
                  aria-hidden
                  className="absolute left-[5px] top-4 h-full w-px bg-gray-200"
                />
              )}
              <span
                className={`relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-gray-50 ${meta.dotClass}`}
              />
              <div className="min-w-0">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{meta.label}</span>
                  {entry.note && (
                    <span className="text-gray-500"> — {entry.note}</span>
                  )}
                </p>
                <p className="text-xs text-gray-400">
                  {formatDateTime(entry.at)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
