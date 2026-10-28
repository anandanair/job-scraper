export interface ModelDefinition {
  id: string;
  name: string;
  provider: "gemini" | "fireworks" | "openai" | "anthropic" | "custom";
  providerName: string;
  category: "free" | "budget" | "flagship";
  tier: "free" | "paid";
  supportsFreeTier: boolean;
  freeRpm?: number;
  freeRpd?: number;
  paidInputCostPerM: number; // in USD per million tokens
  paidOutputCostPerM: number; // in USD per million tokens
  badge: string;
  badgeType: "free" | "budget" | "flagship";
  description: string;
  rateLimitNote: string;
  keyUrl: string;
  keyName: string;
  keyPlaceholder: string;
  recommendedFreeRpm: number;
  recommendedFreeDelaySeconds: number;
  recommendedPaidDelaySeconds: number;
}

export const CURATED_MODELS: ModelDefinition[] = [
  // 🟢 Google Gemini Generation
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "gemini",
    providerName: "Google Gemini",
    category: "free",
    tier: "free",
    supportsFreeTier: true,
    freeRpm: 5,
    freeRpd: 20, // 5 RPM / 20 RPD on unbilled projects
    paidInputCostPerM: 0.75,
    paidOutputCostPerM: 3.75,
    badge: "Recommended Flagship",
    badgeType: "free",
    description: "Google's most intelligent Flash model with unified 1M context. Unbilled free tier capped at 20 RPD.",
    rateLimitNote: "Free: 5 RPM / 20 RPD • Paid: 60+ RPM",
    keyUrl: "https://aistudio.google.com/app/apikey",
    keyName: "Google AI Studio API Key",
    keyPlaceholder: "AIzaSy...",
    recommendedFreeRpm: 4,
    recommendedFreeDelaySeconds: 15, // 15s delay avoids 429s on 5 RPM limit
    recommendedPaidDelaySeconds: 1,
  },
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    provider: "gemini",
    providerName: "Google Gemini",
    category: "free",
    tier: "free",
    supportsFreeTier: true,
    freeRpm: 15,
    freeRpd: 1500, // 15 RPM / 1,500 RPD
    paidInputCostPerM: 0.75,
    paidOutputCostPerM: 3.75,
    badge: "High Daily Quota (1.5k RPD)",
    badgeType: "free",
    description: "Stable, high-capacity Flash model offering a massive 1,500 daily requests on the free tier.",
    rateLimitNote: "Free: 15 RPM / 1,500 RPD • Paid: 60+ RPM",
    keyUrl: "https://aistudio.google.com/app/apikey",
    keyName: "Google AI Studio API Key",
    keyPlaceholder: "AIzaSy...",
    recommendedFreeRpm: 10,
    recommendedFreeDelaySeconds: 8, // 8s delay comfortably safe for 15 RPM
    recommendedPaidDelaySeconds: 1,
  },
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash-Lite",
    provider: "gemini",
    providerName: "Google Gemini",
    category: "free",
    tier: "free",
    supportsFreeTier: true,
    freeRpm: 30,
    freeRpd: 500, // 30 RPM / 500 RPD
    paidInputCostPerM: 0.30,
    paidOutputCostPerM: 2.50,
    badge: "Ultra-Fast (30 RPM)",
    badgeType: "free",
    description: "Fastest execution speed and lowest latency. 30 RPM with 500 requests per day on free tier.",
    rateLimitNote: "Free: 30 RPM / 500 RPD • Paid: $0.30 / $2.50 MTok",
    keyUrl: "https://aistudio.google.com/app/apikey",
    keyName: "Google AI Studio API Key",
    keyPlaceholder: "AIzaSy...",
    recommendedFreeRpm: 20,
    recommendedFreeDelaySeconds: 5, // 5s delay safe for 30 RPM
    recommendedPaidDelaySeconds: 1,
  },
  {
    id: "gemini-4-argon",
    name: "Gemini 4 Argon",
    provider: "gemini",
    providerName: "Google Gemini",
    category: "flagship",
    tier: "paid",
    supportsFreeTier: false,
    paidInputCostPerM: 2.00,
    paidOutputCostPerM: 8.00,
    badge: "Deep Reasoning Flagship",
    badgeType: "flagship",
    description: "Google's reasoning flagship for deep candidate profiling (Requires Paid Billing Key).",
    rateLimitNote: "Paid Only: $2.00 / $8.00 per MTok",
    keyUrl: "https://aistudio.google.com/app/apikey",
    keyName: "Google Cloud / AI Studio API Key",
    keyPlaceholder: "AIzaSy...",
    recommendedFreeRpm: 5,
    recommendedFreeDelaySeconds: 10,
    recommendedPaidDelaySeconds: 1,
  },

  // 🔵 Budget Workhorses (< $1/mo)
  {
    id: "claude-haiku-5-5",
    name: "Claude Haiku 5.5",
    provider: "anthropic",
    providerName: "Anthropic",
    category: "budget",
    tier: "paid",
    supportsFreeTier: false,
    paidInputCostPerM: 0.10,
    paidOutputCostPerM: 0.50,
    badge: "~$0.40 / mo",
    badgeType: "budget",
    description: "Fastest Claude model. Extraordinary natural tone and accuracy at fractions of a penny.",
    rateLimitNote: "Pay-As-You-Go ($0.10 / $0.50 per MTok)",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyName: "Anthropic API Key",
    keyPlaceholder: "sk-ant-...",
    recommendedFreeRpm: 10,
    recommendedFreeDelaySeconds: 5,
    recommendedPaidDelaySeconds: 1,
  },
  {
    id: "gpt-6-luna",
    name: "GPT-6 Luna",
    provider: "openai",
    providerName: "OpenAI",
    category: "budget",
    tier: "paid",
    supportsFreeTier: false,
    paidInputCostPerM: 0.10,
    paidOutputCostPerM: 0.50,
    badge: "~$0.40 / mo",
    badgeType: "budget",
    description: "High-throughput OpenAI workhorse engineered for reliable structured JSON output.",
    rateLimitNote: "Pay-As-You-Go ($0.10 / $0.50 per MTok)",
    keyUrl: "https://platform.openai.com/api-keys",
    keyName: "OpenAI API Key",
    keyPlaceholder: "sk-proj-... or sk-...",
    recommendedFreeRpm: 10,
    recommendedFreeDelaySeconds: 5,
    recommendedPaidDelaySeconds: 1,
  },
  {
    id: "accounts/fireworks/models/glm-5p3-flash",
    name: "GLM-5p3 Flash",
    provider: "fireworks",
    providerName: "Fireworks AI",
    category: "budget",
    tier: "paid",
    supportsFreeTier: false,
    paidInputCostPerM: 0.15,
    paidOutputCostPerM: 0.60,
    badge: "~$0.53 / mo",
    badgeType: "budget",
    description: "Accelerated serverless inference balancing rapid speed and rock-bottom prices.",
    rateLimitNote: "Pay-As-You-Go ($0.15 / $0.60 per MTok)",
    keyUrl: "https://fireworks.ai/api-keys",
    keyName: "Fireworks AI API Key",
    keyPlaceholder: "fw_...",
    recommendedFreeRpm: 10,
    recommendedFreeDelaySeconds: 5,
    recommendedPaidDelaySeconds: 1,
  },
  {
    id: "accounts/fireworks/models/deepseek-v4p1-flash-1017",
    name: "DeepSeek-v4p1 Flash",
    provider: "fireworks",
    providerName: "Fireworks AI",
    category: "budget",
    tier: "paid",
    supportsFreeTier: false,
    paidInputCostPerM: 0.30,
    paidOutputCostPerM: 1.20,
    badge: "~$1.07 / mo",
    badgeType: "budget",
    description: "Deep reasoning open-weights architecture with Fireworks speed optimizations.",
    rateLimitNote: "Pay-As-You-Go ($0.30 / $1.20 per MTok)",
    keyUrl: "https://fireworks.ai/api-keys",
    keyName: "Fireworks AI API Key",
    keyPlaceholder: "fw_...",
    recommendedFreeRpm: 10,
    recommendedFreeDelaySeconds: 5,
    recommendedPaidDelaySeconds: 1,
  },

  // ✨ Flagship Models
  {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    provider: "anthropic",
    providerName: "Anthropic",
    category: "flagship",
    tier: "paid",
    supportsFreeTier: false,
    paidInputCostPerM: 2.00,
    paidOutputCostPerM: 10.00,
    badge: "Premier Tailoring",
    badgeType: "flagship",
    description: "Gold-standard nuanced prose for impactful, human-sounding resume personalization.",
    rateLimitNote: "Pay-As-You-Go ($2.00 / $10.00 per MTok)",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyName: "Anthropic API Key",
    keyPlaceholder: "sk-ant-...",
    recommendedFreeRpm: 10,
    recommendedFreeDelaySeconds: 5,
    recommendedPaidDelaySeconds: 1,
  },
  {
    id: "gpt-6.1-terra",
    name: "GPT-6.1 Terra",
    provider: "openai",
    providerName: "OpenAI",
    category: "flagship",
    tier: "paid",
    supportsFreeTier: false,
    paidInputCostPerM: 1.00,
    paidOutputCostPerM: 5.00,
    badge: "Balanced Flagship",
    badgeType: "flagship",
    description: "Balanced multi-modal intelligence and rigorous schema validation.",
    rateLimitNote: "Pay-As-You-Go ($1.00 / $5.00 per MTok)",
    keyUrl: "https://platform.openai.com/api-keys",
    keyName: "OpenAI API Key",
    keyPlaceholder: "sk-proj-... or sk-...",
    recommendedFreeRpm: 10,
    recommendedFreeDelaySeconds: 5,
    recommendedPaidDelaySeconds: 1,
  },
];

/**
 * Calculates estimated monthly cost and quota usage based on daily volume and tier.
 * Note: Job scoring = 1 LLM request call (initial scoring of scraped jobs).
 *       Resume tailoring = 3 LLM request calls (Stage 1 curation plan + Stage 2 deep tailoring + Stage 3 tailored resume rescore).
 */
export function calculateMonthlyCost(
  model: ModelDefinition,
  tier: "free" | "paid",
  jobsPerDay: number,
  resumesPerDay: number
): {
  monthlyInputTokens: number;
  monthlyOutputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  formattedCost: string;
  scoringCalls: number;
  tailoringCalls: number;
  dailyCalls: number;
  rpdCap: number | null;
  rpdUsagePercent: number;
  bufferRemaining: number | null;
  isBufferLow: boolean;
  isOverRpdQuota: boolean;
  recommendedDelaySeconds: number;
  recommendedDelayNote: string;
} {
  // Scoring: 1 request, ~2,000 input tokens + ~300 output tokens
  // Resume Personalization: 3 requests (Stage 1 plan + Stage 2 tailoring + Stage 3 rescore)
  // ~5,300 input tokens + ~1,500 output tokens total across all 3 stages
  const scoringCalls = jobsPerDay * 1;
  const tailoringCalls = resumesPerDay * 3;
  const dailyCalls = scoringCalls + tailoringCalls;

  const monthlyInputTokens = (jobsPerDay * 2000 + resumesPerDay * 5300) * 30;
  const monthlyOutputTokens = (jobsPerDay * 300 + resumesPerDay * 1500) * 30;
  const totalTokens = monthlyInputTokens + monthlyOutputTokens;

  const isFree = tier === "free" && model.supportsFreeTier;
  const rpdCap = isFree ? model.freeRpd || 1500 : null;

  const rpdUsagePercent = rpdCap ? Math.round((dailyCalls / rpdCap) * 100) : 0;
  const bufferRemaining = rpdCap !== null ? rpdCap - dailyCalls : null;
  const isBufferLow = bufferRemaining !== null && bufferRemaining < 5 && bufferRemaining >= 0;
  const isOverRpdQuota = rpdCap !== null && dailyCalls > rpdCap;

  let recommendedDelaySeconds = 1;
  let recommendedDelayNote = "1s delay (Fast paid execution)";

  if (isFree) {
    recommendedDelaySeconds = model.recommendedFreeDelaySeconds;
    recommendedDelayNote = `${recommendedDelaySeconds}s delay between requests (Safe for ${model.freeRpm || 15} RPM free tier limit)`;
  }

  if (isFree) {
    return {
      monthlyInputTokens,
      monthlyOutputTokens,
      totalTokens,
      estimatedCost: 0,
      formattedCost: "$0.00 / mo (100% Free)",
      scoringCalls,
      tailoringCalls,
      dailyCalls,
      rpdCap,
      rpdUsagePercent,
      bufferRemaining,
      isBufferLow,
      isOverRpdQuota,
      recommendedDelaySeconds,
      recommendedDelayNote,
    };
  }

  const cost =
    (monthlyInputTokens / 1_000_000) * model.paidInputCostPerM +
    (monthlyOutputTokens / 1_000_000) * model.paidOutputCostPerM;

  return {
    monthlyInputTokens,
    monthlyOutputTokens,
    totalTokens,
    estimatedCost: cost,
    formattedCost: `~$${cost.toFixed(2)} / mo`,
    scoringCalls,
    tailoringCalls,
    dailyCalls,
    rpdCap: null,
    rpdUsagePercent: 0,
    bufferRemaining: null,
    isBufferLow: false,
    isOverRpdQuota: false,
    recommendedDelaySeconds: 1,
    recommendedDelayNote: "1s delay (Pay-as-you-go high throughput)",
  };
}
