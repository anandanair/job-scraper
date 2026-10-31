import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  updateJobById,
  getJobById,
  getCustomizedResumeById,
  updateCustomizedResumeById,
  getActiveResumeStyle,
} from "@/lib/supabase/queries";
import { Job, StatusHistoryEntry } from "@/types";
import { parseStatusHistory } from "@/lib/applied-status";

// Handler for PATCH requests to update a job
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ job_id: string }> }
) {
  try {
    const { job_id } = await params;
    if (!job_id) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Partial<Job> & { note?: string };
    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json(
        { error: "Update payload is required" },
        { status: 400 }
      );
    }

    // `note` is a transient field consumed by the history entry below;
    // the persisted column is `notes`.
    const { note, ...updates } = body;

    // Append to the status history timeline whenever the status changes.
    // History is always rebuilt from the DB so concurrent updates are preserved.
    if (updates.status) {
      const currentJob = await getJobById(job_id);
      const history = parseStatusHistory(currentJob?.status_history);
      const lastEntry = history[history.length - 1];
      const entryNote = note && note.trim() ? note.trim() : undefined;
      const newEntry: StatusHistoryEntry = {
        from: lastEntry ? lastEntry.to : currentJob?.status ?? null,
        to: updates.status,
        at: new Date().toISOString(),
        ...(entryNote ? { note: entryNote } : {}),
      };
      // Avoid duplicate consecutive entries for the same status
      if (!lastEntry || lastEntry.to !== newEntry.to) {
        history.push(newEntry);
      }
      updates.status_history = history;
    }

    const updatedJob = await updateJobById(job_id, updates);

    if (!updatedJob) {
      return NextResponse.json(
        { error: `Job with ID ${job_id} not found or update failed` },
        { status: 404 }
      );
    }

    // If job is being marked as applied, lock/snapshot the active theme configuration
    if (updates.status === "applied") {
      try {
        const currentJob = await getJobById(job_id);
        if (currentJob?.customized_resume_id) {
          const customResume = await getCustomizedResumeById(currentJob.customized_resume_id);
          if (customResume && !customResume.theme_config) {
            const activeStyle = await getActiveResumeStyle();
            if (activeStyle) {
              await updateCustomizedResumeById(currentJob.customized_resume_id, {
                theme_config: activeStyle,
              });
            }
          }
        }
      } catch (snapshotErr) {
        console.warn("Notice: Failed to snapshot theme_config on apply:", snapshotErr);
      }
    }

    // Invalidate dashboard stats cache so UI counters refresh immediately
    try {
      revalidateTag("dashboard-stats", "default");
    } catch (e) {
      console.warn("Failed to revalidate dashboard-stats tag:", e);
    }

    return NextResponse.json(updatedJob, { status: 200 });
  } catch (error) {
    console.error("API Error updating job:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Failed to update job", details: errorMessage },
      { status: 500 }
    );
  }
}
