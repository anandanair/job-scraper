import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// 1. Load env files
const webEnv = path.resolve(process.cwd(), ".env.local");
const rootEnv = path.resolve(process.cwd(), "..", ".env");
if (fs.existsSync(webEnv)) dotenv.config({ path: webEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });

import { createSupabaseStaticClient } from "../src/utils/supabase/server";
import { formatResumeToText, evaluateJobFit } from "../src/lib/llm";
import { getCompanyIntelligence } from "../src/lib/company-intel";
import { Resume } from "../src/types";
import { withTelemetry, TelemetryContext } from "../src/lib/telemetry";

const BATCH_LIMIT = 10;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ScoreCliArgs {
  limit?: number;
  jobId?: string;
  force?: boolean;
  dryRun?: boolean;
  rescore?: boolean;
}

function parseScoreCliArgs(): ScoreCliArgs {
  const args = process.argv.slice(2);
  const result: ScoreCliArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg === "--force" || arg === "-f") {
      result.force = true;
    } else if (arg === "--rescore") {
      result.rescore = true;
    } else if (arg.startsWith("--limit=")) {
      const lim = parseInt(arg.split("=")[1], 10);
      if (!isNaN(lim) && lim > 0) result.limit = lim;
    } else if (arg === "--limit" && args[i + 1]) {
      const lim = parseInt(args[++i], 10);
      if (!isNaN(lim) && lim > 0) result.limit = lim;
    } else if (arg.startsWith("--job-id=")) {
      result.jobId = arg.slice("--job-id=".length);
    } else if (arg === "--job-id" && args[i + 1]) {
      result.jobId = args[++i];
    }
  }
  return result;
}

async function runJobScorer(ctx?: TelemetryContext) {
  console.log("=== Starting Scheduled Job Scorer (TypeScript) ===");
  const cli = parseScoreCliArgs();
  console.log(`[CLI] Options: limit=${cli.limit ?? "default"}, force=${Boolean(cli.force)}, dryRun=${Boolean(cli.dryRun)}, jobId=${cli.jobId ?? "none"}`);

  const supabase = createSupabaseStaticClient();

  // 1. Load dynamic AI configuration from Supabase app_settings (Single Source of Truth)
  const { data: dbSettings } = await supabase
    .from("app_settings")
    .select("llm_api_key, llm_model, llm_provider, llm_tier, jobs_to_score_per_run, llm_request_delay_seconds, dream_job_profile, job_search_mode")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!dbSettings?.llm_api_key) {
    const errorMsg = "LLM API key not configured in Supabase 'app_settings'. Please configure your AI provider and API key in Settings.";
    console.error(`✗ Error: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const defaultBatch = dbSettings.jobs_to_score_per_run || BATCH_LIMIT;
  const batchLimit = cli.limit || (cli.force ? Math.max(defaultBatch, 50) : defaultBatch);
  const delayMs = (dbSettings.llm_request_delay_seconds ?? 8) * 1000;
  const activeModel = dbSettings.llm_model || "gemini-3.8-flash";
  const searchMode = (dbSettings.job_search_mode as "get_hired_fast" | "dream_hunter") || "get_hired_fast";

  console.log(
    `✓ Using AI Model: "${activeModel}" from Supabase app_settings ` +
    `(Batch limit: ${batchLimit} jobs, Delay: ${delayMs / 1000}s, Strategy: ${searchMode === "dream_hunter" ? "Dream Hunter" : "Get Hired Fast"}).`
  );

  // 2. Fetch base resume
  let baseResume: Resume | null = null;
  const { data: dbResume } = await supabase
    .from("base_resume")
    .select("resume_data")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dbResume?.resume_data) {
    baseResume = dbResume.resume_data as Resume;
    console.log("✓ Loaded base resume from Supabase database.");
  } else {
    const localCandidates = [
      path.resolve(process.cwd(), "resume.json"),
      path.resolve(process.cwd(), "..", "resume.json"),
    ];

    for (const cand of localCandidates) {
      if (fs.existsSync(cand)) {
        baseResume = JSON.parse(fs.readFileSync(cand, "utf-8"));
        console.log(`✓ Loaded base resume from local file: ${cand}`);
        break;
      }
    }
  }

  if (!baseResume) {
    const errorMsg = "No base resume found in Supabase or locally. Please parse a resume first.";
    console.error(`ERROR: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const baseResumeText = formatResumeToText(baseResume);

  // 3. Fetch jobs to score
  let query = supabase
    .from("jobs")
    .select("job_id, job_title, company, description, level, location, salary_min, salary_max, salary_currency, salary_period")
    .eq("is_active", true);

  if (cli.jobId) {
    query = query.eq("job_id", cli.jobId);
  } else if (!cli.rescore) {
    // ALWAYS score only pending unscored jobs unless explicit --rescore flag is passed
    query = query.is("resume_score", null);
  }

  query = query.order("scraped_at", { ascending: false }).limit(batchLimit);

  const { data: jobsToScore, error: fetchError } = await query;

  if (fetchError) {
    console.error("Error fetching jobs to score:", fetchError);
    throw fetchError;
  }

  if (!jobsToScore || jobsToScore.length === 0) {
    console.log("No jobs require scoring at this time.");
    ctx?.setMetrics({ jobs_evaluated: 0, successful_scores: 0, failed_scores: 0, model: activeModel });
    ctx?.setSummary("No jobs require scoring at this time.");
    return;
  }

  console.log(`Found ${jobsToScore.length} job(s) to process.`);
  let successfulScores = 0;
  let failedScores = 0;

  for (let i = 0; i < jobsToScore.length; i++) {
    const job = jobsToScore[i];
    console.log(`[${i + 1}/${jobsToScore.length}] Scoring: "${job.job_title}" at "${job.company}" (${job.job_id})`);

    try {
      let companyIntel = null;
      if (job.company) {
        try {
          companyIntel = await getCompanyIntelligence(
            job.company,
            job.location || "Singapore",
            supabase,
            Boolean(cli.force || cli.rescore)
          );
        } catch (intelErr: any) {
          console.warn(`  ⚠ Could not fetch company intel for ${job.company}:`, intelErr.message);
        }
      }

      const evalResult = await evaluateJobFit(
        baseResumeText,
        {
          job_id: job.job_id,
          job_title: job.job_title,
          company: job.company,
          level: job.level,
          description: job.description,
          salary_min: job.salary_min,
          salary_max: job.salary_max,
          salary_currency: job.salary_currency,
          salary_period: job.salary_period,
        },
        dbSettings.dream_job_profile,
        searchMode,
        companyIntel
      );

      if (evalResult !== null) {
        if (!cli.dryRun) {
          const { error: updateError } = await supabase
            .from("jobs")
            .update({
              resume_score: evalResult.resume_score,
              dream_score: evalResult.dream_score,
              total_score: evalResult.total_score,
              score_breakdown: evalResult.score_breakdown,
              resume_score_stage: "initial",
            })
            .eq("job_id", job.job_id);

          if (updateError) {
            console.error(`Failed to update score in Supabase for ${job.job_id}:`, updateError.message);
            failedScores++;
          } else {
            const scoreLabel = evalResult.dream_score !== null
              ? `ATS: ${evalResult.resume_score} | Dream: ${evalResult.dream_score}`
              : `ATS: ${evalResult.resume_score} | Fast Hire`;
            console.log(`  ✓ Overall: ${evalResult.total_score}/100 (${scoreLabel}) saved.`);
            successfulScores++;
          }
        } else {
          const scoreLabel = evalResult.dream_score !== null
            ? `ATS: ${evalResult.resume_score} | Dream: ${evalResult.dream_score}`
            : `ATS: ${evalResult.resume_score} | Fast Hire`;
          console.log(`  [Dry-Run] Evaluated: Overall: ${evalResult.total_score}/100 (${scoreLabel}).`);
          successfulScores++;
        }
      } else {
        console.warn(`  ⚠ Could not determine score for job ${job.job_id}`);
        failedScores++;
      }
    } catch (err: any) {
      console.error(`  ✗ Error scoring job ${job.job_id}:`, err.message);
      failedScores++;
    }

    if (i < jobsToScore.length - 1) {
      await sleep(delayMs);
    }
  }

  console.log("=== Job Scoring Finished ===");
  console.log(`Successfully scored: ${successfulScores}`);
  console.log(`Failed / Skipped: ${failedScores}`);

  if (ctx) {
    ctx.setMetrics({
      jobs_evaluated: jobsToScore.length,
      successful_scores: successfulScores,
      failed_scores: failedScores,
      model: activeModel,
      dry_run: Boolean(cli.dryRun),
    });
    ctx.setSummary(
      cli.dryRun
        ? `[Dry-Run] Evaluated ${jobsToScore.length} jobs with ${activeModel}.`
        : `Evaluated ${jobsToScore.length} jobs with ${activeModel}: ${successfulScores} scored successfully, ${failedScores} failed/skipped.`
    );
  }
}

async function main() {
  await withTelemetry(
    {
      workflowName: "AI Job Scorer",
      workflowId: "score_jobs",
    },
    async (ctx) => {
      await runJobScorer(ctx);
    }
  );
}

main().catch((err) => {
  console.error("Fatal error during scoring:", err);
  process.exit(1);
});
