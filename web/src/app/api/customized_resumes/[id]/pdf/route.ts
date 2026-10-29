import { NextRequest, NextResponse } from "next/server";
import { getCustomizedResumeById, getActiveResumeStyle } from "@/lib/supabase/queries";
import { buildPdfBuffer } from "@/lib/pdf";
import { DEFAULT_THEME_CONFIG } from "@/lib/resume-presets";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Resume ID is required" }, { status: 400 });
    }

    const resumeData = await getCustomizedResumeById(id);
    if (!resumeData) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    // Determine theme config:
    // 1. Resume snapshot theme_config (locked when applied or generated)
    // 2. Fallback to active global style
    // 3. Fallback to default theme config
    const activeStyle = await getActiveResumeStyle();
    const themeConfig = resumeData.theme_config || activeStyle || DEFAULT_THEME_CONFIG;

    const {
      id: _id,
      created_at: _ca,
      parsed_at: _pa,
      last_updated: _lu,
      resume_link: _rl,
      theme_config: _tc,
      ...cleanData
    } = resumeData;

    const pdfBuffer = await buildPdfBuffer(cleanData, themeConfig);

    const isDownload = request.nextUrl.searchParams.get("download") === "true";
    const rawName = resumeData.name?.trim().replace(/\s+/g, "_") || "resume";
    const filename = `${rawName}.pdf`;

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
    console.error("Error streaming customized resume PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF", details: error.message },
      { status: 500 }
    );
  }
}

