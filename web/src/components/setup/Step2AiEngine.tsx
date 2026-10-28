"use client";

import React, { useState, useMemo } from "react";
import {
  Cpu,
  CheckCircle2,
  AlertCircle,
  Key,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Lock,
} from "lucide-react";
import {
  CURATED_MODELS,
  ModelDefinition,
} from "@/lib/setup/modelCatalog";
import { Step2BudgetCalculator } from "./Step2BudgetCalculator";

interface Step2AiEngineProps {
  supabaseConnected: boolean;
  connectedSupabaseUrl: string;
  aiConnected?: boolean;
  savedModel?: string;
  savedProvider?: string;
  savedTier?: "free" | "paid";
  onBack: () => void;
  onNextStep: () => void;
  onSuccess: (data: {
    apiKey: string;
    model: string;
    provider: string;
    tier: "free" | "paid";
    maxRpm: number;
    requestDelaySeconds: number;
  }) => void;
}

export function Step2AiEngine({
  supabaseConnected,
  connectedSupabaseUrl,
  aiConnected = false,
  savedModel,
  savedProvider,
  savedTier = "free",
  onBack,
  onNextStep,
  onSuccess,
}: Step2AiEngineProps) {
  const [selectedModelId, setSelectedModelId] = useState(() => savedModel || "gemini-3.8-flash");
  // User's persistent tier preference across model selections
  const [userTierPreference, setUserTierPreference] = useState<"free" | "paid">(() => savedTier || "free");
  const [aiApiKey, setAiApiKey] = useState("");
  const [showAiApiKey, setShowAiApiKey] = useState(false);
  const [modelFilterTab, setModelFilterTab] = useState<"all" | "free" | "budget" | "flagship" | "custom">("all");
  const [customModelInput, setCustomModelInput] = useState("");
  const [isCustomModel, setIsCustomModel] = useState(false);

  // Stable volume sliders: Initialized once to 10 jobs + 2 resumes (16 calls/day)
  // They DO NOT reset when switching models or toggling Free/Paid!
  const [calcJobsPerDay, setCalcJobsPerDay] = useState(10);
  const [calcResumesPerDay, setCalcResumesPerDay] = useState(2);

  // Testing & saving state
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [testLatencyMs, setTestLatencyMs] = useState<number | null>(null);
  const [aiTestSuccess, setAiTestSuccess] = useState(false);
  const [step2Error, setStep2Error] = useState<string | null>(null);

  // Current model definition
  const selectedModel = useMemo<ModelDefinition>(() => {
    const found = CURATED_MODELS.find((m) => m.id === selectedModelId);
    return found || CURATED_MODELS[0];
  }, [selectedModelId]);

  // Effective tier: If model supports free tier, use user's preference; otherwise, strictly "paid"
  const effectiveTier: "free" | "paid" = useMemo(() => {
    if (isCustomModel) return "paid";
    return selectedModel.supportsFreeTier ? userTierPreference : "paid";
  }, [isCustomModel, selectedModel, userTierPreference]);

  // Select model without resetting sliders or userTierPreference
  const handleSelectModel = (m: ModelDefinition) => {
    setSelectedModelId(m.id);
    setStep2Error(null);
  };

  // Filtered models for display
  const displayedModels = useMemo(() => {
    if (modelFilterTab === "all") return CURATED_MODELS;
    if (modelFilterTab === "free") return CURATED_MODELS.filter((m) => m.supportsFreeTier);
    if (modelFilterTab === "budget") return CURATED_MODELS.filter((m) => m.category === "budget");
    if (modelFilterTab === "flagship") return CURATED_MODELS.filter((m) => m.category === "flagship");
    return [];
  }, [modelFilterTab]);

  // Test and save immediately
  const handleTestAndSaveAi = async () => {
    // If already configured and user didn't enter a new key, simply advance to Step 3
    if (aiConnected && !aiApiKey.trim() && !isCustomModel) {
      onNextStep();
      return;
    }

    if (!aiApiKey.trim()) {
      setStep2Error(`Please enter your ${isCustomModel ? "AI" : selectedModel.providerName} API key.`);
      return;
    }
    if (isCustomModel && !customModelInput.trim()) {
      setStep2Error("Please enter a custom LiteLLM model identifier.");
      return;
    }

    setStep2Error(null);
    setIsTestingAi(true);
    setTestLatencyMs(null);

    const activeModel = isCustomModel ? customModelInput.trim() : selectedModel.id;
    const activeProvider = isCustomModel ? "custom" : selectedModel.provider;
    const activeRpm = isCustomModel
      ? 60
      : effectiveTier === "free"
      ? selectedModel.recommendedFreeRpm
      : 60;
    const activeDelay = isCustomModel
      ? 1
      : effectiveTier === "free"
      ? selectedModel.recommendedFreeDelaySeconds
      : 1;

    try {
      // 1. Perform lightweight ping test
      const testRes = await fetch("/api/settings/test-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: activeProvider,
          model: activeModel,
          apiKey: aiApiKey.trim(),
        }),
      });
      const testData = await testRes.json();

      if (!testRes.ok || !testData.success) {
        throw new Error(testData.error || "AI connection test failed. Check your API key and model endpoint.");
      }

      setTestLatencyMs(testData.latencyMs || 250);

      // 2. Immediately persist AI configuration to Supabase app_settings & env files!
      const saveRes = await fetch("/api/setup/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: aiApiKey.trim(),
          model: activeModel,
          provider: activeProvider,
          tier: effectiveTier,
          maxRpm: activeRpm,
          requestDelaySeconds: activeDelay,
        }),
      });

      if (!saveRes.ok) {
        const saveData = await saveRes.json();
        console.warn("Failed to persist AI key to Supabase:", saveData.error);
      }

      setAiTestSuccess(true);
      await new Promise((resolve) => setTimeout(resolve, 800));

      onSuccess({
        apiKey: aiApiKey.trim(),
        model: activeModel,
        provider: activeProvider,
        tier: effectiveTier,
        maxRpm: activeRpm,
        requestDelaySeconds: activeDelay,
      });
    } catch (err: any) {
      setStep2Error(err.message);
    } finally {
      setIsTestingAi(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
          <Cpu className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Connect Your AI Engine</h2>
          <p className="text-xs text-slate-500">
            Select from 100% free models or ultra-economical pay-as-you-go providers for ATS match scoring and 1:1 resume personalization.
          </p>
        </div>
      </div>

      {/* Step 1 Completion Notice */}
      {supabaseConnected && (
        <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Step 1 Complete:</strong> Supabase database connected
              {connectedSupabaseUrl ? ` (${connectedSupabaseUrl})` : ""}.
            </span>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline"
          >
            Change Database
          </button>
        </div>
      )}

      {/* Already Configured Callout */}
      {aiConnected && (
        <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-emerald-950">AI Engine Already Configured & Verified!</p>
              <p className="text-emerald-800 text-[11px] mt-0.5">
                Configured with <strong>{savedModel || selectedModel.name}</strong> ({savedTier || effectiveTier} tier). You can update your key below, or continue directly to Step 3.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNextStep}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition shadow-sm flex items-center justify-center gap-1.5 shrink-0 text-xs"
          >
            <span>Continue to Step 3</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step2Error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">AI Connection Notice</p>
            <p className="mt-0.5">{step2Error}</p>
          </div>
        </div>
      )}

      {aiTestSuccess && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="font-medium">
            {isCustomModel ? customModelInput : selectedModel.name} connection verified & saved successfully
            {testLatencyMs ? ` (${testLatencyMs}ms latency)` : ""}! Proceeding to preferences...
          </p>
        </div>
      )}

      {/* RESPONSIVE SIDE-BY-SIDE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: MODEL SELECTION & API KEY (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => {
                setModelFilterTab("all");
                setIsCustomModel(false);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                modelFilterTab === "all" && !isCustomModel
                  ? "bg-white text-indigo-700 font-bold shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Models
            </button>
            <button
              type="button"
              onClick={() => {
                setModelFilterTab("free");
                setIsCustomModel(false);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1 ${
                modelFilterTab === "free" && !isCustomModel
                  ? "bg-white text-emerald-700 font-bold shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>100% Free Tier</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setModelFilterTab("budget");
                setIsCustomModel(false);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1 ${
                modelFilterTab === "budget" && !isCustomModel
                  ? "bg-white text-blue-700 font-bold shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              <span>Budget (&lt;$1/mo)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setModelFilterTab("flagship");
                setIsCustomModel(false);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1 ${
                modelFilterTab === "flagship" && !isCustomModel
                  ? "bg-white text-purple-700 font-bold shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
              <span>Flagship</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setModelFilterTab("custom");
                setIsCustomModel(true);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1 ${
                isCustomModel
                  ? "bg-white text-slate-900 font-bold shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Custom LiteLLM</span>
            </button>
          </div>

          {/* Model Cards Grid */}
          {!isCustomModel ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
              {displayedModels.map((m) => {
                const isSelected = selectedModelId === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => handleSelectModel(m)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition relative flex flex-col justify-between ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-sm"
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
                        <h3 className="text-sm font-bold text-slate-900">{m.name}</h3>
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
                      <span className="font-medium text-slate-400">
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
                <input
                  type="text"
                  value={customModelInput}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  placeholder="e.g., openai/gpt-6-luna or anthropic/claude-haiku-5-5 or deepseek/deepseek-chat"
                  className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                JobTrack supports any model supported by{" "}
                <a
                  href="https://docs.litellm.ai/docs/providers"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 font-bold underline inline-flex items-center gap-0.5"
                >
                  <span>LiteLLM</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                . Use the provider prefix (e.g., <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-800">openai/...</code>, <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-800">anthropic/...</code>).
              </p>
            </div>
          )}

          {/* BILLING TIER SELECTOR: When model supports Free Tier */}
          {!isCustomModel && selectedModel.supportsFreeTier ? (
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800">
                  Select Project Tier for {selectedModel.name}:
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {effectiveTier === "free" ? "Default Unbilled AI Studio Project" : "Paid Cloud Project"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUserTierPreference("free")}
                  className={`p-2.5 rounded-lg border text-left transition flex items-center justify-between ${
                    effectiveTier === "free"
                      ? "border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-1 ring-emerald-500"
                      : "border-slate-200 hover:border-slate-300 bg-white text-slate-600"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-xs font-bold block">Free Tier (Unbilled)</span>
                      <span className="text-[10px] text-slate-500 block">
                        Capped at {selectedModel.freeRpd} RPD • 100% Free
                      </span>
                    </div>
                  </div>
                  {effectiveTier === "free" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                </button>

                <button
                  type="button"
                  onClick={() => setUserTierPreference("paid")}
                  className={`p-2.5 rounded-lg border text-left transition flex items-center justify-between ${
                    effectiveTier === "paid"
                      ? "border-indigo-500 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-500"
                      : "border-slate-200 hover:border-slate-300 bg-white text-slate-600"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <span className="text-xs font-bold block">Paid Tier (Pay-As-You-Go)</span>
                      <span className="text-[10px] text-slate-500 block">
                        ${selectedModel.paidInputCostPerM} in / ${selectedModel.paidOutputCostPerM} out MTok
                      </span>
                    </div>
                  </div>
                  {effectiveTier === "paid" && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                </button>
              </div>
            </div>
          ) : !isCustomModel ? (
            /* PAID ONLY CALLOUT: When model has no free tier */
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                <div>
                  <span className="font-bold text-slate-800 block">
                    Pay-As-You-Go Only for {selectedModel.name}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    This provider does not offer an unbilled free tier. Billed at ${selectedModel.paidInputCostPerM} input / ${selectedModel.paidOutputCostPerM} output per million tokens.
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 shrink-0">
                Paid Only
              </span>
            </div>
          ) : null}

          {/* Dynamic API Key Input */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-800">
                {isCustomModel ? "Provider API Key" : selectedModel.keyName}
              </label>
              {!isCustomModel && (
                <a
                  href={selectedModel.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  <span>Get API Key at {selectedModel.providerName}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Key className="w-4 h-4" />
              </div>
              <input
                type={showAiApiKey ? "text" : "password"}
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder={
                  aiConnected && !aiApiKey
                    ? "••••••••••••••••••••••••• (Key already saved & verified)"
                    : isCustomModel
                    ? "Enter provider API key..."
                    : selectedModel.keyPlaceholder
                }
                className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowAiApiKey(!showAiApiKey)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showAiApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <p className="mt-1.5 text-[11px] text-slate-500">
              {effectiveTier === "free" && selectedModel.supportsFreeTier
                ? `✨ Free tier key. Safe rate-limit delay will be set to ${selectedModel.recommendedFreeDelaySeconds}s to prevent 429s.`
                : "💳 Pay-as-you-go key. Fast rate-limit delay will be set to 1s."}
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: REAL-TIME BUDGET CALCULATOR (5 Cols - Sticky on Desktop) */}
        <div className="lg:col-span-5 lg:sticky lg:top-6">
          <Step2BudgetCalculator
            model={selectedModel}
            tier={effectiveTier}
            jobsPerDay={calcJobsPerDay}
            resumesPerDay={calcResumesPerDay}
            onChangeJobsPerDay={setCalcJobsPerDay}
            onChangeResumesPerDay={setCalcResumesPerDay}
          />
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="mt-8 pt-5 border-t border-slate-200 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 transition"
        >
          Back to Step 1
        </button>

        {aiConnected && !aiApiKey.trim() ? (
          <button
            type="button"
            onClick={onNextStep}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 text-xs"
          >
            <span>Continue to Step 3 (Preferences)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleTestAndSaveAi}
            disabled={isTestingAi || !aiApiKey.trim() || (isCustomModel && !customModelInput.trim())}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 text-xs"
          >
            {isTestingAi ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying & Saving {isCustomModel ? customModelInput : selectedModel.providerName}...</span>
              </>
            ) : (
              <>
                <span>Test Connection, Save & Continue</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
