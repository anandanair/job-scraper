import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// 1. Load env files
const webEnv = path.resolve(process.cwd(), ".env.local");
const rootEnv = path.resolve(process.cwd(), "..", ".env");
if (fs.existsSync(webEnv)) dotenv.config({ path: webEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });

import { createSupabaseStaticClient } from "../src/utils/supabase/server";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
];

const INACTIVE_KEYWORDS = [
  "this job is no longer available",
  "job is closed",
  "no longer accepting applications",
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkJobActive(jobId: string): Promise<boolean | null> {
  const url = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });

    if (res.status === 404) {
      return false; // Inactive
    }

    if (res.status >= 400) {
      // 429 or server error, assume inconclusive
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
    console.warn(`  Network check error for ${jobId}:`, err.message);
    return null;
  }
}

async function main() {
  console.log("=== Starting Job Liveness Manager (TypeScript) ===");
  const supabase = createSupabaseStaticClient();

  // Find active jobs that haven't been checked recently (older than 3 days, or null last_checked)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: jobsToCheck, error } = await supabase
    .from("jobs")
    .select("job_id, job_title, company, last_checked")
    .eq("is_active", true)
    .or(`last_checked.is.null,last_checked.lt.${threeDaysAgo}`)
    .order("last_checked", { ascending: true, nullsFirst: true })
    .limit(20);

  if (error) {
    console.error("Error fetching jobs to check:", error.message);
    process.exit(1);
  }

  if (!jobsToCheck || jobsToCheck.length === 0) {
    console.log("No jobs require expiry checks at this time.");
    return;
  }

  console.log(`Checking status of ${jobsToCheck.length} active jobs...`);
  let activeCount = 0;
  let closedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < jobsToCheck.length; i++) {
    const job = jobsToCheck[i];
    console.log(`[${i + 1}/${jobsToCheck.length}] Checking job ${job.job_id} ("${job.job_title}" at "${job.company}")...`);

    const isActive = await checkJobActive(job.job_id);

    if (isActive === false) {
      console.log(`  ✗ Job ${job.job_id} is CLOSED / INACTIVE. Marking is_active=false.`);
      await supabase
        .from("jobs")
        .update({
          is_active: false,
          job_state: "closed",
          last_checked: new Date().toISOString(),
        })
        .eq("job_id", job.job_id);
      closedCount++;
    } else if (isActive === true) {
      console.log(`  ✓ Job ${job.job_id} is still ACTIVE.`);
      await supabase
        .from("jobs")
        .update({
          last_checked: new Date().toISOString(),
        })
        .eq("job_id", job.job_id);
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
}

main().catch((err) => {
  console.error("Fatal error in job manager:", err);
  process.exit(1);
});
