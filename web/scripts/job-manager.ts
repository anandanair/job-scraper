import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// 1. Load env files
const webEnv = path.resolve(process.cwd(), ".env.local");
const rootEnv = path.resolve(process.cwd(), "..", ".env");
if (fs.existsSync(webEnv)) dotenv.config({ path: webEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });

import { createSupabaseStaticClient } from "../src/utils/supabase/server";
import { withTelemetry, TelemetryContext } from "../src/lib/telemetry";
import { Impit } from "impit";

let linkedinSession: Impit | null = null;
function getLinkedInClient(): Impit {
  if (!linkedinSession) {
    linkedinSession = new Impit({ browser: "chrome" });
  }
  return linkedinSession;
}

const INACTIVE_KEYWORDS = [
  "this job is no longer available",
  "job is closed",
  "no longer accepting applications",
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ManagerCliArgs {
  limit?: number;
  force?: boolean;
  dryRun?: boolean;
}

function parseManagerCliArgs(): ManagerCliArgs {
  const args = process.argv.slice(2);
  const result: ManagerCliArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg === "--force" || arg === "-f") {
      result.force = true;
    } else if (arg.startsWith("--limit=")) {
      const lim = parseInt(arg.split("=")[1], 10);
      if (!isNaN(lim) && lim > 0) result.limit = lim;
    } else if (arg === "--limit" && args[i + 1]) {
      const lim = parseInt(args[++i], 10);
      if (!isNaN(lim) && lim > 0) result.limit = lim;
    }
  }
  return result;
}

async function checkJobActive(jobId: string, provider?: string | null): Promise<boolean | null> {
  // 1. CareersFuture Liveness Check
  if (provider === "careers_future") {
    const cfUrl = `https://api.mycareersfuture.gov.sg/v2/jobs/${jobId.trim()}`;
    try {
      const res = await fetch(cfUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(12000),
      });

      if (res.status === 404) {
        return false; // Confirmed closed/removed
      }

      if (res.status >= 400) {
        return null; // Server or rate error, inconclusive
      }

      const data = await res.json().catch(() => null);
      if (!data) return null;

      if (data.status === "closed" || data.isClosed === true) {
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn(`  [CareersFuture] Network check error for ${jobId}:`, err.message);
      return null;
    }
  }

  // 2. Direct ATS Boards (Greenhouse, Lever, Ashby)
  if (provider === "greenhouse" || provider === "lever" || provider === "ashby") {
    // Direct ATS jobs are actively verified during ATS fetch cycles
    return true;
  }

  // 3. LinkedIn Guest Liveness Check
  const url = `https://www.linkedin.com/jobs/view/${jobId}/`;
  try {
    const client = getLinkedInClient();
    const res = await client.fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (res.status === 404) {
      return false; // Inactive
    }

    if (res.status >= 400) {
      // 429 or server error, assume inconclusive to protect from false expiration
      return null;
    }

    const html = (await res.text()).toLowerCase();
    for (const keyword of INACTIVE_KEYWORDS) {
      if (html.includes(keyword)) {
        return false; // Inactive
      }
    }

    return true; // Still active
  } catch (err: any) {
    console.warn(`  [LinkedIn] Network check error for ${jobId}:`, err.message);
    return null;
  }
}

async function runJobManager(ctx?: TelemetryContext) {
  console.log("=== Starting Job Liveness Manager (TypeScript) ===");
  const cli = parseManagerCliArgs();
  console.log(`[CLI] Options: limit=${cli.limit ?? "default (20)"}, force=${Boolean(cli.force)}, dryRun=${Boolean(cli.dryRun)}`);

  const supabase = createSupabaseStaticClient();

  // Find active jobs that haven't been checked recently (older than 3 days, or null last_checked)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const limitCount = cli.limit || 20;

  let query = supabase
    .from("jobs")
    .select("job_id, job_title, company, last_checked, provider")
    .eq("is_active", true);

  if (!cli.force) {
    query = query.or(`last_checked.is.null,last_checked.lt.${threeDaysAgo}`);
  }

  query = query.order("last_checked", { ascending: true, nullsFirst: true }).limit(limitCount);

  const { data: jobsToCheck, error } = await query;

  if (error) {
    console.error("Error fetching jobs to check:", error.message);
    throw error;
  }

  if (!jobsToCheck || jobsToCheck.length === 0) {
    console.log("No jobs require expiry checks at this time.");
    ctx?.setMetrics({ jobs_checked: 0, jobs_active: 0, jobs_closed: 0, inconclusive: 0 });
    ctx?.setSummary("No active jobs overdue for availability check.");
    return;
  }

  console.log(`Checking status of ${jobsToCheck.length} active jobs...`);
  let activeCount = 0;
  let closedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < jobsToCheck.length; i++) {
    const job = jobsToCheck[i];
    console.log(`[${i + 1}/${jobsToCheck.length}] Checking job ${job.job_id} ("${job.job_title}" at "${job.company}", Provider: ${job.provider || "linkedin"})...`);

    const isActive = await checkJobActive(job.job_id, job.provider);

    if (isActive === false) {
      console.log(`  ✗ Job ${job.job_id} is CLOSED / INACTIVE. Marking is_active=false.`);
      if (!cli.dryRun) {
        await supabase
          .from("jobs")
          .update({
            is_active: false,
            job_state: "closed",
            last_checked: new Date().toISOString(),
          })
          .eq("job_id", job.job_id);
      } else {
        console.log(`  [Dry-Run] Would mark job ${job.job_id} as closed.`);
      }
      closedCount++;
    } else if (isActive === true) {
      console.log(`  ✓ Job ${job.job_id} is still ACTIVE.`);
      if (!cli.dryRun) {
        await supabase
          .from("jobs")
          .update({
            last_checked: new Date().toISOString(),
          })
          .eq("job_id", job.job_id);
      } else {
        console.log(`  [Dry-Run] Would update last_checked for job ${job.job_id}.`);
      }
      activeCount++;
    } else {
      console.log(`  ⚠ Check for job ${job.job_id} inconclusive, skipping.`);
      skippedCount++;
    }

    if (i < jobsToCheck.length - 1) {
      const delay = Math.floor(Math.random() * 4000) + 4000; // 4 to 8s randomized delay
      await sleep(delay);
    }
  }

  console.log("=== Job Liveness Check Finished ===");
  console.log(`Active: ${activeCount} | Closed: ${closedCount} | Inconclusive: ${skippedCount}`);

  if (ctx) {
    ctx.setMetrics({
      jobs_checked: jobsToCheck.length,
      jobs_active: activeCount,
      jobs_closed: closedCount,
      inconclusive: skippedCount,
      dry_run: Boolean(cli.dryRun),
    });
    ctx.setSummary(
      cli.dryRun
        ? `[Dry-Run] Checked ${jobsToCheck.length} jobs: ${activeCount} active, ${closedCount} expired/closed, ${skippedCount} inconclusive.`
        : `Checked ${jobsToCheck.length} jobs: ${activeCount} active, ${closedCount} expired/closed, ${skippedCount} inconclusive.`
    );
  }
}

async function main() {
  await withTelemetry(
    {
      workflowName: "Job Expiration Manager",
      workflowId: "job_manager",
    },
    async (ctx) => {
      await runJobManager(ctx);
    }
  );
}

main().catch((err) => {
  console.error("Fatal error in job manager:", err);
  process.exit(1);
});
