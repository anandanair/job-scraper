"use client";

import React from "react";
import {
  X,
  Building,
  Star,
  ExternalLink,
  ShieldCheck,
  Zap,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Briefcase,
  Flame,
  Award,
  Layers,
  RefreshCw,
} from "lucide-react";
import { Job, ScoreBreakdown } from "@/types";

interface CompanyIntelModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onRescore?: () => Promise<void>;
  isRescoring?: boolean;
}

export function CompanyIntelModal({
  job,
  isOpen,
  onClose,
  onRescore,
  isRescoring = false,
}: CompanyIntelModalProps) {
  if (!isOpen || !job) return null;

  const breakdown: ScoreBreakdown | undefined = job.score_breakdown || undefined;
  const intel = breakdown?.company_intel;

  const glassdoorRating = intel?.glassdoor_rating;
  const reviewsCount = intel?.glassdoor_reviews_count;
  const isCached = intel?.is_cached;
  const snippets = intel?.source_snippets || [];
  const cultureSummary = intel?.summary;

  const dreamCraft = breakdown?.dream_craft_score;
  const dreamWorkplace = breakdown?.dream_workplace_score;
  const dreamSeniority = breakdown?.dream_seniority_score;
  const dreamCulture = breakdown?.dream_culture_score;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/40">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              <Building className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">
                  {job.company || "Company Intelligence"}
                </h2>
                {isCached ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    <Zap className="h-3 w-3" />
                    Supabase Cached
                  </span>
                ) : intel ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                    <ShieldCheck className="h-3 w-3" />
                    Live Web Intel
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-400/20 text-gray-300 border border-gray-400/30">
                    Not Scored Yet
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Role: <span className="text-indigo-200 font-medium">{job.job_title}</span> • {job.location || "Singapore"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onRescore && (
              <button
                onClick={onRescore}
                disabled={isRescoring}
                className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all disabled:opacity-50 cursor-pointer shadow-xs gap-1.5"
                title="Run live DuckDuckGo web search to fetch fresh employee reviews and rescore this job"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRescoring ? "animate-spin" : ""}`} />
                {isRescoring ? "Fetching Fresh Reviews..." : "Live Refresh & Rescore"}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Overall Composite Score */}
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
                Overall Match
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-emerald-950">
                  {job.total_score ?? job.resume_score ?? "—"}
                </span>
                <span className="text-xs font-semibold text-emerald-700">%</span>
              </div>
            </div>

            {/* ATS Resume Score */}
            <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider">
                ATS Resume Fit
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-blue-950">
                  {job.resume_score ?? "—"}
                </span>
                <span className="text-xs font-medium text-blue-600">/100</span>
              </div>
            </div>

            {/* Dream Score */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
                Dream Job Fit
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-amber-950">
                  {job.dream_score ?? "—"}
                </span>
                <span className="text-xs font-medium text-amber-600">/100</span>
              </div>
            </div>

            {/* Glassdoor / Employee Rating */}
            <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-3 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-purple-800 uppercase tracking-wider">
                Public / Glassdoor Rating
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                {glassdoorRating ? (
                  <>
                    <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
                    <span className="text-xl font-bold text-purple-950">
                      {glassdoorRating.toFixed(1)}
                    </span>
                    <span className="text-xs text-purple-700">/ 5.0</span>
                  </>
                ) : reviewsCount ? (
                  <span className="text-sm font-bold text-purple-900">
                    {reviewsCount.toLocaleString()} Reviews
                  </span>
                ) : snippets.length > 0 ? (
                  <span className="text-xs font-bold text-purple-900">
                    Boutique / Agency
                  </span>
                ) : (
                  <span className="text-xs font-medium text-gray-500">Not indexed</span>
                )}
              </div>
              <span className="text-[10px] text-purple-600 font-medium">
                {glassdoorRating && reviewsCount
                  ? `${reviewsCount.toLocaleString()} reviews`
                  : glassdoorRating
                  ? "Indexed rating"
                  : reviewsCount
                  ? "Community discussions active"
                  : snippets.length > 0
                  ? "Private firm (<50 staff)"
                  : "No public reviews"}
              </span>
            </div>
          </div>

          {/* Section 1: Grounded AI Decision Transparency & Sub-Scores */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-gray-900">
                  Dream Fit Breakdown (Transparent Rubric)
                </h3>
              </div>
              <span className="text-xs text-gray-500 font-medium">
                Grounded in Real Intel
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {/* Craft & Tech Stack */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-gray-700 flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5 text-indigo-500" />
                    Tech Stack & Craft Fit
                  </span>
                  <span className="font-bold text-indigo-700">
                    {dreamCraft !== undefined ? `${dreamCraft} / 35` : "—"}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all"
                    style={{ width: `${dreamCraft !== undefined ? (dreamCraft / 35) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-500">
                  Favorite technologies present vs dealbreakers avoided.
                </p>
              </div>

              {/* Workplace Model */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-gray-700 flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5 text-blue-500" />
                    Workplace Model
                  </span>
                  <span className="font-bold text-blue-700">
                    {dreamWorkplace !== undefined ? `${dreamWorkplace} / 25` : "—"}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${dreamWorkplace !== undefined ? (dreamWorkplace / 25) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-500">
                  Remote, Hybrid, or Onsite preference match.
                </p>
              </div>

              {/* Seniority & Scope */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-gray-700 flex items-center gap-1">
                    <Award className="h-3.5 w-3.5 text-purple-500" />
                    Seniority & Growth Scope
                  </span>
                  <span className="font-bold text-purple-700">
                    {dreamSeniority !== undefined ? `${dreamSeniority} / 20` : "—"}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all"
                    style={{ width: `${dreamSeniority !== undefined ? (dreamSeniority / 20) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-500">
                  Target seniority tier and career trajectory alignment.
                </p>
              </div>

              {/* Culture, WLB & Sentiment */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-gray-700 flex items-center gap-1">
                    <Flame className="h-3.5 w-3.5 text-amber-500" />
                    Culture, Reputation & WLB
                  </span>
                  <span className="font-bold text-amber-700">
                    {dreamCulture !== undefined ? `${dreamCulture} / 20` : "—"}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-amber-600 h-2 rounded-full transition-all"
                    style={{ width: `${dreamCulture !== undefined ? (dreamCulture / 20) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-500">
                  Grounded in employee reviews; neutral (14) if perks unstated.
                </p>
              </div>
            </div>

            {/* AI Culture & Review Reasoning */}
            {breakdown?.culture_analysis && (
              <div className={`p-3.5 rounded-xl border text-xs leading-relaxed space-y-1.5 mt-2 ${
                dreamCulture !== undefined && dreamCulture <= 8
                  ? "bg-red-50/90 border-red-200 text-red-950"
                  : dreamCulture !== undefined && dreamCulture <= 14
                  ? "bg-amber-50/90 border-amber-200 text-amber-950"
                  : "bg-emerald-50/90 border-emerald-200 text-emerald-950"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    AI Evaluation of Company Intel & Workplace Reality:
                  </span>
                  {dreamCulture !== undefined && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      dreamCulture <= 8
                        ? "bg-red-200/80 text-red-900 border border-red-300"
                        : dreamCulture <= 14
                        ? "bg-amber-200/80 text-amber-900 border border-amber-300"
                        : "bg-emerald-200/80 text-emerald-900 border border-emerald-300"
                    }`}>
                      {dreamCulture <= 8 ? "🚨 High Culture Risk" : dreamCulture <= 14 ? "⚠️ Mixed / Neutral Reviews" : "✅ Verified Good Culture"}
                    </span>
                  )}
                </div>
                <p className="pt-0.5 leading-relaxed">{breakdown.culture_analysis}</p>
              </div>
            )}
          </div>

          {/* Section 2: Real Employee Sentiment & Review Excerpts */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Retrieved Company Intelligence & Sentiment
                </h3>
              </div>
              {intel?.retrieved_at && (
                <span className="text-[11px] text-slate-500">
                  Fetched: {new Date(intel.retrieved_at).toLocaleDateString()}
                </span>
              )}
            </div>

            {cultureSummary ? (
              <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-800 leading-relaxed">
                <span className="font-semibold text-slate-900 block mb-1">
                  Employee Sentiment & Overview:
                </span>
                {cultureSummary}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                No specific culture summary retrieved yet. Click &quot;Re-Run Intel & Score&quot; to fetch live insights.
              </p>
            )}

            {/* Verifiable Source Snippets */}
            {snippets.length > 0 && (
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                  Verifiable Sources & Review Snippets ({snippets.length})
                </span>
                <div className="space-y-2">
                  {snippets.map((item, idx) => {
                    const isReddit = item.link.includes("reddit.com") || item.link.includes("redditmedia.com");
                    const isGlassdoor = item.link.includes("glassdoor");
                    const isIndeed = item.link.includes("indeed.com");
                    const isJobStreet = item.link.includes("jobstreet");
                    const isLinkedIn = item.link.includes("linkedin.com");
                    const isRegistry = item.link.includes("mycareersfuture") || item.link.includes("zoominfo");

                    return (
                      <div
                        key={idx}
                        className="p-3 bg-white rounded-lg border border-slate-200 text-xs hover:border-indigo-300 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isReddit ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-300 flex-shrink-0">
                                Reddit
                              </span>
                            ) : isGlassdoor ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex-shrink-0">
                                Glassdoor
                              </span>
                            ) : isIndeed ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300 flex-shrink-0">
                                Indeed
                              </span>
                            ) : isJobStreet ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300 flex-shrink-0">
                                JobStreet
                              </span>
                            ) : isLinkedIn ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 flex-shrink-0">
                                LinkedIn
                              </span>
                            ) : isRegistry ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300 flex-shrink-0">
                                Registry
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-300 flex-shrink-0">
                                Web
                              </span>
                            )}
                            <span className="font-bold text-slate-900">{item.title}</span>
                          </div>
                          {item.link && (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-indigo-600 hover:text-indigo-800 text-[11px] font-medium flex-shrink-0"
                            >
                              Verify
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          )}
                        </div>
                        <p className="text-slate-600 mt-1 leading-normal">{item.snippet}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: AI Insights, Gaps & Red Flags */}
          {breakdown && (
            <div className="space-y-3">
              {/* Matched vs Missing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3.5 space-y-1.5">
                  <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 uppercase tracking-wide">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Matched Core Skills ({breakdown.matched_skills?.length || 0})
                  </span>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(breakdown.matched_skills || []).length > 0 ? (
                      breakdown.matched_skills.map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100/70 text-emerald-800 rounded-md"
                        >
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-500">None extracted</span>
                    )}
                  </div>
                </div>

                <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3.5 space-y-1.5">
                  <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5 uppercase tracking-wide">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    Missing / Skill Gaps ({breakdown.skill_gaps?.length || 0})
                  </span>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(breakdown.skill_gaps || []).length > 0 ? (
                      breakdown.skill_gaps.map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-[11px] font-semibold bg-amber-100/70 text-amber-800 rounded-md"
                        >
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-emerald-700 font-medium">None detected!</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Red Flags Warning if any */}
              {breakdown.red_flags && breakdown.red_flags.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-1">Detected Job Warnings & Red Flags:</span>
                    <ul className="list-disc list-inside space-y-0.5">
                      {breakdown.red_flags.map((rf, idx) => (
                        <li key={idx}>{rf}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Career Coach Advice */}
              {breakdown.actionable_advice && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-950 flex items-start gap-2.5">
                  <Sparkles className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Career Coach Recommendation: </span>
                    <span>{breakdown.actionable_advice}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <span>Zero-cost intelligence powered by public index & Supabase PostgreSQL cache.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
