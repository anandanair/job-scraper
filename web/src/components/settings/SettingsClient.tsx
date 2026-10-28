"use client";

import React, { useState } from "react";
import {
  Bot,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  Sliders,
  MapPin,
  Briefcase,
  Zap,
  Globe,
  ExternalLink,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { AppSettings, LLMProvider, LLMTier } from "@/types";
import { TagListEditor } from "@/components/resume/TagListEditor";

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
  jobs_to_score_per_run: 10,
  jobs_to_customize_per_run: 2,
  max_jobs_per_search: { linkedin: 10, careers_future: 20 },
  llm_max_rpm: 10,
  llm_request_delay_seconds: 8,
  llm_daily_request_budget: 0,
};

const GEMINI_MODELS = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash (Recommended)",
    badge: "Flagship",
    description: "Most intelligent Flash model, engineered for long-horizon software engineering & workflows.",
  },
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash-Lite",
    badge: "Fast & Economical",
    description: "Fastest execution and most budget-friendly for high-volume scoring.",
  },
  {
    id: "gemini-4-argon",
    name: "Gemini 4 Argon",
    badge: "Reasoning Flagship",
    description: "Flagship deep reasoning model with unified 1M context window.",
  },
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    badge: "Balanced",
    description: "Previous-generation balanced Flash model across general tasks.",
  },
  {
    id: "gemini",
    name: "Auto-Fallback Pool ('gemini')",
    badge: "Multi-Model",
    description: "Automatically cycles through Flash models to distribute request quotas and avoid 429s.",
  },
];

const LOCATION_PRESETS = [
  { name: "Singapore", geoId: "102454443" },
  { name: "United States", geoId: "103644278" },
  { name: "United Kingdom", geoId: "102257491" },
  { name: "Canada", geoId: "101174742" },
  { name: "Australia", geoId: "101452733" },
  { name: "United Arab Emirates (Dubai)", geoId: "100205264" },
  { name: "India", geoId: "102713980" },
  { name: "Germany", geoId: "101282230" },
];

export default function SettingsClient({ initialSettings }: SettingsClientProps) {
  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...(initialSettings || {}),
  }));

  const [showApiKey, setShowApiKey] = useState(false);
  const [isCustomModel, setIsCustomModel] = useState<boolean>(() => {
    const current = settings.llm_model;
    return !GEMINI_MODELS.some((m) => m.id === current);
  });
  const [customModelValue, setCustomModelValue] = useState(settings.llm_model);

  // Live Connection Test states
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    latencyMs?: number;
  } | null>(null);

  // Save states
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Apply Tier Presets
  const applyTierPresets = (tier: LLMTier) => {
    if (tier === "free") {
      setSettings((prev) => ({
        ...prev,
        llm_tier: "free",
        llm_max_rpm: 10,
        llm_request_delay_seconds: 8,
        jobs_to_score_per_run: 10,
        jobs_to_customize_per_run: 2,
      }));
    } else {
      setSettings((prev) => ({
        ...prev,
        llm_tier: "paid",
        llm_max_rpm: 60,
        llm_request_delay_seconds: 1,
        jobs_to_score_per_run: 25,
        jobs_to_customize_per_run: 5,
      }));
    }
  };

  // Run Test Connection
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    const activeModel = isCustomModel ? customModelValue : settings.llm_model;

    try {
      const res = await fetch("/api/settings/test-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.llm_provider,
          model: activeModel,
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
      setTesting(false);
    }
  };

  // Save Settings
  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);

    const payload: AppSettings = {
      ...settings,
      llm_model: isCustomModel ? customModelValue.trim() : settings.llm_model,
    };

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSettings(data.settings);
        setSaveStatus({
          type: "success",
          message: "Settings successfully saved to database! Scrapers will use these values on their next run.",
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

  // Reset to original
  const handleReset = () => {
    if (confirm("Reset all settings to previously saved values?")) {
      const fallback = initialSettings || DEFAULT_SETTINGS;
      setSettings(fallback);
      setIsCustomModel(!GEMINI_MODELS.some((m) => m.id === fallback.llm_model));
      setCustomModelValue(fallback.llm_model);
      setTestResult(null);
      setSaveStatus(null);
    }
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Save Notification Banner */}
      {saveStatus && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
            saveStatus.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-3">
            {saveStatus.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            )}
            <p className="text-sm font-medium">{saveStatus.message}</p>
          </div>
          <button
            onClick={() => setSaveStatus(null)}
            className="text-xs underline hover:no-underline opacity-75 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Card 1: AI Provider & Model Configuration */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">AI Provider & Model Settings</h2>
            <p className="text-xs sm:text-sm text-gray-500">
              Select your AI platform, choose a Gemini model, and configure your API key.
            </p>
          </div>
        </div>

        {/* Provider Selection */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
            AI Provider
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: "gemini", name: "Google Gemini", sub: "Recommended" },
              { id: "fireworks", name: "Fireworks AI", sub: "Fast Serverless" },
              { id: "openai", name: "OpenAI", sub: "GPT-4o Mini" },
              { id: "groq", name: "Groq", sub: "Ultra-Fast Llama" },
            ].map((p) => {
              const active = settings.llm_provider === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSettings({ ...settings, llm_provider: p.id as LLMProvider })}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    active
                      ? "border-indigo-600 bg-indigo-50/50 text-indigo-950 ring-2 ring-indigo-500/20"
                      : "border-gray-200 hover:border-gray-300 bg-white text-gray-800"
                  }`}
                >
                  <div className="font-semibold text-sm">{p.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{p.sub}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Account Plan / Tier Mode */}
        <div className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                API Account Tier
              </label>
              <p className="text-xs text-gray-500 mt-0.5">
                {settings.llm_tier === "free"
                  ? "Free Tier auto-calibrates delays (8s) and safe batches to prevent 429 quota exhaustion."
                  : "Paid / Pay-as-you-go enables turbo mode with minimal delay and larger batch sizes."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => applyTierPresets("free")}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-all ${
                  settings.llm_tier === "free"
                    ? "bg-white border-indigo-600 text-indigo-600 shadow-sm"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                Free Tier (AI Studio)
              </button>
              <button
                type="button"
                onClick={() => applyTierPresets("paid")}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-all ${
                  settings.llm_tier === "paid"
                    ? "bg-white border-indigo-600 text-indigo-600 shadow-sm"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                Paid / Pay-as-you-go
              </button>
            </div>
          </div>
        </div>

        {/* Gemini Model Selection */}
        {settings.llm_provider === "gemini" && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Gemini Model Endpoint
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsCustomModel(!isCustomModel);
                  if (isCustomModel) {
                    setSettings({ ...settings, llm_model: "gemini-3.8-flash" });
                  }
                }}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                {isCustomModel ? "Pick from Curated Models" : "Specify Custom Model Endpoint"}
              </button>
            </div>

            {isCustomModel ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={customModelValue}
                  onChange={(e) => setCustomModelValue(e.target.value)}
                  placeholder="e.g., gemini-3.8-flash or gemini-4-argon"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500">
                  Accepts any model name supported by Google AI Studio (e.g., <code>gemini-3.8-flash</code>, <code>gemini-3.5-flash-lite</code>, <code>gemini-4-argon</code>).
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {GEMINI_MODELS.map((m) => {
                  const selected = settings.llm_model === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => setSettings({ ...settings, llm_model: m.id })}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start justify-between ${
                        selected
                          ? "border-indigo-600 bg-indigo-50/40 text-indigo-950 ring-1 ring-indigo-600"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{m.name}</span>
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                            {m.badge}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{m.description}</p>
                      </div>
                      <div className="mt-1">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            selected ? "border-indigo-600 bg-indigo-600" : "border-gray-300"
                          }`}
                        >
                          {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Non-Gemini Model Input */}
        {settings.llm_provider !== "gemini" && (
          <div className="mb-6">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Model Endpoint String
            </label>
            <input
              type="text"
              value={settings.llm_model}
              onChange={(e) => setSettings({ ...settings, llm_model: e.target.value })}
              placeholder={
                settings.llm_provider === "fireworks"
                  ? "accounts/fireworks/models/glm-5p3-flash"
                  : "gpt-4o-mini"
              }
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {/* API Key Input & Connection Test */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
              {settings.llm_provider === "gemini" ? "Google AI Studio API Key" : "API Key"}
            </label>
            {settings.llm_provider === "gemini" && (
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
              >
                Get a free key from Google AI Studio
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Key className="h-4 w-4" />
              </div>
              <input
                type={showApiKey ? "text" : "password"}
                value={settings.llm_api_key || ""}
                onChange={(e) => setSettings({ ...settings, llm_api_key: e.target.value })}
                placeholder="AIzaSy... or fw_..."
                className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <button
              type="button"
              disabled={testing || !settings.llm_api_key}
              onClick={handleTestConnection}
              className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {testing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
                  Testing...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Test AI Connection
                </>
              )}
            </button>
          </div>

          {/* Test Connection Result Feedback */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 transition-all ${
                testResult.success
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-semibold">{testResult.success ? "Success" : "Connection Failed"}</p>
                <p className="mt-0.5 opacity-90">{testResult.message || testResult.error}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card 2: Job Search & Scraper Targets */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
            <Briefcase className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Job Search Preferences</h2>
            <p className="text-xs sm:text-sm text-gray-500">
              Set the job roles and geographic targets that the automated scraper looks for.
            </p>
          </div>
        </div>

        {/* Scraping Sources */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
            Enabled Platforms
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-800 font-medium">
              <input
                type="checkbox"
                checked={settings.scraping_sources.includes("linkedin")}
                onChange={(e) => {
                  const current = new Set(settings.scraping_sources);
                  if (e.target.checked) current.add("linkedin");
                  else current.delete("linkedin");
                  setSettings({ ...settings, scraping_sources: Array.from(current) });
                }}
                className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              LinkedIn Jobs
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-800 font-medium">
              <input
                type="checkbox"
                checked={settings.scraping_sources.includes("careers_future")}
                onChange={(e) => {
                  const current = new Set(settings.scraping_sources);
                  if (e.target.checked) current.add("careers_future");
                  else current.delete("careers_future");
                  setSettings({ ...settings, scraping_sources: Array.from(current) });
                }}
                className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              MyCareersFuture (Singapore)
            </label>
          </div>
        </div>

        {/* Location & GeoID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Target Location
            </label>
            <select
              value={settings.linkedin_location}
              onChange={(e) => {
                const locName = e.target.value;
                const match = LOCATION_PRESETS.find((p) => p.name === locName);
                setSettings({
                  ...settings,
                  linkedin_location: locName,
                  linkedin_geo_id: match ? match.geoId : settings.linkedin_geo_id,
                });
              }}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {LOCATION_PRESETS.map((loc) => (
                <option key={loc.geoId} value={loc.name}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              LinkedIn Geo ID
            </label>
            <input
              type="text"
              value={settings.linkedin_geo_id}
              onChange={(e) => setSettings({ ...settings, linkedin_geo_id: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* LinkedIn Search Queries Tag Editor */}
        <div className="mb-6">
          <TagListEditor
            label="LinkedIn Job Titles / Search Keywords"
            items={settings.linkedin_search_queries}
            onChange={(items) => setSettings({ ...settings, linkedin_search_queries: items })}
            placeholder="e.g. Software Engineer, React Developer, Data Scientist..."
            helperText="Type a job title and press Enter or comma to add. The scraper loops through each keyword."
          />
        </div>

        {/* CareersFuture Queries if enabled */}
        {settings.scraping_sources.includes("careers_future") && (
          <div className="mb-6 pt-4 border-t border-gray-100">
            <TagListEditor
              label="MyCareersFuture Search Keywords"
              items={settings.careers_future_search_queries}
              onChange={(items) => setSettings({ ...settings, careers_future_search_queries: items })}
              placeholder="e.g. Full Stack Developer, DevOps Engineer..."
              helperText="Target search keywords used when scraping CareersFuture."
            />
          </div>
        )}
      </div>

      {/* Card 3: Processing Limits & Safety Delays */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
            <Sliders className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Processing Limits & Rate Guardrails</h2>
            <p className="text-xs sm:text-sm text-gray-500">
              Control how many jobs are processed per scheduled cycle and inter-request timing.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Jobs to Score / Run
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={settings.jobs_to_score_per_run}
              onChange={(e) => setSettings({ ...settings, jobs_to_score_per_run: Number(e.target.value) || 1 })}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">Recommended: 10 (Free) | 25 (Paid)</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Resumes to Customize / Run
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={settings.jobs_to_customize_per_run}
              onChange={(e) => setSettings({ ...settings, jobs_to_customize_per_run: Number(e.target.value) || 1 })}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">Recommended: 2 (Free) | 5 (Paid)</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Request Delay (Seconds)
            </label>
            <input
              type="number"
              min={0}
              max={60}
              value={settings.llm_request_delay_seconds}
              onChange={(e) => setSettings({ ...settings, llm_request_delay_seconds: Number(e.target.value) || 0 })}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">Recommended: 8s (Free safe) | 1s (Paid)</p>
          </div>
        </div>
      </div>

      {/* Sticky Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 py-3.5 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Defaults
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm hover:shadow flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Saving Changes...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
