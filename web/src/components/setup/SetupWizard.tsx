"use client";

import React, { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { SetupStepper } from "./SetupStepper";
import { Step1Database } from "./Step1Database";
import { Step2AiEngine } from "./Step2AiEngine";
import { Step3Preferences } from "./Step3Preferences";
import { Step4ResumeStudio } from "./Step4ResumeStudio";
import { Step5GitHub } from "./Step5GitHub";
import { AppSettings } from "@/types";

interface SetupWizardProps {
  initialStep?: 1 | 2 | 3 | 4 | 5;
  initialSupabaseConnected?: boolean;
  initialSupabaseUrl?: string;
  initialSupabaseServiceRoleKey?: string;
  initialAiConnected?: boolean;
  initialAiApiKey?: string;
  initialAiModel?: string;
  initialAiProvider?: string;
  initialAiTier?: "free" | "paid";
  initialSettings?: AppSettings | null;
}

export default function SetupWizard({
  initialStep = 1,
  initialSupabaseConnected = false,
  initialSupabaseUrl = "",
  initialSupabaseServiceRoleKey = "",
  initialAiConnected = false,
  initialAiApiKey = "",
  initialAiModel,
  initialAiProvider,
  initialAiTier,
  initialSettings = null,
}: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(initialStep);
  const [supabaseConnected, setSupabaseConnected] = useState(initialSupabaseConnected);
  const [connectedSupabaseUrl, setConnectedSupabaseUrl] = useState(initialSupabaseUrl);
  const [connectedServiceRoleKey, setConnectedServiceRoleKey] = useState(initialSupabaseServiceRoleKey);
  const [aiConnected, setAiConnected] = useState(initialAiConnected);
  const [savedSettings, setSavedSettings] = useState<AppSettings | null>(initialSettings);

  // AI Configuration from Step 2
  const [aiConfig, setAiConfig] = useState<{
    apiKey: string;
    model: string;
    provider: string;
    tier: "free" | "paid";
    maxRpm: number;
    requestDelaySeconds: number;
  }>({
    apiKey: initialAiApiKey || "",
    model: initialAiModel || "gemini-3.8-flash",
    provider: initialAiProvider || "gemini",
    tier: initialAiTier || "free",
    maxRpm: 4,
    requestDelaySeconds: 15,
  });

  const [preferencesSaved, setPreferencesSaved] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  // Calculate highest step user can freely click into
  const maxAccessibleStep: 1 | 2 | 3 | 4 | 5 = preferencesSaved || initialStep >= 4
    ? 5
    : (aiConnected || !!aiConfig.apiKey)
    ? 3
    : supabaseConnected
    ? 2
    : 1;

  // Restore active step and configuration on mount/refresh
  useEffect(() => {
    if (initialStep > 1) {
      setCurrentStep(initialStep);
      setSupabaseConnected(true);
      return;
    }

    // Client-side verification
    fetch("/api/setup/status")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.supabaseConnected) {
          setSupabaseConnected(true);
          if (data.supabaseUrl) setConnectedSupabaseUrl(data.supabaseUrl);
          if (data.supabaseServiceRoleKey) setConnectedServiceRoleKey(data.supabaseServiceRoleKey);
          if (data.hasAiKey) setAiConnected(true);
          if (data.hasPreferences) setPreferencesSaved(true);
          if (data.savedSettings) setSavedSettings(data.savedSettings);

          if (data.step && data.step > 1) {
            setCurrentStep(data.step as 1 | 2 | 3 | 4 | 5);
          } else {
            setCurrentStep(2);
          }
        }
      })
      .catch((err) => console.warn("Setup status fetch error:", err));
  }, [initialStep]);

  const updateStepRemote = (step: 1 | 2 | 3 | 4 | 5) => {
    fetch("/api/setup/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step }),
    }).catch(console.warn);
  };

  const handleStepTransition = (step: 1 | 2 | 3 | 4 | 5) => {
    updateStepRemote(step);
    setCurrentStep(step);
  };

  // Handler: Save Step 3 Job Preferences and advance to Step 4 (Resume Studio)
  const handleSavePreferences = async (prefs: {
    queries: string[];
    location: string;
    geoId: string;
    jobTypes: string;
    workplaceTypes: string;
    scrapingSources: string[];
  }) => {
    setIsSavingPreferences(true);
    try {
      const res = await fetch("/api/setup/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkedinSearchQueries: prefs.queries,
          linkedinLocation: prefs.location,
          linkedinGeoId: prefs.geoId,
          linkedinJobType: prefs.jobTypes,
          linkedinFWt: prefs.workplaceTypes,
          scrapingSources: prefs.scrapingSources,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save job preferences.");
      }

      if (data.settings) {
        setSavedSettings(data.settings);
      }
      setPreferencesSaved(true);
      handleStepTransition(4);
    } finally {
      setIsSavingPreferences(false);
    }
  };

  // Handler: Finish setup and navigate to dashboard
  const handleLaunchDashboard = async () => {
    try {
      await fetch("/api/setup/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupCompleted: true }),
      });
    } catch (err) {
      console.warn("Notice calling /api/setup/finish:", err);
    }
    window.location.href = "/";
  };

  return (
    <div className="py-6 px-2 sm:px-4 flex flex-col justify-center">
      <div className="max-w-7xl mx-auto w-full">
        {/* Wizard Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Quick Setup Wizard
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
            Welcome to JobTrack
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-xl mx-auto">
            Configure your autonomous scraper, Supabase database, and AI resume studio in under 2 minutes.
          </p>
        </div>

        {/* Stepper Progress Bar */}
        <SetupStepper
          currentStep={currentStep}
          onStepClick={(step) => setCurrentStep(step)}
          maxAccessibleStep={maxAccessibleStep}
        />

        {/* Main Step Card Container */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/80 p-6 sm:p-8">
          {currentStep === 1 && (
            <Step1Database
              supabaseConnected={supabaseConnected}
              connectedSupabaseUrl={connectedSupabaseUrl}
              onConnected={(url) => {
                setSupabaseConnected(true);
                if (url) setConnectedSupabaseUrl(url);
              }}
              onNextStep={() => handleStepTransition(2)}
            />
          )}

          {currentStep === 2 && (
            <Step2AiEngine
              supabaseConnected={supabaseConnected}
              connectedSupabaseUrl={connectedSupabaseUrl}
              aiConnected={aiConnected}
              savedModel={aiConfig.model}
              savedProvider={aiConfig.provider}
              savedTier={aiConfig.tier}
              onBack={() => setCurrentStep(1)}
              onNextStep={() => handleStepTransition(3)}
              onSuccess={(data) => {
                setAiConfig(data);
                setAiConnected(true);
                handleStepTransition(3);
              }}
            />
          )}

          {currentStep === 3 && (
            <Step3Preferences
              initialSettings={savedSettings}
              onBack={() => setCurrentStep(2)}
              onNext={handleSavePreferences}
              isSaving={isSavingPreferences}
            />
          )}

          {currentStep === 4 && (
            <Step4ResumeStudio
              onBack={() => setCurrentStep(3)}
              onNextStep={() => handleStepTransition(5)}
            />
          )}

          {currentStep === 5 && (
            <Step5GitHub
              onBack={() => setCurrentStep(4)}
              onFinish={handleLaunchDashboard}
              supabaseUrl={connectedSupabaseUrl}
              supabaseServiceRoleKey={connectedServiceRoleKey}
              llmApiKey={aiConfig.apiKey}
              llmModel={aiConfig.model}
              llmTier={aiConfig.tier}
              llmProvider={aiConfig.provider}
            />
          )}
        </div>
      </div>
    </div>
  );
}
