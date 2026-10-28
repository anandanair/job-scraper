"use client";

import React, { useState } from "react";
import {
  Bot,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Terminal,
  ArrowRight,
  Clock,
  Sparkles,
  Info,
} from "lucide-react";

interface Step4GitHubProps {
  onBack: () => void;
  onFinish: () => void;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  llmApiKey?: string;
  llmModel?: string;
}

export function Step4GitHub({
  onBack,
  onFinish,
  supabaseUrl = "",
  supabaseServiceRoleKey = "",
  llmApiKey = "",
  llmModel = "gemini-3.8-flash",
}: Step4GitHubProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const secrets = [
    {
      name: "SUPABASE_URL",
      value: supabaseUrl || "https://your-project.supabase.co",
      description: "Database REST endpoint from Step 1",
    },
    {
      name: "SUPABASE_SERVICE_ROLE_KEY",
      value: supabaseServiceRoleKey || "your-supabase-service-role-key",
      description: "Admin database access key from Step 1",
    },
  ];

  const compositeGhCommand = `gh secret set SUPABASE_URL --body "${supabaseUrl || "YOUR_SUPABASE_URL"}" && gh secret set SUPABASE_SERVICE_ROLE_KEY --body "${supabaseServiceRoleKey || "YOUR_SERVICE_ROLE_KEY"}"`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
          <Bot className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            24/7 Cloud Automation (GitHub Actions)
          </h2>
          <p className="text-xs text-slate-500">
            Keep your job scraper and AI resume tailor running autonomously around the clock without keeping your computer on.
          </p>
        </div>
      </div>

      {/* Cloud Cron Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-bold text-slate-900">Daily Scraper</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Runs twice daily (11:30 AM & 7:00 PM) to discover newly published jobs.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-bold text-slate-900">AI Job Scorer</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Runs every 4 hours to match & score jobs against your uploaded baseline resume.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs font-bold text-slate-900">Resume Tailor</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Pre-generates custom tailored ATS resumes for high-scoring roles every hour.
          </p>
        </div>
      </div>

      {/* GitHub Repository Secrets Card */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Required Repository Secrets</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                2 secrets needed
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Add these 2 secrets to your GitHub repository under <b>Settings → Secrets and variables → Actions</b>. Your AI settings and search preferences are fetched dynamically from your database!
            </p>
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
          >
            <span>GitHub Settings</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Secrets List */}
        <div className="space-y-2.5">
          {secrets.map((s) => (
            <div
              key={s.name}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition"
            >
              <div className="min-w-0 pr-3">
                <span className="font-mono text-xs font-bold text-slate-900 block truncate">
                  {s.name}
                </span>
                <span className="text-[11px] text-slate-500 block truncate">
                  {s.description}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(s.value, s.name)}
                className="shrink-0 px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-300 rounded-lg text-xs font-semibold text-slate-700 hover:text-indigo-600 flex items-center gap-1.5 shadow-sm transition"
              >
                {copiedKey === s.name ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied Value</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Value</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Fast CLI Option */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              <span>Or 1-Click Sync via GitHub CLI (`gh`):</span>
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(compositeGhCommand, "composite_gh")}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
            >
              {copiedKey === "composite_gh" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy CLI Command</span>
                </>
              )}
            </button>
          </div>
          <div className="p-3 bg-slate-900 rounded-xl overflow-x-auto text-[11px] font-mono text-slate-200">
            <code>{compositeGhCommand}</code>
          </div>
        </div>
      </div>

      {/* Info notice */}
      <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p>
          You can also run scrapers locally anytime via{" "}
          <code className="px-1 py-0.5 bg-amber-100 rounded text-[11px] font-mono">
            python backend/scraper.py
          </code>
          . GitHub Actions allows continuous daily runs in the cloud for free without local machine dependencies.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="pt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 transition"
        >
          Back to Preferences
        </button>
        <button
          type="button"
          onClick={onFinish}
          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 text-xs"
        >
          <span>Complete Setup & Launch JobTrack</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
