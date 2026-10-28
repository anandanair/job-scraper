"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Loader2, ArrowRight, ArrowLeft, RefreshCw, AlertCircle } from "lucide-react";
import { Resume, ResumeThemeConfig, ResumeStyleSetting } from "@/types";
import { DEFAULT_THEME_CONFIG } from "@/lib/resume-presets";
import ResumeStudioClient from "@/components/resume-studio/ResumeStudioClient";

interface Step4ResumeStudioProps {
  onBack: () => void;
  onNextStep: () => void;
}

export function Step4ResumeStudio({ onBack, onNextStep }: Step4ResumeStudioProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [baseResume, setBaseResume] = useState<Resume | null>(null);
  const [activeStyle, setActiveStyle] = useState<ResumeThemeConfig>(DEFAULT_THEME_CONFIG);
  const [savedPresets, setSavedPresets] = useState<ResumeStyleSetting[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadStudioData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch Master Base Resume
      const resumeRes = await fetch("/api/base-resume");
      if (resumeRes.ok) {
        const contentType = resumeRes.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const resumeData = await resumeRes.json();
          setBaseResume(resumeData);
        }
      }

      // 2. Fetch Resume Style Presets & Active Style
      const styleRes = await fetch("/api/resume-style");
      if (styleRes.ok) {
        const contentType = styleRes.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const styleData = await styleRes.json();
          const active = styleData.themeConfig || styleData.activeStyle;
          if (active) {
            setActiveStyle(active);
          }
          const presets = styleData.presets || styleData.savedPresets;
          if (presets && Array.isArray(presets)) {
            setSavedPresets(presets);
          }
        }
      }
    } catch (err: any) {
      console.error("Error loading resume studio data:", err);
      setErrorMsg("Failed to load resume details. You can still customize or proceed.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStudioData();
  }, []);

  return (
    <div className="flex flex-col space-y-4">
      {/* Studio Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/50 border border-indigo-100 rounded-2xl shadow-sm">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100/70 text-indigo-800 text-[11px] font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            Step 4: Master Resume Studio & Typography
          </div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Verify Parsed Details & Set Preferred ATS Style
          </h2>
          <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
            Review your extracted baseline profile below. Feel free to polish any text, adjust font sizes, margins, or color palettes. All settings saved here automatically calibrate future AI job-tailored resumes.
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
            onClick={onNextStep}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5"
          >
            <span>Continue to Automation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={loadStudioData}
            className="ml-auto underline font-semibold hover:text-amber-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Studio Workspace */}
      {isLoading ? (
        <div className="h-[600px] flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
          <p className="text-sm font-semibold text-slate-800">
            Loading your Master Resume & ATS Typography Studio...
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Preparing your profile fields, active ATS style, and live canvas preview.
          </p>
        </div>
      ) : (
        <div className="h-[760px] border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
          <ResumeStudioClient
            initialBaseResume={baseResume}
            initialThemeConfig={activeStyle}
            initialSavedSettings={savedPresets}
            defaultTab="content"
          />
        </div>
      )}

      {/* Bottom Sticky Action Footer */}
      <div className="pt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 transition flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Preferences
        </button>
        <button
          type="button"
          onClick={onNextStep}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/20 transition flex items-center gap-2"
        >
          <span>Continue to Cloud Automation</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
