import { NextResponse } from "next/server";
import { writeEnvFiles } from "@/lib/setup/envWriter";
import { updateAppSettings } from "@/lib/supabase/queries";
import { markSetupComplete } from "@/lib/setup/setupState";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty if called purely to finalize
    }

    const {
      llmApiKey,
      llmModel = "gemini-3.8-flash",
      llmProvider = "gemini",
      llmTier = "free",
      llmMaxRpm = 10,
      llmRequestDelaySeconds = 8,
      linkedinSearchQueries,
      linkedinLocation,
    } = body;

    // 1. Update app_settings in Supabase if values provided
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const updatePayload: any = {
        setup_completed: true,
        setup_step: 5,
      };

      if (llmProvider) updatePayload.llm_provider = llmProvider;
      if (llmModel) updatePayload.llm_model = llmModel;
      if (llmTier) updatePayload.llm_tier = llmTier;
      if (llmMaxRpm) updatePayload.llm_max_rpm = Number(llmMaxRpm) || 10;
      if (llmRequestDelaySeconds) updatePayload.llm_request_delay_seconds = Number(llmRequestDelaySeconds) || 8;
      if (llmApiKey) updatePayload.llm_api_key = llmApiKey;
      if (Array.isArray(linkedinSearchQueries) && linkedinSearchQueries.length >= 3) {
        updatePayload.linkedin_search_queries = linkedinSearchQueries;
        updatePayload.careers_future_search_queries = linkedinSearchQueries;
      }
      if (linkedinLocation) {
        updatePayload.linkedin_location = linkedinLocation;
      }

      try {
        await updateAppSettings(updatePayload);
      } catch (dbErr: any) {
        console.warn("Notice updating app_settings during finish:", dbErr.message);
      }
    }

    // 2. Persist setup completion to local .env and state
    await markSetupComplete();

    // 3. Return response with persistent authentication cookie
    const response = NextResponse.json({
      success: true,
      message: "Setup completed successfully.",
    });

    response.cookies.set("jobtrack_setup_complete", "true", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax",
      httpOnly: false, // Accessible to client-side if needed
    });

    return response;
  } catch (error: any) {
    console.error("Error in /api/setup/finish:", error);
    return NextResponse.json(
      { error: error.message || "Failed to finalize setup." },
      { status: 500 }
    );
  }
}
