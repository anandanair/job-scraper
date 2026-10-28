"use client";

import React, { useState, useMemo } from "react";
import {
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Zap,
  Cpu,
} from "lucide-react";
import { AppSettings, LLMProvider, LLMTier } from "@/types";
import { CURATED_MODELS, ModelDefinition } from "@/lib/setup/modelCatalog";

interface AiEngineSettingsProps {
  settings: AppSettings;
  onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onApplyTierPreset: (tier: LLMTier) => void;
  onTestConnection: () => Promise<void>;
  isTesting: boolean;
  testResult: {
    success: boolean;
    message?: string;
    error?: string;
    latencyMs?: number;
  } | null;
}

export function AiEngineSettings({
  settings,
  onChange,
  onApplyTierPreset,
  onTestConnection,
  isTesting,
  testResult,
}: AiEngineSettingsProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [modelFilterTab, setModelFilterTab] = useState<"all" | "free" | "budget" | "flagship" | "custom">(() => {
    const isCurated = CURATED_MODELS.some((m) => m.id === settings.llm_model);
    return isCurated ? "all" : "custom";
  });
  const [customModelInput, setCustomModelInput] = useState(settings.llm_model);

  // Check if current model is a custom LiteLLM model
  const isCustomModel = useMemo(() => {
    return !CURATED_MODELS.some((m) => m.id === settings.llm_model);
  }, [settings.llm_model]);

  // Current active curated model definition (if any)
  const activeModel = useMemo<ModelDefinition>(() => {
    const found = CURATED_MODELS.find((m) => m.id === settings.llm_model);
    return found || CURATED_MODELS[0];
  }, [settings.llm_model]);

  // Filtered models for display matching setup
  const displayedModels = useMemo(() => {
    if (modelFilterTab === "free") return CURATED_MODELS.filter((m) => m.supportsFreeTier);
    if (modelFilterTab === "budget") return CURATED_MODELS.filter((m) => m.category === "budget");
    if (modelFilterTab === "flagship") return CURATED_MODELS.filter((m) => m.category === "flagship");
    return CURATED_MODELS;
  }, [modelFilterTab]);

  // Select a model from the curated list
  const handleSelectModel = (model: ModelDefinition) => {
    onChange("llm_model", model.id);
    onChange("llm_provider", model.provider as LLMProvider);

    if (model.supportsFreeTier) {
      // Keep existing tier or default to free
      const tier = settings.llm_tier === "paid" ? "paid" : "free";
      onChange("llm_tier", tier);
      onChange(
        "llm_request_delay_seconds",
        tier === "free" ? model.recommendedFreeDelaySeconds : model.recommendedPaidDelaySeconds
      );
      onChange("llm_max_rpm", tier === "free" ? model.recommendedFreeRpm : 60);
    } else {
      // Paid-only models
      onChange("llm_tier", "paid");
      onChange("llm_request_delay_seconds", model.recommendedPaidDelaySeconds);
      onChange("llm_max_rpm", 60);
    }
  };

  const handleCustomModelSubmit = () => {
    if (customModelInput.trim()) {
      const trimmed = customModelInput.trim();
      onChange("llm_model", trimmed);

      // Determine provider prefix if available e.g. "openai/gpt-4o" -> "openai"
      let provider: LLMProvider = "openai";
      if (trimmed.startsWith("gemini/")) provider = "gemini";
      else if (trimmed.startsWith("anthropic/")) provider = "anthropic";
      else if (trimmed.startsWith("fireworks/")) provider = "fireworks";

      onChange("llm_provider", provider);
      onChange("llm_tier", "paid");
      onChange("llm_request_delay_seconds", 1);
      onChange("llm_max_rpm", 60);
    }
  };

  return (
    <div className="space-y-6">
      {/* Active AI Summary Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-white to-slate-50 border border-indigo-100 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                Active AI Engine
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Currently Selected
              </span>
            </div>
            <p className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">
              {isCustomModel ? "Custom LiteLLM" : activeModel.providerName} •{" "}
              <span className="font-mono text-indigo-900">{settings.llm_model}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 text-xs font-bold rounded-lg border ${
              settings.llm_tier === "free"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-indigo-50 text-indigo-700 border-indigo-200"
            }`}
          >
            {settings.llm_tier === "free" ? "Free Tier (Unbilled)" : "Paid Pay-As-You-Go"}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            Delay: {settings.llm_request_delay_seconds}s
          </span>
        </div>
      </div>

      {/* 1. Model Selection from Curated Catalog */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              AI Models Catalog
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              Select from curated models across Google Gemini, OpenAI, Anthropic, Fireworks AI, or enter a custom LiteLLM identifier.
            </p>
          </div>

          {/* Category Filter Tabs matching Setup */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setModelFilterTab("all")}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition ${
                modelFilterTab === "all"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Models
            </button>
            <button
              type="button"
              onClick={() => setModelFilterTab("free")}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1 ${
                modelFilterTab === "free"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>100% Free Tier</span>
            </button>
            <button
              type="button"
              onClick={() => setModelFilterTab("budget")}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1 ${
                modelFilterTab === "budget"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              <span>Budget (&lt;$1/mo)</span>
            </button>
            <button
              type="button"
              onClick={() => setModelFilterTab("flagship")}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1 ${
                modelFilterTab === "flagship"
                  ? "bg-white text-purple-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
              <span>Flagship</span>
            </button>
            <button
              type="button"
              onClick={() => setModelFilterTab("custom")}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition ${
                modelFilterTab === "custom"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Custom LiteLLM
            </button>
          </div>
        </div>

        {/* Model Grid */}
        {modelFilterTab !== "custom" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayedModels.map((m) => {
              const isSelected = settings.llm_model === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => handleSelectModel(m)}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition relative flex flex-col justify-between ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs"
                      : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {m.providerName}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          m.badgeType === "free"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : m.badgeType === "budget"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-purple-50 text-purple-700 border-purple-200"
                        }`}
                      >
                        {m.badge}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900">{m.name}</h4>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-snug line-clamp-2">
                      {m.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-mono">{m.rateLimitNote}</span>
                    <span className="font-semibold text-slate-400">
                      {m.supportsFreeTier ? "Free / Paid" : "Paid Only"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Custom LiteLLM Model Identifier
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customModelInput}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  placeholder="e.g. openai/gpt-4o-mini or anthropic/claude-3-5-sonnet-latest"
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleCustomModelSubmit}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition"
                >
                  Apply Model
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Any model identifier supported by LiteLLM can be specified here using the provider prefix.
            </p>
          </div>
        )}
      </div>

      {/* 2. Billing Tier Switcher (when model supports Free Tier) */}
      {!isCustomModel && activeModel.supportsFreeTier && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Project Tier for {activeModel.name}:
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {settings.llm_tier === "free" ? "Default Unbilled AI Studio Project" : "Paid Cloud Project"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onApplyTierPreset("free")}
              className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between ${
                settings.llm_tier === "free"
                  ? "border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-1 ring-emerald-500 shadow-xs"
                  : "border-slate-200 hover:border-slate-300 bg-white text-slate-600"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="text-xs font-bold block">Free Tier (Unbilled)</span>
                  <span className="text-[11px] text-slate-500 block">
                    Capped at {activeModel.freeRpd || 1500} RPD • 100% Free
                  </span>
                </div>
              </div>
              {settings.llm_tier === "free" && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onApplyTierPreset("paid")}
              className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between ${
                settings.llm_tier === "paid"
                  ? "border-indigo-500 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-500 shadow-xs"
                  : "border-slate-200 hover:border-slate-300 bg-white text-slate-600"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Zap className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <span className="text-xs font-bold block">Paid Tier (Pay-As-You-Go)</span>
                  <span className="text-[11px] text-slate-500 block">
                    High throughput • ~$0.40 to $2.00 / mo
                  </span>
                </div>
              </div>
              {settings.llm_tier === "paid" && (
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* 3. API Key & Live Connection Test */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              {isCustomModel ? "LiteLLM API Key" : activeModel.keyName}
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              Saved in your Supabase database and used for automated scoring and tailoring.
            </p>
          </div>
          {!isCustomModel && activeModel.keyUrl && (
            <a
              href={activeModel.keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
            >
              <span>Get key from {activeModel.providerName}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Key className="w-4 h-4" />
            </div>
            <input
              type={showApiKey ? "text" : "password"}
              value={settings.llm_api_key || ""}
              onChange={(e) => onChange("llm_api_key", e.target.value)}
              placeholder={isCustomModel ? "sk-... or api key" : activeModel.keyPlaceholder}
              className="w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="button"
            disabled={isTesting || !settings.llm_api_key}
            onClick={onTestConnection}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {isTesting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Testing Connection...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Test Live Connection</span>
              </>
            )}
          </button>
        </div>

        {/* Live Test Feedback */}
        {testResult && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 transition-all ${
              testResult.success
                ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                : "bg-rose-50 text-rose-900 border border-rose-200"
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-bold">
                {testResult.success
                  ? `Connection Verified${testResult.latencyMs ? ` (${testResult.latencyMs}ms latency)` : ""}`
                  : "Connection Failed"}
              </p>
              <p className="mt-0.5 opacity-90">{testResult.message || testResult.error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
