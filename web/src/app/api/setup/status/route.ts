import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { getSetupState } from "@/lib/setup/setupState";

export const dynamic = "force-dynamic";

function getEnvCredentials() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  // If not in process.env, attempt reading directly from .env.local
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
        }
      }
    }
  }

  return { url, serviceKey };
}

export async function GET() {
  try {
    const { url, serviceKey } = getEnvCredentials();

    // 1. If no Supabase URL or Key -> Step 1 is pending
    if (!url || !serviceKey) {
      return NextResponse.json({
        step: 1,
        supabaseConnected: false,
        missingTables: [],
        hasAiKey: false,
        hasResume: false,
        isComplete: false,
      });
    }

    // 2. Validate Supabase connection and verify tables exist
    let supabaseConnected = false;
    let missingTables: string[] = [];
    let hasAiKey = false;
    let hasResume = false;
    let savedSettings: any = null;

    try {
      const supabase = createClient(url, serviceKey, {
        auth: { persistSession: false },
      });

      // Verify that all core database tables exist
      const checkTable = async (tableName: string) => {
        const { error } = await supabase.from(tableName).select("*").limit(1);
        return !error || error.code === "PGRST116";
      };

      const [hasJobs, hasAppSettings, hasBaseResume, hasStyles] = await Promise.all([
        checkTable("jobs"),
        checkTable("app_settings"),
        checkTable("base_resume"),
        checkTable("resume_style_settings"),
      ]);

      missingTables = Object.entries({
        jobs: hasJobs,
        app_settings: hasAppSettings,
        base_resume: hasBaseResume,
        resume_style_settings: hasStyles,
      })
        .filter(([_, exists]) => !exists)
        .map(([name]) => name);

      const allCoreTablesExist = missingTables.length === 0;

      if (allCoreTablesExist) {
        supabaseConnected = true;

        // Check app_settings for AI Key and preferences
        const { data: settingsData } = await supabase
          .from("app_settings")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        if (settingsData) {
          savedSettings = settingsData;
          if (settingsData.llm_api_key) {
            hasAiKey = true;
          }
        }

        // Check base_resume table or bucket
        const { data: resumeData } = await supabase
          .from("base_resume")
          .select("id")
          .limit(1)
          .single();

        if (resumeData?.id) {
          hasResume = true;
        } else {
          // Check if resume.json exists in filesystem
          const isWebCwd = fs.existsSync(path.resolve(process.cwd(), "next.config.ts")) || 
                           fs.existsSync(path.resolve(process.cwd(), "next.config.js"));
          const rootResume = isWebCwd
            ? path.resolve(process.cwd(), "..", "resume.json")
            : path.resolve(process.cwd(), "resume.json");
          if (fs.existsSync(rootResume)) {
            hasResume = true;
          }
        }
      }
    } catch (dbErr) {
      console.warn("Could not query Supabase during status check:", dbErr);
    }

    // Determine current pending step
    const setupState = await getSetupState();
    let pendingStep: 1 | 2 | 3 | 4 | 5 = 1;
    const hasPreferences = Boolean(
      savedSettings?.linkedin_search_queries &&
      savedSettings.linkedin_search_queries.length >= 3 &&
      savedSettings?.linkedin_geo_id
    );

    if (!supabaseConnected) {
      pendingStep = 1;
    } else if (!hasAiKey) {
      pendingStep = 2;
    } else if (!hasPreferences || !hasResume) {
      pendingStep = 3;
    } else if (setupState.step === 5 || (savedSettings as any)?.setup_step === 5) {
      pendingStep = 5;
    } else {
      pendingStep = 4;
    }

    const isComplete = Boolean(
      setupState.isCompleted ||
      (savedSettings as any)?.setup_completed
    );

    return NextResponse.json({
      step: pendingStep,
      supabaseConnected,
      missingTables,
      supabaseUrl: url,
      supabaseServiceRoleKey: serviceKey,
      hasAiKey,
      hasResume,
      hasPreferences,
      isComplete,
      savedSettings,
      llmModel: savedSettings?.llm_model || "gemini-3.8-flash",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to check setup status", step: 1 },
      { status: 500 }
    );
  }
}
