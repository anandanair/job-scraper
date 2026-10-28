import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// 1. Load env files
const webEnv = path.resolve(process.cwd(), ".env.local");
const rootEnv = path.resolve(process.cwd(), "..", ".env");
if (fs.existsSync(webEnv)) dotenv.config({ path: webEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });

import { parseResumePdf } from "../src/lib/resumeParser";
import { upsertBaseResume } from "../src/lib/supabase/queries";
import { createSupabaseStaticClient } from "../src/utils/supabase/server";

async function main() {
  console.log("=== Starting Resume Parsing (TypeScript) ===");

  const supabase = createSupabaseStaticClient();
  let pdfBuffer: Buffer | null = null;

  // 1. Try to download resume.pdf from Supabase Storage
  console.log("Checking Supabase Storage bucket 'resumes' for resume.pdf...");
  const { data, error } = await supabase.storage.from("resumes").download("resume.pdf");

  if (!error && data) {
    console.log("✓ Successfully downloaded resume.pdf from Supabase Storage.");
    pdfBuffer = Buffer.from(await data.arrayBuffer());
  } else {
    // 2. Fallback to local resume.pdf
    const localCandidates = [
      path.resolve(process.cwd(), "resume.pdf"),
      path.resolve(process.cwd(), "..", "resume.pdf"),
      path.resolve(process.cwd(), "..", "backend", "resume.pdf"),
    ];
    for (const cand of localCandidates) {
      if (fs.existsSync(cand)) {
        console.log(`Found local resume file at: ${cand}`);
        pdfBuffer = fs.readFileSync(cand);
        break;
      }
    }
  }

  if (!pdfBuffer) {
    console.error("ERROR: Could not find resume.pdf in Supabase Storage or locally.");
    console.error("Please upload your resume in the web Setup Wizard or Supabase Storage dashboard.");
    process.exit(1);
  }

  // 3. Parse with AI
  console.log("Extracting text, links, and parsing structured data with AI...");
  const parsed = await parseResumePdf(pdfBuffer);

  console.log(`✓ Extraction complete!`);
  console.log(`  Candidate: ${parsed.name}`);
  console.log(`  Email: ${parsed.email}`);
  console.log(`  Skills: ${parsed.skills?.length || 0} extracted`);
  console.log(`  Experience: ${parsed.experience?.length || 0} roles extracted`);
  console.log(`  Projects: ${parsed.projects?.length || 0} projects extracted`);

  // 4. Upsert to Supabase base_resume table
  console.log("Saving structured resume to Supabase 'base_resume' table...");
  await upsertBaseResume(parsed);
  console.log("✓ Successfully saved parsed resume to Supabase database.");

  // 5. Also save a local JSON copy (for fallback/inspection)
  const jsonPath = path.resolve(process.cwd(), "..", "resume.json");
  fs.writeFileSync(jsonPath, JSON.stringify(parsed, null, 2), "utf-8");
  console.log(`✓ Saved copy to: ${jsonPath}`);

  console.log("=== Resume processing finished successfully! ===");
}

main().catch((err) => {
  console.error("Fatal error parsing resume:", err);
  process.exit(1);
});
