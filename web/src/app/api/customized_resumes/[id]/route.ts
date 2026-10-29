import { NextResponse } from "next/server";
import { updateCustomizedResumeById } from "@/lib/supabase/queries";
import { Resume } from "@/types";

// Handler for PATCH requests to update a customized resume
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
    console.error("API Error updating customized resume:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Failed to update resume", details: errorMessage },
      { status: 500 },
    );
  }
}
