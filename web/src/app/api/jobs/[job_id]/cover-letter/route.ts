import { NextRequest, NextResponse } from "next/server";
import {
  getJobById,
  getUserProfileByEmail,
  getCoverLetterByJobId,
  upsertCoverLetter,
  deleteCoverLetterByJobId,
} from "@/lib/supabase/queries";
import { generateCoverLetterWithLLM } from "@/lib/llm";
import { CoverLetterTone } from "@/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/jobs/[job_id]/cover-letter
 * Fetches the existing cover letter for this job.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ job_id: string }> }
) {
  try {
    const { job_id } = await params;
    if (!job_id) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    const coverLetter = await getCoverLetterByJobId(job_id);
    return NextResponse.json({ cover_letter: coverLetter });
  } catch (error: any) {
    console.error("Error fetching cover letter:", error);
    return NextResponse.json(
      { error: "Failed to fetch cover letter", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/jobs/[job_id]/cover-letter
 * Generates an on-demand custom cover letter with AI using the base resume & JD.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ job_id: string }> }
) {
  try {
    const { job_id } = await params;
    if (!job_id) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const tone: CoverLetterTone = body.tone || "confident_professional";
    const customInstructions: string = body.customInstructions || "";

    // 1. Fetch Job
    const job = await getJobById(job_id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // 2. Fetch Master Profile (base_resume)
    const baseResume = await getUserProfileByEmail();
    if (!baseResume) {
      return NextResponse.json(
        {
          error:
            "No master resume found. Please configure your profile in Resume Studio before generating a cover letter.",
        },
        { status: 400 }
      );
    }

    // 3. Generate tailored cover letter content
    const letterContent = await generateCoverLetterWithLLM(
      baseResume,
      {
        job_title: job.job_title,
        company: job.company,
        level: job.level,
        description: job.description,
        location: job.location,
      },
      {
        tone,
        customInstructions,
        senderName: baseResume.name,
      }
    );

    // 4. Upsert into Supabase database
    const savedLetter = await upsertCoverLetter(job_id, letterContent, tone);

    return NextResponse.json({ cover_letter: savedLetter }, { status: 201 });
  } catch (error: any) {
    console.error("Error generating cover letter:", error);
    return NextResponse.json(
      { error: "Failed to generate cover letter", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/jobs/[job_id]/cover-letter
 * Saves manual user edits to the cover letter.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ job_id: string }> }
) {
  try {
    const { job_id } = await params;
    if (!job_id) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    const body = await request.json();
    if (!body || typeof body.content !== "string") {
      return NextResponse.json(
        { error: "Content string is required" },
        { status: 400 }
      );
    }

    const tone: CoverLetterTone = body.tone || "confident_professional";
    const updated = await upsertCoverLetter(job_id, body.content, tone);

    return NextResponse.json({ cover_letter: updated });
  } catch (error: any) {
    console.error("Error updating cover letter:", error);
    return NextResponse.json(
      { error: "Failed to update cover letter", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/jobs/[job_id]/cover-letter
 * Deletes the cover letter draft for this job.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ job_id: string }> }
) {
  try {
    const { job_id } = await params;
    if (!job_id) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    await deleteCoverLetterByJobId(job_id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting cover letter:", error);
    return NextResponse.json(
      { error: "Failed to delete cover letter", details: error.message },
      { status: 500 }
    );
  }
}
