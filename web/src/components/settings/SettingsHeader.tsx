"use client";

import React from "react";
import { Bot, MapPin, Sliders } from "lucide-react";
import { AppSettings } from "@/types";

interface SettingsHeaderProps {
  settings: AppSettings;
}

export function SettingsHeader({ settings }: SettingsHeaderProps) {
  const providerLabel =
    settings.llm_provider === "gemini"
      ? "Google Gemini"
      : settings.llm_provider === "fireworks"
      ? "Fireworks AI"
      : settings.llm_provider === "openai"
      ? "OpenAI"
      : settings.llm_provider === "anthropic"
      ? "Anthropic"
      : "Custom Model";

  const dailyJobs =
    typeof settings.max_jobs_per_search?.daily_jobs === "number"
      ? settings.max_jobs_per_search.daily_jobs
      : (settings.jobs_to_score_per_run || 2) * 6;

  const dailyResumes =
    typeof settings.max_jobs_per_search?.daily_resumes === "number"
      ? settings.max_jobs_per_search.daily_resumes
      : (settings.jobs_to_customize_per_run || 1) * 6;

  return (
    <div className="mb-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Settings & Configuration
          </h1>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            Live
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
          Manage your AI model selection, job search criteria, daily workloads, and cloud automation.
          All settings persist directly to your Supabase database.
        </p>
      </div>

      {/* Quick Summary Badges */}
      <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
          <Bot className="w-3.5 h-3.5 text-indigo-600" />
          <span className="font-semibold">{providerLabel}:</span>
          <span className="font-mono text-slate-600">{settings.llm_model}</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
              settings.llm_tier === "free"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-indigo-100 text-indigo-800"
            }`}
          >
            {settings.llm_tier === "free" ? "Free Tier" : "Paid Tier"}
          </span>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
          <MapPin className="w-3.5 h-3.5 text-blue-600" />
          <span className="font-semibold">Target:</span>
          <span className="text-slate-600">{settings.linkedin_location || "Singapore"}</span>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
          <Sliders className="w-3.5 h-3.5 text-amber-600" />
          <span className="font-semibold">Workload:</span>
          <span className="text-slate-600">
            {dailyJobs} jobs / {dailyResumes} resumes daily ({settings.jobs_to_score_per_run} score / {settings.jobs_to_customize_per_run} tailor / run)
          </span>
        </div>
      </div>
    </div>
  );
}
