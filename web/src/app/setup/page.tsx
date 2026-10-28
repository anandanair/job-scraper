import SetupWizard from "@/components/setup/SetupWizard";
import fs from "fs";
import path from "path";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { AppSettings } from "@/types";
import { getSetupState } from "@/lib/setup/setupState";

export const dynamic = "force-dynamic";

async function getInitialSetupStatus(): Promise<{
  initialStep: 1 | 2 | 3 | 4 | 5;
  supabaseConnected: boolean;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  hasAiKey: boolean;
  aiApiKey?: string;
  savedModel?: string;
  savedProvider?: string;
  savedTier?: "free" | "paid";
  savedSettings?: AppSettings | null;
  isComplete: boolean;
}> {
  const setupState = await getSetupState();

  if (setupState.isCompleted) {
    return {
      initialStep: 5,
      supabaseConnected: true,
      supabaseUrl: "",
      supabaseServiceRoleKey: "",
      hasAiKey: true,
      isComplete: true,
    };
  }

  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  let llmKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || process.env.FIREWORKS_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || "";
  let llmModel = process.env.LLM_MODEL || "";

  if (!url || !serviceKey) {
    const isWebCwd = fs.existsSync(path.resolve(process.cwd(), "next.config.ts")) || 
                     fs.existsSync(path.resolve(process.cwd(), "next.config.js"));
    const webEnvPath = isWebCwd 
      ? path.resolve(process.cwd(), ".env.local")
      : path.resolve(process.cwd(), "web", ".env.local");

    if (fs.existsSync(webEnvPath)) {
      const content = fs.readFileSync(webEnvPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
          url = trimmed.split("=")[1].replace(/["']/g, "").trim();
        } else if (trimmed.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
          serviceKey = trimmed.split("=")[1].replace(/["']/g, "").trim();
        } else if (trimmed.startsWith("LLM_API_KEY=")) {
          llmKey = trimmed.split("=")[1].replace(/["']/g, "").trim();
        } else if (trimmed.startsWith("LLM_MODEL=")) {
          llmModel = trimmed.split("=")[1].replace(/["']/g, "").trim();
        }
      }
    }
  }

  if (!url || !serviceKey) {
    return {
      initialStep: 1,
      supabaseConnected: false,
      supabaseUrl: "",
      supabaseServiceRoleKey: "",
      hasAiKey: false,
      isComplete: false,
    };
  }

  try {
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { error: jobsErr } = await supabase.from("jobs").select("job_id").limit(1);
    if (!jobsErr) {
      // Database connected! Step 1 is done
      const { data: settings } = await supabase
        .from("app_settings")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      const effectiveAiKey = settings?.llm_api_key || llmKey;
      const hasAiKey = Boolean(effectiveAiKey && effectiveAiKey.trim().length > 0);
      const savedModel = settings?.llm_model || llmModel || "gemini-3.8-flash";
      const savedProvider = settings?.llm_provider || "gemini";
      const savedTier = (settings?.llm_tier as "free" | "paid") || "free";

      if (!hasAiKey) {
        return {
          initialStep: 2,
          supabaseConnected: true,
          supabaseUrl: url,
          supabaseServiceRoleKey: serviceKey,
          hasAiKey: false,
          aiApiKey: effectiveAiKey,
          savedModel,
          savedProvider,
          savedTier,
          savedSettings: (settings as AppSettings) || null,
          isComplete: false,
        };
      }

      // Check if preferences and resume exist
      const hasPreferences = Boolean(
        settings?.linkedin_search_queries &&
        settings.linkedin_search_queries.length >= 3 &&
        settings?.linkedin_geo_id
      );

      const { data: resume } = await supabase.from("base_resume").select("id").limit(1).single();
      const hasResume = Boolean(resume?.id);

      if (!hasPreferences || !hasResume) {
        return {
          initialStep: 3,
          supabaseConnected: true,
          supabaseUrl: url,
          supabaseServiceRoleKey: serviceKey,
          hasAiKey: true,
          aiApiKey: effectiveAiKey,
          savedModel,
          savedProvider,
          savedTier,
          savedSettings: (settings as AppSettings) || null,
          isComplete: false,
        };
      }

      // Advance to Step 5 if setupState step is 5 or db indicates step 5
      const resolvedStep: 1 | 2 | 3 | 4 | 5 =
        setupState.step === 5 || (settings as any)?.setup_step === 5 ? 5 : 4;

      return {
        initialStep: resolvedStep,
        supabaseConnected: true,
        supabaseUrl: url,
        supabaseServiceRoleKey: serviceKey,
        hasAiKey: true,
        aiApiKey: effectiveAiKey,
        savedModel,
        savedProvider,
        savedTier,
        savedSettings: (settings as AppSettings) || null,
        isComplete: false,
      };
    }
  } catch (err) {
    console.warn("Failed to check Supabase in SetupPage:", err);
  }

  return {
    initialStep: 1,
    supabaseConnected: false,
    supabaseUrl: url,
    supabaseServiceRoleKey: serviceKey,
    hasAiKey: false,
    savedSettings: null,
    isComplete: false,
  };
}

interface SetupPageProps {
  searchParams?: Promise<{ force?: string }>;
}

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const params = searchParams ? await searchParams : {};
  const isForced = params?.force === "true";
  const status = await getInitialSetupStatus();

  if (status.isComplete && !isForced) {
    redirect("/");
  }

  return (
    <SetupWizard
      initialStep={status.initialStep}
      initialSupabaseConnected={status.supabaseConnected}
      initialSupabaseUrl={status.supabaseUrl}
      initialSupabaseServiceRoleKey={status.supabaseServiceRoleKey}
      initialAiConnected={status.hasAiKey}
      initialAiApiKey={status.aiApiKey}
      initialAiModel={status.savedModel}
      initialAiProvider={status.savedProvider}
      initialAiTier={status.savedTier}
      initialSettings={status.savedSettings}
    />
  );
}
