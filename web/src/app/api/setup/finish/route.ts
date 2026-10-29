import { NextResponse } from "next/server";
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
      llmModel,
      llmProvider,
      llmTier,
      llmMaxRpm,
      llmRequestDelaySeconds,
      linkedinSearchQueries,
      linkedinLocation,
    } = body;

    // 1. Update app_settings in Supabase (Single Source of Truth)
    // Only update configuration fields if explicitly passed; NEVER overwrite with hardcoded defaults!
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const updatePayload: any = {
        setup_completed: true,
        setup_step: 5,
      };

      if (llmProvider && typeof llmProvider === "string") updatePayload.llm_provider = llmProvider;
      if (llmModel && typeof llmModel === "string") updatePayload.llm_model = llmModel;
      if (llmTier && typeof llmTier === "string") updatePayload.llm_tier = llmTier;
      if (llmMaxRpm !== undefined && llmMaxRpm !== null) updatePayload.llm_max_rpm = Number(llmMaxRpm);
      if (llmRequestDelaySeconds !== undefined && llmRequestDelaySeconds !== null) {
        updatePayload.llm_request_delay_seconds = Number(llmRequestDelaySeconds);
      }
      if (llmApiKey && typeof llmApiKey === "string" && llmApiKey.trim().length > 0) {
        updatePayload.llm_api_key = llmApiKey.trim();
      }
      if (Array.isArray(linkedinSearchQueries) && linkedinSearchQueries.length >= 3) {
        updatePayload.linkedin_search_queries = linkedinSearchQueries;
        updatePayload.careers_future_search_queries = linkedinSearchQueries;
      }
      if (linkedinLocation && typeof linkedinLocation === "string") {
        updatePayload.linkedin_location = linkedinLocation;
      }

      try {
        await updateAppSettings(updatePayload);
      } catch (dbErr: any) {
        console.warn("Notice updating app_settings during finish:", dbErr.message);
      }
    }

    // 2. Mark setup complete in-memory and database
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
