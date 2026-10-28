import { NextResponse } from "next/server";
import { updateAppSettings } from "@/lib/supabase/queries";

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
    } = body;

    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return NextResponse.json(
        { error: "API key is required." },
        { status: 400 }
      );
    }

    const cleanApiKey = apiKey.trim();

    // Update app_settings in Supabase as the single source of truth
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await updateAppSettings({
        llm_provider: provider,
        llm_model: model,
        llm_api_key: cleanApiKey,
        llm_tier: tier,
        llm_max_rpm: Number(maxRpm) || 4,
        llm_request_delay_seconds: Number(requestDelaySeconds) || 15,
      });
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
