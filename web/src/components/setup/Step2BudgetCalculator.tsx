"use client";

import React from "react";
import { Calculator, ShieldCheck, Zap, AlertTriangle, Info, AlertOctagon } from "lucide-react";
import {
  ModelDefinition,
  calculateMonthlyCost,
} from "@/lib/setup/modelCatalog";

interface Step2BudgetCalculatorProps {
  model: ModelDefinition;
  tier: "free" | "paid";
  jobsPerDay: number;
  resumesPerDay: number;
  onChangeJobsPerDay: (jobs: number) => void;
  onChangeResumesPerDay: (resumes: number) => void;
}

export function Step2BudgetCalculator({
  model,
  tier,
  jobsPerDay,
  resumesPerDay,
  onChangeJobsPerDay,
  onChangeResumesPerDay,
}: Step2BudgetCalculatorProps) {
  const costCalc = calculateMonthlyCost(model, tier, jobsPerDay, resumesPerDay);

  return (
    <div className="bg-gradient-to-br from-indigo-50/60 via-white to-slate-50 rounded-2xl border border-indigo-100/80 p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-indigo-100/60">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm shadow-indigo-600/30">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Budget & Quota Simulator
            </h3>
            <p className="text-[11px] text-slate-500">
              Live simulation for <span className="font-semibold text-slate-800">{model.name}</span> (
              <span className={tier === "free" ? "text-emerald-700 font-bold" : "text-indigo-700 font-bold"}>
                {tier === "free" ? "Free Tier" : "Paid Tier"}
              </span>)
            </p>
          </div>
        </div>
      </div>

      {/* Sliders (Stable - Won't reset when models or tiers change) */}
      <div className="space-y-3.5">
        {/* Slider 1: Jobs Scored */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
            <span>Jobs Scored / Day</span>
            <span className="font-bold text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded text-xs">
              {jobsPerDay} jobs/day
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={60}
            step={1}
            value={jobsPerDay}
            onChange={(e) => onChangeJobsPerDay(Number(e.target.value))}
            className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
            <span>1 job</span>
            <span>10 (Default)</span>
            <span>60 jobs/day</span>
          </div>
        </div>

        {/* Slider 2: Resumes Tailored */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
            <span>Resumes Tailored / Day</span>
            <span className="font-bold text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded text-xs">
              {resumesPerDay} resumes/day
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={resumesPerDay}
            onChange={(e) => onChangeResumesPerDay(Number(e.target.value))}
            className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
            <span>1 resume</span>
            <span>2 (Default)</span>
            <span>10 resumes/day</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">
            💡 Each tailored resume consumes <strong>3 LLM requests</strong> (1. Strategy Curation + 2. Deep Tailoring + 3. ATS Match Rescore).
          </p>
        </div>
      </div>

      {/* Warnings & Buffer Status */}
      {costCalc.isOverRpdQuota ? (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-start gap-2">
          <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-snug">
            <strong>Daily Quota Exceeded ({costCalc.dailyCalls} / {costCalc.rpdCap} RPD)!</strong> Planned requests exceed the daily limit by {costCalc.dailyCalls - (costCalc.rpdCap || 0)} calls. Automated runs will encounter 429 quota exhaustion. Switch to the Paid Tier or lower daily jobs.
          </p>
        </div>
      ) : costCalc.isBufferLow ? (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-snug">
            <strong>Low Safety Buffer ({costCalc.bufferRemaining} calls left):</strong> We recommend keeping at least 5 requests unused in your daily quota for error retries and manual resume tailoring from the web dashboard.
          </p>
        </div>
      ) : costCalc.rpdCap !== null ? (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200/80 text-emerald-900 rounded-xl text-[11px] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Safe: {costCalc.bufferRemaining} reserve calls left for retries & web tailoring</span>
          </div>
          <span className="font-bold text-emerald-700">🟢 Safe</span>
        </div>
      ) : null}

      {/* Metrics Cards */}
      <div className="space-y-2.5">
        {/* Estimated Monthly Cost */}
        <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Estimated Monthly Cost
            </span>
            <span className={`text-xl font-black font-mono mt-0.5 block ${tier === "free" ? "text-emerald-600" : "text-indigo-600"}`}>
              {costCalc.formattedCost}
            </span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
            tier === "free" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"
          }`}>
            {tier === "free" ? "Unbilled Free Tier" : "Pay-As-You-Go"}
          </span>
        </div>

        {/* Daily Quota Meter */}
        <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Daily Request Calculation
            </span>
            <span className="font-mono text-xs font-semibold text-slate-700">
              {costCalc.rpdCap
                ? `${costCalc.dailyCalls} / ${costCalc.rpdCap} RPD (${costCalc.rpdUsagePercent}%)`
                : `${costCalc.dailyCalls} calls / day`}
            </span>
          </div>

          <div className="text-[11px] text-slate-600 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between">
            <span>{costCalc.scoringCalls} scoring (1/job) + {costCalc.tailoringCalls} tailoring (3/res)</span>
            <span className="font-bold text-slate-800">= {costCalc.dailyCalls} total calls/day</span>
          </div>

          {costCalc.rpdCap && (
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  costCalc.rpdUsagePercent > 100
                    ? "bg-rose-500"
                    : costCalc.isBufferLow
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, costCalc.rpdUsagePercent)}%` }}
              />
            </div>
          )}
        </div>

        {/* RPM Throttling Delay Recommendation */}
        <div className="p-3 bg-white rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Recommended Delay Between Requests
            </span>
            <span className="font-mono text-xs font-bold text-indigo-600">
              {costCalc.recommendedDelaySeconds} seconds
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            {costCalc.recommendedDelayNote}
          </p>
        </div>
      </div>

      {/* Side-by-Side Quick Comparison Chips */}
      <div className="pt-2 border-t border-indigo-100/60">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
          Monthly Cost at {jobsPerDay} jobs + {resumesPerDay} resumes/day ({costCalc.dailyCalls} calls/day):
        </span>
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200/80">
            <span className="text-[10px] text-emerald-800 font-bold block">Gemini 3.8 Flash</span>
            <span className="font-mono font-extrabold text-emerald-900">$0.00 / mo</span>
            <span className="text-[9px] text-emerald-700 block mt-0.5">20 RPD Free</span>
          </div>
          <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200/80">
            <span className="text-[10px] text-emerald-800 font-bold block">Gemini 3.6 Flash</span>
            <span className="font-mono font-extrabold text-emerald-900">$0.00 / mo</span>
            <span className="text-[9px] text-emerald-700 block mt-0.5">1.5k RPD Free</span>
          </div>
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-200/80">
            <span className="text-[10px] text-blue-800 font-bold block">Claude Haiku 5.5</span>
            <span className="font-mono font-extrabold text-blue-900">
              ~${(((jobsPerDay * 2000 + resumesPerDay * 5300) * 30 / 1e6 * 0.1) + ((jobsPerDay * 300 + resumesPerDay * 1500) * 30 / 1e6 * 0.5)).toFixed(2)}/mo
            </span>
            <span className="text-[9px] text-blue-700 block mt-0.5">Paid ($0.10/$0.50)</span>
          </div>
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-200/80">
            <span className="text-[10px] text-blue-800 font-bold block">Fireworks GLM-5p3</span>
            <span className="font-mono font-extrabold text-blue-900">
              ~${(((jobsPerDay * 2000 + resumesPerDay * 5300) * 30 / 1e6 * 0.15) + ((jobsPerDay * 300 + resumesPerDay * 1500) * 30 / 1e6 * 0.6)).toFixed(2)}/mo
            </span>
            <span className="text-[9px] text-blue-700 block mt-0.5">Paid ($0.15/$0.60)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
