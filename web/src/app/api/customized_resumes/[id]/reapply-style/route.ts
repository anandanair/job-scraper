import { NextResponse } from "next/server";
import {
  getCustomizedResumeById,
  getActiveResumeStyle,
  updateCustomizedResumeById,
} from "@/lib/supabase/queries";

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

    // Update customized resume's theme snapshot to the active style
    await updateCustomizedResumeById(id, {
      theme_config: activeStyle,
    });

    const pdfUrl = `/api/customized_resumes/${id}/pdf`;

    return NextResponse.json(
      {
        success: true,
        pdfUrl,
        theme_config: activeStyle,
        message: "Active style reapplied successfully.",
      },
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
