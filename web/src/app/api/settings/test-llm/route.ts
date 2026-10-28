import { NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, model, apiKey } = body || {};

    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return NextResponse.json(
        { success: false, error: "Please enter an API key before testing connection." },
        { status: 400 }
      );
    }

    const cleanApiKey = apiKey.trim();
    const cleanModel = (model || "gemini-3.8-flash").trim();

    const startTime = Date.now();

    // Perform lightweight ping to verify API key and model availability
    const result = await callLLM({
      prompt: "Reply with exactly the single word 'OK'. Do not include punctuation or explanations.",
      temperature: 0.1,
      apiKeyOverride: cleanApiKey,
      modelOverride: cleanModel,
      providerOverride: provider,
    });

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: `Connection successful! Responded in ${latencyMs}ms.`,
      model: cleanModel,
      latencyMs,
      sampleResponse: result.slice(0, 50),
    });
  } catch (err: any) {
    console.error("Test LLM error:", err);
    return NextResponse.json({
      success: false,
      error: err.message || "Failed to connect to LLM provider. Please check your API key and model endpoint.",
    });
  }
}
