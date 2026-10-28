import { NextRequest, NextResponse } from "next/server";
import { updateBaseResume } from "@/lib/supabase/queries";

/**
 * PATCH /api/base-resume
 * Updates the base resume data in Supabase.
 */
export async function PATCH(request: NextRequest) {
  try {
    const resumeData = await request.json();

    const updated = await updateBaseResume(resumeData);

    if (!updated) {
      return NextResponse.json(
        { error: "No base resume found to update." },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating base resume:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update base resume",
      },
      { status: 500 }
    );
  }
}
