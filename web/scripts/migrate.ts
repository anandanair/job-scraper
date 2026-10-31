import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// 1. Load env files
const webEnv = path.resolve(process.cwd(), ".env.local");
const rootEnv = path.resolve(process.cwd(), "..", ".env");
if (fs.existsSync(webEnv)) dotenv.config({ path: webEnv });
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });

import { createSupabaseStaticClient, isSupabaseConfigured } from "../src/utils/supabase/server";
import { runPendingMigrations } from "../src/lib/setup/runMigrations";

/**
 * Applies pending database migrations.
 *
 * Run by every automation workflow before it touches the database, so cloud-only
 * users (who never launch the app locally) still receive schema updates.
 *
 * Exits non-zero when migrations remain outstanding, which fails the workflow
 * loudly instead of letting the scraper run against a stale schema.
 */
async function main() {
  console.log("=== JobTrack: Database Migration Check ===");

  if (!isSupabaseConfigured()) {
    console.error("[ERROR] Supabase credentials are missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createSupabaseStaticClient();
  const result = await runPendingMigrations(supabase, true);

  if (result.appliedCount > 0) {
    console.log(`[OK] Applied ${result.appliedCount} migration(s).`);
  }

  if (result.ok) {
    console.log("[OK] Database schema is up to date.");
    return;
  }

  console.error(`[ERROR] ${result.remaining} migration(s) still pending.`);
  if (result.reason) console.error(`        ${result.reason}`);
  process.exit(1);
}

main().catch((error) => {
  console.error("[ERROR] Migration check failed:", error?.message || error);
  process.exit(1);
});
