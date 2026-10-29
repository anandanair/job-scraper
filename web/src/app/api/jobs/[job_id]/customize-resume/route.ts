import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import {
  getJobById,
  updateJobById,
  getUserProfileByEmail,
  getActiveResumeStyle,
} from "@/lib/supabase/queries";
import { createSupabaseStaticClient } from "@/utils/supabase/server";
import {
  customizeResumeWithLLM,
  formatResumeToText,
  scoreJobWithResume,
} from "@/lib/llm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ job_id: string }> },
) {
  try {
    const { job_id } = await params;
    if (!job_id) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 },
      );
    }

    // 1. Fetch job
    const job = await getJobById(job_id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // 2. Fetch baseline master profile
    const baseResume = await getUserProfileByEmail();
    if (!baseResume) {
      return NextResponse.json(
        {
          error:
            "No base resume profile found. Please upload/create one in Resume Studio.",
        },
        { status: 400 },
      );
    }

    // 3. Tailor resume content using Multi-Stage Agentic Pipeline (Strategist + Copywriter + Healer)
    console.log(
      `[API /customize-resume] Tailoring resume for job ${job_id} ("${job.job_title}")...`,
    );
    const customizedData = await customizeResumeWithLLM(baseResume, {
      job_title: job.job_title,
      company: job.company,
      level: job.level,
      description: job.description,
    });

    // 4. Fetch active saved resume style for theme snapshotting
    const activeStyle = await getActiveResumeStyle();
    const supabase = createSupabaseStaticClient();

    // 5. Save Customized Resume into Supabase table (Single Source of Truth, no storage bucket required)
    const dataToInsert = {
      ...customizedData,
      theme_config: activeStyle,
    };

    const { data: insertedResume, error: insertError } = await supabase
      .from("customized_resumes")
      .insert(dataToInsert)
      .select("id")
      .single();

    if (insertError || !insertedResume) {
      console.error("Customized resume insert error:", insertError);
      return NextResponse.json(
        {
          error: "Failed to save customized resume to database",
          details: insertError?.message,
        },
        { status: 500 },
      );
    }

    const customizedResumeId = insertedResume.id;
    const resumeStreamingUrl = `/api/customized_resumes/${customizedResumeId}/pdf`;

    // 6. Stage 3: Re-score the job with the newly customized resume immediately (The Evaluator)
    console.log(
      `[API /customize-resume] Stage 3: Evaluating customized resume against job ${job_id}...`,
    );
    let newScore: number | null = null;
    try {
      const resumeText = formatResumeToText(customizedData);
      newScore = await scoreJobWithResume(resumeText, {
        job_id: job.job_id,
        job_title: job.job_title,
        company: job.company,
        level: job.level,
        description: job.description,
      });
      console.log(
        `[API /customize-resume] Custom resume rescore for ${job_id}: ${newScore}/100`,
      );
    } catch (evalErr: any) {
      console.warn(
        `[API /customize-resume] Notice: Rescoring with customized resume failed, keeping prior score:`,
        evalErr.message,
      );
    }

    // 7. Update Job Record with custom resume ID and new score
    const jobUpdates: Record<string, any> = {
      customized_resume_id: customizedResumeId,
    };
    if (newScore !== null) {
      jobUpdates.resume_score = newScore;
      jobUpdates.resume_score_stage = "custom";
    }

    await updateJobById(job_id, jobUpdates);

    // 8. Revalidate tags and paths
    try {
      revalidateTag("dashboard-stats", "default");
      revalidatePath("/");
      revalidatePath(`/jobs/${job_id}`);
    } catch (e) {
      console.warn("Revalidate error:", e);
    }

    return NextResponse.json(
      {
        success: true,
        job_id,
        customized_resume_id: customizedResumeId,
        resume_link: resumeStreamingUrl,
        resume_score: newScore,
        resume_score_stage:
          newScore !== null ? "custom" : job.resume_score_stage,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Error customizing resume:", error);
    return NextResponse.json(
      { error: "Failed to customize resume", details: error.message },
      { status: 500 },
    );
  }
}
