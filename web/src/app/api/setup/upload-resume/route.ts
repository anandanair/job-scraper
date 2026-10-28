import { NextResponse } from "next/server";
import { parseResumePdf } from "@/lib/resumeParser";
import { upsertBaseResume } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Parse resume in-memory with AI using pdfjs-dist
    const parsedResume = await parseResumePdf(buffer);

    // 2. Save structured resume directly to Supabase PostgreSQL table
    await upsertBaseResume(parsedResume);

    const parsedProfile = {
      name: parsedResume.name || undefined,
      email: parsedResume.email || undefined,
      skillsCount: parsedResume.skills ? parsedResume.skills.length : 0,
      experienceCount: parsedResume.experience ? parsedResume.experience.length : 0,
    };

    return NextResponse.json({
      success: true,
      parsed: true,
      profile: parsedProfile,
      message: "Resume parsed and baseline profile saved successfully.",
    });
  } catch (error: any) {
    console.error("Error processing resume:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process resume." },
      { status: 500 }
    );
  }
}
