"use client";

import React, { useState } from "react";
import {
  Target,
  Zap,
  Flame,
  CheckCircle2,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  DollarSign,
  Laptop,
  Plus,
  X,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { AppSettings, DreamJobProfile, JobSearchMode } from "@/types";

interface Step4SearchStrategyProps {
  initialSettings?: AppSettings | null;
  onBack: () => void;
  onNextStep: () => void;
}

const SENIORITY_OPTIONS = [
  { id: "junior", label: "Junior / Entry (1-2 yrs)" },
  { id: "mid", label: "Mid-Level (3-5 yrs)" },
  { id: "senior", label: "Senior Engineer (5-8 yrs)" },
  { id: "lead", label: "Staff / Principal / Lead (8+ yrs)" },
  { id: "manager", label: "Engineering Management" },
];

const WORKPLACE_OPTIONS = [
  { id: "remote", label: "100% Remote (Worldwide / Regional)" },
  { id: "hybrid", label: "Hybrid (1-2 days office)" },
  { id: "onsite", label: "On-Site" },
];

const CURRENCIES = [
  { code: "SGD", label: "SGD - Singapore Dollar (S$)" },
  { code: "USD", label: "USD - US Dollar ($)" },
  { code: "EUR", label: "EUR - Euro (€)" },
  { code: "GBP", label: "GBP - British Pound (£)" },
  { code: "CAD", label: "CAD - Canadian Dollar (C$)" },
  { code: "AUD", label: "AUD - Australian Dollar (A$)" },
  { code: "INR", label: "INR - Indian Rupee (₹)" },
  { code: "MYR", label: "MYR - Malaysian Ringgit (RM)" },
];

const DEFAULT_DREAM_PROFILE: DreamJobProfile = {
  target_titles: [],
  target_seniorities: ["mid", "senior"],
  workplace_models: ["remote", "hybrid"],
  salary_floor_min: null,
  salary_floor_currency: "SGD",
  salary_floor_period: "month",
  favorite_tech_stack: ["TypeScript", "React", "Next.js"],
  dealbreaker_tech_stack: ["PHP", "WordPress", "jQuery"],
  culture_priorities: ["wlb", "autonomy", "learning_stipend", "health_family"],
  target_ats_companies: [],
};

export function Step4SearchStrategy({
  initialSettings,
  onBack,
  onNextStep,
}: Step4SearchStrategyProps) {
  const [mode, setMode] = useState<JobSearchMode>(
    initialSettings?.job_search_mode || "get_hired_fast"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dream Job Profile State
  const rawProfile = (initialSettings?.dream_job_profile || {}) as Partial<DreamJobProfile>;
  const [profile, setProfile] = useState<DreamJobProfile>({
    ...DEFAULT_DREAM_PROFILE,
    ...rawProfile,
    target_titles: Array.isArray(rawProfile.target_titles) ? rawProfile.target_titles : DEFAULT_DREAM_PROFILE.target_titles,
    target_seniorities: Array.isArray(rawProfile.target_seniorities) ? rawProfile.target_seniorities : DEFAULT_DREAM_PROFILE.target_seniorities,
    workplace_models: Array.isArray(rawProfile.workplace_models) ? rawProfile.workplace_models : DEFAULT_DREAM_PROFILE.workplace_models,
    favorite_tech_stack: Array.isArray(rawProfile.favorite_tech_stack) ? rawProfile.favorite_tech_stack : DEFAULT_DREAM_PROFILE.favorite_tech_stack,
    dealbreaker_tech_stack: Array.isArray(rawProfile.dealbreaker_tech_stack) ? rawProfile.dealbreaker_tech_stack : DEFAULT_DREAM_PROFILE.dealbreaker_tech_stack,
  });

  // Tag inputs for Dream Hunter mode
  const [techLoveInput, setTechLoveInput] = useState("");
  const [techHateInput, setTechHateInput] = useState("");

  const handleAddLoveTech = () => {
    const trimmed = techLoveInput.trim();
    if (trimmed && !profile.favorite_tech_stack.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setProfile((p) => ({ ...p, favorite_tech_stack: [...p.favorite_tech_stack, trimmed] }));
      setTechLoveInput("");
    }
  };

  const handleRemoveLoveTech = (tech: string) => {
    setProfile((p) => ({
      ...p,
      favorite_tech_stack: p.favorite_tech_stack.filter((t) => t !== tech),
    }));
  };

  const handleAddHateTech = () => {
    const trimmed = techHateInput.trim();
    if (trimmed && !profile.dealbreaker_tech_stack.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setProfile((p) => ({ ...p, dealbreaker_tech_stack: [...p.dealbreaker_tech_stack, trimmed] }));
      setTechHateInput("");
    }
  };

  const handleRemoveHateTech = (tech: string) => {
    setProfile((p) => ({
      ...p,
      dealbreaker_tech_stack: p.dealbreaker_tech_stack.filter((t) => t !== tech),
    }));
  };

  const toggleSeniority = (id: string) => {
    const current = profile.target_seniorities || [];
    const next = current.includes(id)
      ? current.filter((s) => s !== id)
      : [...current, id];
    setProfile((p) => ({ ...p, target_seniorities: next }));
  };

  const toggleWorkplace = (id: string) => {
    const current = profile.workplace_models || [];
    const next = current.includes(id)
      ? current.filter((m) => m !== id)
      : [...current, id];
    setProfile((p) => ({ ...p, workplace_models: next }));
  };

  const handleContinue = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const payload: Partial<AppSettings> = {
        job_search_mode: mode,
      };

      if (mode === "dream_hunter") {
        payload.dream_job_profile = profile;
      }

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to save search strategy.");
      }

      onNextStep();
    } catch (err: any) {
      console.error("Error saving search strategy:", err);
      setErrorMsg(err.message || "Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/50 border border-indigo-100 rounded-2xl shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100/70 text-indigo-800 text-[11px] font-bold uppercase tracking-wider mb-1">
            <Target className="w-3.5 h-3.5 text-indigo-600" />
            Step 4: Search Strategy &amp; Objective
          </div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Choose Your Primary Job Search Objective
          </h2>
          <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
            Configure how JobTrack evaluates opportunities and tailors resumes based on your current career situation. You can change this at any time in Settings.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="px-3.5 py-2 border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 transition flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={isSaving}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span>Continue to Resume Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">
          {errorMsg}
        </div>
      )}

      {/* Mode Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Get Hired Fast */}
        <div
          onClick={() => setMode("get_hired_fast")}
          className={`cursor-pointer rounded-2xl p-5 border-2 transition-all relative ${
            mode === "get_hired_fast"
              ? "border-emerald-600 bg-emerald-50/50 shadow-md ring-4 ring-emerald-50"
              : "border-gray-200 hover:border-gray-300 bg-white"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`p-2.5 rounded-xl ${
                  mode === "get_hired_fast"
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Get Hired Fast</h3>
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                  Recommended &bull; Maximize Callbacks
                </span>
              </div>
            </div>
            {mode === "get_hired_fast" && (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            )}
          </div>

          <p className="text-xs text-gray-600 mt-3.5 leading-relaxed">
            <strong>100% Qualification &amp; ATS Match.</strong> Evaluates postings purely against your resume skills and experience. Never penalizes or hides opportunities for missing perks, vague compensation, or strict filters.
          </p>

          <ul className="mt-4 space-y-2 text-xs text-gray-600 border-t border-gray-100 pt-3">
            <li className="flex items-center gap-2 text-emerald-950 font-medium">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Auto-tailors resumes for any match &ge; 60% ATS fit</span>
            </li>
            <li className="flex items-center gap-2 text-emerald-950 font-medium">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Faster AI scoring with zero unnecessary prompt overhead</span>
            </li>
            <li className="flex items-center gap-2 text-emerald-950 font-medium">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Instant setup &mdash; zero extra fields required</span>
            </li>
          </ul>
        </div>

        {/* Card 2: Dream Hunter */}
        <div
          onClick={() => setMode("dream_hunter")}
          className={`cursor-pointer rounded-2xl p-5 border-2 transition-all relative ${
            mode === "dream_hunter"
              ? "border-indigo-600 bg-indigo-50/50 shadow-md ring-4 ring-indigo-50"
              : "border-gray-200 hover:border-gray-300 bg-white"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`p-2.5 rounded-xl ${
                  mode === "dream_hunter"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Dream Hunter</h3>
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                  Selective &bull; Strict Dream Gating
                </span>
              </div>
            </div>
            {mode === "dream_hunter" && (
              <CheckCircle2 className="w-6 h-6 text-indigo-600 shrink-0" />
            )}
          </div>

          <p className="text-xs text-gray-600 mt-3.5 leading-relaxed">
            <strong>Dual Evaluation (ATS + Dream Checklist).</strong> Enforces strict salary floors, remote/hybrid preferences, favorite technologies, and company dealbreakers.
          </p>

          <ul className="mt-4 space-y-2 text-xs text-gray-600 border-t border-gray-100 pt-3">
            <li className="flex items-center gap-2 text-indigo-950 font-medium">
              <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Overall score combines ATS match &amp; dream alignment (50/50)</span>
            </li>
            <li className="flex items-center gap-2 text-indigo-950 font-medium">
              <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Auto-tailoring gated by both qualification and dream score</span>
            </li>
            <li className="flex items-center gap-2 text-indigo-950 font-medium">
              <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Ideal for employed candidates holding out for high-tier offers</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Dynamic Section based on mode */}
      {mode === "get_hired_fast" ? (
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-emerald-950">
              Ready to Proceed to Resume Studio
            </h4>
            <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
              You have chosen <strong>Get Hired Fast</strong>. Click <strong>&quot;Continue to Resume Studio&quot;</strong> above to review your parsed master profile and calibrate your preferred ATS typesetting style.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5 bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-600" />
              Dream Job Checklist Configuration (Optional)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Set your target preferences below. All fields are optional and can be refined later in Settings.
            </p>
          </div>

          {/* Workplace Preference */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5 text-gray-500" />
              Workplace Model
            </label>
            <div className="flex flex-wrap gap-2">
              {WORKPLACE_OPTIONS.map((opt) => {
                const isSelected = profile.workplace_models.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleWorkplace(opt.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seniority */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-gray-500" />
              Seniority Levels
            </label>
            <div className="flex flex-wrap gap-2">
              {SENIORITY_OPTIONS.map((opt) => {
                const isSelected = profile.target_seniorities.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleSeniority(opt.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Salary Floor */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-gray-500" />
              Target Compensation Floor
            </label>
            <div className="flex flex-wrap items-center gap-2 max-w-lg">
              <select
                value={profile.salary_floor_currency || "SGD"}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, salary_floor_currency: e.target.value }))
                }
                className="px-3 py-2 text-xs border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>

              <input
                type="number"
                value={profile.salary_floor_min || ""}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    salary_floor_min: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                placeholder="e.g. 10000"
                className="w-36 px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />

              <select
                value={profile.salary_floor_period || "month"}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    salary_floor_period: e.target.value as "month" | "year",
                  }))
                }
                className="px-3 py-2 text-xs border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="month">per month</option>
                <option value="year">per year</option>
              </select>
            </div>
          </div>

          {/* Favorite & Dealbreaker Tech Stack */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Tech Love */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Favorite Tech Stack
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={techLoveInput}
                  onChange={(e) => setTechLoveInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddLoveTech();
                    }
                  }}
                  placeholder="e.g. Next.js, Rust"
                  className="flex-1 px-3 py-2 text-xs border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddLoveTech}
                  className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {profile.favorite_tech_stack.map((tech) => (
                  <span
                    key={tech}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium"
                  >
                    {tech}
                    <button
                      type="button"
                      onClick={() => handleRemoveLoveTech(tech)}
                      className="hover:text-emerald-950"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Tech Dealbreakers */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                Dealbreaker Tech Stack
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={techHateInput}
                  onChange={(e) => setTechHateInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddHateTech();
                    }
                  }}
                  placeholder="e.g. PHP, WordPress"
                  className="flex-1 px-3 py-2 text-xs border border-red-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddHateTech}
                  className="px-3 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold hover:bg-red-700 transition"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {profile.dealbreaker_tech_stack.map((tech) => (
                  <span
                    key={tech}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-800 border border-red-200 text-xs font-medium"
                  >
                    {tech}
                    <button
                      type="button"
                      onClick={() => handleRemoveHateTech(tech)}
                      className="hover:text-red-950"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}