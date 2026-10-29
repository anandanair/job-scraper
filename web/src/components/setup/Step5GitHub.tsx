"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Bot,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  Clock,
  Sparkles,
  Info,
  ArrowLeft,
  GitFork,
  Zap,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Layers,
  ChevronDown,
  ChevronUp,
  Sliders,
  Calculator,
  AlertTriangle,
} from "lucide-react";
import {
  CURATED_MODELS,
  ModelDefinition,
  calculateMonthlyCost,
} from "@/lib/setup/modelCatalog";

interface Step5GitHubProps {
  onBack: () => void;
  onFinish: () => void;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  llmApiKey?: string;
  llmModel?: string;
  llmTier?: "free" | "paid";
  llmProvider?: string;
  initialJobsPerDay?: number;
  initialResumesPerDay?: number;
}

interface GitRepoInfo {
  detected: boolean;
  owner?: string | null;
  repo: string;
  isUpstream: boolean;
  upstreamOwner: string;
  upstreamRepo: string;
}

export function Step5GitHub({
  onBack,
  onFinish,
  supabaseUrl = "",
  supabaseServiceRoleKey = "",
  llmApiKey = "",
  llmModel = "gemini-3.8-flash",
  llmTier = "free",
  llmProvider = "gemini",
  initialJobsPerDay,
  initialResumesPerDay,
}: Step5GitHubProps) {
  // --- Setup Mode State ---
  const [setupMode, setSetupMode] = useState<"auto" | "manual">("auto");

  // --- Auto-detect Git Repo Info ---
  const [repoInfo, setRepoInfo] = useState<GitRepoInfo>({
    detected: false,
    owner: null,
    repo: "job-scraper",
    isUpstream: true,
    upstreamOwner: "anandanair",
    upstreamRepo: "job-scraper",
  });
  const [isLoadingRepo, setIsLoadingRepo] = useState(true);

  // --- Model & Tier Definition ---
  const activeModelDef = useMemo<ModelDefinition>(() => {
    return (
      CURATED_MODELS.find((m) => m.id === llmModel) ||
      CURATED_MODELS[0]
    );
  }, [llmModel]);

  const isFreeTier = llmTier === "free" && activeModelDef.supportsFreeTier;

  // Maximum limits based on model free tier quota (RPD)
  // Scoring = 1 call, Tailoring = 3 calls
  const maxFreeRpd = activeModelDef.freeRpd || 500;

  // --- Daily Volume Sliders ---
  // Defaults to initial values from Step 2 or 10 jobs/day & 2 resumes/day
  const [jobsPerDay, setJobsPerDay] = useState(() => initialJobsPerDay || 10);
  const [resumesPerDay, setResumesPerDay] = useState(() => initialResumesPerDay || 2);

  // Computed batch limits per run (both run every 4 hours = 6 runs/day)
  const jobsPerRun = Math.max(1, Math.ceil(jobsPerDay / 6));
  const resumesPerRun = Math.max(1, Math.ceil(resumesPerDay / 6));

  // Cost & Rate-limit calculations
  const costCalc = useMemo(() => {
    return calculateMonthlyCost(activeModelDef, llmTier, jobsPerDay, resumesPerDay);
  }, [activeModelDef, llmTier, jobsPerDay, resumesPerDay]);

  // Dynamic slider limits
  const maxJobsAllowed = useMemo(() => {
    if (!isFreeTier) return 100;
    // Keep at least 3 calls for 1 resume if possible
    const availableForJobs = Math.max(1, maxFreeRpd - (resumesPerDay * 3));
    return Math.min(availableForJobs, 60);
  }, [isFreeTier, maxFreeRpd, resumesPerDay]);

  const maxResumesAllowed = useMemo(() => {
    if (!isFreeTier) return 20;
    const availableForResumes = Math.max(0, Math.floor((maxFreeRpd - jobsPerDay) / 3));
    return Math.min(Math.max(1, availableForResumes), 10);
  }, [isFreeTier, maxFreeRpd, jobsPerDay]);

  // Adjust sliders if current selection exceeds dynamic cap
  useEffect(() => {
    if (jobsPerDay > maxJobsAllowed) {
      setJobsPerDay(maxJobsAllowed);
    }
  }, [maxJobsAllowed, jobsPerDay]);

  useEffect(() => {
    if (resumesPerDay > maxResumesAllowed) {
      setResumesPerDay(maxResumesAllowed);
    }
  }, [maxResumesAllowed, resumesPerDay]);

  // Load existing batch preferences from app_settings on mount
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.settings) {
          const s = data.settings;
          if (typeof s.max_jobs_per_search?.daily_jobs === "number") {
            setJobsPerDay(s.max_jobs_per_search.daily_jobs);
          } else if (s.jobs_to_score_per_run && !initialJobsPerDay) {
            setJobsPerDay(s.jobs_to_score_per_run * 6);
          }
          if (typeof s.max_jobs_per_search?.daily_resumes === "number") {
            setResumesPerDay(s.max_jobs_per_search.daily_resumes);
          } else if (s.jobs_to_customize_per_run && !initialResumesPerDay) {
            setResumesPerDay(s.jobs_to_customize_per_run * 6);
          }
        }
      })
      .catch(() => {});
  }, [initialJobsPerDay, initialResumesPerDay]);

  // Save batch limits to Supabase
  const persistBatchLimits = async (scoreBatch: number, customizeBatch: number) => {
    try {
      const currentRes = await fetch("/api/settings");
      const currentData = currentRes.ok ? await currentRes.json() : null;
      const existingSettings = currentData?.settings || {};

      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobs_to_score_per_run: scoreBatch,
          jobs_to_customize_per_run: customizeBatch,
          max_jobs_per_search: {
            ...(existingSettings.max_jobs_per_search || {}),
            daily_jobs: jobsPerDay,
            daily_resumes: resumesPerDay,
          },
        }),
      });
    } catch (err) {
      console.warn("Could not persist batch settings:", err);
    }
  };

  // --- 1-Click Sync State ---
  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "authenticating" | "forking" | "encrypting" | "success" | "error">("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{
    username: string;
    targetRepo: string;
    forkCreated: boolean;
    repoUrl: string;
    actionsEnabled?: boolean;
    workflowDispatched?: boolean;
    localRemoteUpdated?: boolean;
  } | null>(null);

  // --- Manual Mode State ---
  const [manualUsername, setManualUsername] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showHousekeeping, setShowHousekeeping] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/setup/github")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) {
          setRepoInfo(data);
          if (data.owner && !data.isUpstream) {
            setManualUsername(data.owner);
          }
        }
      })
      .catch((err) => console.warn("Failed to check git info:", err))
      .finally(() => {
        if (isMounted) setIsLoadingRepo(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Copy helper
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // 1-Click Auto-Fork & Sync Handler
  const handleAutoSync = async () => {
    const trimmedToken = tokenInput.trim();
    if (!trimmedToken) {
      setSyncError("Please enter your GitHub Personal Access Token.");
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncStatus("authenticating");

    // Persist volume batch limits to database
    await persistBatchLimits(jobsPerRun, resumesPerRun);

    try {
      const res = await fetch("/api/setup/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: trimmedToken,
          supabaseUrl,
          supabaseServiceRoleKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sync secrets to GitHub.");
      }

      setSyncResult({
        username: data.username,
        targetRepo: data.targetRepo,
        forkCreated: data.forkCreated,
        repoUrl: data.repoUrl,
        actionsEnabled: data.actionsEnabled,
        workflowDispatched: data.workflowDispatched,
        localRemoteUpdated: data.localRemoteUpdated,
      });
      setSyncStatus("success");
    } catch (err: any) {
      setSyncStatus("error");
      setSyncError(err.message || "An unexpected error occurred while syncing with GitHub.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Finish button
  const handleCompleteSetup = async () => {
    await persistBatchLimits(jobsPerRun, resumesPerRun);
    onFinish();
  };

  const tokenCreationUrl =
    "https://github.com/settings/tokens/new?scopes=repo,workflow&description=JobTrack+Automation";

  const effectiveForkOwner =
    syncResult?.username || manualUsername.trim() || (repoInfo.owner && !repoInfo.isUpstream ? repoInfo.owner : "your-username");

  const manualSecretsUrl = `https://github.com/${effectiveForkOwner}/${repoInfo.repo}/settings/secrets/actions/new`;

  const secretsList = [
    {
      name: "SUPABASE_URL",
      value: supabaseUrl || "https://your-project.supabase.co",
      description: "Database REST endpoint from Step 1",
    },
    {
      name: "SUPABASE_SERVICE_ROLE_KEY",
      value: supabaseServiceRoleKey || "your-supabase-service-role-key",
      description: "Database admin service role key from Step 1",
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold uppercase tracking-wider mb-2">
          <Bot className="w-3.5 h-3.5" />
          Step 5: Cloud Scheduling & Rate-Limit Quotas
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Calibrate Daily Volumes & Connect GitHub Actions
        </h2>
        <p className="text-xs text-slate-600 mt-1 max-w-3xl">
          Set how many jobs to score and customize each day within your AI provider's safety limits. Your scheduled cloud workflows will automatically run on autopilot without needing your computer on.
        </p>
      </div>

      {/* 2. Volume & Quota Rate-Limit Sliders */}
      <div className="bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 rounded-2xl border border-indigo-100 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-indigo-100/70 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Daily Workload & Rate-Limit Guardrails
              </h3>
              <p className="text-[11px] text-slate-500">
                Calibrated for <span className="font-semibold text-slate-800">{activeModelDef.name}</span> (
                <span className={isFreeTier ? "text-emerald-700 font-bold" : "text-indigo-700 font-bold"}>
                  {isFreeTier ? `Free Tier • Max ${maxFreeRpd} calls/day` : "Paid Tier"}
                </span>
                )
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs font-bold text-slate-900 font-mono">
              {costCalc.dailyCalls} / {isFreeTier ? `${maxFreeRpd} max requests/day` : "day"}
            </span>
            <p className="text-[11px] text-slate-500">
              {isFreeTier ? (
                <span className="text-emerald-600 font-semibold">100% Free Tier Guaranteed</span>
              ) : (
                <span className="text-indigo-600 font-semibold">{costCalc.formattedCost}</span>
              )}
            </p>
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Slider 1: Jobs Scored / Day */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Jobs Scored / Day</span>
              <span className="font-bold text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded text-xs">
                {jobsPerDay} jobs/day
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={maxJobsAllowed}
              step={1}
              value={jobsPerDay}
              onChange={(e) => setJobsPerDay(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>1 job/day</span>
              <span className="text-indigo-600 font-semibold">{jobsPerRun} per run (6x/day)</span>
              <span>{maxJobsAllowed} max</span>
            </div>
            <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
              Runs every 4 hours. Evaluates <strong>{jobsPerRun} jobs per run</strong> to meet your {jobsPerDay} daily goal.
            </p>
          </div>

          {/* Slider 2: Resumes Tailored / Day */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Resumes Tailored / Day</span>
              <span className="font-bold text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded text-xs">
                {resumesPerDay} resumes/day
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={maxResumesAllowed}
              step={1}
              value={resumesPerDay}
              onChange={(e) => setResumesPerDay(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>1 resume</span>
              <span className="text-indigo-600 font-semibold">{resumesPerRun} per run (6x/day)</span>
              <span>{maxResumesAllowed} max</span>
            </div>
            <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
              Runs every 4 hours. Generates up to <strong>{resumesPerRun} customized PDF resumes per run</strong>.
            </p>
          </div>
        </div>

        {/* Free Quota Safety Meter */}
        {isFreeTier && (
          <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Rate-Limit Safe:</strong> Consumes {costCalc.dailyCalls} of {maxFreeRpd} daily requests. Safe buffer of {costCalc.bufferRemaining} calls remaining.
              </span>
            </div>
            <span className="font-bold font-mono text-[11px] text-emerald-700 shrink-0">
              {costCalc.rpdUsagePercent}% utilized
            </span>
          </div>
        )}
      </div>

      {/* 3. Scheduled Jobs Architecture Overview (No YAML filenames) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-indigo-600" />
            Configured Cloud Automations (Calibrated to Your Daily Volumes)
          </h3>
          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            ● 24/7 Cloud Actions Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Job 1: Scraper */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                  Discovery & Scraping
                </span>
                <span className="text-[11px] font-bold text-blue-800">Once Daily</span>
              </div>
              <h4 className="text-xs font-bold text-slate-900">Autonomous Job Scraper</h4>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                Discovers all postings published over the past 24 hours on LinkedIn & MyCareersFuture matching your target keywords.
              </p>
            </div>
            <p className="text-[10px] font-bold text-slate-600 pt-2 border-t border-slate-100">
              Runs Daily at 7:00 PM SGT
            </p>
          </div>

          {/* Job 2: Match Scorer */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                  AI Evaluation
                </span>
                <span className="text-[11px] font-bold text-indigo-800">Every 4 Hours</span>
              </div>
              <h4 className="text-xs font-bold text-slate-900">AI Job Match Scorer</h4>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                Evaluates incoming jobs against your Master Resume using Gemini to calculate match scores (0–100) and missing skills.
              </p>
            </div>
            <p className="text-[10px] font-bold text-indigo-700 pt-2 border-t border-slate-100">
              Scores {jobsPerRun} jobs/run &bull; {jobsPerDay} total/day
            </p>
          </div>

          {/* Job 3: Resume Tailoring */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">
                  Smart Tailoring
                </span>
                <span className="text-[11px] font-bold text-purple-800">Every 4 Hours</span>
              </div>
              <h4 className="text-xs font-bold text-slate-900">Resume Tailoring Engine</h4>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                Autonomously drafts custom ATS resumes in PDF format for high-matching jobs (≥ 75%) with your active styling.
              </p>
            </div>
            <p className="text-[10px] font-bold text-purple-700 pt-2 border-t border-slate-100">
              Tailors up to {resumesPerRun} resumes/run &bull; {resumesPerDay} total/day
            </p>
          </div>
        </div>

        {/* Housekeeping Dropdown */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowHousekeeping(!showHousekeeping)}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 transition"
          >
            <span>Secondary / Maintenance Automation (Daily Cleanup)</span>
            {showHousekeeping ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showHousekeeping && (
            <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between animate-in fade-in duration-150">
              <div>
                <p className="font-semibold text-slate-800">Database Lifecycle & Stale Job Manager</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Archives expired postings and maintains optimal query speeds. Runs daily at 1:00 AM SGT. (Not required for initial launch).
                </p>
              </div>
              <span className="text-[10px] font-semibold px-2 py-1 rounded bg-slate-200 text-slate-700 shrink-0">
                Housekeeping
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Execution Mode Selector Preview (Local Runner Coming Soon) */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
          <div>
            <p className="text-xs font-bold text-slate-800">Execution Architecture</p>
            <p className="text-[11px] text-slate-500">
              Cloud Actions run 24/7 on GitHub for free. Local Background Daemon is planned for future TypeScript scraper release.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 text-xs font-semibold">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white shadow-xs">
            Cloud Actions (24/7 Free)
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-400 cursor-not-allowed" title="Coming soon with full TypeScript scraper">
            Local Runner (Coming Soon)
          </span>
        </div>
      </div>

      {/* 5. GitHub Setup Tabs (1-Click Auto vs Manual) */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
        {/* Tab switch header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Configure Cloud Repository Secrets (Only 2 Secrets Required)
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Your AI Model and API Key are loaded dynamically from Supabase, so GitHub only needs database connection credentials.
            </p>
          </div>

          <div className="inline-flex p-1 bg-slate-100 rounded-xl shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSetupMode("auto")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                setupMode === "auto"
                  ? "bg-white text-indigo-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              1-Click Auto-Fork & Sync
            </button>
            <button
              type="button"
              onClick={() => setSetupMode("manual")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                setupMode === "manual"
                  ? "bg-white text-indigo-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Manual Copy & Paste
            </button>
          </div>
        </div>

        {/* Mode A: 1-Click Automated Sync */}
        {setupMode === "auto" && (
          <div className="space-y-4">
            {/* Repository Info Callout */}
            <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3 text-xs">
              <GitFork className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-indigo-950">
                  {repoInfo.isUpstream
                    ? "Template Repository Detected"
                    : `Personal Fork Connected: ${repoInfo.owner}/${repoInfo.repo}`}
                </p>
                <p className="text-[11px] text-indigo-700 mt-0.5">
                  {repoInfo.isUpstream
                    ? `You are currently on the upstream template (${repoInfo.upstreamOwner}/${repoInfo.upstreamRepo}). 1-Click Sync will automatically create your personal fork and configure your secrets.`
                    : `Secrets will be synced directly to your fork (${repoInfo.owner}/${repoInfo.repo}) where your scheduled workflows run.`}
                </p>
              </div>
            </div>

            {/* Token Generation & Input Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                  GitHub Personal Access Token
                </label>
                <a
                  href={tokenCreationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 underline"
                >
                  <span>Generate Token on GitHub (Pre-filled scope)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showToken ? "text" : "password"}
                    value={tokenInput}
                    onChange={(e) => {
                      setTokenInput(e.target.value);
                      setSyncError(null);
                    }}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-semibold"
                  >
                    {showToken ? "Hide" : "Show"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAutoSync}
                  disabled={isSyncing || !tokenInput.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition shrink-0"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Auto-Fork & Sync Secrets</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Only needs the standard <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">repo</code> scope to create your fork and store secrets. Token is never stored on disk.
              </p>
            </div>

            {/* Error Message */}
            {syncError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Sync Failed</p>
                  <p className="mt-0.5">{syncError}</p>
                </div>
              </div>
            )}

            {/* Success Results Banner */}
            {syncStatus === "success" && syncResult && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Cloud Automation Ready on GitHub!</span>
                </div>
                <div className="space-y-1 text-emerald-800 text-[11px] pl-6">
                  {syncResult.forkCreated && (
                    <p>✓ Created personal fork: <span className="font-mono font-bold">{syncResult.targetRepo}</span></p>
                  )}
                  <p>✓ Encrypted & pushed <span className="font-mono font-bold">SUPABASE_URL</span></p>
                  <p>✓ Encrypted & pushed <span className="font-mono font-bold">SUPABASE_SERVICE_ROLE_KEY</span></p>
                  <p>✓ Configured workload: <span className="font-bold">{jobsPerRun} jobs & {resumesPerRun} resumes per run</span></p>
                  {syncResult.localRemoteUpdated && (
                    <p>✓ Local git remote origin linked to your personal fork</p>
                  )}
                  {syncResult.actionsEnabled && (
                    <p>✓ Enabled GitHub Actions & scheduled automation workflows</p>
                  )}
                  {syncResult.workflowDispatched ? (
                    <p className="font-semibold text-emerald-950">
                      ✓ Triggered Daily Job Scraper initial run (scraping jobs in background...)
                    </p>
                  ) : (
                    <p>✓ Automated schedule active (daily at 7:00 PM SGT)</p>
                  )}
                </div>
                <div className="pt-2 pl-6 flex items-center gap-3">
                  <a
                    href={`${syncResult.repoUrl}/actions`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-xs transition"
                  >
                    <span>View Live Runs on GitHub Actions</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mode B: Manual Copy & Paste Setup */}
        {setupMode === "manual" && (
          <div className="space-y-4">
            {/* Step 1: Fork Link */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <GitFork className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <p className="font-bold text-slate-900">Step 1: Fork the Repository to your GitHub Account</p>
                  <p className="text-[11px] text-slate-500">
                    If you haven't forked yet, create a copy under your personal GitHub profile.
                  </p>
                </div>
              </div>
              <a
                href={`https://github.com/${repoInfo.upstreamOwner}/${repoInfo.upstreamRepo}/fork`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-bold transition shrink-0"
              >
                <GitFork className="w-3.5 h-3.5" />
                <span>Fork on GitHub (1 Click)</span>
              </a>
            </div>

            {/* Step 2: Secrets Table */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-900">
                  Step 2: Add these 2 Repository Secrets to your Fork
                </p>
                <a
                  href={manualSecretsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 underline"
                >
                  <span>Open Fork Secrets Settings</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {secretsList.map((s) => (
                  <div key={s.name} className="p-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-slate-900">{s.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{s.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(s.value, s.name)}
                      className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-[11px] flex items-center gap-1 transition"
                    >
                      {copiedKey === s.name ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Copy Value</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. Sticky Action Footer */}
      <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-full sm:w-auto px-5 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 transition flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Resume Studio
        </button>

        {syncStatus !== "success" && (
          <button
            type="button"
            onClick={handleCompleteSetup}
            className="w-full sm:w-auto px-5 py-3 border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 transition flex items-center justify-center gap-1.5"
          >
            Skip Automation for Now
          </button>
        )}

        <button
          type="button"
          onClick={handleCompleteSetup}
          className="w-full sm:flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 text-xs"
        >
          <Sparkles className="w-4 h-4" />
          <span>{syncStatus === "success" ? "Launch Dashboard" : "Complete Setup & Launch Dashboard"}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Backward compatibility alias
export const Step4GitHub = Step5GitHub;
