"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Flame,
  ShieldAlert,
  Heart,
  DollarSign,
  Plus,
  X,
  Check,
  CheckCircle2,
  Wand2,
  Loader2,
  AlertCircle,
  HeartPulse,
  Laptop,
  GraduationCap,
  Baby,
  Activity,
  Clock,
  Palmtree,
  Coffee,
  Calendar,
  Coins,
  TrendingUp,
  PiggyBank,
  Globe,
  Users,
  Shield,
  Layers,
  Zap,
  Target,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AppSettings, DreamJobProfile, JobSearchMode } from "@/types";

interface DreamJobSettingsProps {
  settings: AppSettings;
  onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
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

export interface CultureBenefitItem {
  id: string;
  category: "Benefits & Perks" | "Time Off & Wellbeing" | "Financial Growth" | "Culture & Autonomy";
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const CULTURE_AND_BENEFITS_OPTIONS: CultureBenefitItem[] = [
  // 1. Benefits & Perks
  {
    id: "health_family",
    category: "Benefits & Perks",
    label: "Comprehensive Healthcare & Family Coverage",
    description: "Medical, dental, vision, mental health therapy, and dependent/family insurance.",
    icon: HeartPulse,
  },
  {
    id: "home_office_perks",
    category: "Benefits & Perks",
    label: "Home Office & Top-Spec Tech Equipment",
    description: "Latest MacBook Pro (M3/M4 Max), 4K monitors, ergonomic chair budget, and monthly internet stipend.",
    icon: Laptop,
  },
  {
    id: "learning_stipend",
    category: "Benefits & Perks",
    label: "Learning, Books & Conference Budget",
    description: "Annual dedicated budget ($1,500+) for courses, books, and international tech conferences.",
    icon: GraduationCap,
  },
  {
    id: "parental_leave",
    category: "Benefits & Perks",
    label: "Generous Paid Parental Leave",
    description: "16+ weeks paid maternity/paternity leave, baby bonuses, and flexible phased return-to-work.",
    icon: Baby,
  },
  {
    id: "wellness_gym",
    category: "Benefits & Perks",
    label: "Wellness, Fitness & Commuter Passes",
    description: "Monthly gym/fitness allowance, mental health subscriptions, or commuter transit passes.",
    icon: Activity,
  },

  // 2. Time Off & Wellbeing
  {
    id: "wlb",
    category: "Time Off & Wellbeing",
    label: "Strict Work-Life Balance (Protected 40h)",
    description: "No weekend or after-hours pings, respect for off-hours, protected deep focus blocks.",
    icon: Clock,
  },
  {
    id: "generous_pto",
    category: "Time Off & Wellbeing",
    label: "Generous / Unlimited Paid Time Off (PTO)",
    description: "25+ days annual leave, company-wide shutdown weeks (e.g., year-end), and summer recharge days.",
    icon: Palmtree,
  },
  {
    id: "four_day_week",
    category: "Time Off & Wellbeing",
    label: "4-Day Work Week / Flexible Core Hours",
    description: "32-hour work weeks or complete freedom to work around your personal peak productivity hours.",
    icon: Coffee,
  },
  {
    id: "sabbatical",
    category: "Time Off & Wellbeing",
    label: "Paid Sabbaticals & Recharge Breaks",
    description: "Extended paid time off after tenure milestones (e.g. 1 month paid sabbatical after 3 years).",
    icon: Calendar,
  },

  // 3. Financial Growth & Security
  {
    id: "equity",
    category: "Financial Growth",
    label: "Meaningful Equity / RSUs / Stock Grants",
    description: "Liquid public RSUs, high-upside pre-IPO options, or employee stock purchase plans (ESPP).",
    icon: Coins,
  },
  {
    id: "performance_bonus",
    category: "Financial Growth",
    label: "Annual Performance Bonuses & Profit Sharing",
    description: "Predictable, transparent 10-25%+ cash bonuses tied to individual & company milestones.",
    icon: TrendingUp,
  },
  {
    id: "retirement_match",
    category: "Financial Growth",
    label: "Retirement / Pension Contribution Match",
    description: "Generous 401(k), CPF voluntary top-up, or pension contribution matching.",
    icon: PiggyBank,
  },

  // 4. Culture, Autonomy & Leadership
  {
    id: "autonomy",
    category: "Culture & Autonomy",
    label: "Async-First & Minimal Recurring Meetings",
    description: "Deep work culture, documentation-driven decisions, async status updates over meetings.",
    icon: Shield,
  },
  {
    id: "ai_rd",
    category: "Culture & Autonomy",
    label: "Cutting-Edge AI / Innovation / High Compute",
    description: "Access to state-of-the-art models, generous GPU/cloud compute budgets, and novel R&D autonomy.",
    icon: Sparkles,
  },
  {
    id: "mentorship",
    category: "Culture & Autonomy",
    label: "Staff+ Engineering Mentorship & Clear Ladders",
    description: "Rigorous code reviews, clear engineering levels, and direct guidance from industry veterans.",
    icon: Users,
  },
  {
    id: "global_mobility",
    category: "Culture & Autonomy",
    label: "Global Mobility & Work From Anywhere",
    description: "Freedom to work abroad for 30-90 days/year, or visa sponsorship & international transfer pathways.",
    icon: Globe,
  },
  {
    id: "transparency",
    category: "Culture & Autonomy",
    label: "Transparent Leadership & Psychological Safety",
    description: "Open company financials, blameless postmortems, transparent pay bands, and authentic executive comms.",
    icon: Layers,
  },
];

const CATEGORIES: Array<{
  name: CultureBenefitItem["category"];
  title: string;
  description: string;
  badgeColor: string;
}> = [
  {
    name: "Benefits & Perks",
    title: "Benefits, Healthcare & Equipment",
    description: "Healthcare coverage, top-tier hardware, and professional growth budgets",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    name: "Time Off & Wellbeing",
    title: "Time Off, Flexibility & Balance",
    description: "Rest, vacations, flexible hours, and protected personal time",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    name: "Financial Growth",
    title: "Financial Upside & Wealth Creation",
    description: "Equity grants, liquid RSUs, bonuses, and retirement contributions",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    name: "Culture & Autonomy",
    title: "Operating Culture & Engineering Standards",
    description: "Deep work autonomy, staff+ mentorship, AI tooling, and global mobility",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
  },
];

export const WORLD_CURRENCIES = [
  { code: "SGD", label: "SGD - Singapore Dollar (S$)" },
  { code: "USD", label: "USD - US Dollar ($)" },
  { code: "EUR", label: "EUR - Euro (€)" },
  { code: "GBP", label: "GBP - British Pound (£)" },
  { code: "INR", label: "INR - Indian Rupee (₹)" },
  { code: "AUD", label: "AUD - Australian Dollar (A$)" },
  { code: "CAD", label: "CAD - Canadian Dollar (C$)" },
  { code: "JPY", label: "JPY - Japanese Yen (¥)" },
  { code: "CHF", label: "CHF - Swiss Franc (CHF)" },
  { code: "HKD", label: "HKD - Hong Kong Dollar (HK$)" },
  { code: "NZD", label: "NZD - New Zealand Dollar (NZ$)" },
  { code: "AED", label: "AED - UAE Dirham (AED)" },
  { code: "MYR", label: "MYR - Malaysian Ringgit (RM)" },
  { code: "CNY", label: "CNY - Chinese Yuan (¥)" },
  { code: "BRL", label: "BRL - Brazilian Real (R$)" },
  { code: "DKK", label: "DKK - Danish Krone (kr)" },
  { code: "IDR", label: "IDR - Indonesian Rupiah (Rp)" },
  { code: "ILS", label: "ILS - Israeli Shekel (₪)" },
  { code: "KRW", label: "KRW - South Korean Won (₩)" },
  { code: "MXN", label: "MXN - Mexican Peso (Mex$)" },
  { code: "NOK", label: "NOK - Norwegian Krone (kr)" },
  { code: "PHP", label: "PHP - Philippine Peso (₱)" },
  { code: "PLN", label: "PLN - Polish Zloty (zł)" },
  { code: "QAR", label: "QAR - Qatari Riyal (QR)" },
  { code: "SAR", label: "SAR - Saudi Riyal (SAR)" },
  { code: "SEK", label: "SEK - Swedish Krona (kr)" },
  { code: "THB", label: "THB - Thai Baht (฿)" },
  { code: "TRY", label: "TRY - Turkish Lira (₺)" },
  { code: "TWD", label: "TWD - New Taiwan Dollar (NT$)" },
  { code: "VND", label: "VND - Vietnamese Dong (₫)" },
  { code: "ZAR", label: "ZAR - South African Rand (R)" },
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

export function DreamJobSettings({ settings, onChange }: DreamJobSettingsProps) {
  const currentMode: JobSearchMode = settings.job_search_mode || "get_hired_fast";
  const [showDormantChecklist, setShowDormantChecklist] = useState(false);

  const rawProfile = (settings.dream_job_profile || {}) as Partial<DreamJobProfile>;
  const profile: DreamJobProfile = {
    ...DEFAULT_DREAM_PROFILE,
    ...rawProfile,
    target_titles: Array.isArray(rawProfile.target_titles) ? rawProfile.target_titles : DEFAULT_DREAM_PROFILE.target_titles,
    target_seniorities: Array.isArray(rawProfile.target_seniorities) ? rawProfile.target_seniorities : DEFAULT_DREAM_PROFILE.target_seniorities,
    workplace_models: Array.isArray(rawProfile.workplace_models) ? rawProfile.workplace_models : DEFAULT_DREAM_PROFILE.workplace_models,
    salary_floor_currency: rawProfile.salary_floor_currency || DEFAULT_DREAM_PROFILE.salary_floor_currency,
    salary_floor_period: rawProfile.salary_floor_period || DEFAULT_DREAM_PROFILE.salary_floor_period,
    favorite_tech_stack: Array.isArray(rawProfile.favorite_tech_stack) ? rawProfile.favorite_tech_stack : DEFAULT_DREAM_PROFILE.favorite_tech_stack,
    dealbreaker_tech_stack: Array.isArray(rawProfile.dealbreaker_tech_stack) ? rawProfile.dealbreaker_tech_stack : DEFAULT_DREAM_PROFILE.dealbreaker_tech_stack,
    culture_priorities: Array.isArray(rawProfile.culture_priorities) ? rawProfile.culture_priorities : DEFAULT_DREAM_PROFILE.culture_priorities,
    target_ats_companies: Array.isArray(rawProfile.target_ats_companies) ? rawProfile.target_ats_companies : DEFAULT_DREAM_PROFILE.target_ats_companies,
  };

  const updateProfile = (updates: Partial<DreamJobProfile>) => {
    const updated: DreamJobProfile = {
      ...profile,
      ...updates,
    };
    onChange("dream_job_profile", updated);
  };

  const handleModeChange = (newMode: JobSearchMode) => {
    onChange("job_search_mode", newMode);
  };

  // Tag inputs
  const [techLoveInput, setTechLoveInput] = useState("");
  const [techHateInput, setTechHateInput] = useState("");

  // Auto-populate from Master Resume state
  const [isPopulating, setIsPopulating] = useState(false);
  const [populateStatus, setPopulateStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleAutoPopulateFromResume = async () => {
    setIsPopulating(true);
    setPopulateStatus(null);
    try {
      const res = await fetch("/api/base-resume");
      if (!res.ok) {
        throw new Error("Failed to load Master Resume from database.");
      }
      const resume = await res.json();
      if (!resume || !resume.name || resume.name === "NA") {
        throw new Error("No parsed Master Resume found. Please parse or upload a resume in Resume Studio first.");
      }

      // 1. Extract core tech skills (up to 15 top skills)
      const rawSkills: string[] = Array.isArray(resume.skills) ? resume.skills : [];
      const cleanedSkills = rawSkills
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 15);

      // Merge with existing favorite tech stack without duplicates
      const mergedTech = Array.from(new Set([...(profile.favorite_tech_stack || []), ...cleanedSkills]));

      // 2. Infer seniority levels based on experience
      const experiences = Array.isArray(resume.experience) ? resume.experience : [];
      const detectedSeniorities = new Set<string>();

      let hasLeadTitle = false;
      let hasSeniorTitle = false;
      let hasManagerTitle = false;

      for (const exp of experiences) {
        const titleLower = (exp.job_title || "").toLowerCase();
        if (
          titleLower.includes("lead") ||
          titleLower.includes("principal") ||
          titleLower.includes("staff") ||
          titleLower.includes("architect")
        ) {
          hasLeadTitle = true;
        }
        if (
          titleLower.includes("senior") ||
          titleLower.includes("sr.") ||
          titleLower.includes("sr ") ||
          titleLower.includes("iii") ||
          titleLower.includes("iv")
        ) {
          hasSeniorTitle = true;
        }
        if (
          titleLower.includes("manager") ||
          titleLower.includes("head") ||
          titleLower.includes("director")
        ) {
          hasManagerTitle = true;
        }
      }

      if (hasLeadTitle) {
        detectedSeniorities.add("senior");
        detectedSeniorities.add("lead");
      } else if (hasSeniorTitle || experiences.length >= 3) {
        detectedSeniorities.add("mid");
        detectedSeniorities.add("senior");
      } else if (experiences.length >= 1) {
        detectedSeniorities.add("junior");
        detectedSeniorities.add("mid");
      } else {
        detectedSeniorities.add("mid");
        detectedSeniorities.add("senior");
      }

      if (hasManagerTitle) {
        detectedSeniorities.add("manager");
      }

      const updatedSeniorities = Array.from(detectedSeniorities);

      // Apply updates to profile
      updateProfile({
        favorite_tech_stack: mergedTech.length > 0 ? mergedTech : profile.favorite_tech_stack,
        target_seniorities: updatedSeniorities.length > 0 ? updatedSeniorities : profile.target_seniorities,
      });

      setPopulateStatus({
        type: "success",
        message: `Auto-populated ${cleanedSkills.length} skills and seniority (${updatedSeniorities.join(", ")}) from "${resume.name}"'s Master Resume.`,
      });

      setTimeout(() => {
        setPopulateStatus(null);
      }, 7000);
    } catch (err: any) {
      setPopulateStatus({
        type: "error",
        message: err.message || "Failed to auto-populate from Master Resume.",
      });
    } finally {
      setIsPopulating(false);
    }
  };

  const handleAddLoveTech = () => {
    const trimmed = techLoveInput.trim();
    const current = profile.favorite_tech_stack || [];
    if (trimmed && !current.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      updateProfile({ favorite_tech_stack: [...current, trimmed] });
      setTechLoveInput("");
    }
  };

  const handleRemoveLoveTech = (tech: string) => {
    const current = profile.favorite_tech_stack || [];
    updateProfile({
      favorite_tech_stack: current.filter((t) => t !== tech),
    });
  };

  const handleAddHateTech = () => {
    const trimmed = techHateInput.trim();
    const current = profile.dealbreaker_tech_stack || [];
    if (trimmed && !current.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      updateProfile({ dealbreaker_tech_stack: [...current, trimmed] });
      setTechHateInput("");
    }
  };

  const handleRemoveHateTech = (tech: string) => {
    const current = profile.dealbreaker_tech_stack || [];
    updateProfile({
      dealbreaker_tech_stack: current.filter((t) => t !== tech),
    });
  };

  const toggleSeniority = (id: string) => {
    const current = profile.target_seniorities || [];
    const next = current.includes(id)
      ? current.filter((s) => s !== id)
      : [...current, id];
    updateProfile({ target_seniorities: next });
  };

  const toggleWorkplace = (id: string) => {
    const current = profile.workplace_models || [];
    const next = current.includes(id)
      ? current.filter((m) => m !== id)
      : [...current, id];
    updateProfile({ workplace_models: next });
  };

  const toggleCulture = (id: string) => {
    const current = profile.culture_priorities || [];
    const next = current.includes(id)
      ? current.filter((c) => c !== id)
      : [...current, id];
    updateProfile({ culture_priorities: next });
  };

  const salaryNum = profile.salary_floor_min ? Number(profile.salary_floor_min) : null;
  const isMonthly = profile.salary_floor_period !== "year";
  const selectedCultureCount = (profile.culture_priorities || []).length;

  return (
    <div className="space-y-6">
      {/* Search Strategy Selector */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Target className="h-5 w-5 text-indigo-600" />
            Job Search Strategy & Intent
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Choose whether JobTrack prioritizes high-volume qualification matches to get you hired quickly, or enforces strict dream criteria.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Get Hired Fast */}
          <div
            onClick={() => handleModeChange("get_hired_fast")}
            className={`cursor-pointer rounded-xl p-4 border-2 transition-all relative ${
              currentMode === "get_hired_fast"
                ? "border-emerald-600 bg-emerald-50/50 shadow-sm"
                : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${currentMode === "get_hired_fast" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Get Hired Fast</h4>
                  <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">
                    Default &bull; Maximize Callbacks
                  </span>
                </div>
              </div>
              {currentMode === "get_hired_fast" && (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              )}
            </div>
            <p className="text-xs text-gray-600 mt-3 leading-relaxed">
              <strong>100% ATS Qualification Fit.</strong> Evaluates jobs purely against your resume skills and experience. Never penalizes or hides jobs for missing perks, vague salaries, or strict filters. Auto-tailoring runs on any match &ge; 60%.
            </p>
          </div>

          {/* Card 2: Dream Hunter */}
          <div
            onClick={() => handleModeChange("dream_hunter")}
            className={`cursor-pointer rounded-xl p-4 border-2 transition-all relative ${
              currentMode === "dream_hunter"
                ? "border-indigo-600 bg-indigo-50/50 shadow-sm"
                : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${currentMode === "dream_hunter" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Dream Hunter</h4>
                  <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide">
                    Selective &bull; Strict Filters
                  </span>
                </div>
              </div>
              {currentMode === "dream_hunter" && (
                <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />
              )}
            </div>
            <p className="text-xs text-gray-600 mt-3 leading-relaxed">
              <strong>Dual Evaluation (ATS + Dream Checklist).</strong> Enforces strict salary floor, remote/hybrid preference, tech stacks, and culture priorities. Auto-tailoring gates jobs failing your dream criteria.
            </p>
          </div>
        </div>
      </div>

      {/* Notice when in Get Hired Fast mode */}
      {currentMode === "get_hired_fast" && (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-950">
                Dream Checklist is Dormant in "Get Hired Fast" Mode
              </h4>
              <p className="text-xs text-emerald-800 mt-0.5 max-w-2xl leading-relaxed">
                JobTrack is prioritizing immediate qualification without filtering out viable opportunities. All jobs are scored 100% on ATS fit. Your dream criteria below remain saved if you switch to Dream Hunter later.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDormantChecklist(!showDormantChecklist)}
            className="px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-white border border-emerald-200 rounded-xl hover:bg-emerald-50 transition shrink-0 flex items-center gap-1.5"
          >
            <span>{showDormantChecklist ? "Hide Saved Checklist" : "View / Edit Saved Checklist"}</span>
            {showDormantChecklist ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}

      {/* Checklist section: displayed if in dream_hunter mode OR user explicitly clicks to view/edit saved checklist */}
      {(currentMode === "dream_hunter" || showDormantChecklist) && (
        <>
          {/* Banner with Auto-Populate Button */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {currentMode === "get_hired_fast" ? "Saved Dream Job Checklist (Dormant)" : "Dream Job Checklist & Criteria"}
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  {currentMode === "get_hired_fast"
                    ? "These criteria are currently preserved in your settings. They will be actively evaluated once you switch to Dream Hunter mode."
                    : "Set your target aspirations, salary floor, perks, and dealbreakers. JobTrack calculates a dedicated Dream Match (0-100) alongside your ATS Resume score."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAutoPopulateFromResume}
              disabled={isPopulating}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 shrink-0 cursor-pointer"
              title="Inspect your Master Resume and pre-populate your skills & seniority"
            >
              {isPopulating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              <span>Auto-Populate from Resume</span>
            </button>
          </div>

          {/* Populate feedback alert */}
          {populateStatus && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                populateStatus.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-rose-50 border-rose-200 text-rose-900"
              }`}
            >
              <div className="flex items-center gap-2">
                {populateStatus.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{populateStatus.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setPopulateStatus(null)}
                className="hover:opacity-75"
              >
                <X size={14} />
              </button>
            </div>
          )}

      {/* Seniority & Track */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-3">
        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          Target Seniority Levels
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {SENIORITY_OPTIONS.map((opt) => {
            const isSelected = (profile.target_seniorities || []).includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleSeniority(opt.id)}
                className={`p-3 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                  isSelected
                    ? "bg-amber-50 border-amber-300 text-amber-900 shadow-xs"
                    : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <CheckCircle2 className="h-4 w-4 text-amber-600 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Workplace Preferences & Compensation Floor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Workplace Model */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-3">
          <h4 className="text-sm font-bold text-gray-900">Workplace Arrangement</h4>
          <div className="space-y-2">
            {WORKPLACE_OPTIONS.map((opt) => {
              const isSelected = (profile.workplace_models || []).includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleWorkplace(opt.id)}
                  className={`w-full p-3 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                    isSelected
                      ? "bg-purple-50 border-purple-300 text-purple-900"
                      : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check className="h-4 w-4 text-purple-600" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Compensation Floor */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-3">
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            Minimum Acceptable Base Salary
          </h4>
          <p className="text-xs text-gray-500">
            Jobs with transparent compensation below this threshold will be flagged or de-prioritized.
          </p>
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Currency Selector */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Currency
                </label>
                <select
                  value={profile.salary_floor_currency || "SGD"}
                  onChange={(e) => updateProfile({ salary_floor_currency: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {WORLD_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Base Amount
                </label>
                <input
                  type="number"
                  placeholder={isMonthly ? "e.g. 10000" : "e.g. 120000"}
                  value={profile.salary_floor_min ?? ""}
                  onChange={(e) =>
                    updateProfile({
                      salary_floor_min: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Period Selector (Monthly vs Annual) */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Frequency
                </label>
                <select
                  value={profile.salary_floor_period || "month"}
                  onChange={(e) =>
                    updateProfile({
                      salary_floor_period: e.target.value as "month" | "year",
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="month">Monthly (/month)</option>
                  <option value="year">Annual (/year)</option>
                </select>
              </div>
            </div>

            {/* Equivalent calculation helper */}
            {salaryNum && salaryNum > 0 && (
              <div className="rounded-lg bg-emerald-50/70 border border-emerald-200/80 px-3 py-1.5 text-[11px] text-emerald-800 flex items-center justify-between">
                <span>
                  Configured:{" "}
                  <strong>
                    {profile.salary_floor_currency} {salaryNum.toLocaleString()} /{" "}
                    {isMonthly ? "month" : "year"}
                  </strong>
                </span>
                <span className="text-emerald-700">
                  ≈ {profile.salary_floor_currency}{" "}
                  {isMonthly
                    ? `${(salaryNum * 12).toLocaleString()} / year`
                    : `${Math.round(salaryNum / 12).toLocaleString()} / month`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tech Stack Loves vs Dealbreakers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Loves */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-3">
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <Heart className="h-4 w-4 text-emerald-600" />
            Must-Have / Favorite Tech Stack
          </h4>
          <p className="text-xs text-gray-500">Roles with these tools receive positive score multipliers.</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. TypeScript, React, Go"
              value={techLoveInput}
              onChange={(e) => setTechLoveInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddLoveTech();
                }
              }}
              className="flex-1 px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={handleAddLoveTech}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(profile.favorite_tech_stack || []).map((tech) => (
              <span
                key={tech}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200"
              >
                {tech}
                <button
                  type="button"
                  onClick={() => handleRemoveLoveTech(tech)}
                  className="hover:text-emerald-950 transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            {(profile.favorite_tech_stack || []).length === 0 && (
              <span className="text-xs text-gray-400 italic">No favorite tech stack specified.</span>
            )}
          </div>
        </div>

        {/* Dealbreakers */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-3">
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4 text-red-600" />
            Dealbreaker Technologies & Stacks
          </h4>
          <p className="text-xs text-gray-500">Roles requiring these will be de-prioritized or flagged.</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. PHP 5, WordPress, COBOL"
              value={techHateInput}
              onChange={(e) => setTechHateInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddHateTech();
                }
              }}
              className="flex-1 px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button
              type="button"
              onClick={handleAddHateTech}
              className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-semibold hover:bg-red-700 transition-colors"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(profile.dealbreaker_tech_stack || []).map((tech) => (
              <span
                key={tech}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 text-red-800 border border-red-200"
              >
                {tech}
                <button
                  type="button"
                  onClick={() => handleRemoveHateTech(tech)}
                  className="hover:text-red-950 transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            {(profile.dealbreaker_tech_stack || []).length === 0 && (
              <span className="text-xs text-gray-400 italic">No dealbreaker technologies specified.</span>
            )}
          </div>
        </div>
      </div>

      {/* Culture, Perks & Dream Benefits Priorities */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-4">
          <div>
            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              Culture, Perks & Dream Benefits
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Select the perks, cultural values, and company benefits that matter most to you. The AI evaluates each job posting for these signals to boost your Dream Match score.
            </p>
          </div>
          <div className="flex-shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <Flame size={12} className="text-amber-600" />
              {selectedCultureCount} Selected
            </span>
          </div>
        </div>

        {/* Grouped by Categories */}
        <div className="space-y-6">
          {CATEGORIES.map((cat) => {
            const items = CULTURE_AND_BENEFITS_OPTIONS.filter((opt) => opt.category === cat.name);
            return (
              <div key={cat.name} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${cat.badgeColor}`}>
                      {cat.name}
                    </span>
                    <span className="text-xs font-semibold text-gray-800">{cat.title}</span>
                  </div>
                  <span className="text-[11px] text-gray-400 hidden sm:inline">{cat.description}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {items.map((opt) => {
                    const isSelected = (profile.culture_priorities || []).includes(opt.id);
                    const IconComponent = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleCulture(opt.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                          isSelected
                            ? "bg-amber-50/80 border-amber-300 shadow-xs ring-1 ring-amber-400/30"
                            : "bg-gray-50/60 border-gray-200/80 hover:bg-gray-100/70"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected
                              ? "bg-amber-100 text-amber-700"
                              : "bg-white text-gray-500 border border-gray-200"
                          }`}
                        >
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0 pr-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-xs font-bold leading-snug ${isSelected ? "text-amber-950" : "text-gray-900"}`}>
                              {opt.label}
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="h-4 w-4 text-amber-600 flex-shrink-0 ml-1" />
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                            {opt.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
        </>
      )}
    </div>
  );
}
