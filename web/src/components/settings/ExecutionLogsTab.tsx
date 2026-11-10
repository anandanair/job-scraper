"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Terminal,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  Filter,
  Info,
  Layers,
  Sparkles,
  Play,
  ChevronDown,
  Check,
  Square,
} from "lucide-react";
import { AutomationRun, AutomationWorkflowId } from "@/types";
import { ExecutionLogModal } from "./ExecutionLogModal";

interface StatsData {
  total: number;
  success: number;
  warning: number;
  failed: number;
  stopped?: number;
  running: number;
}

const WORKFLOW_FILTERS: { id: string; label: string; workflowId?: AutomationWorkflowId }[] = [
  { id: "all", label: "All Workflows" },
  { id: "scrape_jobs", label: "Job Scraper", workflowId: "scrape_jobs" },
  { id: "score_jobs", label: "AI Scorer", workflowId: "score_jobs" },
  { id: "customize_resumes", label: "Resume Tailor", workflowId: "customize_resumes" },
  { id: "job_manager", label: "Expiration Manager", workflowId: "job_manager" },
];

const STATUS_FILTERS = [
  { id: "all", label: "All Statuses" },
  { id: "success", label: "Success" },
  { id: "warning", label: "Warnings" },
  { id: "failed", label: "Failed" },
  { id: "stopped", label: "Stopped" },
];

function formatTimeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== "number") return "-";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(0);
  return `${mins}m ${secs}s`;
}

export function ExecutionLogsTab() {
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [stats, setStats] = useState<StatsData>({
    total: 0,
    success: 0,
    warning: 0,
    failed: 0,
    running: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedWorkflow, setSelectedWorkflow] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Trigger dropdown states
  const [triggerDropdownOpen, setTriggerDropdownOpen] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [triggerFeedback, setTriggerFeedback] = useState<{
    text: string;
    workflowId?: AutomationWorkflowId;
    workflowName?: string;
    isError?: boolean;
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchRuns = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedWorkflow !== "all") params.set("workflow_id", selectedWorkflow);
      if (selectedStatus !== "all") params.set("status", selectedStatus);
      params.set("limit", "100");

      const res = await fetch(`/api/system/automation-runs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load automation runs");
      const json = await res.json();

      if (json.success) {
        setRuns(json.runs || []);
        if (json.stats) setStats(json.stats);
      }
    } catch (err) {
      console.error("Error loading execution logs:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedWorkflow, selectedStatus]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Auto-refresh interval (every 10s if toggled)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchRuns();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchRuns]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTriggerDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTriggerFromLogs = async (workflowId: AutomationWorkflowId, name: string) => {
    try {
      setTriggerLoading(true);
      setTriggerDropdownOpen(false);
      const res = await fetch("/api/system/trigger-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow_id: workflowId, force: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setTriggerFeedback({
          text: `Error: ${data.error || "Failed to trigger workflow."}`,
          isError: true,
        });
      } else {
        setTriggerFeedback({
          text: `Started ${name} locally (PID: ${data.pid}).`,
          workflowId,
          workflowName: name,
        });
        setAutoRefresh(true);
        setTimeout(() => fetchRuns(), 1200);
      }
    } catch (e: any) {
      setTriggerFeedback({
        text: `Error: ${e?.message || "Network error"}`,
        isError: true,
      });
    } finally {
      setTriggerLoading(false);
      setTimeout(() => setTriggerFeedback(null), 8000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Explainer */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              Workflow Execution Telemetry
              <span className="text-xs font-normal text-indigo-300 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                100 Runs Retention
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live execution logs, non-fatal rate-limit warnings, and runtime metrics for all GitHub Action and local workflows.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
          {/* Run Job Locally Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setTriggerDropdownOpen(!triggerDropdownOpen)}
              disabled={triggerLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
            >
              {triggerLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Run Job Locally</span>
              <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
            </button>

            {triggerDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-30 py-1.5 text-xs divide-y divide-slate-800">
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Select Workflow To Run
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => handleTriggerFromLogs("scrape_jobs", "Daily Job Scraper")}
                    className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition"
                  >
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    <span>Daily Job Scraper</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTriggerFromLogs("score_jobs", "AI Job Scorer")}
                    className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>AI Job Scorer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTriggerFromLogs("customize_resumes", "ATS Resume Tailor")}
                    className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>ATS Resume Tailor</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTriggerFromLogs("job_manager", "Job Expiration Manager")}
                    className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition"
                  >
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    <span>Job Expiration Manager</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              autoRefresh
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`}
            />
            <span>Auto-Refresh {autoRefresh ? "ON" : "OFF"}</span>
          </button>

          <button
            type="button"
            onClick={fetchRuns}
            disabled={loading}
            className="p-1.5 px-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Trigger Feedback Notification */}
      {triggerFeedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between gap-2 border ${
            triggerFeedback.isError
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-indigo-50 border-indigo-200 text-indigo-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <Info className={`w-4 h-4 shrink-0 ${triggerFeedback.isError ? "text-rose-600" : "text-indigo-600"}`} />
            <span>{triggerFeedback.text}</span>
          </div>

          {triggerFeedback.workflowId && triggerFeedback.workflowName && (
            <button
              type="button"
              onClick={() => {
                const nowIso = new Date().toISOString();
                setSelectedRun({
                  id: "live-" + triggerFeedback.workflowId,
                  workflow_name: triggerFeedback.workflowName!,
                  workflow_id: triggerFeedback.workflowId!,
                  status: "running",
                  trigger_type: "local_web",
                  started_at: nowIso,
                  metrics: {},
                  error_count: 0,
                  warning_count: 0,
                  errors_list: [],
                  created_at: nowIso,
                });
              }}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shrink-0 shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Watch Live Stream</span>
            </button>
          )}
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Runs */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Recorded Runs</div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{stats.total}</div>
          </div>
        </div>

        {/* Success Runs */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Successful</div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-600">{stats.success}</div>
          </div>
        </div>

        {/* Warning Runs (Rate limits etc.) */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              Warnings
              <span className="text-[10px] text-slate-400 font-normal">(429 / retry)</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-amber-600">{stats.warning}</div>
          </div>
        </div>

        {/* Failed Runs */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Failed</div>
            <div className="text-xl sm:text-2xl font-bold text-rose-600">{stats.failed}</div>
          </div>
        </div>

        {/* Stopped Runs */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600">
            <Square className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Stopped</div>
            <div className="text-xl sm:text-2xl font-bold text-slate-700">{stats.stopped || 0}</div>
          </div>
        </div>
      </div>

      {/* Filter Pills Toolbar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
        {/* Workflow Filters */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Workflow:
          </span>
          {WORKFLOW_FILTERS.map((wf) => {
            const isActive = selectedWorkflow === wf.id;
            return (
              <button
                key={wf.id}
                type="button"
                onClick={() => setSelectedWorkflow(wf.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {wf.label}
              </button>
            );
          })}
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1 border-t border-slate-100">
          <span className="text-xs font-semibold text-slate-400 mr-2 flex items-center gap-1">
            Status:
          </span>
          {STATUS_FILTERS.map((st) => {
            const isActive = selectedStatus === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStatus(st.id)}
                className={`px-2.5 py-0.5 rounded-md text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                {st.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Runs List */}
      <div className="space-y-3">
        {loading && runs.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-sm text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            <p className="text-sm font-medium">Loading automation telemetry...</p>
          </div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-sm text-slate-500">
            <Terminal className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-slate-800">No automation runs found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Runs are recorded whenever an actual scraping, scoring, tailoring, or manager job executes. Skipped
              hourly gatekeeper evaluations are excluded to preserve telemetry storage.
            </p>
          </div>
        ) : (
          runs.map((run) => {
            const isSuccess = run.status === "success";
            const isWarning = run.status === "warning";
            const isFailed = run.status === "failed";
            const isStopped = run.status === "stopped";

            return (
              <div
                key={run.id}
                onClick={() => setSelectedRun(run)}
                className="group p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Status Icon + Title + Details */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 p-2 rounded-xl shrink-0 ${
                        isSuccess
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                          : isWarning
                          ? "bg-amber-50 text-amber-600 border border-amber-100"
                          : isFailed
                          ? "bg-rose-50 text-rose-600 border border-rose-100"
                          : isStopped
                          ? "bg-slate-100 text-slate-600 border border-slate-200"
                          : "bg-sky-50 text-sky-600 border border-sky-100"
                      }`}
                    >
                      {isSuccess && <CheckCircle2 className="w-4 h-4" />}
                      {isWarning && <AlertTriangle className="w-4 h-4" />}
                      {isFailed && <XCircle className="w-4 h-4" />}
                      {isStopped && <Square className="w-4 h-4" />}
                      {run.status === "running" && <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {run.workflow_name}
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {run.workflow_id}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isSuccess
                              ? "bg-emerald-100 text-emerald-800"
                              : isWarning
                              ? "bg-amber-100 text-amber-800"
                              : isFailed
                              ? "bg-rose-100 text-rose-800"
                              : isStopped
                              ? "bg-slate-200 text-slate-700"
                              : "bg-sky-100 text-sky-800"
                          }`}
                        >
                          {run.status}
                        </span>

                        {/* Non-fatal warning flag */}
                        {run.warning_count > 0 && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            ⚠️ {run.warning_count} rate-limit warning(s)
                          </span>
                        )}
                      </div>

                      {/* Summary sentence */}
                      {run.summary && (
                        <p className="text-xs text-slate-600 line-clamp-1">{run.summary}</p>
                      )}

                      {/* Metrics tags */}
                      {run.metrics && Object.keys(run.metrics).length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {Object.entries(run.metrics).slice(0, 4).map(([k, v]) => (
                            <span
                              key={k}
                              className="text-[11px] px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200 font-mono"
                            >
                              <span className="text-slate-400">{k}:</span>{" "}
                              <span className="font-semibold text-slate-700">
                                {typeof v === "object" ? JSON.stringify(v) : String(v)}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Timing + Action Button */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                    <div className="text-right text-xs text-slate-500 space-y-0.5">
                      <div className="font-medium text-slate-700">{formatTimeAgo(run.started_at)}</div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>{formatDuration(run.duration_seconds)}</span>
                        <span>•</span>
                        <span className="capitalize">{run.trigger_type.replace("_", " ")}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {run.github_run_url && (
                        <a
                          href={run.github_run_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-colors"
                          title="Open GitHub Action Run"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRun(run);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          run.status === "running"
                            ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 animate-pulse font-bold"
                            : "text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200"
                        }`}
                      >
                        {run.status === "running" ? (
                          <>
                            <Terminal className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Watch Live Terminal</span>
                          </>
                        ) : (
                          <>
                            <span>View Logs</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Explanatory footer note */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
        <Info className="w-4 h-4 text-slate-400 shrink-0" />
        <span>
          Telemetry logs are automatically pruned to retain the latest 100 actual worker executions (~7 to 10 days of
          complete history across all 4 workflows). Skipped hourly schedule checks are omitted.
        </span>
      </div>

      {/* Modal Dialog */}
      {selectedRun && (
        <ExecutionLogModal run={selectedRun} onClose={() => setSelectedRun(null)} />
      )}
    </div>
  );
}
