import { NextRequest, NextResponse } from "next/server";
import { updateBaseResume, getUserProfileByEmail } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/base-resume
 * Retrieves the current active base resume data from Supabase.
 */
export async function GET() {
  try {
    const resume = await getUserProfileByEmail();
    return NextResponse.json(resume || null, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching base resume:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch base resume",
      },
      { status: 500 }
    );
  }
}

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
