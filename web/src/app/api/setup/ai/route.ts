import { NextResponse } from "next/server";
import { updateAppSettings, getAppSettings } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      apiKey,
      model = "gemini-3.8-flash",
      provider = "gemini",
      tier = "free",
      maxRpm = 4,
      requestDelaySeconds = 15,
      jobsPerDay,
      resumesPerDay,
    } = body;

    let existingSettings = null;
    try {
      existingSettings = await getAppSettings();
    } catch {
      // ignore
    }

    const cleanApiKey =
      typeof apiKey === "string" && apiKey.trim()
        ? apiKey.trim()
        : existingSettings?.llm_api_key;

    if (!cleanApiKey) {
      return NextResponse.json(
        { error: "API key is required." },
        { status: 400 }
      );
    }

    // Build payload to update app_settings in Supabase as single source of truth
    const payload: Parameters<typeof updateAppSettings>[0] = {
      llm_provider: provider,
      llm_model: model,
      llm_api_key: cleanApiKey,
      llm_tier: tier,
      llm_max_rpm: Number(maxRpm) || 4,
      llm_request_delay_seconds: Number(requestDelaySeconds) || 15,
    };

    if (jobsPerDay !== undefined && jobsPerDay !== null) {
      const jpd = Number(jobsPerDay);
      payload.jobs_to_score_per_run = Math.max(1, Math.ceil(jpd / 6));
    }

    if (resumesPerDay !== undefined && resumesPerDay !== null) {
      const rpd = Number(resumesPerDay);
      payload.jobs_to_customize_per_run = Math.max(1, Math.ceil(rpd / 6));
    }

    if (jobsPerDay !== undefined || resumesPerDay !== undefined) {
      const updatedMaxJobs = {
        ...(existingSettings?.max_jobs_per_search || {}),
      };
      if (jobsPerDay !== undefined && jobsPerDay !== null) {
        updatedMaxJobs.daily_jobs = Number(jobsPerDay);
      }
      if (resumesPerDay !== undefined && resumesPerDay !== null) {
        updatedMaxJobs.daily_resumes = Number(resumesPerDay);
      }
      payload.max_jobs_per_search = updatedMaxJobs;
    }

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await updateAppSettings(payload);
    }

    return NextResponse.json({
      success: true,
      message: "AI configuration saved successfully.",
    });
  } catch (error: any) {
    console.error("Error in /api/setup/ai:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save AI configuration." },
      { status: 500 }
    );
  }
}
