import fs from "fs";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";

// 1. Load env files
const webEnv = path.resolve(process.cwd(), ".env.local");
const rootEnv = path.resolve(process.cwd(), "..", ".env");
if (fs.existsSync(webEnv)) dotenv.config({ path: webEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });

import { createSupabaseStaticClient } from "../src/utils/supabase/server";
import { customizeResumeWithLLM, formatResumeToText, scoreJobWithResume } from "../src/lib/llm";
import { getActiveResumeStyle } from "../src/lib/supabase/queries";
import { Resume } from "../src/types";

const MIN_SCORE_THRESHOLD = 60;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("=== Starting Scheduled Resume Customizer (TypeScript) ===");
  const supabase = createSupabaseStaticClient();

  // 1. Load dynamic AI configuration from Supabase app_settings (Single Source of Truth)
  const { data: dbSettings } = await supabase
    .from("app_settings")
    .select("llm_api_key, llm_model, llm_provider, llm_tier, jobs_to_customize_per_run, llm_request_delay_seconds")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!dbSettings?.llm_api_key) {
    console.error("✗ Error: LLM API key not configured in Supabase 'app_settings'.");
    console.error("  Please configure your AI provider and API key in Settings or complete the Setup Wizard.");
    process.exit(1);
  }

  const batchLimit = dbSettings.jobs_to_customize_per_run || 2;
  const delayMs = (dbSettings.llm_request_delay_seconds ?? 8) * 1000;

  console.log(
    `✓ Using AI Model: "${dbSettings.llm_model || "gemini-3.8-flash"}" from Supabase app_settings ` +
    `(Batch limit: ${batchLimit} resumes, Delay: ${delayMs / 1000}s).`
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

  // 2. Fetch active resume style for theme snapshotting
  const activeStyle = await getActiveResumeStyle();

  // 3. Query top scored jobs lacking customized resumes
  const { data: candidateJobs, error: fetchError } = await supabase
    .from("jobs")
    .select("job_id, job_title, company, description, level, resume_score, status")
    .eq("is_active", true)
    .is("customized_resume_id", null)
    .gte("resume_score", MIN_SCORE_THRESHOLD)
    .order("resume_score", { ascending: false })
    .limit(batchLimit);

  if (fetchError) {
    console.error("Error fetching jobs for resume customization:", fetchError);
    process.exit(1);
  }

  if (!candidateJobs || candidateJobs.length === 0) {
    console.log("No high-matching jobs found needing customized resumes at this time.");
    return;
  }

  console.log(`Found ${candidateJobs.length} eligible jobs (score >= ${MIN_SCORE_THRESHOLD}) to customize.`);

  for (let i = 0; i < candidateJobs.length; i++) {
    const job = candidateJobs[i];
    console.log(`[${i + 1}/${candidateJobs.length}] Customizing resume for: "${job.job_title}" at "${job.company}" (${job.job_id})`);

    try {
      // Step A: Tailor resume content using AI multi-stage pipeline
      console.log("  Tailoring resume content with Multi-Stage AI Pipeline (Strategist + Copywriter)...");
      const customizedData = await customizeResumeWithLLM(baseResume, {
        job_title: job.job_title,
        company: job.company,
        level: job.level,
        description: job.description,
      });

      // Step B: Insert into customized_resumes table (Single Source of Truth with Theme Snapshot)
      const customizedResumeId = crypto.randomUUID();
      const resumeStreamingUrl = `/api/customized_resumes/${customizedResumeId}/pdf`;

      const dataToInsert = {
        id: customizedResumeId,
        ...customizedData,
        resume_link: resumeStreamingUrl,
        theme_config: activeStyle,
      };

      const { error: insertError } = await supabase
        .from("customized_resumes")
        .insert(dataToInsert);

      if (insertError) {
        console.error(`  ✗ Failed to save customized resume in DB for ${job.job_id}:`, insertError.message);
        continue;
      }

      // Step C: Update job record with foreign key
      const jobUpdates: Record<string, any> = {
        customized_resume_id: customizedResumeId,
      };

      const { error: jobUpdateError } = await supabase
        .from("jobs")
        .update(jobUpdates)
        .eq("job_id", job.job_id);

      if (jobUpdateError) {
        console.error(`  ✗ Failed to link customized resume to job ${job.job_id}:`, jobUpdateError.message);
        continue;
      }

      console.log(`  ✓ Customized resume saved and linked to job ${job.job_id} (ID: ${customizedResumeId}).`);

      // Step D: Stage 3: Re-score job with newly customized resume (The Evaluator)
      console.log("  Stage 3/3: Re-scoring job fit with customized resume (The Evaluator)...");
      try {
        const tailoredText = formatResumeToText(customizedData);
        const newScore = await scoreJobWithResume(tailoredText, {
          job_id: job.job_id,
          job_title: job.job_title,
          company: job.company,
          level: job.level,
          description: job.description,
        });

        if (newScore !== null) {
          const { error: scoreUpdateError } = await supabase
            .from("jobs")
            .update({
              resume_score: newScore,
              resume_score_stage: "custom",
            })
            .eq("job_id", job.job_id);

          if (scoreUpdateError) {
            console.warn("  ⚠ Failed to update re-score on job:", scoreUpdateError.message);
          } else {
            console.log(`  ✓ Re-scored with customized resume: ${job.resume_score} -> ${newScore}/100`);
          }
        }
      } catch (scoreErr: any) {
        console.warn("  ⚠ Re-scoring notice:", scoreErr.message);
      }
    } catch (err: any) {
      console.error(`  ✗ Failed to process job ${job.job_id}:`, err.message);
    }

    if (i < candidateJobs.length - 1) {
      await sleep(delayMs);
    }
  }

  console.log("=== Resume Customization Cycle Completed ===");
}

main().catch((err) => {
  console.error("Fatal error during resume customization:", err);
  process.exit(1);
});
