import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// 1. Load env files
const webEnv = path.resolve(process.cwd(), ".env.local");
const rootEnv = path.resolve(process.cwd(), "..", ".env");
if (fs.existsSync(webEnv)) dotenv.config({ path: webEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });

import { createSupabaseStaticClient } from "../src/utils/supabase/server";
import { formatResumeToText, scoreJobWithResume } from "../src/lib/llm";
import { Resume } from "../src/types";

const BATCH_LIMIT = 10;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("=== Starting Scheduled Job Scorer (TypeScript) ===");
  const supabase = createSupabaseStaticClient();

  // 1. Load dynamic AI configuration from Supabase app_settings (Single Source of Truth)
  const { data: dbSettings } = await supabase
    .from("app_settings")
    .select("llm_api_key, llm_model, llm_provider, llm_tier, jobs_to_score_per_run, llm_request_delay_seconds")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!dbSettings?.llm_api_key) {
    console.error("✗ Error: LLM API key not configured in Supabase 'app_settings'.");
    console.error("  Please configure your AI provider and API key in Settings or complete the Setup Wizard.");
    process.exit(1);
  }

  const batchLimit = dbSettings.jobs_to_score_per_run || BATCH_LIMIT;
  const delayMs = (dbSettings.llm_request_delay_seconds ?? 8) * 1000;

  console.log(
    `✓ Using AI Model: "${dbSettings.llm_model || "gemini-3.8-flash"}" from Supabase app_settings ` +
    `(Batch limit: ${batchLimit} jobs, Delay: ${delayMs / 1000}s).`
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
    console.error("ERROR: No base resume found in Supabase or locally. Please parse a resume first.");
    process.exit(1);
  }

  const baseResumeText = formatResumeToText(baseResume);

  // 2. Fetch unscored jobs
  const { data: jobsToScore, error: fetchError } = await supabase
    .from("jobs")
    .select("job_id, job_title, company, description, level")
    .is("resume_score", null)
    .eq("is_active", true)
    .order("scraped_at", { ascending: true })
    .limit(batchLimit);

  if (fetchError) {
    console.error("Error fetching jobs to score:", fetchError);
    process.exit(1);
  }

  if (!jobsToScore || jobsToScore.length === 0) {
    console.log("No jobs require initial scoring at this time.");
    return;
  }

  console.log(`Found ${jobsToScore.length} unscored jobs to process.`);
  let successfulScores = 0;
  let failedScores = 0;

  for (let i = 0; i < jobsToScore.length; i++) {
    const job = jobsToScore[i];
    console.log(`[${i + 1}/${jobsToScore.length}] Scoring: "${job.job_title}" at "${job.company}" (${job.job_id})`);

    try {
      const score = await scoreJobWithResume(baseResumeText, {
        job_id: job.job_id,
        job_title: job.job_title,
        company: job.company,
        level: job.level,
        description: job.description,
      });

      if (score !== null) {
        const { error: updateError } = await supabase
          .from("jobs")
          .update({
            resume_score: score,
            resume_score_stage: "initial",
          })
          .eq("job_id", job.job_id);

        if (updateError) {
          console.error(`Failed to update score in Supabase for ${job.job_id}:`, updateError.message);
          failedScores++;
        } else {
          console.log(`  ✓ Score: ${score}/100 saved.`);
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
}

main().catch((err) => {
  console.error("Fatal error during scoring:", err);
  process.exit(1);
});
