import { NextResponse } from "next/server";
import { getCustomizedResumeById, getActiveResumeStyle } from "@/lib/supabase/queries";
import { createSupabaseStaticClient } from "@/utils/supabase/server";
import { buildPdfBuffer } from "@/lib/pdf";
import { getSignedUrl } from "@/lib/supabase/storage";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Resume ID is required" }, { status: 400 });
    }

    const resumeData = await getCustomizedResumeById(id);
    if (!resumeData) {
      return NextResponse.json({ error: "Customized resume not found" }, { status: 404 });
    }

    const activeStyle = await getActiveResumeStyle();

    const {
      id: _id,
      created_at: _ca,
      parsed_at: _pa,
      last_updated: _lu,
      resume_link: _rl,
      ...cleanData
    } = resumeData;

    const pdfBuffer = await buildPdfBuffer(cleanData, activeStyle);

    const storagePath = resumeData.resume_link || `resume_${id}.pdf`;
    const supabase = createSupabaseStaticClient();

    const { error: uploadError } = await supabase.storage
      .from("personalized_resumes")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error during re-style:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload updated PDF", details: uploadError.message },
        { status: 500 }
      );
    }

    const newSignedUrl = await getSignedUrl(storagePath);

    return NextResponse.json(
      { success: true, signedUrl: newSignedUrl, storagePath },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error re-applying style to resume:", error);
    return NextResponse.json(
      { error: "Failed to re-apply style", details: error.message },
      { status: 500 }
    );
  }
}
