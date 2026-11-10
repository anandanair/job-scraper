import { NextRequest, NextResponse } from "next/server";
import { createSupabaseStaticClient, isSupabaseConfigured } from "@/utils/supabase/server";
import { AutomationRun } from "@/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/system/automation-runs
 *
 * Query parameters:
 * - workflow_id: string (optional, filter by specific workflow or 'all')
 * - status: string (optional, filter by status or 'all')
 * - limit: number (optional, default 50, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        success: false,
        error: "Supabase is not configured.",
        runs: [],
        stats: { total: 0, success: 0, warning: 0, failed: 0, running: 0 },
      });
    }

    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get("workflow_id");
    const status = searchParams.get("status");
    const limitParam = searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 100);

    const supabase = createSupabaseStaticClient();

    // 0. Auto-reconcile orphaned or dead 'running' runs
    try {
      const { data: stuckRuns } = await supabase
        .from("automation_runs")
        .select("id, workflow_id, trigger_type, started_at, log_output")
        .eq("status", "running");

      if (stuckRuns && stuckRuns.length > 0) {
        const now = Date.now();
        const globalForWorkflows = globalThis as unknown as {
          runningWorkflows?: Map<string, { pid: number; started_at: string }>;
        };
        const activeLocal = globalForWorkflows.runningWorkflows;

        for (const stuck of stuckRuns) {
          const isLocal = stuck.trigger_type === "local_web" || stuck.trigger_type === "local_cli";
          const startedAtMs = new Date(stuck.started_at).getTime();
          const ageMs = now - startedAtMs;

          // Local runs that are no longer registered in runningWorkflows (and older than 8s to prevent race condition)
          const isDeadLocal = isLocal && (!activeLocal || !activeLocal.has(stuck.workflow_id)) && ageMs > 8000;
          // Cloud runs running for more than 45 minutes without completion
          const isTimedOutCloud = !isLocal && ageMs > 45 * 60 * 1000;

          if (isDeadLocal || isTimedOutCloud) {
            const completedAt = new Date();
            const durationSeconds = Math.max(1, Math.round(ageMs / 1000));
            const finalStatus = isDeadLocal ? "stopped" : "failed";
            const reason = isDeadLocal
              ? "Process stopped or interrupted."
              : "Execution timed out or aborted.";

            await supabase
              .from("automation_runs")
              .update({
                status: finalStatus,
                completed_at: completedAt.toISOString(),
                duration_seconds: durationSeconds,
                summary: reason,
                error_message: reason,
              })
              .eq("id", stuck.id);
          }
        }
      }
    } catch (reconcileErr) {
      console.warn("[AutomationRuns] Non-fatal error reconciling stuck runs:", reconcileErr);
    }

    // 1. Fetch runs matching criteria
    let query = supabase
      .from("automation_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);

    if (workflowId && workflowId !== "all") {
      query = query.eq("workflow_id", workflowId);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data: runs, error } = await query;

    if (error) {
      console.error("Error fetching automation runs:", error.message);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          runs: [],
          stats: { total: 0, success: 0, warning: 0, failed: 0, running: 0 },
        },
        { status: 500 }
      );
    }

    // 2. Compute quick high-level summary stats across the latest runs
    // Fetch stats over the latest 100 runs
    const { data: allRecentRuns } = await supabase
      .from("automation_runs")
      .select("status")
      .order("started_at", { ascending: false })
      .limit(100);

    const stats = {
      total: allRecentRuns?.length || 0,
      success: 0,
      warning: 0,
      failed: 0,
      stopped: 0,
      running: 0,
    };

    if (allRecentRuns) {
      for (const r of allRecentRuns) {
        if (r.status === "success") stats.success++;
        else if (r.status === "warning") stats.warning++;
        else if (r.status === "failed") stats.failed++;
        else if (r.status === "stopped") stats.stopped++;
        else if (r.status === "running") stats.running++;
      }
    }

    return NextResponse.json({
      success: true,
      runs: (runs || []) as AutomationRun[],
      stats,
    });
  } catch (err: any) {
    console.error("Unhandled error in /api/system/automation-runs:", err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Internal server error",
        runs: [],
        stats: { total: 0, success: 0, warning: 0, failed: 0, running: 0 },
      },
      { status: 500 }
    );
  }
}
