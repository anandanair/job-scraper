"use client";

import React, { useState, useEffect } from "react";
import {
  GitFork,
  ExternalLink,
  Clock,
  Sparkles,
} from "lucide-react";
import { AppSettings } from "@/types";

interface CloudWorkflowsSettingsProps {
  settings: AppSettings;
}

interface GitRepoInfo {
  detected: boolean;
  owner?: string | null;
  repo: string;
  isUpstream: boolean;
  upstreamOwner: string;
  upstreamRepo: string;
}

const WORKFLOWS = [
  {
    id: "scrape_jobs.yml",
    name: "Daily Job Scraper",
    schedule: "Daily at 7:00 PM SGT (11:00 UTC)",
    cron: "0 11 * * *",
    description: "Scrapes LinkedIn & MyCareersFuture for new postings and saves markdown to Supabase.",
    badge: "Python Engine",
  },
  {
    id: "score_jobs.yml",
    name: "AI Job Scorer",
    schedule: "Every 4 hours",
    cron: "0 */4 * * *",
    description: "Evaluates unscored jobs against your Master Resume and generates ATS fit scores.",
    badge: "Node.js Worker",
  },
  {
    id: "hourly_resume_customization.yml",
    name: "ATS Resume Tailor",
    schedule: "Every 4 hours (offset :30)",
    cron: "30 */4 * * *",
    description: "Performs 3-stage personalization and generates PDF resumes for top-scoring jobs.",
    badge: "PDFKit Engine",
  },
  {
    id: "job_manager.yml",
    name: "Job Expiration Manager",
    schedule: "Daily at 12:00 AM SGT (16:00 UTC)",
    cron: "0 16 * * *",
    description: "Pings live job URLs, archives expired postings, and maintains clean database state.",
    badge: "Housekeeping",
  },
];

export function CloudWorkflowsSettings({ settings }: CloudWorkflowsSettingsProps) {
  const [repoInfo, setRepoInfo] = useState<GitRepoInfo>({
    detected: false,
    owner: null,
    repo: "job-scraper",
    isUpstream: true,
    upstreamOwner: "anandanair",
    upstreamRepo: "job-scraper",
  });
  const [isLoadingRepo, setIsLoadingRepo] = useState(true);

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
      .catch((err) => console.warn("Failed to check github info:", err))
      .finally(() => {
        if (isMounted) setIsLoadingRepo(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const repoOwner = repoInfo.owner || repoInfo.upstreamOwner;
  const repoName = repoInfo.repo || repoInfo.upstreamRepo;
  const actionsUrl = `https://github.com/${repoOwner}/${repoName}/actions`;

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

      {/* 2. Automated Scheduled Workflows Overview */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 sm:p-6 space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
            Automated Cloud Workflows (GitHub Actions)
          </label>
          <p className="text-xs text-slate-500 mt-0.5">
            These background workflows execute in your personal fork 24/7 without requiring your local machine to stay awake.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {WORKFLOWS.map((wf) => (
            <div
              key={wf.id}
              className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-xs space-y-2.5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {wf.badge}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    {wf.cron}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-900">{wf.name}</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {wf.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1 font-semibold text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{wf.schedule}</span>
                </span>
                <a
                  href={`https://github.com/${repoOwner}/${repoName}/actions/workflows/${wf.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-800 font-bold inline-flex items-center gap-1 text-xs"
                >
                  <span>View Run History</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
