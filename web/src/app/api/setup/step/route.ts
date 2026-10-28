import { NextResponse } from "next/server";
import { saveSetupStep } from "@/lib/setup/setupState";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const step = Number(body?.step);

    if (!step || step < 1 || step > 5) {
      return NextResponse.json({ error: "Invalid step number (1-5)." }, { status: 400 });
    }

    await saveSetupStep(step as 1 | 2 | 3 | 4 | 5);

    return NextResponse.json({ success: true, step });
  } catch (err: any) {
    console.error("Error saving setup step:", err);
    return NextResponse.json({ error: err.message || "Failed to save step." }, { status: 500 });
  }
}
