import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// 1. Load env files
const webEnv = path.resolve(process.cwd(), ".env.local");
const rootEnv = path.resolve(process.cwd(), "..", ".env");
if (fs.existsSync(webEnv)) dotenv.config({ path: webEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });

import { createSupabaseStaticClient } from "../src/utils/supabase/server";
import { customizeResumeWithLLM, formatResumeToText, scoreJobWithResume } from "../src/lib/llm";
import { buildPdfBuffer } from "../src/lib/pdf";
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

  // 2. Fetch active resume style
  const activeStyle = await getActiveResumeStyle();

  // 3. Query top scored jobs lacking customized resumes
  const { data: candidateJobs, error: fetchError } = await supabase
    .from("jobs")
    .select("job_id, job_title, company, description, level, resume_score")
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
      // Step A: Tailor resume content using AI
      console.log("  Tailoring resume content with AI...");
      const customizedData = await customizeResumeWithLLM(baseResume, {
        job_title: job.job_title,
        company: job.company,
        level: job.level,
        description: job.description,
      });

      // Step B: Build PDF buffer using active style
      console.log("  Rendering PDF buffer via PDFKit...");
      const pdfBuffer = await buildPdfBuffer(customizedData, activeStyle);

      // Step C: Upload PDF to Supabase Storage
      const destinationPath = `resume_${job.job_id}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("personalized_resumes")
        .upload(destinationPath, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        console.error(`  ✗ Storage upload error for ${job.job_id}:`, uploadError.message);
        continue;
      }

      // Step D: Insert into customized_resumes table
      const dataToInsert = {
        ...customizedData,
        resume_link: destinationPath,
      };

      const { data: insertedResume, error: insertError } = await supabase
        .from("customized_resumes")
        .insert(dataToInsert)
        .select("id")
        .single();

      if (insertError || !insertedResume) {
        console.error(`  ✗ Failed to save customized resume in DB for ${job.job_id}:`, insertError?.message);
        continue;
      }

      const customizedResumeId = insertedResume.id;

      // Step E: Update job record
      await supabase
        .from("jobs")
        .update({
          customized_resume_id: customizedResumeId,
          resume_link: destinationPath,
          status: "resume_generated",
        })
        .eq("job_id", job.job_id);

      console.log(`  ✓ Customized resume PDF saved and linked to job ${job.job_id}.`);

      // Step F: Re-score job with newly customized resume
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
          await supabase
            .from("jobs")
            .update({
              resume_score: newScore,
              resume_score_stage: "custom",
            })
            .eq("job_id", job.job_id);
          console.log(`  ✓ Re-scored with customized resume: ${job.resume_score} -> ${newScore}/100`);
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
