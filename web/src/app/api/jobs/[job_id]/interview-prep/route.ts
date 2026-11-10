import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { getJobById, getUserProfileByEmail } from "@/lib/supabase/queries";
import { generateInterviewPrepWithLLM } from "@/lib/llm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ job_id: string }> }
) {
  try {
    const { job_id } = await params;
    if (!job_id) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: prep, error } = await supabase
      .from("job_interview_prep")
      .select("*")
      .eq("job_id", job_id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, prep });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

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

    const supabase = await createSupabaseServerClient();

    // Check if prep already exists
    const { data: existingPrep } = await supabase
      .from("job_interview_prep")
      .select("*")
      .eq("job_id", job_id)
      .maybeSingle();

    const body = await request.json().catch(() => ({}));
    const { forceRefresh, tone, customNotes } = body;
    if (existingPrep && !forceRefresh) {
      return NextResponse.json({ success: true, prep: existingPrep });
    }

    const generated = await generateInterviewPrepWithLLM(
      baseResume,
      {
        job_id,
        job_title: job.job_title,
        company: job.company,
        description: job.description,
      },
      { tone, customNotes }
    );

    const payload = {
      job_id,
      technical_questions: generated.technical_questions,
      behavioral_star: generated.behavioral_star,
      reverse_questions: generated.reverse_questions,
      company_brief: generated.company_brief,
      updated_at: new Date().toISOString(),
    };

    const { data: savedPrep, error: upsertError } = await supabase
      .from("job_interview_prep")
      .upsert(payload, { onConflict: "job_id" })
      .select()
      .single();

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, prep: savedPrep });
  } catch (err: any) {
    console.error("Error creating interview prep:", err);
    return NextResponse.json(
      { error: "Failed to generate interview prep", details: err.message },
      { status: 500 }
    );
  }
}
