import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import {
  getJobById,
  updateJobById,
  getCustomizedResumeById,
  getUserProfileByEmail,
  getAppSettings,
} from "@/lib/supabase/queries";
import { formatResumeToText, evaluateJobFit } from "@/lib/llm";
import { getCompanyIntelligence } from "@/lib/company-intel";

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

    const settings = await getAppSettings();
    const resumeText = formatResumeToText(resumeData);

    // 3. Fetch real-world company intelligence (Glassdoor, public sentiment, reviews)
    let companyIntel = null;
    if (job.company) {
      try {
        // In on-demand testing rescore, always live fetch to bypass the cache completely as requested
        companyIntel = await getCompanyIntelligence(
          job.company,
          job.location || "Singapore",
          null,
          true // forceLive: true for on-demand test rescores
        );
      } catch (err: any) {
        console.warn(`[Rescore] Error fetching company intel for ${job.company}:`, err.message);
      }
    }

    const evalResult = await evaluateJobFit(
      resumeText,
      {
        job_id: job.job_id,
        job_title: job.job_title,
        company: job.company,
        level: job.level,
        description: job.description,
      },
      settings?.dream_job_profile,
      settings?.job_search_mode || "get_hired_fast",
      companyIntel
    );

    if (!evalResult) {
      return NextResponse.json(
        { error: "AI failed to evaluate a score for this job" },
        { status: 502 }
      );
    }

    // Update job in Supabase
    await updateJobById(job_id, {
      resume_score: evalResult.resume_score,
      dream_score: evalResult.dream_score,
      total_score: evalResult.total_score,
      score_breakdown: evalResult.score_breakdown,
      resume_score_stage: stage,
    });

    // Invalidate dashboard stats & job pages cache
    try {
      revalidateTag("dashboard-stats", "default");
      revalidatePath("/");
      revalidatePath(`/jobs/${job_id}`);
      revalidatePath("/jobs/top-matches");
      revalidatePath("/jobs/new");
    } catch (e) {
      console.warn("Revalidate error:", e);
    }

    return NextResponse.json(
      {
        success: true,
        job_id,
        resume_score: evalResult.resume_score,
        dream_score: evalResult.dream_score,
        total_score: evalResult.total_score,
        score_breakdown: evalResult.score_breakdown,
        company_intel: companyIntel,
        resume_score_stage: stage,
      },
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
