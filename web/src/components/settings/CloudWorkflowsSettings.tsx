"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  GitFork,
  ExternalLink,
  Clock,
  Globe,
  MapPin,
  CheckCircle2,
  Calendar,
  Sparkles,
  Play,
  Square,
  RefreshCw,
  Terminal,
  AlertCircle,
  Zap,
} from "lucide-react";
import { AppSettings, AutomationWorkflowId, AutomationRun } from "@/types";
import {
  getAllowedExecutionTimes,
  getDefaultScheduleTime,
  normalizeTimezone,
  isValidTimezone,
} from "@/lib/schedule-utils";
import { ExecutionLogModal } from "./ExecutionLogModal";

interface CloudWorkflowsSettingsProps {
  settings: AppSettings;
  onChange?: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onNavigateToLogs?: () => void;
}

interface GitRepoInfo {
  detected: boolean;
  owner?: string | null;
  repo: string;
  isUpstream: boolean;
  upstreamOwner: string;
  upstreamRepo: string;
}

interface RunningWorkflowInfo {
  workflow_id: AutomationWorkflowId;
  pid: number;
  started_at: string;
  options?: any;
}

const COMMON_TIMEZONES = [
  { value: "Asia/Singapore", label: "Singapore (SGT / UTC+8)" },
  { value: "Asia/Kolkata", label: "India (IST / UTC+5:30)" },
  { value: "America/New_York", label: "US Eastern (EST/EDT / UTC-5)" },
  { value: "America/Chicago", label: "US Central (CST/CDT / UTC-6)" },
  { value: "America/Denver", label: "US Mountain (MST/MDT / UTC-7)" },
  { value: "America/Los_Angeles", label: "US Pacific (PST/PDT / UTC-8)" },
  { value: "Europe/London", label: "London (GMT/BST / UTC+0)" },
  { value: "Europe/Berlin", label: "Central Europe (CET/CEST / UTC+1)" },
  { value: "Asia/Dubai", label: "Dubai (GST / UTC+4)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST / UTC+9)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT / UTC+10)" },
];

const WORKFLOWS: {
  id: string;
  workflowId: AutomationWorkflowId;
  name: string;
  schedule: string;
  cron: string;
  description: string;
  badge: string;
}[] = [
  {
    id: "scrape_jobs.yml",
    workflowId: "scrape_jobs",
    name: "Daily Job Scraper",
    schedule: "Hourly gatekeeper (12 * * * *)",
    cron: "12 * * * *",
    description: "Evaluates your local timezone schedule hourly and scrapes LinkedIn & CareersFuture for fresh postings.",
    badge: "TypeScript Engine",
  },
  {
    id: "score_jobs.yml",
    workflowId: "score_jobs",
    name: "AI Job Scorer",
    schedule: "Every 4 hours (offset :17)",
    cron: "17 */4 * * *",
    description: "Evaluates unscored jobs against your Master Resume and generates ATS fit scores.",
    badge: "Node.js Worker",
  },
  {
    id: "hourly_resume_customization.yml",
    workflowId: "customize_resumes",
    name: "ATS Resume Tailor",
    schedule: "Every 4 hours (offset :47)",
    cron: "47 */4 * * *",
    description: "Performs 3-stage personalization and generates PDF resumes for top-scoring jobs.",
    badge: "PDFKit Engine",
  },
  {
    id: "job_manager.yml",
    workflowId: "job_manager",
    name: "Job Expiration Manager",
    schedule: "Daily at 1:25 AM SGT (17:25 UTC)",
    cron: "25 17 * * *",
    description: "Pings live job URLs, archives expired postings, and maintains clean database state.",
    badge: "Housekeeping",
  },
];

export function CloudWorkflowsSettings({ settings, onChange, onNavigateToLogs }: CloudWorkflowsSettingsProps) {
  const [repoInfo, setRepoInfo] = useState<GitRepoInfo>({
    detected: false,
    owner: null,
    repo: "job-scraper",
    isUpstream: true,
    upstreamOwner: "anandanair",
    upstreamRepo: "job-scraper",
  });
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("");

  // Local Automation Runner States
  const [runningWorkflows, setRunningWorkflows] = useState<RunningWorkflowInfo[]>([]);
  const [forceBypass, setForceBypass] = useState<boolean>(true);
  const [dryRun, setDryRun] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
    workflowId?: AutomationWorkflowId;
    workflowName?: string;
  } | null>(null);
  const [activeModalRun, setActiveModalRun] = useState<AutomationRun | null>(null);

  const currentTz = settings.schedule_timezone || "Asia/Singapore";
  const currentHour = typeof settings.schedule_hour === "number" ? settings.schedule_hour : 19;
  const currentMinute = typeof settings.schedule_minute === "number" ? settings.schedule_minute : 0;

  // Poll running workflows status
  const fetchRunningWorkflows = useCallback(async () => {
    try {
      const res = await fetch("/api/system/trigger-workflow");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.runningWorkflows)) {
          setRunningWorkflows(data.runningWorkflows);
        }
      }
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    fetchRunningWorkflows();
    const interval = setInterval(fetchRunningWorkflows, runningWorkflows.length > 0 ? 1500 : 4000);
    return () => clearInterval(interval);
  }, [fetchRunningWorkflows, runningWorkflows.length]);

  // 1. Calculate dynamically allowed running times for the selected timezone
  const allowedTimes = useMemo(() => {
    return getAllowedExecutionTimes(currentTz);
  }, [currentTz]);

  // Keep live local clock updated
  useEffect(() => {
    const updateClock = () => {
      try {
        const fmt = new Intl.DateTimeFormat("en-US", {
          timeZone: normalizeTimezone(currentTz),
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });
        setCurrentTimeStr(fmt.format(new Date()));
      } catch {
        setCurrentTimeStr("");
      }
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [currentTz]);

  // Fetch repository information from /api/setup/github
  useEffect(() => {
    let isMounted = true;
    fetch("/api/setup/github")
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data) {
          setRepoInfo({
            detected: data.detected,
            owner: data.owner,
            repo: data.repo || "job-scraper",
            isUpstream: data.isUpstream,
            upstreamOwner: data.upstreamOwner || "anandanair",
            upstreamRepo: data.upstreamRepo || "job-scraper",
          });
        }
      })
      .catch((err) => console.warn("Failed to check github info:", err));

    return () => {
      isMounted = false;
    };
  }, []);

  const handleTimezoneChange = (newTz: string) => {
    if (!onChange) return;
    const def = getDefaultScheduleTime(newTz);
    onChange("schedule_timezone", newTz);
    onChange("schedule_hour", def.hour);
    onChange("schedule_minute", def.minute);
  };

  const handleDetectBrowserTimezone = () => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected && isValidTimezone(detected)) {
        handleTimezoneChange(detected);
      }
    } catch (e) {
      console.warn("Could not detect browser timezone:", e);
    }
  };

  const handleTimeSlotSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!onChange) return;
    const [hStr, mStr] = e.target.value.split(":");
    const hour = parseInt(hStr, 10);
    const minute = parseInt(mStr, 10);
    onChange("schedule_hour", hour);
    onChange("schedule_minute", minute);
  };

  const handleOpenLiveModal = (workflowId: AutomationWorkflowId, name: string) => {
    const running = runningWorkflows.find((r) => r.workflow_id === workflowId);
    const nowIso = new Date().toISOString();
    setActiveModalRun({
      id: "live-" + workflowId,
      workflow_name: name,
      workflow_id: workflowId,
      status: "running",
      trigger_type: "local_web",
      started_at: running ? running.started_at : nowIso,
      metrics: {},
      error_count: 0,
      warning_count: 0,
      errors_list: [],
      created_at: nowIso,
    });
  };

  const handleRunWorkflowLocally = async (workflowId: AutomationWorkflowId, workflowName: string) => {
    try {
      setActionLoadingId(workflowId);
      setFeedback(null);

      const res = await fetch("/api/system/trigger-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow_id: workflowId,
          force: forceBypass,
          dryRun: dryRun,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({
          type: "error",
          text: data.error || `Failed to trigger ${workflowName}.`,
        });
      } else {
        setFeedback({
          type: "success",
          text: `Started ${workflowName} locally (PID: ${data.pid}).`,
          workflowId,
          workflowName,
        });
        await fetchRunningWorkflows();
        // Do NOT auto-launch stream: user can click "Watch Live Stream" or "Watch Live Terminal"
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || `Network error triggering ${workflowName}.`,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelWorkflow = async (workflowId: AutomationWorkflowId, workflowName: string) => {
    try {
      setActionLoadingId(workflowId);
      setFeedback(null);

      const res = await fetch("/api/system/trigger-workflow", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow_id: workflowId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({
          type: "error",
          text: data.error || `Failed to cancel ${workflowName}.`,
        });
      } else {
        setFeedback({
          type: "info",
          text: `Terminated ${workflowName} successfully.`,
        });
        await fetchRunningWorkflows();
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || `Network error canceling ${workflowName}.`,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Format last scraped timestamp
  const lastScrapedDisplay = useMemo(() => {
    if (!settings.last_scraped_at) return "Never";
    try {
      const d = new Date(settings.last_scraped_at);
      if (isNaN(d.getTime())) return "Never";
      return new Intl.DateTimeFormat("en-US", {
        timeZone: normalizeTimezone(currentTz),
        dateStyle: "medium",
        timeStyle: "short",
      }).format(d);
    } catch {
      return "Never";
    }
  }, [settings.last_scraped_at, currentTz]);

  const repoOwner = repoInfo.owner || repoInfo.upstreamOwner;
  const repoName = repoInfo.repo || repoInfo.upstreamRepo;
  const actionsUrl = `https://github.com/${repoOwner}/${repoName}/actions`;

  // Determine minute pattern (:00 or :30) for informational label
  const sampleSlotMinute = allowedTimes[0]?.minute ?? 0;
  const minutePatternStr = sampleSlotMinute === 0 ? "top of the hour (:00)" : `half-hour (:${sampleSlotMinute.toString().padStart(2, "0")})`;

  return (
    <div className="space-y-6">
      {/* 1. Repository Status Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 text-white backdrop-blur-xs border border-white/10 shadow-xs">
              <GitFork className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  Cloud GitHub Automation
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Active Fork
                </span>
              </div>
              <p className="text-sm sm:text-base font-extrabold mt-0.5">
                {repoOwner}/{repoName}
              </p>
            </div>
          </div>

          <div>
            <a
              href={actionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-2 shadow-xs"
            >
              <span>GitHub Actions</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* 2. Interactive Daily Job Scraper Scheduling Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <label className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Daily Job Scraper Schedule
              </label>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Select your local timezone and preferred daily run time. The background workflow evaluates hourly and scrapes fresh jobs at your scheduled time.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleDetectBrowserTimezone}
              className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition inline-flex items-center gap-1.5 shadow-2xs"
              title="Automatically detect timezone from your current browser"
            >
              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
              <span>Detect My Timezone</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Timezone Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                Local Timezone
              </span>
              {currentTimeStr && (
                <span className="text-[11px] font-mono text-indigo-600 bg-indigo-50/70 px-2 py-0.5 rounded border border-indigo-100">
                  {currentTimeStr}
                </span>
              )}
            </label>
            <select
              value={currentTz}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              className="w-full text-xs sm:text-sm font-medium border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs"
            >
              {COMMON_TIMEZONES.some((tz) => tz.value === currentTz) ? null : (
                <option value={currentTz}>
                  {currentTz} (Current Configuration)
                </option>
              )}
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              Current IANA ID: <span className="font-mono text-slate-700 font-semibold">{currentTz}</span>
            </p>
          </div>

          {/* Timezone-Aware Allowed Running Times */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Preferred Run Time
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                Runs once daily
              </span>
            </label>
            <select
              value={`${currentHour}:${currentMinute}`}
              onChange={handleTimeSlotSelect}
              className="w-full text-xs sm:text-sm font-medium border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs"
            >
              {allowedTimes.map((slot) => {
                const val = `${slot.hour24}:${slot.minute}`;
                const isRec = slot.isRecommended;
                return (
                  <option key={val} value={val}>
                    {slot.label} {isRec ? "(Recommended - Evening)" : ""}
                  </option>
                );
              })}
            </select>
            <p className="text-[11px] text-slate-500">
              Slots occur at the <span className="font-semibold text-slate-700">{minutePatternStr}</span> based on your timezone offset.
            </p>
          </div>
        </div>

        {/* Schedule Summary & Last Scraped Status Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-slate-700 font-medium">
              Daily Scrape Schedule:{" "}
              <strong className="text-slate-900 font-bold">
                {allowedTimes.find((t) => t.hour24 === currentHour && t.minute === currentMinute)?.label ||
                  `${currentHour}:${currentMinute.toString().padStart(2, "0")}`}
              </strong>{" "}
              ({currentTz})
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-500">
            <span>Last Completed Run:</span>
            <span className="font-mono text-slate-700 font-semibold bg-white px-2 py-0.5 rounded border border-slate-200">
              {lastScrapedDisplay}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Local Automation Runner & Cloud Workflows */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-600" />
              <label className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                Automation Workflows & On-Demand Local Runner
              </label>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Trigger any background job on demand locally with real-time live terminal streaming, or inspect automated runs.
            </p>
          </div>

          {/* Local Run Options Toolbar */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={forceBypass}
                onChange={(e) => setForceBypass(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 border-slate-300"
              />
              <span>Force Bypass Daily Caps & Schedule</span>
            </label>

            <span className="text-slate-300">|</span>

            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 border-slate-300"
              />
              <span>Dry-Run (Simulate Only)</span>
            </label>
          </div>
        </div>

        {/* Action Feedback Banner */}
        {feedback && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 border ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : feedback.type === "error"
                ? "bg-rose-50 text-rose-800 border-rose-200"
                : "bg-indigo-50 text-indigo-800 border-indigo-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
              {feedback.type === "error" && <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
              {feedback.type === "info" && <RefreshCw className="w-4 h-4 shrink-0 text-indigo-600" />}
              <span>{feedback.text}</span>
            </div>
            {feedback.workflowId && feedback.workflowName && (
              <button
                type="button"
                onClick={() => handleOpenLiveModal(feedback.workflowId!, feedback.workflowName!)}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shrink-0 shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Watch Live Stream</span>
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {WORKFLOWS.map((wf) => {
            const runningRec = runningWorkflows.find((r) => r.workflow_id === wf.workflowId);
            const isRunning = Boolean(runningRec);
            const isLoading = actionLoadingId === wf.workflowId;

            return (
              <div
                key={wf.id}
                className={`p-4 rounded-xl border transition-all ${
                  isRunning
                    ? "border-emerald-300 bg-emerald-50/20 shadow-md ring-2 ring-emerald-500/20"
                    : "border-slate-200/90 bg-white shadow-xs"
                } space-y-3 flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isRunning
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse"
                          : "bg-indigo-50 text-indigo-700 border-indigo-200"
                      }`}
                    >
                      {isRunning ? "● Running Locally" : wf.badge}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      {wf.cron}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900">{wf.name}</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {wf.description}
                  </p>

                  {/* Active running info */}
                  {isRunning && runningRec && (
                    <div className="mt-2 text-[11px] text-emerald-700 font-mono bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
                        <span>PID: {runningRec.pid}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenLiveModal(wf.workflowId, wf.name)}
                        className="font-bold underline hover:no-underline text-emerald-800 flex items-center gap-1"
                      >
                        <Terminal className="w-3 h-3" />
                        <span>Watch Live Terminal</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    {isRunning ? (
                      <button
                        type="button"
                        onClick={() => handleCancelWorkflow(wf.workflowId, wf.name)}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 shadow-2xs transition disabled:opacity-50"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Stop Run</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRunWorkflowLocally(wf.workflowId, wf.name)}
                        disabled={isLoading || runningWorkflows.length > 0}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-2xs transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title={runningWorkflows.length > 0 ? "Another workflow is currently running locally" : "Trigger execution immediately"}
                      >
                        {isLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                        <span>Run Locally</span>
                      </button>
                    )}
                  </div>

                  <a
                    href={`https://github.com/${repoOwner}/${repoName}/actions/workflows/${wf.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-500 hover:text-indigo-600 font-semibold inline-flex items-center gap-1 text-xs"
                  >
                    <span>Cloud History</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Terminal Modal */}
      {activeModalRun && (
        <ExecutionLogModal run={activeModalRun} onClose={() => setActiveModalRun(null)} />
      )}
    </div>
  );
}
