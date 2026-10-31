import type { SupabaseClient } from "@supabase/supabase-js";
import { getMigrationStatus, tryAutoApplyMigrations } from "./migrations";

export interface MigrationRunResult {
  /** True when the database is fully migrated after this run. */
  ok: boolean;
  /** Number of migrations applied during this run. */
  appliedCount: number;
  /** Migrations still outstanding after this run. */
  remaining: number;
  /** Human-readable reason when ok is false. */
  reason?: string;
}

/**
 * Brings a database up to date, applying every pending migration it can.
 *
 * Safe to call repeatedly and concurrently: each migration is applied inside
 * exec_migration(), which takes an advisory lock and records the version, so a
 * second caller is a no-op rather than a duplicate DDL run.
 *
 * Shared by the Next.js startup hook and the GitHub Actions workflows so both
 * paths converge on identical behaviour.
 */
export async function runPendingMigrations(
  supabase: SupabaseClient,
  isConfigured: boolean
): Promise<MigrationRunResult> {
  const status = await getMigrationStatus(supabase, isConfigured);

  if (status.state === "not_configured") {
    return { ok: false, appliedCount: 0, remaining: 0, reason: "Supabase is not configured." };
  }

  if (status.state === "unreachable") {
    return {
      ok: false,
      appliedCount: 0,
      remaining: 0,
      reason: status.error || "Could not reach the Supabase project.",
    };
  }

  if (status.state === "up_to_date") {
    return { ok: true, appliedCount: 0, remaining: 0 };
  }

  if (!status.boosterAvailable) {
    return {
      ok: false,
      appliedCount: 0,
      remaining: status.pending.length,
      reason:
        "The exec_migration booster is not installed. Apply the pending SQL from the JobTrack dashboard banner once to enable automatic migrations.",
    };
  }

  const result = await tryAutoApplyMigrations(supabase, status.pending);
  const after = await getMigrationStatus(supabase, true);

  return {
    ok: after.state === "up_to_date",
    appliedCount: result.appliedCount,
    remaining: after.pending.length,
    reason: result.error,
  };
}
