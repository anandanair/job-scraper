"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRealtimeJobs } from "@/components/providers/RealtimeJobsProvider";

export default function RefreshButton({
  currentPage,
}: {
  currentPage: number;
}) {
  const router = useRouter();
  const [localRefreshing, setLocalRefreshing] = useState(false);
  const { hasUpdates, pendingCount, isRefreshing: realtimeRefreshing, triggerRefresh } = useRealtimeJobs();

  const isRefreshing = localRefreshing || realtimeRefreshing;

  const handleRefresh = async () => {
    if (hasUpdates) {
      await triggerRefresh();
      return;
    }
    setLocalRefreshing(true);
    router.refresh();
    setTimeout(() => {
      setLocalRefreshing(false);
    }, 1000);
  };

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`inline-flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs sm:text-sm font-medium transition-colors shadow-2xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-60 ${
        hasUpdates
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          : "border-zinc-200/90 text-zinc-700 bg-white hover:bg-zinc-50 hover:border-zinc-300"
      }`}
      title={hasUpdates ? `${pendingCount} new updates ready` : "Refresh jobs"}
    >
      {hasUpdates ? (
        <span className="relative flex h-2 w-2 mr-0.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
      ) : (
        <RefreshCw
          size={14}
          className={`text-zinc-500 ${isRefreshing ? "animate-spin" : ""}`}
        />
      )}
      <span>
        {isRefreshing
          ? "Refreshing..."
          : hasUpdates
            ? `Update (${pendingCount})`
            : "Refresh"}
      </span>
    </button>
  );
}
