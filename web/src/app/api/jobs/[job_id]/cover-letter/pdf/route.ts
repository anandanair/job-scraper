import { NextRequest, NextResponse } from "next/server";
import {
  getJobById,
  getUserProfileByEmail,
  getCoverLetterByJobId,
  getActiveResumeStyle,
} from "@/lib/supabase/queries";
import { buildCoverLetterPdfBuffer } from "@/lib/pdf";
import { DEFAULT_THEME_CONFIG } from "@/lib/resume-presets";

export const dynamic = "force-dynamic";

/**
 * GET /api/jobs/[job_id]/cover-letter/pdf
 * Streams an ATS-standard PDF of the cover letter.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ job_id: string }> }
) {
  try {
    const { job_id } = await params;
    if (!job_id) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    const [coverLetter, job, baseResume, activeStyle] = await Promise.all([
      getCoverLetterByJobId(job_id),
      getJobById(job_id),
      getUserProfileByEmail(),
      getActiveResumeStyle(),
    ]);

    if (!coverLetter) {
      return NextResponse.json(
        { error: "No cover letter found for this job" },
        { status: 404 }
      );
    }

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const themeConfig = activeStyle || DEFAULT_THEME_CONFIG;

    const pdfBuffer = await buildCoverLetterPdfBuffer(
      {
        candidate: {
          name: baseResume?.name || "Candidate",
          email: baseResume?.email,
          phone: baseResume?.phone,
          location: baseResume?.location,
          links: baseResume?.links,
        },
        company: job.company,
        jobTitle: job.job_title,
        content: coverLetter.content,
      },
      themeConfig
    );

    const isDownload = request.nextUrl.searchParams.get("download") === "true";
    const safeCandidateName = (baseResume?.name || "Candidate")
      .trim()
      .replace(/\s+/g, "_");
    const safeCompany = job.company.trim().replace(/\s+/g, "_");
    const filename = `${safeCandidateName}_Cover_Letter_${safeCompany}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": isDownload
          ? `attachment; filename="${filename}"`
          : `inline; filename="${filename}"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error: any) {
    console.error("Error streaming cover letter PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate cover letter PDF", details: error.message },
      { status: 500 }
    );
  }
}
