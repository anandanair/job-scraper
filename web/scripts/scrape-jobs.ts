import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// 1. Load env files across monorepo locations
const webEnv = path.resolve(process.cwd(), ".env.local");
const rootEnv = path.resolve(process.cwd(), "..", ".env");

if (fs.existsSync(webEnv)) dotenv.config({ path: webEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });

import { createSupabaseStaticClient } from "../src/utils/supabase/server";
import {
  loadScraperSettings,
  processLinkedInQuery,
  processCareersFutureQuery,
  saveJobsToSupabase,
  SAFE_MAX_SCRAPE_PER_SOURCE,
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
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg.startsWith("--source=")) {
      const src = arg.split("=")[1].toLowerCase();
      if (src === "all" || src === "linkedin" || src === "careers_future") {
        result.source = src;
      }
    } else if (arg === "--source" && args[i + 1]) {
      const src = args[++i].toLowerCase();
      if (src === "all" || src === "linkedin" || src === "careers_future") {
        result.source = src;
      }
    } else if (arg.startsWith("--query=")) {
      result.query = arg.slice("--query=".length);
    } else if (arg === "--query" && args[i + 1]) {
      result.query = args[++i];
    } else if (arg.startsWith("--limit=")) {
      const lim = parseInt(arg.split("=")[1], 10);
      if (!isNaN(lim) && lim > 0) {
        result.limit = lim;
      }
    } else if (arg === "--limit" && args[i + 1]) {
      const lim = parseInt(args[++i], 10);
      if (!isNaN(lim) && lim > 0) {
        result.limit = lim;
      }
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }

  // Positional fallback in case an outer runner or npm strips flag keys
  if (positional.length > 0) {
    for (const p of positional) {
      const lower = p.toLowerCase();
      if (!result.source && (lower === "linkedin" || lower === "careers_future" || lower === "all")) {
        result.source = lower;
      } else if (!result.limit && /^\d+$/.test(p)) {
        result.limit = parseInt(p, 10);
      } else if (!result.query) {
        result.query = p;
      }
    }
  }

  return result;
}

async function main() {
  console.log("=================================================================");
  console.log("       JobTrack Autonomous Job Scraper (TypeScript Engine)       ");
  console.log("=================================================================\n");

  const cli = parseCliArgs();
  console.log(`[CLI] Options: source=${cli.source ?? "all (configured)"}, query=${cli.query ? `"${cli.query}"` : "all (configured)"}, limit=${cli.limit ?? "default"}, dryRun=${Boolean(cli.dryRun)}`);
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
    const dailyTarget = Math.min(
      SAFE_MAX_SCRAPE_PER_SOURCE,
      settings.maxJobsPerSearch.daily_scrape_linkedin ?? 15
    );
    const perQueryLimit = Math.min(
      SAFE_MAX_SCRAPE_PER_SOURCE,
      cli.limit ?? (cli.query ? dailyTarget : (settings.maxJobsPerSearch.linkedin ?? 5))
    );

    if (queries.length === 0) {
      console.log("ℹ️ No LinkedIn search queries configured. Set queries in Settings or pass --query.");
    }

    let totalLinkedinScrapedThisRun = 0;

    for (let i = 0; i < queries.length; i++) {
      if (totalLinkedinScrapedThisRun >= dailyTarget) {
        console.log(`[LinkedIn] Reached daily safety limit of ${totalLinkedinScrapedThisRun}/${dailyTarget} jobs. Halting further queries.`);
        break;
      }

      const query = queries[i];
      const remainingQuota = dailyTarget - totalLinkedinScrapedThisRun;
      const queryLimit = Math.min(perQueryLimit, remainingQuota);

      console.log(`\n------------------------------------------------------------`);
      console.log(`[LinkedIn] Processing Query (${i + 1}/${queries.length}): "${query}" (Limit: ${queryLimit}, Daily Cap: ${dailyTarget})`);
      console.log(`------------------------------------------------------------`);

      const scrapedJobs = await processLinkedInQuery(
        query,
        settings.linkedinConfig.location,
        supabase,
        settings.linkedinConfig,
        queryLimit
      );

      if (scrapedJobs.length > 0) {
        totalLinkedinScrapedThisRun += scrapedJobs.length;
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

      if (i < queries.length - 1 && totalLinkedinScrapedThisRun < dailyTarget) {
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
    const dailyTarget = Math.min(
      SAFE_MAX_SCRAPE_PER_SOURCE,
      settings.maxJobsPerSearch.daily_scrape_careers_future ?? 15
    );
    const perQueryLimit = Math.min(
      SAFE_MAX_SCRAPE_PER_SOURCE,
      cli.limit ?? (cli.query ? dailyTarget : (settings.maxJobsPerSearch.careers_future ?? 5))
    );

    if (queries.length === 0) {
      console.log("ℹ️ No CareersFuture search queries configured. Set queries in Settings or pass --query.");
    }

    let totalCfScrapedThisRun = 0;

    for (let i = 0; i < queries.length; i++) {
      if (totalCfScrapedThisRun >= dailyTarget) {
        console.log(`[CareersFuture] Reached daily safety limit of ${totalCfScrapedThisRun}/${dailyTarget} jobs. Halting further queries.`);
        break;
      }

      const query = queries[i];
      const remainingQuota = dailyTarget - totalCfScrapedThisRun;
      const queryLimit = Math.min(perQueryLimit, remainingQuota);

      console.log(`\n------------------------------------------------------------`);
      console.log(`[CareersFuture] Processing Query (${i + 1}/${queries.length}): "${query}" (Limit: ${queryLimit}, Daily Cap: ${dailyTarget})`);
      console.log(`------------------------------------------------------------`);

      const scrapedJobs = await processCareersFutureQuery(
        query,
        supabase,
        settings.careersFutureConfig,
        queryLimit
      );

      if (scrapedJobs.length > 0) {
        totalCfScrapedThisRun += scrapedJobs.length;
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

      if (i < queries.length - 1 && totalCfScrapedThisRun < dailyTarget) {
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
