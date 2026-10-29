"use client";

import React, { useState, useMemo } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import { AppSettings, LLMTier } from "@/types";
import { SettingsHeader } from "./SettingsHeader";
import { SettingsTabs, SettingsTabId } from "./SettingsTabs";
import { AiEngineSettings } from "./AiEngineSettings";
import { JobSearchSettings } from "./JobSearchSettings";
import { AutomationBudgetSettings } from "./AutomationBudgetSettings";
import { CloudWorkflowsSettings } from "./CloudWorkflowsSettings";
import { SettingsStickyBar } from "./SettingsStickyBar";

interface SettingsClientProps {
  initialSettings: AppSettings | null;
}

const DEFAULT_SETTINGS: AppSettings = {
  llm_provider: "gemini",
  llm_model: "gemini-3.8-flash",
  llm_api_key: "",
  llm_tier: "free",
  linkedin_search_queries: ["Software Engineer", "Full Stack Developer"],
  linkedin_location: "Singapore",
  linkedin_geo_id: "102454443",
  linkedin_job_type: "F",
  linkedin_job_posting_date: "r86400",
  linkedin_f_wt: "1,2,3",
  careers_future_search_queries: ["Software Engineer", "Frontend Developer"],
  careers_future_search_categories: ["Information Technology"],
  careers_future_search_employment_types: ["Full Time"],
  scraping_sources: ["linkedin"],
  jobs_to_score_per_run: 2,
  jobs_to_customize_per_run: 1,
  max_jobs_per_search: {
    linkedin: 5,
    careers_future: 5,
    daily_scrape_linkedin: 15,
    daily_scrape_careers_future: 15,
  },
  llm_max_rpm: 5,
  llm_request_delay_seconds: 15,
  llm_daily_request_budget: 0,
};

export default function SettingsClient({ initialSettings }: SettingsClientProps) {
  const mergedSettings = useMemo<AppSettings>(() => {
    const raw = {
      ...DEFAULT_SETTINGS,
      ...(initialSettings || {}),
    };

    const dailyJobs =
      typeof raw.max_jobs_per_search?.daily_jobs === "number"
        ? raw.max_jobs_per_search.daily_jobs
        : Math.max(1, (raw.jobs_to_score_per_run || 2) * 6);

    const dailyResumes =
      typeof raw.max_jobs_per_search?.daily_resumes === "number"
        ? raw.max_jobs_per_search.daily_resumes
        : Math.max(1, (raw.jobs_to_customize_per_run || 1) * 6);

    const dailyScrapeLinkedin = Math.min(
      30,
      typeof raw.max_jobs_per_search?.daily_scrape_linkedin === "number"
        ? raw.max_jobs_per_search.daily_scrape_linkedin
        : (typeof raw.max_jobs_per_search?.linkedin === "number"
            ? Math.min(30, raw.max_jobs_per_search.linkedin)
            : 15)
    );

    const dailyScrapeCareersFuture = Math.min(
      30,
      typeof raw.max_jobs_per_search?.daily_scrape_careers_future === "number"
        ? raw.max_jobs_per_search.daily_scrape_careers_future
        : (typeof raw.max_jobs_per_search?.careers_future === "number"
            ? Math.min(30, raw.max_jobs_per_search.careers_future)
            : 15)
    );

    return {
      ...raw,
      max_jobs_per_search: {
        ...(raw.max_jobs_per_search || {}),
        daily_scrape_linkedin: dailyScrapeLinkedin,
        daily_scrape_careers_future: dailyScrapeCareersFuture,
        daily_jobs: dailyJobs,
        daily_resumes: dailyResumes,
      },
    };
  }, [initialSettings]);

  const [initialSnapshot, setInitialSnapshot] = useState<AppSettings>(mergedSettings);
  const [settings, setSettings] = useState<AppSettings>(mergedSettings);

  const [activeTab, setActiveTab] = useState<SettingsTabId>("ai");

  // Save states
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Live Connection Test states
  const [testingAi, setTestingAi] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    latencyMs?: number;
  } | null>(null);

  // Compute dirty state
  const isDirty = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(initialSnapshot);
  }, [settings, initialSnapshot]);

  // Generic field updater
  const handleFieldChange = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Apply Tier Presets
  const handleApplyTierPreset = (tier: LLMTier) => {
    if (tier === "free") {
      setSettings((prev) => ({
        ...prev,
        llm_tier: "free",
        llm_max_rpm: 5,
        llm_request_delay_seconds: 15,
      }));
    } else {
      setSettings((prev) => ({
        ...prev,
        llm_tier: "paid",
        llm_max_rpm: 60,
        llm_request_delay_seconds: 1,
      }));
    }
  };

  // Run Test Connection
  const handleTestConnection = async () => {
    setTestingAi(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/settings/test-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.llm_provider,
          model: settings.llm_model,
          apiKey: settings.llm_api_key,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: data.message,
          latencyMs: data.latencyMs,
        });
      } else {
        setTestResult({
          success: false,
          error: data.error || "Failed to connect to model.",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || "Network error while connecting to LLM endpoint.",
      });
    } finally {
      setTestingAi(false);
    }
  };

  // Save Settings
  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const saved = data.settings || settings;
        setSettings(saved);
        setInitialSnapshot(saved);
        setSaveStatus({
          type: "success",
          message:
            "Settings successfully saved! Scrapers and AI workers will use these values on their next execution.",
        });
        setTimeout(() => setSaveStatus(null), 5000);
      } else {
        setSaveStatus({
          type: "error",
          message: data.error || "Failed to save settings.",
        });
      }
    } catch (err: any) {
      setSaveStatus({
        type: "error",
        message: err.message || "Network error while saving settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset Changes
  const handleReset = () => {
    if (confirm("Discard all unsaved changes and revert to the saved settings?")) {
      setSettings(initialSnapshot);
      setTestResult(null);
      setSaveStatus(null);
    }
  };

  return (
    <div className="space-y-6 pb-28">
      {/* Page Header */}
      <SettingsHeader settings={settings} />

      {/* Save Status Notification Banner */}
      {saveStatus && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
            saveStatus.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-3">
            {saveStatus.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            )}
            <p className="text-xs sm:text-sm font-semibold">{saveStatus.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setSaveStatus(null)}
            className="text-xs underline hover:no-underline opacity-75 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <SettingsTabs activeTab={activeTab} onChangeTab={setActiveTab} />

      {/* Tab Contents */}
      {activeTab === "ai" && (
        <AiEngineSettings
          settings={settings}
          onChange={handleFieldChange}
          onApplyTierPreset={handleApplyTierPreset}
          onTestConnection={handleTestConnection}
          isTesting={testingAi}
          testResult={testResult}
        />
      )}

      {activeTab === "search" && (
        <JobSearchSettings settings={settings} onChange={handleFieldChange} />
      )}

      {activeTab === "automation" && (
        <AutomationBudgetSettings settings={settings} onChange={handleFieldChange} />
      )}

      {activeTab === "cloud" && <CloudWorkflowsSettings settings={settings} />}

      {/* Fixed Sticky Action Bar */}
      <SettingsStickyBar
        isDirty={isDirty}
        isSaving={saving}
        onReset={handleReset}
        onSave={handleSave}
      />
    </div>
  );
}