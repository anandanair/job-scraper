"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export type RealtimeUpdateType =
  | "new_jobs"
  | "scored"
  | "customized"
  | "general";

interface RealtimeJobsContextType {
  hasUpdates: boolean;
  pendingCount: number;
  pendingType: RealtimeUpdateType;
  pendingMessage: string;
  isRefreshing: boolean;
  triggerRefresh: () => Promise<void>;
  dismiss: () => void;
  markJobMutated: (jobId: string) => void;
}

const RealtimeJobsContext = createContext<RealtimeJobsContextType | null>(null);

export function useRealtimeJobs() {
  const context = useContext(RealtimeJobsContext);
  if (!context) {
    // Fail-soft fallback so components can render safely even outside provider
    return {
      hasUpdates: false,
      pendingCount: 0,
      pendingType: "general" as RealtimeUpdateType,
      pendingMessage: "",
      isRefreshing: false,
      triggerRefresh: async () => {},
      dismiss: () => {},
      markJobMutated: () => {},
    };
  }
  return context;
}

interface RealtimeJobsProviderProps {
  children: ReactNode;
}

export function RealtimeJobsProvider({ children }: RealtimeJobsProviderProps) {
  const router = useRouter();
  const [hasUpdates, setHasUpdates] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingType, setPendingType] = useState<RealtimeUpdateType>("general");
  const [pendingMessage, setPendingMessage] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Transient set of job_ids mutated locally in this tab so we don't notify the user of their own actions
  const recentlyMutatedJobIds = useRef<Set<string>>(new Set());

  // Buffer incoming Realtime events over 2 seconds to group batch scrapes cleanly
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedEventsRef = useRef<{
    inserts: number;
    scored: number;
    customized: number;
  }>({
    inserts: 0,
    scored: 0,
    customized: 0,
  });

  const markJobMutated = useCallback((jobId: string) => {
    if (!jobId) return;
    recentlyMutatedJobIds.current.add(jobId);
    setTimeout(() => {
      recentlyMutatedJobIds.current.delete(jobId);
    }, 12000); // 12-second TTL for local mutations
  }, []);

  const triggerRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      router.refresh();
      // Brief settling delay for smooth UI transition
      await new Promise((resolve) => setTimeout(resolve, 800));
    } finally {
      setIsRefreshing(false);
      setHasUpdates(false);
      setPendingCount(0);
      setPendingMessage("");
      accumulatedEventsRef.current = { inserts: 0, scored: 0, customized: 0 };
    }
  }, [router]);

  const dismiss = useCallback(() => {
    setHasUpdates(false);
    setPendingCount(0);
    setPendingMessage("");
    accumulatedEventsRef.current = { inserts: 0, scored: 0, customized: 0 };
  }, []);

  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch (err) {
      console.warn("[RealtimeJobsProvider] Supabase client unavailable:", err);
      return;
    }

    const channel = supabase
      .channel("jobtrack-realtime-jobs")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "jobs",
        },
        (payload) => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;
          const targetJobId = newRow?.job_id || oldRow?.job_id;

          // Ignore mutations originating from this user's clicks in this tab
          if (targetJobId && recentlyMutatedJobIds.current.has(targetJobId)) {
            return;
          }

          if (payload.eventType === "INSERT") {
            if (newRow && newRow.is_active !== false) {
              accumulatedEventsRef.current.inserts += 1;
            }
          } else if (payload.eventType === "UPDATE") {
            if (
              newRow?.customized_resume_id &&
              (!oldRow || !oldRow.customized_resume_id)
            ) {
              accumulatedEventsRef.current.customized += 1;
            } else if (
              newRow?.resume_score !== null &&
              newRow?.resume_score !== undefined &&
              (!oldRow ||
                oldRow.resume_score === null ||
                oldRow.resume_score === undefined ||
                oldRow.resume_score !== newRow.resume_score)
            ) {
              accumulatedEventsRef.current.scored += 1;
            } else {
              accumulatedEventsRef.current.inserts += 1;
            }
          }

          // Debounce updates by 2s to group batch jobs
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }

          debounceTimerRef.current = setTimeout(() => {
            const { inserts, scored, customized } =
              accumulatedEventsRef.current;
            const total = inserts + scored + customized;
            if (total === 0) return;

            let type: RealtimeUpdateType = "general";
            let msg = "";

            if (inserts > 0 && scored === 0 && customized === 0) {
              type = "new_jobs";
              msg = `✨ ${inserts} new job${inserts === 1 ? "" : "s"} discovered`;
            } else if (scored > 0 && inserts === 0 && customized === 0) {
              type = "scored";
              msg = `🎯 ${scored} job${scored === 1 ? "" : "s"} newly evaluated with AI`;
            } else if (customized > 0 && inserts === 0 && scored === 0) {
              type = "customized";
              msg = `📄 ${customized} new tailored resume${customized === 1 ? "" : "s"} ready`;
            } else {
              type = "general";
              msg = `✨ ${total} new job update${total === 1 ? "" : "s"} available`;
            }

            setPendingCount(total);
            setPendingType(type);
            setPendingMessage(msg);
            setHasUpdates(true);
          }, 2000);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Connected cleanly to Supabase Realtime
        } else if (status === "CHANNEL_ERROR") {
          console.warn("[RealtimeJobsProvider] WebSocket subscription error");
        }
      });

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <RealtimeJobsContext.Provider
      value={{
        hasUpdates,
        pendingCount,
        pendingType,
        pendingMessage,
        isRefreshing,
        triggerRefresh,
        dismiss,
        markJobMutated,
      }}
    >
      {children}
    </RealtimeJobsContext.Provider>
  );
}
