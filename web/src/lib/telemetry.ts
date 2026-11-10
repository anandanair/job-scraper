import { createSupabaseStaticClient, isSupabaseConfigured } from "../utils/supabase/server";
import { AutomationWorkflowId, AutomationRunStatus } from "../types";

export interface TelemetryContext {
  setSummary: (summary: string) => void;
  setMetric: (key: string, value: any) => void;
  setMetrics: (metrics: Record<string, any>) => void;
  recordWarning: (warning: string) => void;
  recordError: (error: string | Error) => void;
}

export interface WithTelemetryOptions {
  workflowName: string;
  workflowId: AutomationWorkflowId;
  triggerType?: "schedule" | "workflow_dispatch" | "local_cli" | "local_web";
}

/**
 * Universal Telemetry and Error Tracking Wrapper.
 *
 * Wraps automation worker executions to capture:
 * - Real-time execution status (success, warning, failed)
 * - Domain metrics (e.g. jobs scraped, resumes tailored)
 * - Non-fatal warnings (LinkedIn 429 cooldowns, LLM retry backoffs)
 * - Complete console log output with timestamps
 * - Automatic retention ceiling of latest 100 runs
 */
export async function withTelemetry<T>(
  options: WithTelemetryOptions,
  runFn: (ctx: TelemetryContext) => Promise<T>
): Promise<T> {
  const startedAt = new Date();
  const startedAtIso = startedAt.toISOString();

  // 1. Resolve Trigger Type and GitHub Actions Context
  let triggerType: "schedule" | "workflow_dispatch" | "local_cli" | "local_web" = options.triggerType || "local_cli";
  if (process.env.TRIGGER_TYPE === "local_web") {
    triggerType = "local_web";
  } else if (process.env.GITHUB_EVENT_NAME === "workflow_dispatch") {
    triggerType = "workflow_dispatch";
  } else if (process.env.GITHUB_EVENT_NAME === "schedule" || process.env.GITHUB_ACTIONS === "true") {
    triggerType = "schedule";
  }

  const githubRunId = process.env.GITHUB_RUN_ID || null;
  const githubRunNumber = process.env.GITHUB_RUN_NUMBER || null;
  const githubRepo = process.env.GITHUB_REPOSITORY || null;
  const githubRunUrl =
    githubRepo && githubRunId
      ? `https://github.com/${githubRepo}/actions/runs/${githubRunId}`
      : null;

  // 2. Initialize Telemetry State
  let summary: string | null = null;
  const metrics: Record<string, any> = {};
  const errorsList: string[] = [];
  let warningCount = 0;
  let errorCount = 0;

  const logLines: string[] = [];
  const maxStoredLogLines = 2000; // Safeguard against gigantic log outputs

  const formatTime = () => {
    const d = new Date();
    return d.toTimeString().split(" ")[0]; // HH:MM:SS
  };

  const addLog = (level: "INFO" | "WARN" | "ERROR", args: any[]) => {
    const msg = args
      .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
      .join(" ");
    if (logLines.length < maxStoredLogLines) {
      logLines.push(`[${formatTime()}] [${level}] ${msg}`);
    } else if (logLines.length === maxStoredLogLines) {
      logLines.push(`[${formatTime()}] [WARN] Log output truncated: reached ${maxStoredLogLines} line limit.`);
    }
  };

  // 3. Hook Console Methods
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args: any[]) => {
    addLog("INFO", args);
    originalLog(...args);
  };

  console.warn = (...args: any[]) => {
    warningCount++;
    addLog("WARN", args);
    const warnMsg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
    if (errorsList.length < 20 && !errorsList.includes(warnMsg)) {
      errorsList.push(`[WARN] ${warnMsg.slice(0, 200)}`);
    }
    originalWarn(...args);
  };

  console.error = (...args: any[]) => {
    errorCount++;
    addLog("ERROR", args);
    const errMsg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
    if (errorsList.length < 20 && !errorsList.includes(errMsg)) {
      errorsList.push(`[ERROR] ${errMsg.slice(0, 200)}`);
    }
    originalError(...args);
  };

  // 4. Create Initial Database Record (if Supabase configured)
  let runId: string | null = null;
  const supabase = isSupabaseConfigured() ? createSupabaseStaticClient() : null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("automation_runs")
        .insert({
          workflow_name: options.workflowName,
          workflow_id: options.workflowId,
          status: "running",
          trigger_type: triggerType,
          started_at: startedAtIso,
          github_run_id: githubRunId,
          github_run_number: githubRunNumber,
          github_run_url: githubRunUrl,
        })
        .select("id")
        .single();

      if (!error && data?.id) {
        runId = data.id;
      }
    } catch (dbErr) {
      originalWarn("[Telemetry] Could not insert initial run record:", dbErr);
    }
  }

  const ctx: TelemetryContext = {
    setSummary: (s: string) => {
      summary = s;
    },
    setMetric: (key: string, val: any) => {
      metrics[key] = val;
    },
    setMetrics: (m: Record<string, any>) => {
      Object.assign(metrics, m);
    },
    recordWarning: (warn: string) => {
      warningCount++;
      if (errorsList.length < 20 && !errorsList.includes(warn)) {
        errorsList.push(`[WARN] ${warn.slice(0, 200)}`);
      }
    },
    recordError: (err: string | Error) => {
      errorCount++;
      const msg = err instanceof Error ? err.message : String(err);
      if (errorsList.length < 20 && !errorsList.includes(msg)) {
        errorsList.push(`[ERROR] ${msg.slice(0, 200)}`);
      }
    },
  };

  // 5. Execute Worker Function
  let result: T;
  let executionError: any = null;

  // Signal handlers to capture graceful stops
  const handleSignal = async (signalName: string) => {
    if (supabase && runId) {
      try {
        const completedAt = new Date();
        const durationSeconds = Math.max(1, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000));
        await supabase
          .from("automation_runs")
          .update({
            status: "stopped",
            completed_at: completedAt.toISOString(),
            duration_seconds: durationSeconds,
            summary: `Interrupted by signal ${signalName}.`,
            error_message: `Process received ${signalName}.`,
            log_output: logLines.join("\n"),
          })
          .eq("id", runId);
      } catch {
        // non-fatal
      }
    }
    process.exit(130);
  };

  const onSigInt = () => handleSignal("SIGINT");
  const onSigTerm = () => handleSignal("SIGTERM");
  process.once("SIGINT", onSigInt);
  process.once("SIGTERM", onSigTerm);

  // Periodic in-progress telemetry flush (every 4s) so web UI can view live logs in real time
  let flushTimer: NodeJS.Timeout | null = null;
  let lastFlushedLines = 0;

  if (supabase && runId) {
    flushTimer = setInterval(async () => {
      if (runId && logLines.length > lastFlushedLines) {
        lastFlushedLines = logLines.length;
        try {
          await supabase
            .from("automation_runs")
            .update({
              log_output: logLines.join("\n"),
              metrics,
              warning_count: warningCount,
              error_count: errorCount,
              summary: summary || `Executing... (${logLines.length} lines logged)`,
            })
            .eq("id", runId);
        } catch {
          // non-fatal periodic sync
        }
      }
    }, 4000);
  }

  try {
    result = await runFn(ctx);
  } catch (err) {
    executionError = err;
    errorCount++;
    const errMsg = err instanceof Error ? err.message : String(err);
    if (!errorsList.includes(errMsg)) {
      errorsList.unshift(`[FATAL] ${errMsg.slice(0, 250)}`);
    }
  } finally {
    process.removeListener("SIGINT", onSigInt);
    process.removeListener("SIGTERM", onSigTerm);
    if (flushTimer) {
      clearInterval(flushTimer);
    }
    // Restore console immediately
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }

  // 6. Finalize Telemetry Record
  const completedAt = new Date();
  const durationSeconds = Math.max(1, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000));

  let finalStatus: AutomationRunStatus = "success";
  if (executionError) {
    finalStatus = "failed";
  } else if (errorCount > 0 || warningCount > 0) {
    finalStatus = "warning";
  }

  if (supabase) {
    try {
      const updatePayload = {
        status: finalStatus,
        completed_at: completedAt.toISOString(),
        duration_seconds: durationSeconds,
        summary: summary || (executionError ? `Failed with error: ${executionError.message || executionError}` : `Completed in ${durationSeconds}s`),
        metrics: metrics,
        error_count: errorCount,
        warning_count: warningCount,
        error_message: executionError ? (executionError.message || String(executionError)) : null,
        errors_list: errorsList,
        log_output: logLines.join("\n"),
        github_run_url: githubRunUrl,
      };

      if (runId) {
        await supabase.from("automation_runs").update(updatePayload).eq("id", runId);
      } else {
        await supabase.from("automation_runs").insert({
          workflow_name: options.workflowName,
          workflow_id: options.workflowId,
          trigger_type: triggerType,
          started_at: startedAtIso,
          github_run_id: githubRunId,
          github_run_number: githubRunNumber,
          ...updatePayload,
        });
      }

      // Auto-prune beyond 100 runs
      const { data: oldRuns } = await supabase
        .from("automation_runs")
        .select("id")
        .order("started_at", { ascending: false })
        .range(100, 200);

      if (oldRuns && oldRuns.length > 0) {
        const idsToDelete = oldRuns.map((r) => r.id);
        await supabase.from("automation_runs").delete().in("id", idsToDelete);
      }
    } catch (persistErr) {
      originalWarn("[Telemetry] Could not finalize run record:", persistErr);
    }
  }

  // If fatal error occurred, re-throw it so worker exit code is 1
  if (executionError) {
    throw executionError;
  }

  return result!;
}
