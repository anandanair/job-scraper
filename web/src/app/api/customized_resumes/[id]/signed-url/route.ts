import { NextResponse } from "next/server";
import { getCustomizedResumeById } from "@/lib/supabase/queries";
import { getSignedUrl } from "@/lib/supabase/storage";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Resume ID is required" },
        { status: 400 }
      );
    }

    // Fetch the resume data to get the storage path from resume_link
    const resume = await getCustomizedResumeById(id);

    if (!resume) {
      return NextResponse.json(
        { error: "Resume not found" },
        { status: 404 }
      );
    }

    if (!resume.resume_link) {
      return NextResponse.json(
        { error: "Resume link (path) not found for this resume" },
        { status: 404 }
      );
    }

    // The user mentioned that resume_link now stores the file path like resume_4382914613.pdf
    // Files are stored in the 'personalized_resumes' bucket.
    const storagePath = resume.resume_link;

    try {
      const signedUrl = await getSignedUrl(storagePath);
      return NextResponse.json({ signedUrl });
    } catch (storageError: any) {
      console.error("Storage error:", storageError);
      return NextResponse.json(
        { error: "Failed to generate signed URL", details: storageError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("API Error in signed-url route:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
