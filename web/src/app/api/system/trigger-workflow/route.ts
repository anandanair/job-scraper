import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { spawn, execSync } from "child_process";
import { AutomationWorkflowId } from "@/types";
import { createSupabaseStaticClient, isSupabaseConfigured } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

interface RunningWorkflowRecord {
  workflow_id: AutomationWorkflowId;
  pid: number;
  started_at: string;
  options: {
    force?: boolean;
    dryRun?: boolean;
    source?: string;
    limit?: number;
    query?: string;
  };
  child?: any;
  logs: string[];
}

interface CompletedWorkflowRecord {
  workflow_id: AutomationWorkflowId;
  pid: number;
  started_at: string;
  completed_at: string;
  exit_code: number | null;
  logs: string[];
}

const globalForWorkflows = globalThis as unknown as {
  runningWorkflows?: Map<AutomationWorkflowId, RunningWorkflowRecord>;
  recentCompletedWorkflows?: Map<AutomationWorkflowId, CompletedWorkflowRecord>;
};

const runningProcesses =
  globalForWorkflows.runningWorkflows ||
  (globalForWorkflows.runningWorkflows = new Map<AutomationWorkflowId, RunningWorkflowRecord>());

const recentCompleted =
  globalForWorkflows.recentCompletedWorkflows ||
  (globalForWorkflows.recentCompletedWorkflows = new Map<AutomationWorkflowId, CompletedWorkflowRecord>());

const SCRIPT_MAP: Record<AutomationWorkflowId, string> = {
  scrape_jobs: "scripts/scrape-jobs.ts",
  score_jobs: "scripts/score-jobs.ts",
  customize_resumes: "scripts/customize-resumes.ts",
  job_manager: "scripts/job-manager.ts",
};

/**
 * Synchronize early termination, failure, or user cancellation to Supabase automation_runs.
 */
async function syncTerminationToSupabase(
  workflowId: AutomationWorkflowId,
  finalStatus: "stopped" | "failed",
  reason: string,
  logs: string[],
  startedAtIso: string
) {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = createSupabaseStaticClient();
    const { data: runs } = await supabase
      .from("automation_runs")
      .select("id, started_at")
      .eq("workflow_id", workflowId)
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1);

    if (runs && runs.length > 0) {
      const run = runs[0];
      const completedAt = new Date();
      const startedAt = new Date(run.started_at || startedAtIso);
      const durationSeconds = Math.max(1, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000));

      await supabase
        .from("automation_runs")
        .update({
          status: finalStatus,
          completed_at: completedAt.toISOString(),
          duration_seconds: durationSeconds,
          summary: reason,
          error_message: reason,
          log_output: logs.join("\n"),
        })
        .eq("id", run.id);
    }
  } catch (err) {
    console.warn(`[TriggerWorkflow] Could not sync termination to Supabase for ${workflowId}:`, err);
  }
}

function pruneDeadProcesses() {
  for (const [id, rec] of runningProcesses.entries()) {
    try {
      if (rec.child && (rec.child.exitCode !== null || rec.child.killed)) {
        throw new Error("Process already exited");
      }
      // process.kill(pid, 0) tests if process is alive without signaling
      process.kill(rec.pid, 0);
    } catch {
      const exitCode = rec.child?.exitCode ?? null;
      recentCompleted.set(id, {
        workflow_id: id,
        pid: rec.pid,
        started_at: rec.started_at,
        completed_at: new Date().toISOString(),
        exit_code: exitCode,
        logs: [...rec.logs],
      });
      runningProcesses.delete(id);

      // Asynchronously heal stuck 'running' Supabase row if process died unexpectedly
      if (exitCode !== 0) {
        const isStop = exitCode === 130;
        syncTerminationToSupabase(
          id,
          isStop ? "stopped" : "failed",
          `Process exited unexpectedly (code: ${exitCode ?? "terminated"}).`,
          rec.logs,
          rec.started_at
        ).catch(() => {});
      }
    }
  }
}

/**
 * GET /api/system/trigger-workflow
 * Returns all currently running local workflows or streams logs for a specific workflow.
 *
 * Query params:
 * - workflow_id: string (optional)
 * - logs: boolean ("true" to fetch buffered live log lines)
 */
export async function GET(request: NextRequest) {
  pruneDeadProcesses();

  const { searchParams } = new URL(request.url);
  const requestedWorkflowId = searchParams.get("workflow_id") as AutomationWorkflowId | null;
  const includeLogs = searchParams.get("logs") === "true";

  if (requestedWorkflowId && includeLogs) {
    const running = runningProcesses.get(requestedWorkflowId);
    if (running) {
      return NextResponse.json({
        success: true,
        workflow_id: requestedWorkflowId,
        isRunning: true,
        pid: running.pid,
        started_at: running.started_at,
        logs: running.logs,
      });
    }

    const completed = recentCompleted.get(requestedWorkflowId);
    if (completed) {
      return NextResponse.json({
        success: true,
        workflow_id: requestedWorkflowId,
        isRunning: false,
        pid: completed.pid,
        started_at: completed.started_at,
        completed_at: completed.completed_at,
        exit_code: completed.exit_code,
        logs: completed.logs,
      });
    }

    return NextResponse.json({
      success: true,
      workflow_id: requestedWorkflowId,
      isRunning: false,
      logs: [],
    });
  }

  const active = Array.from(runningProcesses.values()).map((r) => ({
    workflow_id: r.workflow_id,
    pid: r.pid,
    started_at: r.started_at,
    options: r.options,
  }));

  return NextResponse.json({
    success: true,
    runningWorkflows: active,
  });
}

/**
 * POST /api/system/trigger-workflow
 * Spawns a background workflow worker process locally with in-memory live log capture.
 */
export async function POST(request: NextRequest) {
  try {
    pruneDeadProcesses();

    const body = await request.json().catch(() => ({}));
    const workflowId = body.workflow_id as AutomationWorkflowId;

    if (!workflowId || !SCRIPT_MAP[workflowId]) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid workflow_id. Expected one of: ${Object.keys(SCRIPT_MAP).join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Check if already running
    if (runningProcesses.has(workflowId)) {
      const existing = runningProcesses.get(workflowId)!;
      return NextResponse.json(
        {
          success: false,
          error: `Workflow "${workflowId}" is already running (PID: ${existing.pid}).`,
          runningWorkflow: {
            workflow_id: existing.workflow_id,
            pid: existing.pid,
            started_at: existing.started_at,
          },
        },
        { status: 409 }
      );
    }

    // Resolve directories
    const webDir = fs.existsSync(path.resolve(process.cwd(), "scripts"))
      ? process.cwd()
      : path.resolve(process.cwd(), "web");

    const scriptRelative = SCRIPT_MAP[workflowId];
    const scriptPath = path.resolve(webDir, scriptRelative);

    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        {
          success: false,
          error: `Script not found at: ${scriptPath}`,
        },
        { status: 500 }
      );
    }

    const tsxDistPath = path.resolve(webDir, "node_modules", "tsx", "dist", "cli.mjs");
    if (!fs.existsSync(tsxDistPath)) {
      return NextResponse.json(
        {
          success: false,
          error: `tsx CLI not found at: ${tsxDistPath}. Please run npm install.`,
        },
        { status: 500 }
      );
    }

    // Build arguments
    const args: string[] = [tsxDistPath, scriptPath];

    // Options (force defaults to true for manual local UI trigger)
    const force = body.force !== false;
    const dryRun = Boolean(body.dryRun);
    const source = body.source;
    const limit = typeof body.limit === "number" && body.limit > 0 ? body.limit : undefined;
    const query = typeof body.query === "string" && body.query.trim() ? body.query.trim() : undefined;
    const rescore = Boolean(body.rescore);

    if (force) args.push("--force");
    if (dryRun) args.push("--dry-run");
    if (rescore) args.push("--rescore");
    if (source && source !== "all") args.push(`--source=${source}`);
    if (limit) args.push(`--limit=${limit}`);
    if (query) args.push(`--query=${query}`);

    console.log(`[TriggerWorkflow] Spawning: ${process.execPath} ${args.join(" ")} in ${webDir}`);

    const child = spawn(process.execPath, args, {
      cwd: webDir,
      env: {
        ...process.env,
        TRIGGER_TYPE: "local_web",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const pid = child.pid;
    if (!pid) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to spawn child worker process: PID not returned.",
        },
        { status: 500 }
      );
    }

    const record: RunningWorkflowRecord = {
      workflow_id: workflowId,
      pid,
      started_at: new Date().toISOString(),
      options: { force, dryRun, source, limit, query },
      child,
      logs: [
        `[${new Date().toLocaleTimeString()}] [INFO] Starting local worker process for ${workflowId} (PID: ${pid})...`,
      ],
    };

    runningProcesses.set(workflowId, record);

    // Stream logs to console and buffer for live website viewing
    child.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      process.stdout.write(`[Worker:${workflowId}] ${text}`);
      const lines = text.split(/\r?\n/).filter((l: string) => l.trim().length > 0);
      for (const line of lines) {
        if (record.logs.length < 2500) {
          record.logs.push(line);
        }
      }
    });

    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      process.stderr.write(`[Worker:${workflowId}:ERR] ${text}`);
      const lines = text.split(/\r?\n/).filter((l: string) => l.trim().length > 0);
      for (const line of lines) {
        if (record.logs.length < 2500) {
          record.logs.push(`[stderr] ${line}`);
        }
      }
    });

    child.on("exit", async (code, signal) => {
      console.log(`[TriggerWorkflow] Process ${pid} for ${workflowId} exited with code ${code}, signal ${signal}`);
      record.logs.push(`[${new Date().toLocaleTimeString()}] [INFO] Process ${pid} completed with exit code ${code ?? 0}.`);
      recentCompleted.set(workflowId, {
        workflow_id: workflowId,
        pid,
        started_at: record.started_at,
        completed_at: new Date().toISOString(),
        exit_code: code,
        logs: [...record.logs],
      });
      runningProcesses.delete(workflowId);

      // If the process exited abnormally (non-zero exit code or signal), ensure Supabase is updated
      if (code !== 0 || signal) {
        const isStop = code === 130 || signal === "SIGTERM" || signal === "SIGINT";
        const status = isStop ? "stopped" : "failed";
        const reason = isStop
          ? `Process stopped by signal ${signal || code}.`
          : `Process exited with error code ${code ?? 1}. Check execution logs.`;
        await syncTerminationToSupabase(workflowId, status, reason, record.logs, record.started_at);
      }
    });

    child.on("error", async (err) => {
      console.error(`[TriggerWorkflow] Process ${pid} for ${workflowId} failed:`, err);
      record.logs.push(`[${new Date().toLocaleTimeString()}] [ERROR] Process failed to spawn or crashed: ${err.message}`);
      recentCompleted.set(workflowId, {
        workflow_id: workflowId,
        pid,
        started_at: record.started_at,
        completed_at: new Date().toISOString(),
        exit_code: 1,
        logs: [...record.logs],
      });
      runningProcesses.delete(workflowId);

      await syncTerminationToSupabase(
        workflowId,
        "failed",
        `Process crashed or failed to spawn: ${err.message}`,
        record.logs,
        record.started_at
      );
    });

    return NextResponse.json({
      success: true,
      message: `Started workflow "${workflowId}" locally (PID: ${pid}).`,
      workflow_id: workflowId,
      pid,
      started_at: record.started_at,
    });
  } catch (err: any) {
    console.error("Unhandled error in POST /api/system/trigger-workflow:", err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Internal server error triggering workflow",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/system/trigger-workflow
 * Cancels a currently running local workflow.
 */
export async function DELETE(request: NextRequest) {
  try {
    pruneDeadProcesses();

    const body = await request.json().catch(() => ({}));
    const workflowId = body.workflow_id as AutomationWorkflowId;

    if (!workflowId || !runningProcesses.has(workflowId)) {
      return NextResponse.json(
        {
          success: false,
          error: `Workflow "${workflowId}" is not currently running.`,
        },
        { status: 404 }
      );
    }

    const record = runningProcesses.get(workflowId)!;
    const pid = record.pid;

    console.log(`[TriggerWorkflow] Terminating running workflow ${workflowId} (PID: ${pid})`);

    if (process.platform === "win32") {
      try {
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" });
      } catch {
        record.child?.kill();
      }
    } else {
      record.child?.kill("SIGTERM");
    }

    record.logs.push(`[${new Date().toLocaleTimeString()}] [WARN] Process manually terminated by user.`);
    recentCompleted.set(workflowId, {
      workflow_id: workflowId,
      pid,
      started_at: record.started_at,
      completed_at: new Date().toISOString(),
      exit_code: 130,
      logs: [...record.logs],
    });

    runningProcesses.delete(workflowId);

    // Immediately persist 'stopped' status to Supabase automation_runs
    await syncTerminationToSupabase(
      workflowId,
      "stopped",
      `Process manually terminated by user (PID: ${pid}).`,
      record.logs,
      record.started_at
    );

    return NextResponse.json({
      success: true,
      message: `Terminated workflow "${workflowId}" (PID: ${pid}).`,
    });
  } catch (err: any) {
    console.error("Unhandled error in DELETE /api/system/trigger-workflow:", err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Internal server error terminating workflow",
      },
      { status: 500 }
    );
  }
}
