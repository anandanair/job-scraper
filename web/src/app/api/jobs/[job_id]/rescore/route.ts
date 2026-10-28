import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import {
  getJobById,
  updateJobById,
  getCustomizedResumeById,
  getUserProfileByEmail,
} from "@/lib/supabase/queries";
import { formatResumeToText, scoreJobWithResume } from "@/lib/llm";

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

    let resumeData: any = null;
    let stage: "custom" | "initial" = "initial";

    // 1. Try to get customized resume if available
    if (job.customized_resume_id) {
      resumeData = await getCustomizedResumeById(job.customized_resume_id);
      if (resumeData) {
        stage = "custom";
      }
    }

    // 2. If no custom resume, fall back to base resume
    if (!resumeData) {
      resumeData = await getUserProfileByEmail();
      stage = "initial";
    }

    if (!resumeData) {
      return NextResponse.json(
        { error: "No resume found to score against. Upload a base resume first." },
        { status: 400 }
      );
    }

    const resumeText = formatResumeToText(resumeData);
    const score = await scoreJobWithResume(resumeText, {
      job_id: job.job_id,
      job_title: job.job_title,
      company: job.company,
      level: job.level,
      description: job.description,
    });

    if (score === null) {
      return NextResponse.json(
        { error: "AI failed to evaluate a score for this job" },
        { status: 502 }
      );
    }

    // Update job in Supabase
    await updateJobById(job_id, {
      resume_score: score,
      resume_score_stage: stage,
    });

    // Invalidate dashboard stats cache
    try {
      revalidateTag("dashboard-stats", "default");
      revalidatePath("/");
      revalidatePath(`/jobs/${job_id}`);
    } catch (e) {
      console.warn("Revalidate error:", e);
    }

    return NextResponse.json(
      { success: true, job_id, resume_score: score, resume_score_stage: stage },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error rescoring job:", error);
    return NextResponse.json(
      { error: "Failed to rescore job", details: error.message },
      { status: 500 }
    );
  }
}
