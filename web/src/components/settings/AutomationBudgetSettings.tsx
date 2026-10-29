"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Calculator,
  ShieldCheck,
  AlertTriangle,
  Globe,
  Lock,
  ArrowRight,
  CheckCircle2,
  Info,
  Sparkles,
  FileText,
} from "lucide-react";
import { AppSettings } from "@/types";
import {
  CURATED_MODELS,
  ModelDefinition,
  calculateMonthlyCost,
} from "@/lib/setup/modelCatalog";

interface AutomationBudgetSettingsProps {
  settings: AppSettings;
  onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

const HARD_SAFETY_SCRAPE_MAX = 30;

export function AutomationBudgetSettings({
  settings,
  onChange,
}: AutomationBudgetSettingsProps) {
  // Current active curated model definition (fallback to first if custom)
  const activeModel = useMemo<ModelDefinition>(() => {
    return (
      CURATED_MODELS.find((m) => m.id === settings.llm_model) ||
      CURATED_MODELS[0]
    );
  }, [settings.llm_model]);

  const isFreeTier =
    settings.llm_tier === "free" && activeModel.supportsFreeTier;

  // Active sources & search queries
  const isLinkedinActive = settings.scraping_sources?.includes("linkedin") ?? true;
  const isCfActive = settings.scraping_sources?.includes("careers_future") ?? false;

  const linkedinQueries = Array.isArray(settings.linkedin_search_queries)
    ? settings.linkedin_search_queries
    : [];
  const cfQueries =
    Array.isArray(settings.careers_future_search_queries) &&
    settings.careers_future_search_queries.length > 0
      ? settings.careers_future_search_queries
      : linkedinQueries;

  // Exact daily volume: persisted in max_jobs_per_search
  const getInitialDailyJobs = () => {
    if (typeof settings.max_jobs_per_search?.daily_jobs === "number") {
      return settings.max_jobs_per_search.daily_jobs;
    }
    return Math.max(1, (settings.jobs_to_score_per_run || 2) * 6);
  };

  const getInitialDailyResumes = () => {
    if (typeof settings.max_jobs_per_search?.daily_resumes === "number") {
      return settings.max_jobs_per_search.daily_resumes;
    }
    return Math.max(1, (settings.jobs_to_customize_per_run || 1) * 6);
  };

  const getInitialScrapeLinkedin = () => {
    if (typeof settings.max_jobs_per_search?.daily_scrape_linkedin === "number") {
      return Math.min(
        HARD_SAFETY_SCRAPE_MAX,
        Math.max(5, settings.max_jobs_per_search.daily_scrape_linkedin)
      );
    }
    if (typeof settings.max_jobs_per_search?.linkedin === "number") {
      return Math.min(
        HARD_SAFETY_SCRAPE_MAX,
        Math.max(5, settings.max_jobs_per_search.linkedin)
      );
    }
    return 15;
  };

  const getInitialScrapeCf = () => {
    if (typeof settings.max_jobs_per_search?.daily_scrape_careers_future === "number") {
      return Math.min(
        HARD_SAFETY_SCRAPE_MAX,
        Math.max(5, settings.max_jobs_per_search.daily_scrape_careers_future)
      );
    }
    if (typeof settings.max_jobs_per_search?.careers_future === "number") {
      return Math.min(
        HARD_SAFETY_SCRAPE_MAX,
        Math.max(5, settings.max_jobs_per_search.careers_future)
      );
    }
    return 15;
  };

  const [dailyJobs, setDailyJobs] = useState<number>(getInitialDailyJobs);
  const [dailyResumes, setDailyResumes] = useState<number>(getInitialDailyResumes);
  const [dailyScrapeLinkedin, setDailyScrapeLinkedin] = useState<number>(getInitialScrapeLinkedin);
  const [dailyScrapeCf, setDailyScrapeCf] = useState<number>(getInitialScrapeCf);

  // Keep state in sync if settings reloads from server or resets
  useEffect(() => {
    setDailyJobs(getInitialDailyJobs());
    setDailyResumes(getInitialDailyResumes());
    setDailyScrapeLinkedin(getInitialScrapeLinkedin());
    setDailyScrapeCf(getInitialScrapeCf());
  }, [
    settings.max_jobs_per_search?.daily_jobs,
    settings.max_jobs_per_search?.daily_resumes,
    settings.max_jobs_per_search?.daily_scrape_linkedin,
    settings.max_jobs_per_search?.daily_scrape_careers_future,
    settings.max_jobs_per_search?.linkedin,
    settings.max_jobs_per_search?.careers_future,
    settings.jobs_to_score_per_run,
    settings.jobs_to_customize_per_run,
  ]);

  // Calculate live budget & quota metrics
  const costCalc = useMemo(() => {
    return calculateMonthlyCost(
      activeModel,
      settings.llm_tier,
      dailyJobs,
      dailyResumes
    );
  }, [activeModel, settings.llm_tier, dailyJobs, dailyResumes]);

  // Total daily scraped postings across all active platforms
  const totalDailyScraped =
    (isLinkedinActive ? dailyScrapeLinkedin : 0) +
    (isCfActive ? dailyScrapeCf : 0);

  // Handle changing LinkedIn scraping slider
  const handleDailyScrapeLinkedinChange = (val: number) => {
    const clamped = Math.min(HARD_SAFETY_SCRAPE_MAX, Math.max(5, val));
    setDailyScrapeLinkedin(clamped);
    const queryCount = Math.max(1, linkedinQueries.length);
    const perQuery = Math.max(1, Math.floor(clamped / queryCount));

    const updatedMaxJobs = {
      ...(settings.max_jobs_per_search || {}),
      daily_scrape_linkedin: clamped,
      daily_scrape_careers_future: dailyScrapeCf,
      linkedin: perQuery,
      daily_jobs: dailyJobs,
      daily_resumes: dailyResumes,
    };
    onChange("max_jobs_per_search", updatedMaxJobs);
  };

  // Handle changing CareersFuture scraping slider
  const handleDailyScrapeCfChange = (val: number) => {
    const clamped = Math.min(HARD_SAFETY_SCRAPE_MAX, Math.max(5, val));
    setDailyScrapeCf(clamped);
    const queryCount = Math.max(1, cfQueries.length);
    const perQuery = Math.max(1, Math.floor(clamped / queryCount));

    const updatedMaxJobs = {
      ...(settings.max_jobs_per_search || {}),
      daily_scrape_linkedin: dailyScrapeLinkedin,
      daily_scrape_careers_future: clamped,
      careers_future: perQuery,
      daily_jobs: dailyJobs,
      daily_resumes: dailyResumes,
    };
    onChange("max_jobs_per_search", updatedMaxJobs);
  };

  // Handle changing daily jobs slider -> auto-sets batch limit, daily_jobs, and safe delay
  const handleDailyJobsChange = (val: number) => {
    setDailyJobs(val);
    const perRun = Math.max(1, Math.ceil(val / 6));
    onChange("jobs_to_score_per_run", perRun);

    const updatedMaxJobs = {
      ...(settings.max_jobs_per_search || {}),
      daily_scrape_linkedin: dailyScrapeLinkedin,
      daily_scrape_careers_future: dailyScrapeCf,
      daily_jobs: val,
      daily_resumes: dailyResumes,
    };
    onChange("max_jobs_per_search", updatedMaxJobs);

    // Predefined safe guardrails matching setup
    const safeDelay = isFreeTier ? activeModel.recommendedFreeDelaySeconds : 1;
    const safeRpm = isFreeTier ? activeModel.recommendedFreeRpm : 60;
    onChange("llm_request_delay_seconds", safeDelay);
    onChange("llm_max_rpm", safeRpm);
  };

  // Handle changing daily resumes slider -> auto-sets batch limit, daily_resumes, and safe delay
  const handleDailyResumesChange = (val: number) => {
    setDailyResumes(val);
    const perRun = Math.max(1, Math.ceil(val / 6));
    onChange("jobs_to_customize_per_run", perRun);

    const updatedMaxJobs = {
      ...(settings.max_jobs_per_search || {}),
      daily_scrape_linkedin: dailyScrapeLinkedin,
      daily_scrape_careers_future: dailyScrapeCf,
      daily_jobs: dailyJobs,
      daily_resumes: val,
    };
    onChange("max_jobs_per_search", updatedMaxJobs);

    // Predefined safe guardrails matching setup
    const safeDelay = isFreeTier ? activeModel.recommendedFreeDelaySeconds : 1;
    const safeRpm = isFreeTier ? activeModel.recommendedFreeRpm : 60;
    onChange("llm_request_delay_seconds", safeDelay);
    onChange("llm_max_rpm", safeRpm);
  };

  return (
    <div className="space-y-6">
      {/* 1. Autonomous Pipeline Funnel Visualizer */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Autonomous Daily Pipeline Flow
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualizing the full journey from daily job scraping to AI scoring and resume tailoring.
            </p>
          </div>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full border self-start sm:self-auto ${
              totalDailyScraped <= dailyJobs
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-blue-50 text-blue-700 border-blue-200"
            }`}
          >
            {totalDailyScraped <= dailyJobs ? "Balanced Pipeline" : "Funnel Filtering Active"}
          </span>
        </div>

        {/* 3-Step Flow Diagram */}
        <div className="grid grid-cols-1 md:grid-cols-5 items-center gap-3 pt-1">
          {/* Step 1: Scrape */}
          <div className="md:col-span-1 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-slate-500 text-xs font-bold uppercase tracking-wider">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>1. Scrape</span>
            </div>
            <div className="text-lg font-black text-slate-900 font-mono">
              ~{totalDailyScraped}
            </div>
            <p className="text-[10px] text-slate-500">jobs / day collected</p>
          </div>

          {/* Arrow 1 */}
          <div className="hidden md:flex justify-center text-slate-300">
            <ArrowRight className="w-5 h-5 text-indigo-400" />
          </div>

          {/* Step 2: Score */}
          <div className="md:col-span-1 p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-indigo-700 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>2. AI Score</span>
            </div>
            <div className="text-lg font-black text-indigo-700 font-mono">
              {dailyJobs}
            </div>
            <p className="text-[10px] text-indigo-600/80">jobs / day evaluated</p>
          </div>

          {/* Arrow 2 */}
          <div className="hidden md:flex justify-center text-slate-300">
            <ArrowRight className="w-5 h-5 text-indigo-400" />
          </div>

          {/* Step 3: Tailor */}
          <div className="md:col-span-1 p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-emerald-800 text-xs font-bold uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>3. Tailor</span>
            </div>
            <div className="text-lg font-black text-emerald-800 font-mono">
              {dailyResumes}
            </div>
            <p className="text-[10px] text-emerald-700/80">resumes / day tailored</p>
          </div>
        </div>

        {/* Informative Pipeline Note */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          {totalDailyScraped <= dailyJobs ? (
            <span>
              <strong>Zero Backlog Guarantee:</strong> Your scraping volume (~{totalDailyScraped} jobs/day) fits within your daily scoring capacity ({dailyJobs} jobs/day). All freshly scraped postings will be evaluated on the same day without accumulating an un-evaluated queue.
            </span>
          ) : (
            <span>
              <strong>Newest-First Prioritization:</strong> Scraping collects ~{totalDailyScraped} jobs/day, while AI scoring evaluates the top <strong>{dailyJobs} newest postings first</strong> each day. Adjust your scraping sliders below if you want exact 1:1 parity and zero surplus.
            </span>
          )}
        </div>
      </div>

      {/* 2. Daily Scraping Volume Calibration (Stage 1) */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Daily Job Scraping Volume (Stage 1)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Control the maximum number of new listings scraped daily across your selected job boards.
            </p>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
            <Lock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Max Cap: {HARD_SAFETY_SCRAPE_MAX} jobs/source</span>
          </div>
        </div>

        {/* Sliders Grid for Scraping Sources */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* LinkedIn Scraping Slider */}
          {isLinkedinActive && (
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
                    in
                  </div>
                  <span>LinkedIn Jobs / Day</span>
                </div>
                <span className="font-mono bg-white text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 font-bold shadow-2xs">
                  {dailyScrapeLinkedin} jobs/day
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={HARD_SAFETY_SCRAPE_MAX}
                step={1}
                value={dailyScrapeLinkedin}
                onChange={(e) => handleDailyScrapeLinkedinChange(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>5 jobs</span>
                <span>15 (Recommended)</span>
                <span>30 (Safety Max)</span>
              </div>
              <p className="text-[11px] text-slate-500 pt-0.5">
                Spreads across <strong>{linkedinQueries.length} target titles</strong> (~{Math.max(1, Math.floor(dailyScrapeLinkedin / Math.max(1, linkedinQueries.length)))} jobs per title).
              </p>
            </div>
          )}

          {/* CareersFuture Scraping Slider */}
          {isCfActive && (
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-red-600 text-white flex items-center justify-center font-bold text-[10px]">
                    SG
                  </div>
                  <span>MyCareersFuture / Day</span>
                </div>
                <span className="font-mono bg-white text-red-800 px-2 py-0.5 rounded border border-red-200 font-bold shadow-2xs">
                  {dailyScrapeCf} jobs/day
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={HARD_SAFETY_SCRAPE_MAX}
                step={1}
                value={dailyScrapeCf}
                onChange={(e) => handleDailyScrapeCfChange(Number(e.target.value))}
                className="w-full accent-red-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>5 jobs</span>
                <span>15 (Recommended)</span>
                <span>30 (Safety Max)</span>
              </div>
              <p className="text-[11px] text-slate-500 pt-0.5">
                Spreads across <strong>{cfQueries.length} target titles</strong> (~{Math.max(1, Math.floor(dailyScrapeCf / Math.max(1, cfQueries.length)))} jobs per title).
              </p>
            </div>
          )}
        </div>

        {/* Safety Callout */}
        <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>Anti-Ban Safety Limit:</strong> Scraping is strictly restricted to a maximum of 30 jobs/day per platform. This prevents LinkedIn from rate-limiting your guest requests or flagging your network IP.
          </span>
        </div>
      </div>

      {/* 3. Interactive Budget & Daily Volume Sliders (Stages 2 & 3) */}
      <div className="bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 rounded-2xl border border-indigo-100 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-indigo-100/70 gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Monthly AI Budget & Daily Quota Simulator
              </h3>
              <p className="text-xs text-slate-500">
                Live simulation for <span className="font-semibold text-slate-800">{activeModel.name}</span> (
                <span className={isFreeTier ? "text-emerald-700 font-bold" : "text-indigo-700 font-bold"}>
                  {isFreeTier ? "Free Tier" : "Paid Tier"}
                </span>)
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-500 block">Estimated Cost</span>
            <span className="text-base sm:text-lg font-extrabold text-indigo-700 font-mono">
              {costCalc.formattedCost}
            </span>
          </div>
        </div>

        {/* Sliders Grid: Jobs / Day (Stage 2) and Resumes / Day (Stage 3) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Slider 1: Jobs Scored / Day */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Jobs Scored / Day (Stage 2)</span>
              <span className="font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100 font-bold">
                {dailyJobs} jobs/day
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={60}
              step={1}
              value={dailyJobs}
              onChange={(e) => handleDailyJobsChange(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>1 job</span>
              <span>12 (Default)</span>
              <span>60 jobs/day</span>
            </div>
            <p className="text-[11px] text-slate-500 pt-1">
              Auto-calibrates to <strong>{settings.jobs_to_score_per_run} jobs per run</strong> across 6 daily cycles.
            </p>
          </div>

          {/* Slider 2: Resumes Tailored / Day */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Resumes Tailored / Day (Stage 3)</span>
              <span className="font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100 font-bold">
                {dailyResumes} resumes/day
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={12}
              step={1}
              value={dailyResumes}
              onChange={(e) => handleDailyResumesChange(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>1 resume</span>
              <span>2 (Default)</span>
              <span>12 resumes/day</span>
            </div>
            <p className="text-[11px] text-slate-500 pt-1">
              Each resume consumes 3 LLM calls. Auto-calibrates to <strong>{settings.jobs_to_customize_per_run} per run</strong>.
            </p>
          </div>
        </div>

        {/* Quota Usage Gauge & Alerts */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">Daily Request Budget Usage</span>
            <span className="font-mono font-bold text-slate-900">
              {costCalc.dailyCalls} / {costCalc.rpdCap ? `${costCalc.rpdCap} RPD` : "Unlimited (Paid)"}
            </span>
          </div>

          {/* Progress Bar */}
          {costCalc.rpdCap && (
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
              <div
                className={`h-full transition-all duration-300 ${
                  costCalc.isOverRpdQuota
                    ? "bg-rose-500"
                    : costCalc.isBufferLow
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, costCalc.rpdUsagePercent)}%` }}
              />
            </div>
          )}

          {/* Alert Callouts */}
          {costCalc.isOverRpdQuota ? (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                <strong>Quota Warning:</strong> Daily workload ({costCalc.dailyCalls} calls) exceeds the free tier cap ({costCalc.rpdCap} RPD) for {activeModel.name}. Lower your daily volume or switch to a paid API key.
              </span>
            </div>
          ) : costCalc.isBufferLow ? (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Buffer Alert:</strong> Only {costCalc.bufferRemaining} calls remaining before reaching the daily free quota.
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>Monthly Token Consumption:</span>
              <span className="font-mono text-slate-700 font-semibold">
                ~{(costCalc.totalTokens / 1_000_000).toFixed(2)}M Tokens / mo
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Automated Safe Configuration Summary */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Automated Rate-Limit Guardrails (Pre-defined for Safety)
          </h4>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Scraping, scoring, and tailoring batch limits are automatically derived to protect against rate limits and ensure smooth execution:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Scraping Target</span>
            <span className="text-xs font-bold text-slate-800 font-mono mt-0.5 block">
              ~{totalDailyScraped} jobs / day
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Scoring Batch</span>
            <span className="text-xs font-bold text-slate-800 font-mono mt-0.5 block">
              {settings.jobs_to_score_per_run} jobs / run (6x daily)
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Tailoring Batch</span>
            <span className="text-xs font-bold text-slate-800 font-mono mt-0.5 block">
              {settings.jobs_to_customize_per_run} resumes / run (6x daily)
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Safety Request Delay</span>
            <span className="text-xs font-bold text-slate-800 font-mono mt-0.5 block">
              {settings.llm_request_delay_seconds}s between requests
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}