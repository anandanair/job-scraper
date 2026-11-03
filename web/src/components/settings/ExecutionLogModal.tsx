"use client";

import React, { useState, useMemo } from "react";
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
} from "lucide-react";
import { AutomationRun } from "@/types";

interface ExecutionLogModalProps {
  run: AutomationRun;
  onClose: () => void;
}

export function ExecutionLogModal({ run, onClose }: ExecutionLogModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [copied, setCopied] = useState(false);

  // Format date and duration
  const startTime = new Date(run.started_at);
  const formattedStart = startTime.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });

  const durationText = useMemo(() => {
    if (typeof run.duration_seconds === "number") {
      if (run.duration_seconds < 60) {
        return `${run.duration_seconds.toFixed(1)}s`;
      }
      const mins = Math.floor(run.duration_seconds / 60);
      const secs = (run.duration_seconds % 60).toFixed(0);
      return `${mins}m ${secs}s`;
    }
    return run.completed_at ? "Completed" : "Running...";
  }, [run.duration_seconds, run.completed_at]);

  // Filter logs by search term
  const filteredLogs = useMemo<string[]>(() => {
    if (!run.log_output) return [];
    const lines = run.log_output.split("\n");
    if (!searchTerm.trim()) return lines;
    const lower = searchTerm.toLowerCase();
    return lines.filter((l: string) => l.toLowerCase().includes(lower));
  }, [run.log_output, searchTerm]);

  // Copy full logs to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(run.log_output || "No logs available.");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy logs:", err);
    }
  };

  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
                run.status === "success"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : run.status === "warning"
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : run.status === "failed"
                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
              }`}
            >
              {run.status === "success" && <CheckCircle2 className="w-5 h-5" />}
              {run.status === "warning" && <AlertTriangle className="w-5 h-5" />}
              {run.status === "failed" && <XCircle className="w-5 h-5" />}
              {run.status === "running" && <Activity className="w-5 h-5 animate-pulse" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{run.workflow_name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-md font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  {run.workflow_id}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                    run.status === "success"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : run.status === "warning"
                      ? "bg-amber-500/20 text-amber-300"
                      : run.status === "failed"
                      ? "bg-rose-500/20 text-rose-300"
                      : "bg-sky-500/20 text-sky-300"
                  }`}
                >
                  {run.status}
                </span>
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
          {run.summary && (
            <div className="text-xs sm:text-sm text-slate-200">
              <span className="text-slate-400 font-semibold mr-1.5">Summary:</span>
              <span>{run.summary}</span>
            </div>
          )}

          {/* Metrics Pills */}
          {run.metrics && Object.keys(run.metrics).length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                Metrics:
              </span>
              {Object.entries(run.metrics).map(([key, val]) => (
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

          {/* Warnings & Errors Notice */}
          {(run.warning_count > 0 || run.error_count > 0 || (run.errors_list && run.errors_list.length > 0)) && (
            <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Telemetry Flag: {run.warning_count} warning(s), {run.error_count} error(s)
                </span>
              </div>
              {run.errors_list && run.errors_list.length > 0 && (
                <ul className="list-disc list-inside space-y-0.5 text-amber-300/90 pl-1 font-mono text-[11px]">
                  {run.errors_list.map((msg: string, idx: number) => (
                    <li key={idx} className="truncate" title={msg}>
                      {msg}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Terminal Controls Toolbar */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>execution_output.log</span>
            <span className="text-slate-600">({filteredLogs.length} lines)</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Log Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter logs..."
                className="w-36 sm:w-48 pl-8 pr-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
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
        <div className="flex-1 min-h-[250px] max-h-[500px] overflow-y-auto p-4 bg-slate-950 font-mono text-[11px] sm:text-xs leading-relaxed text-slate-300 select-text">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 py-12">
              {searchTerm ? "No log lines match your search filter." : "No console logs recorded for this run."}
            </div>
          ) : (
            filteredLogs.map((line: string, idx: number) => {
              // Syntax colorize log lines based on keywords
              let lineClass = "text-slate-300";
              if (line.includes("[ERROR]") || line.includes("✗") || line.includes("Fatal error")) {
                lineClass = "text-rose-400 font-semibold";
              } else if (line.includes("[WARN]") || line.includes("⚠") || line.includes("429")) {
                lineClass = "text-amber-300";
              } else if (line.includes("✓") || line.includes("[SUCCESS]")) {
                lineClass = "text-emerald-400";
              } else if (line.includes("[INFO]") || line.includes("[CLI]") || line.includes("[Schedule]")) {
                lineClass = "text-sky-300";
              } else if (line.startsWith("===") || line.startsWith("---")) {
                lineClass = "text-slate-500";
              }

              return (
                <div key={idx} className={`hover:bg-slate-900/60 px-1 rounded transition-colors ${lineClass}`}>
                  {line}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
