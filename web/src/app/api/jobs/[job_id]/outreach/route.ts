import { NextResponse } from "next/server";
import { getJobById, getUserProfileByEmail } from "@/lib/supabase/queries";
import { generateOutreachNotesWithLLM } from "@/lib/llm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ job_id: string }> }
) {
  try {
    const { job_id } = await params;
    if (!job_id) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    const job = await getJobById(job_id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const baseResume = await getUserProfileByEmail();
    if (!baseResume) {
      return NextResponse.json(
        { error: "No base resume found. Please upload a resume first." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { recipientName, tone, customNote } = body;

    const outreach = await generateOutreachNotesWithLLM(
      baseResume,
      {
        job_title: job.job_title,
        company: job.company,
        description: job.description,
        location: job.location,
      },
      { recipientName, tone, customNote }
    );

    return NextResponse.json({ success: true, outreach });
  } catch (err: any) {
    console.error("Error generating outreach notes:", err);
    return NextResponse.json(
      { error: "Failed to generate outreach notes", details: err.message },
      { status: 500 }
    );
  }
}
