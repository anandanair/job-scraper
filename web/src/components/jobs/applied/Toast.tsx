"use client";

import { useEffect } from "react";
import { CheckCircle2, XCircle, X, Undo2 } from "lucide-react";

export interface ToastData {
  id: number;
  message: string;
  type: "success" | "error";
  /** When set, shows an Undo button that triggers this callback */
  onUndo?: () => void;
}

export default function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastData | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[100] max-w-sm animate-slide-up"
      role="status"
      aria-live="polite"
    >
      <div
        className={`flex items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur-sm ${
          toast.type === "success"
            ? "border-emerald-200 bg-emerald-50/95 text-emerald-800"
            : "border-rose-200 bg-rose-50/95 text-rose-800"
        }`}
      >
        {toast.type === "success" ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
        )}
        <p className="text-sm font-medium">{toast.message}</p>
        {toast.onUndo && (
          <button
            onClick={() => {
              toast.onUndo?.();
              onDismiss();
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Undo
          </button>
        )}
        <button
          onClick={onDismiss}
          className="ml-auto shrink-0 rounded-md p-0.5 text-gray-400 transition-colors hover:bg-gray-200/60 hover:text-gray-600"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
