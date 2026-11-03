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
      running: 0,
    };

    if (allRecentRuns) {
      for (const r of allRecentRuns) {
        if (r.status === "success") stats.success++;
        else if (r.status === "warning") stats.warning++;
        else if (r.status === "failed") stats.failed++;
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
