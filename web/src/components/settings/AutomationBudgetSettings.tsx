"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Calculator,
  ShieldCheck,
  AlertTriangle,
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

  // Exact daily volume: persisted in max_jobs_per_search.daily_jobs / daily_resumes
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

  const [dailyJobs, setDailyJobs] = useState<number>(getInitialDailyJobs);
  const [dailyResumes, setDailyResumes] = useState<number>(getInitialDailyResumes);

  // Keep state in sync if settings reloads from server or resets
  useEffect(() => {
    setDailyJobs(getInitialDailyJobs());
    setDailyResumes(getInitialDailyResumes());
  }, [
    settings.max_jobs_per_search?.daily_jobs,
    settings.max_jobs_per_search?.daily_resumes,
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

  // Handle changing daily jobs slider -> auto-sets batch limit, daily_jobs, and safe delay
  const handleDailyJobsChange = (val: number) => {
    setDailyJobs(val);
    const perRun = Math.max(1, Math.ceil(val / 6));
    onChange("jobs_to_score_per_run", perRun);

    const updatedMaxJobs = {
      ...(settings.max_jobs_per_search || {}),
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
      {/* 1. Interactive Budget & Daily Volume Sliders (Exact match to Setup) */}
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

        {/* Sliders Grid: Only Jobs / Day and Resumes / Day */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Slider 1: Jobs Scored / Day */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Jobs Scored / Day</span>
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
              Auto-calibrates to <strong>{settings.jobs_to_score_per_run} jobs per run</strong> across 6 daily runs.
            </p>
          </div>

          {/* Slider 2: Resumes Tailored / Day */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Resumes Tailored / Day</span>
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

      {/* 2. Automated Safe Configuration Summary */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Automated Rate-Limit Guardrails (Pre-defined for Safety)
          </h4>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Batch limits and inter-request timing are automatically derived from your daily volume sliders to prevent 429 quota exhaustion:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
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
