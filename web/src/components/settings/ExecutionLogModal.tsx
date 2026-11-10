"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  X,
  Copy,
  Check,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Terminal,
  Activity,
  Layers,
  ArrowDown,
  RefreshCw,
  Square,
} from "lucide-react";
import { AutomationRun } from "@/types";

interface ExecutionLogModalProps {
  run: AutomationRun;
  onClose: () => void;
}

export function ExecutionLogModal({ run, onClose }: ExecutionLogModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Live state
  const [liveLogs, setLiveLogs] = useState<string[]>(() => {
    if (run.log_output && run.log_output.trim().length > 0) {
      return run.log_output.split("\n");
    }
    return [];
  });
  const [isLive, setIsLive] = useState<boolean>(() => run.status === "running" || run.id.startsWith("live-"));
  const [liveStatus, setLiveStatus] = useState<string>(run.id.startsWith("live-") ? "running" : run.status);
  const [liveSummary, setLiveSummary] = useState<string | undefined>(run.summary || undefined);
  const [liveMetrics, setLiveMetrics] = useState<Record<string, any>>(run.metrics || {});
  const [durationSeconds, setDurationSeconds] = useState<number | null>(run.duration_seconds ?? null);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Sync state whenever run prop changes
  useEffect(() => {
    if (run.log_output && run.log_output.trim().length > 0) {
      setLiveLogs(run.log_output.split("\n"));
    }
    const live = run.status === "running" || run.id.startsWith("live-");
    setIsLive(live);
    setLiveStatus(run.id.startsWith("live-") ? "running" : run.status);
    setLiveSummary(run.summary || undefined);
    setLiveMetrics(run.metrics || {});
    setDurationSeconds(run.duration_seconds ?? null);
  }, [run]);

  // Initial fetch for logs if empty (supports recently completed local runs)
  useEffect(() => {
    let isMounted = true;
    if (liveLogs.length === 0) {
      fetch(`/api/system/trigger-workflow?workflow_id=${run.workflow_id}&logs=true`)
        .then((res) => res.json())
        .then((data) => {
          if (isMounted && data.success && Array.isArray(data.logs) && data.logs.length > 0) {
            setLiveLogs(data.logs);
            if (data.isRunning === false && !run.status) {
              setLiveStatus("success");
              setIsLive(false);
            }
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [run.workflow_id, liveLogs.length, run.status]);

  // Poll live logs while running
  useEffect(() => {
    if (!isLive) return;

    let isMounted = true;

    const pollLiveLogs = async () => {
      try {
        let localIsRunning = true;

        // 1. Fetch live in-memory lines from local API runner (authoritative source for active process)
        const res = await fetch(`/api/system/trigger-workflow?workflow_id=${run.workflow_id}&logs=true`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success) {
            if (Array.isArray(data.logs) && data.logs.length > 0) {
              setLiveLogs(data.logs);
            }
            localIsRunning = Boolean(data.isRunning);
            if (!localIsRunning) {
              setIsLive(false);
              setLiveStatus(data.exit_code === 0 ? "success" : data.exit_code === null ? "stopped" : "failed");
            }
          }
        }

        // 2. Poll Supabase telemetry record for metrics & summary updates
        const runRes = await fetch(`/api/system/automation-runs?workflow_id=${run.workflow_id}&limit=1`);
        if (runRes.ok) {
          const runData = await runRes.json();
          if (isMounted && runData.success && Array.isArray(runData.runs) && runData.runs.length > 0) {
            const latest = runData.runs[0];
            const runStartTime = new Date(run.started_at).getTime();
            const latestStartTime = new Date(latest.started_at).getTime();

            // Only adopt Supabase telemetry if the record was started around or after this run trigger
            // (10s tolerance for clock skew)
            const isMatchingRun = isNaN(latestStartTime) || latestStartTime >= runStartTime - 10000;

            if (isMatchingRun) {
              if (latest.status) setLiveStatus(latest.status);
              if (latest.summary) setLiveSummary(latest.summary);
              if (latest.metrics) setLiveMetrics(latest.metrics);
              if (typeof latest.duration_seconds === "number") setDurationSeconds(latest.duration_seconds);

              // Only stop isLive via Supabase if the local runner also confirmed the process is no longer active
              if (!localIsRunning && latest.status !== "running") {
                setIsLive(false);
                if (latest.log_output && latest.log_output.length > 0) {
                  setLiveLogs(latest.log_output.split("\n"));
                }
              }
            }
          }
        }
      } catch (err) {
        // Non-fatal polling error
      }
    };

    pollLiveLogs();
    const interval = setInterval(pollLiveLogs, 1200);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isLive, run.workflow_id, run.started_at]);

  // Auto-scroll to bottom as new log lines stream in
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveLogs.length, autoScroll]);

  // Format date and duration
  const startTime = new Date(run.started_at);
  const formattedStart = startTime.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });

  const durationText = useMemo(() => {
    if (typeof durationSeconds === "number") {
      if (durationSeconds < 60) {
        return `${durationSeconds.toFixed(1)}s`;
      }
      const mins = Math.floor(durationSeconds / 60);
      const secs = (durationSeconds % 60).toFixed(0);
      return `${mins}m ${secs}s`;
    }
    return isLive ? "Running..." : "Completed";
  }, [durationSeconds, isLive]);

  // Filter logs by search term
  const filteredLogs = useMemo<string[]>(() => {
    if (liveLogs.length === 0) return [];
    if (!searchTerm.trim()) return liveLogs;
    const lower = searchTerm.toLowerCase();
    return liveLogs.filter((l: string) => l.toLowerCase().includes(lower));
  }, [liveLogs, searchTerm]);

  // Copy full logs to clipboard
  const handleCopy = async () => {
    try {
      const fullText = liveLogs.join("\n") || "No logs available.";
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy logs:", err);
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isSuccess = liveStatus === "success";
  const isWarning = liveStatus === "warning";
  const isFailed = liveStatus === "failed";
  const isStopped = liveStatus === "stopped";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl flex items-center justify-center ${
                isSuccess
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : isWarning
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : isFailed
                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  : isStopped
                  ? "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                  : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
              }`}
            >
              {isSuccess && <CheckCircle2 className="w-5 h-5" />}
              {isWarning && <AlertTriangle className="w-5 h-5" />}
              {isFailed && <XCircle className="w-5 h-5" />}
              {isStopped && <Square className="w-4 h-4 text-slate-400" />}
              {isLive && <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-white">{run.workflow_name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-md font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  {run.workflow_id}
                </span>

                {isLive ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>LIVE STREAMING</span>
                  </span>
                ) : (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                      isSuccess
                        ? "bg-emerald-500/20 text-emerald-300"
                        : isWarning
                        ? "bg-amber-500/20 text-amber-300"
                        : isFailed
                        ? "bg-rose-500/20 text-rose-300"
                        : isStopped
                        ? "bg-slate-700/60 text-slate-300 border border-slate-600"
                        : "bg-sky-500/20 text-sky-300"
                    }`}
                  >
                    {liveStatus}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                <span>{formattedStart}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {durationText}
                </span>
                <span>•</span>
                <span className="capitalize">{run.trigger_type.replace("_", " ")}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {run.github_run_url && (
              <a
                href={run.github_run_url}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition-colors"
              >
                <span>GitHub Action</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Telemetry Summary & Highlights */}
        <div className="px-5 py-3.5 bg-slate-900/60 border-b border-slate-800/80 space-y-2 shrink-0">
          {(liveSummary || isLive) && (
            <div className="text-xs sm:text-sm text-slate-200">
              <span className="text-slate-400 font-semibold mr-1.5">Summary:</span>
              <span>{liveSummary || (isLive ? "Worker executing locally..." : "Completed execution.")}</span>
            </div>
          )}

          {/* Metrics Pills */}
          {liveMetrics && Object.keys(liveMetrics).length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                Metrics:
              </span>
              {Object.entries(liveMetrics).map(([key, val]) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-mono bg-slate-800/80 text-indigo-300 border border-slate-700"
                >
                  <span className="text-slate-400">{key}:</span>
                  <span className="font-semibold text-slate-200">
                    {typeof val === "object" ? JSON.stringify(val) : String(val)}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Terminal Controls Toolbar */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>live_stream.log</span>
            <span className="text-slate-500">({filteredLogs.length} lines)</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-scroll toggle */}
            <button
              type="button"
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
                autoScroll
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
              title="Automatically follow new output"
            >
              <ArrowDown className={`w-3 h-3 ${autoScroll ? "text-emerald-400" : "text-slate-500"}`} />
              <span>Auto-Scroll {autoScroll ? "ON" : "OFF"}</span>
            </button>

            {/* Log Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter logs..."
                className="w-32 sm:w-44 pl-8 pr-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-md border border-slate-700 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Logs</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dark Terminal Output Body */}
        <div className="flex-1 min-h-[260px] max-h-[520px] overflow-y-auto p-4 bg-slate-950 font-mono text-[11px] sm:text-xs leading-relaxed text-slate-300 select-text">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 py-12">
              {searchTerm ? "No log lines match your search filter." : (
                <div className="flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                  <span>Waiting for worker process stdout output...</span>
                </div>
              )}
            </div>
          ) : (
            filteredLogs.map((line: string, idx: number) => {
              // Syntax colorize log lines based on keywords
              let lineClass = "text-slate-300";
              if (line.includes("[ERROR]") || line.includes("✗") || line.includes("Fatal error") || line.includes("[stderr]")) {
                lineClass = "text-rose-400 font-semibold";
              } else if (line.includes("[WARN]") || line.includes("⚠") || line.includes("429")) {
                lineClass = "text-amber-300";
              } else if (line.includes("✓") || line.includes("[SUCCESS]")) {
                lineClass = "text-emerald-400";
              } else if (line.includes("[INFO]") || line.includes("[CLI]") || line.includes("[Schedule]") || line.includes("[FORCE BYPASS]")) {
                lineClass = "text-sky-300";
              } else if (line.startsWith("===") || line.startsWith("---")) {
                lineClass = "text-slate-500";
              }

              return (
                <div key={idx} className={`hover:bg-slate-900/60 px-1 py-0.5 rounded transition-colors whitespace-pre-wrap ${lineClass}`}>
                  {line}
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
}
