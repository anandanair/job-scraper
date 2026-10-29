import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// 1. Load env files across monorepo locations
const webEnv = path.resolve(process.cwd(), ".env.local");
const rootEnv = path.resolve(process.cwd(), "..", ".env");
const backendEnv = path.resolve(process.cwd(), "..", "backend", ".env");

if (fs.existsSync(webEnv)) dotenv.config({ path: webEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
if (fs.existsSync(backendEnv)) dotenv.config({ path: backendEnv });

import { createSupabaseStaticClient } from "../src/utils/supabase/server";
import {
  loadScraperSettings,
  processLinkedInQuery,
  processCareersFutureQuery,
  saveJobsToSupabase,
} from "../src/lib/scraper";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

interface CliArgs {
  source?: "all" | "linkedin" | "careers_future";
  query?: string;
  limit?: number;
  dryRun?: boolean;
}

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--source" && args[i + 1]) {
      const src = args[++i].toLowerCase();
      if (src === "all" || src === "linkedin" || src === "careers_future") {
        result.source = src;
      }
    } else if (arg === "--query" && args[i + 1]) {
      result.query = args[++i];
    } else if (arg === "--limit" && args[i + 1]) {
      const lim = parseInt(args[++i], 10);
      if (!isNaN(lim) && lim > 0) {
        result.limit = lim;
      }
    } else if (arg === "--dry-run") {
      result.dryRun = true;
    }
  }

  return result;
}

async function main() {
  console.log("=================================================================");
  console.log("       JobTrack Autonomous Job Scraper (TypeScript Engine)       ");
  console.log("=================================================================\n");

  const cli = parseCliArgs();
  const supabase = createSupabaseStaticClient();

  // Load dynamic configuration from Supabase app_settings (or defaults if unconfigured)
  const settings = await loadScraperSettings(supabase);

  // Determine active sources
  let activeSources: string[] = [];
  if (cli.source && cli.source !== "all") {
    activeSources = [cli.source];
  } else {
    activeSources = settings.scrapingSources;
  }

  console.log(`Active Scraping Sources: ${activeSources.join(", ")}`);
  if (cli.dryRun) {
    console.log("Mode: DRY-RUN (Jobs will be extracted and displayed but not upserted to database)");
  }

  let totalNewJobsSaved = 0;

  // 1. LinkedIn Scraping
  if (activeSources.includes("linkedin")) {
    console.log("\n==================== Starting LinkedIn Scraping ====================");
    const queries = cli.query ? [cli.query] : settings.linkedinQueries;
    const maxJobs = cli.limit ?? settings.maxJobsPerSearch.linkedin ?? 10;

    if (queries.length === 0) {
      console.log("ℹ️ No LinkedIn search queries configured. Set queries in Settings or pass --query.");
    }

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      console.log(`\n------------------------------------------------------------`);
      console.log(`[LinkedIn] Processing Query (${i + 1}/${queries.length}): "${query}" (Limit: ${maxJobs})`);
      console.log(`------------------------------------------------------------`);

      const scrapedJobs = await processLinkedInQuery(
        query,
        settings.linkedinConfig.location,
        supabase,
        settings.linkedinConfig,
        maxJobs
      );

      if (scrapedJobs.length > 0) {
        if (!cli.dryRun) {
          const savedCount = await saveJobsToSupabase(supabase, scrapedJobs);
          totalNewJobsSaved += savedCount;
        } else {
          console.log(`[Dry-Run] Extracted ${scrapedJobs.length} LinkedIn jobs for "${query}":`);
          scrapedJobs.forEach((j, idx) => console.log(`  ${idx + 1}. [${j.job_id}] ${j.job_title} @ ${j.company}`));
        }
      } else {
        console.log(`[LinkedIn] No new jobs fetched for query "${query}".`);
      }

      if (i < queries.length - 1) {
        const queryDelay = randomBetween(
          settings.linkedinConfig.searchQueryMinDelay,
          settings.linkedinConfig.searchQueryMaxDelay
        );
        console.log(`[LinkedIn] Waiting ${queryDelay.toFixed(2)}s before next query...`);
        await sleep(queryDelay * 1000);
      }
    }
  } else {
    console.log("\nℹ️ Skipping LinkedIn Scraping (disabled in arguments / settings).");
  }

  // 2. CareersFuture Scraping
  if (activeSources.includes("careers_future")) {
    console.log("\n================= Starting CareersFuture Scraping =================");
    const queries = cli.query ? [cli.query] : settings.careersFutureQueries;
    const maxJobs = cli.limit ?? settings.maxJobsPerSearch.careers_future ?? 20;

    if (queries.length === 0) {
      console.log("ℹ️ No CareersFuture search queries configured. Set queries in Settings or pass --query.");
    }

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      console.log(`\n------------------------------------------------------------`);
      console.log(`[CareersFuture] Processing Query (${i + 1}/${queries.length}): "${query}" (Limit: ${maxJobs})`);
      console.log(`------------------------------------------------------------`);

      const scrapedJobs = await processCareersFutureQuery(
        query,
        supabase,
        settings.careersFutureConfig,
        maxJobs
      );

      if (scrapedJobs.length > 0) {
        if (!cli.dryRun) {
          const savedCount = await saveJobsToSupabase(supabase, scrapedJobs);
          totalNewJobsSaved += savedCount;
        } else {
          console.log(`[Dry-Run] Extracted ${scrapedJobs.length} CareersFuture jobs for "${query}":`);
          scrapedJobs.forEach((j, idx) => console.log(`  ${idx + 1}. [${j.job_id}] ${j.job_title} @ ${j.company}`));
        }
      } else {
        console.log(`[CareersFuture] No new jobs fetched for query "${query}".`);
      }

      if (i < queries.length - 1) {
        const queryDelay = randomBetween(5.0, 10.0);
        console.log(`[CareersFuture] Waiting ${queryDelay.toFixed(2)}s before next query...`);
        await sleep(queryDelay * 1000);
      }
    }
  } else {
    console.log("\nℹ️ Skipping CareersFuture Scraping (disabled in arguments / settings).");
  }

  console.log("\n=================================================================");
  console.log(`Job scraping complete. Total new jobs saved: ${totalNewJobsSaved}`);
  console.log("=================================================================\n");
}

main().catch((err) => {
  console.error("Fatal error in job scraper:", err);
  process.exit(1);
});
