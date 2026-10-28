import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import {
  getJobById,
  updateJobById,
  getUserProfileByEmail,
  getActiveResumeStyle,
} from "@/lib/supabase/queries";
import { createSupabaseStaticClient } from "@/utils/supabase/server";
import { customizeResumeWithLLM, formatResumeToText, scoreJobWithResume } from "@/lib/llm";
import { buildPdfBuffer } from "@/lib/pdf";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ job_id: string }> }
) {
  try {
    const { job_id } = await params;
    if (!job_id) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    // 1. Fetch Job
    const job = await getJobById(job_id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // 2. Fetch Master Base Resume
    const baseResume = await getUserProfileByEmail();
    if (!baseResume) {
      return NextResponse.json(
        { error: "No base resume found. Please configure your profile first." },
        { status: 400 }
      );
    }

    // 3. Tailor resume content using AI
    const customizedData = await customizeResumeWithLLM(baseResume, {
      job_title: job.job_title,
      company: job.company,
      level: job.level,
      description: job.description,
    });

    // 4. Build PDF buffer using active saved resume style
    const activeStyle = await getActiveResumeStyle();
    const pdfBuffer = await buildPdfBuffer(customizedData, activeStyle);

    // 5. Upload PDF to Supabase Storage (personalized_resumes bucket)
    const destinationPath = `resume_${job_id}.pdf`;
    const supabase = createSupabaseStaticClient();

    const { error: uploadError } = await supabase.storage
      .from("personalized_resumes")
      .upload(destinationPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload resume to storage", details: uploadError.message },
        { status: 500 }
      );
    }

    // 6. Save Customized Resume into Supabase table
    const dataToInsert = {
      ...customizedData,
      resume_link: destinationPath,
    };

    const { data: insertedResume, error: insertError } = await supabase
      .from("customized_resumes")
      .insert(dataToInsert)
      .select("id")
      .single();

    if (insertError || !insertedResume) {
      console.error("Customized resume insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save customized resume to database", details: insertError?.message },
        { status: 500 }
      );
    }

    const customizedResumeId = insertedResume.id;

    // 7. Re-score the job with the newly customized resume immediately
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
    } catch (e) {
      console.warn("Auto-rescore after customization failed:", e);
    }

    // 8. Update Job record in Supabase
    const jobUpdates: any = {
      customized_resume_id: customizedResumeId,
    };
    if (newScore !== null) {
      jobUpdates.resume_score = newScore;
      jobUpdates.resume_score_stage = "custom";
    }

    await updateJobById(job_id, jobUpdates);

    // 9. Revalidate tags and paths
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
        resume_link: destinationPath,
        resume_score: newScore,
        resume_score_stage: newScore !== null ? "custom" : job.resume_score_stage,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error customizing resume:", error);
    return NextResponse.json(
      { error: "Failed to customize resume", details: error.message },
      { status: 500 }
    );
  }
}
