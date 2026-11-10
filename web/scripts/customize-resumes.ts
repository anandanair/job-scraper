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
import { withTelemetry, TelemetryContext } from "../src/lib/telemetry";

const MIN_SCORE_THRESHOLD = 60;
const MIN_DREAM_THRESHOLD = 60;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CustomizeCliArgs {
  limit?: number;
  jobId?: string;
  force?: boolean;
  dryRun?: boolean;
}

function parseCustomizeCliArgs(): CustomizeCliArgs {
  const args = process.argv.slice(2);
  const result: CustomizeCliArgs = {};

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
    } else if (arg.startsWith("--job-id=")) {
      result.jobId = arg.slice("--job-id=".length);
    } else if (arg === "--job-id" && args[i + 1]) {
      result.jobId = args[++i];
    }
  }
  return result;
}

async function runResumeCustomizer(ctx?: TelemetryContext) {
  console.log("=== Starting Scheduled Resume Customizer (TypeScript) ===");
  const cli = parseCustomizeCliArgs();
  console.log(`[CLI] Options: limit=${cli.limit ?? "default"}, force=${Boolean(cli.force)}, dryRun=${Boolean(cli.dryRun)}, jobId=${cli.jobId ?? "none"}`);

  const supabase = createSupabaseStaticClient();

  // 1. Load dynamic AI configuration from Supabase app_settings (Single Source of Truth)
  const { data: dbSettings } = await supabase
    .from("app_settings")
    .select("llm_api_key, llm_model, llm_provider, llm_tier, jobs_to_customize_per_run, llm_request_delay_seconds, job_search_mode")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!dbSettings?.llm_api_key) {
    const errorMsg = "LLM API key not configured in Supabase 'app_settings'. Please configure your AI provider and API key in Settings.";
    console.error(`✗ Error: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const batchLimit = cli.limit || dbSettings.jobs_to_customize_per_run || 2;
  const delayMs = (dbSettings.llm_request_delay_seconds ?? 8) * 1000;
  const activeModel = dbSettings.llm_model || "gemini-3.8-flash";
  const searchMode = (dbSettings.job_search_mode as "get_hired_fast" | "dream_hunter") || "get_hired_fast";
  const isDreamMode = searchMode === "dream_hunter";

  console.log(
    `✓ Using AI Model: "${activeModel}" from Supabase app_settings ` +
    `(Batch limit: ${batchLimit} resumes, Delay: ${delayMs / 1000}s, Strategy: ${isDreamMode ? "Dream Hunter" : "Get Hired Fast"}).`
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

  // 2. Fetch active resume style for theme snapshotting
  const activeStyle = await getActiveResumeStyle();

  // 3. Query top scored jobs lacking customized resumes
  let query = supabase
    .from("jobs")
    .select("job_id, job_title, company, description, level, resume_score, dream_score, total_score, status, is_interested")
    .eq("is_active", true);

  if (cli.jobId) {
    query = query.eq("job_id", cli.jobId);
  } else {
    query = query.is("customized_resume_id", null);

    if (!cli.force) {
      query = query
        .gte("resume_score", MIN_SCORE_THRESHOLD)
        .or("is_interested.is.null,is_interested.eq.true");

      if (isDreamMode) {
        query = query.or(`dream_score.is.null,dream_score.gte.${MIN_DREAM_THRESHOLD}`);
      }
    }

    query = query
      .order("is_interested", { ascending: false, nullsFirst: false })
      .order("total_score", { ascending: false, nullsFirst: false })
      .order("resume_score", { ascending: false });
  }

  query = query.limit(batchLimit);

  const { data: candidateJobs, error: fetchError } = await query;

  if (fetchError) {
    console.error("Error fetching jobs for resume customization:", fetchError);
    throw fetchError;
  }

  if (!candidateJobs || candidateJobs.length === 0) {
    console.log("No jobs found needing customized resumes at this time.");
    ctx?.setMetrics({ candidates_found: 0, resumes_tailored: 0, failed_count: 0, model: activeModel });
    ctx?.setSummary("No jobs found needing customized resumes at this time.");
    return;
  }

  console.log(`Found ${candidateJobs.length} eligible job(s) to customize.`);
  let tailoredCount = 0;
  let failedCount = 0;

  for (let i = 0; i < candidateJobs.length; i++) {
    const job = candidateJobs[i];

    if (!cli.force) {
      // Explicit guard: Completely exclude any job marked as Not Interested
      if (job.is_interested === false) {
        console.log(`[${i + 1}/${candidateJobs.length}] Skipping job "${job.job_title}" (${job.job_id}) - marked as Not Interested.`);
        continue;
      }

      // Explicit Dream Gate guard: only enforce if in Dream Hunter mode
      if (isDreamMode && job.dream_score !== null && job.dream_score !== undefined && job.dream_score < MIN_DREAM_THRESHOLD) {
        console.log(`[${i + 1}/${candidateJobs.length}] Skipping job "${job.job_title}" (${job.job_id}) - Dream Match ${job.dream_score}% is below ${MIN_DREAM_THRESHOLD}%.`);
        continue;
      }
    }

    const overallScore = job.total_score ?? job.resume_score;
    console.log(`[${i + 1}/${candidateJobs.length}] Customizing resume for: "${job.job_title}" at "${job.company}" (${job.job_id}) [Match: ${overallScore}% | ATS: ${job.resume_score}% | Dream: ${job.dream_score ?? "N/A"}%]`);

    try {
      // Step A: Tailor resume content using AI multi-stage pipeline
      console.log("  Tailoring resume content with Multi-Stage AI Pipeline (Strategist + Copywriter)...");
      const customizedData = await customizeResumeWithLLM(baseResume, {
        job_title: job.job_title,
        company: job.company,
        level: job.level,
        description: job.description,
      });

      if (!cli.dryRun) {
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
          console.error("  ✗ Failed to save customized resume to Supabase:", insertError.message);
          failedCount++;
          continue;
        }

        // Step C: Update jobs table with customized_resume_id and mark status tailored
        const newStatus = job.status === "new" ? "tailored" : job.status;
        const { error: jobUpdateError } = await supabase
          .from("jobs")
          .update({
            customized_resume_id: customizedResumeId,
            status: newStatus,
          })
          .eq("job_id", job.job_id);

        if (jobUpdateError) {
          console.warn("  ⚠ Failed to link customized_resume_id to job:", jobUpdateError.message);
        } else {
          console.log(`  ✓ Linked customized resume to job ${job.job_id} (Status -> ${newStatus}).`);
        }

        // Step D: Re-score job with customized resume
        try {
          console.log("  Re-scoring job against tailored resume variant...");
          const tailoredResumeObj: Resume = {
            ...baseResume,
            ...customizedData,
          };
          const tailoredText = formatResumeToText(tailoredResumeObj);
          const newScore = await scoreJobWithResume(tailoredText, job.description || "");

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
      } else {
        console.log(`  [Dry-Run] Tailored summary length: ${customizedData.summary?.length || 0} chars, Matched skills: ${customizedData.skills?.length || 0}`);
      }

      tailoredCount++;
    } catch (err: any) {
      console.error(`  ✗ Failed to process job ${job.job_id}:`, err.message);
      failedCount++;
    }

    if (i < candidateJobs.length - 1) {
      await sleep(delayMs);
    }
  }

  console.log("=== Resume Customization Cycle Completed ===");
  console.log(`Successfully tailored: ${tailoredCount} | Failed: ${failedCount}`);

  if (ctx) {
    ctx.setMetrics({
      candidates_found: candidateJobs.length,
      resumes_tailored: tailoredCount,
      failed_count: failedCount,
      model: activeModel,
      dry_run: Boolean(cli.dryRun),
    });
    ctx.setSummary(
      cli.dryRun
        ? `[Dry-Run] Tailored ${tailoredCount} of ${candidateJobs.length} eligible job resume(s) (Model: ${activeModel}).`
        : `Tailored ${tailoredCount} of ${candidateJobs.length} eligible job resume(s) (Model: ${activeModel}).`
    );
  }
}

async function main() {
  await withTelemetry(
    {
      workflowName: "ATS Resume Tailor",
      workflowId: "customize_resumes",
    },
    async (ctx) => {
      await runResumeCustomizer(ctx);
    }
  );
}

main().catch((err) => {
  console.error("Fatal error during resume customization:", err);
  process.exit(1);
});
