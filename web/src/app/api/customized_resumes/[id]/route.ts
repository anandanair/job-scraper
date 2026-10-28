import { NextResponse } from "next/server";
import {
  updateCustomizedResumeById,
  uploadPersonalizedResume, // Import the upload function
} from "@/lib/supabase/queries"; // Adjust path as needed
import { Resume } from "@/types";

// Handler for PATCH requests to update a resume
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const updates = (await request.json()) as Partial<Omit<Resume, "id">>;
    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Update payload is required" },
        { status: 400 },
      );
    }

    const updatedResume = await updateCustomizedResumeById(id, updates);

    if (!updatedResume) {
      return NextResponse.json(
        { error: `Resume with ID ${id} not found or update failed` },
        { status: 404 },
      );
    }

    return NextResponse.json(updatedResume, { status: 200 });
  } catch (error) {
    console.error("API Error updating job:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Failed to update resume", details: errorMessage },
      { status: 500 },
    );
  }
}

// New Handler for POST requests to upload a personalized resume PDF
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Filename is required" },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fileName = formData.get("fileName") as string;

    if (!file) {
      return NextResponse.json(
        { error: "File is required in formData" },
        { status: 400 },
      );
    }

    const savedFileName = await uploadPersonalizedResume(fileName, file);

    return NextResponse.json({ fileName: savedFileName }, { status: 200 });
  } catch (error) {
    console.error("API Error uploading personalized resume:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Failed to upload personalized resume", details: errorMessage },
      { status: 500 },
    );
  }
}
