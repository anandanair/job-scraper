"use client";

import { useRealtimeJobs } from "@/components/providers/RealtimeJobsProvider";
import { RefreshCw, X, Sparkles, Flame, FileText } from "lucide-react";

export default function RealtimeUpdateBanner() {
  const {
    hasUpdates,
    pendingMessage,
    pendingType,
    isRefreshing,
    triggerRefresh,
    dismiss,
  } = useRealtimeJobs();

  if (!hasUpdates) return null;

  const renderIcon = () => {
    switch (pendingType) {
      case "scored":
        return <Flame size={15} className="text-amber-400 shrink-0" />;
      case "customized":
        return <FileText size={15} className="text-purple-400 shrink-0" />;
      case "new_jobs":
      default:
        return <Sparkles size={15} className="text-indigo-400 shrink-0" />;
    }
  };

  return (
    <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 pointer-events-auto transition-all animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-2.5 sm:gap-3.5 px-4 py-2 bg-slate-900/95 hover:bg-slate-900 text-white text-xs sm:text-sm font-medium rounded-full shadow-2xl border border-indigo-500/30 backdrop-blur-md">
        {/* Pulsing beacon indicator */}
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>

        {renderIcon()}

        <span className="truncate max-w-[240px] sm:max-w-none text-slate-100 font-medium">
          {pendingMessage}
        </span>

        {/* Click to update action */}
        <button
          type="button"
          onClick={triggerRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-70 cursor-pointer"
          title="Refresh page to load fresh data"
        >
          <RefreshCw
            size={12}
            className={`transition-transform ${isRefreshing ? "animate-spin" : ""}`}
          />
          <span>{isRefreshing ? "Updating..." : "Update"}</span>
        </button>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={dismiss}
          className="text-slate-400 hover:text-white p-1 rounded-full transition-colors cursor-pointer -mr-1"
          title="Dismiss notification"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
