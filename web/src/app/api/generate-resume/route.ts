import { NextRequest, NextResponse } from "next/server";
import { buildPdfBufferWithMeta, ResumeInput } from "@/lib/pdf";
import { getActiveResumeStyle } from "@/lib/supabase/queries";
import { ResumeThemeConfig } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    let resumeData: ResumeInput;
    let styleConfig: ResumeThemeConfig | undefined;

    if (body && typeof body === "object" && "resumeData" in body) {
      resumeData = body.resumeData;
      styleConfig = body.styleConfig;
    } else {
      resumeData = body;
    }

    if (!styleConfig) {
      styleConfig = await getActiveResumeStyle();
    }

    const { buffer: pdfBuffer, pageCount } = await buildPdfBufferWithMeta(
      resumeData,
      styleConfig
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=resume.pdf",
        "X-Page-Count": pageCount.toString(),
        "Access-Control-Expose-Headers": "X-Page-Count",
      },
    });
  } catch (error: any) {
    console.error("Error generating resume PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF", details: error.message },
      { status: 500 }
    );
  }
}
