import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const webEnv = path.resolve(process.cwd(), ".env.local");
const rootEnv = path.resolve(process.cwd(), "..", ".env");
if (fs.existsSync(webEnv)) dotenv.config({ path: webEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });

import { createSupabaseStaticClient } from "../src/utils/supabase/server";
import {
  convertHtmlToMarkdown,
  processCareersFutureQuery,
  processLinkedInQuery,
  DEFAULT_CAREERS_FUTURE_CONFIG,
  DEFAULT_LINKEDIN_CONFIG,
} from "../src/lib/scraper";

async function runDiagnostics() {
  console.log("================================================================");
  console.log("          JobTrack Scraper Diagnostics & Parity Suite           ");
  console.log("================================================================\n");

  // Test 1: HTML-to-Markdown Verification
  console.log("▶ [Test 1] Testing HTML to Markdown fidelity...");
  const sampleHtml = `
    <div class="description">
      <h1>Frontend Engineer</h1>
      <p>We are looking for a <strong>Senior React Developer</strong> with:</p>
      <ul>
        <li>5+ years of TypeScript experience</li>
        <li>Deep understanding of Next.js</li>
      </ul>
      <script>console.log("bad script");</script>
      <style>.bad { color: red; }</style>
    </div>
  `;
  const markdown = convertHtmlToMarkdown(sampleHtml);
  console.log("Output Markdown preview:\n---\n" + markdown + "\n---");

  if (
    markdown.includes("bad script") ||
    markdown.includes(".bad") ||
    !markdown.includes("Senior React Developer") ||
    !markdown.includes("- 5+ years")
  ) {
    console.error("✗ Test 1 FAILED: Markdown conversion contains unwanted artifacts or missing content.");
  } else {
    console.log("✓ Test 1 PASSED: Clean Markdown produced, script/style stripped.\n");
  }

  // Parse command line arguments for optional live API test
  const args = process.argv.slice(2);
  const sourceArg = args.find((_, i) => args[i - 1] === "--source");
  const queryArg = args.find((_, i) => args[i - 1] === "--query") || "Software Engineer";
  const limitArg = parseInt(args.find((_, i) => args[i - 1] === "--limit") || "1", 10);

  const supabase = createSupabaseStaticClient();

  // Test 2: CareersFuture
  if (!sourceArg || sourceArg === "all" || sourceArg === "careers_future") {
    console.log(`▶ [Test 2] Testing CareersFuture Live Query (Query: "${queryArg}", Limit: ${limitArg})...`);
    try {
      const cfJobs = await processCareersFutureQuery(
        queryArg,
        supabase,
        DEFAULT_CAREERS_FUTURE_CONFIG,
        limitArg
      );
      console.log(`✓ Test 2 Completed: Fetched ${cfJobs.length} job(s) from CareersFuture.`);
      if (cfJobs.length > 0) {
        const job = cfJobs[0];
        console.log(`  Sample Job ID: ${job.job_id}`);
        console.log(`  Title: ${job.job_title}`);
        console.log(`  Company: ${job.company}`);
        console.log(`  Level: ${job.level}`);
        console.log(`  Description snippet: ${job.description?.slice(0, 150)}...`);
      }
    } catch (err) {
      console.error("✗ Test 2 Encountered error:", err);
    }
    console.log("");
  }

  // Test 3: LinkedIn
  if (!sourceArg || sourceArg === "all" || sourceArg === "linkedin") {
    console.log(`▶ [Test 3] Testing LinkedIn Guest Query (Query: "${queryArg}", Limit: ${limitArg})...`);
    try {
      const linkedInConfig = {
        ...DEFAULT_LINKEDIN_CONFIG,
        detailFetchMinDelay: 2.0, // Reduced for diagnostic testing
        detailFetchMaxDelay: 4.0,
      };

      const liJobs = await processLinkedInQuery(
        queryArg,
        "Singapore",
        supabase,
        linkedInConfig,
        limitArg
      );
      console.log(`✓ Test 3 Completed: Fetched ${liJobs.length} job(s) from LinkedIn.`);
      if (liJobs.length > 0) {
        const job = liJobs[0];
        console.log(`  Sample Job ID: ${job.job_id}`);
        console.log(`  Title: ${job.job_title}`);
        console.log(`  Company: ${job.company}`);
        console.log(`  Level: ${job.level}`);
        console.log(`  Description snippet: ${job.description?.slice(0, 150)}...`);
      }
    } catch (err) {
      console.error("✗ Test 3 Encountered error:", err);
    }
    console.log("");
  }

  console.log("================================================================");
  console.log("Diagnostics finished.");
  console.log("================================================================\n");
}

runDiagnostics().catch(console.error);
