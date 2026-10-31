import type { SupabaseClient } from "@supabase/supabase-js";

export interface Migration {
  id: string;
  title: string;
  description: string;
  sql: string;
}

export const ALL_MIGRATIONS: Migration[] = [
  {
    id: "20261029_01_migration_booster_and_interest_filter",
    title: "Automated Migration Booster & Interest Filter",
    description:
      "Installs the exec_migration booster RPC for future zero-touch updates and updates query functions to strictly exclude jobs marked as Not Interested.",
    sql: `-- 1. Create schema_migrations table
CREATE TABLE IF NOT EXISTS "public"."schema_migrations" (
    "version" text PRIMARY KEY,
    "applied_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE "public"."schema_migrations" OWNER TO "postgres";
ALTER TABLE "public"."schema_migrations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."schema_migrations" FROM PUBLIC, "anon", "authenticated";
GRANT ALL ON TABLE "public"."schema_migrations" TO "service_role";

-- 2. Create exec_migration booster RPC (enables automated migrations via service_role)
DROP FUNCTION IF EXISTS "public"."exec_migration"("sql_query" text);

CREATE OR REPLACE FUNCTION "public"."exec_migration"("p_version" text, "sql_query" text) RETURNS void
    LANGUAGE "plpgsql"
    SECURITY DEFINER
    SET search_path = public, pg_catalog, pg_temp
    AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('jobtrack_schema_migrations'));

    IF EXISTS (SELECT 1 FROM public.schema_migrations WHERE version = p_version) THEN
        RETURN;
    END IF;

    EXECUTE sql_query;

    INSERT INTO public.schema_migrations (version) VALUES (p_version)
    ON CONFLICT (version) DO NOTHING;
END;
$$;

ALTER FUNCTION "public"."exec_migration"("p_version" text, "sql_query" text) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."exec_migration"("p_version" text, "sql_query" text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."exec_migration"("p_version" text, "sql_query" text) TO service_role;

-- Read-only probe so the app can detect the booster without executing DDL.
CREATE OR REPLACE FUNCTION "public"."has_migration_booster"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SECURITY DEFINER
    SET search_path = public, pg_catalog, pg_temp
    AS $$
    SELECT to_regprocedure('public.exec_migration(text, text)') IS NOT NULL;
$$;

ALTER FUNCTION "public"."has_migration_booster"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."has_migration_booster"() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."has_migration_booster"() TO service_role;

-- 3. Ensure is_interested column exists on jobs
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "is_interested" boolean;

-- 4. Update get_jobs_for_resume_generation_custom_sort to strictly exclude uninterested jobs
CREATE OR REPLACE FUNCTION "public"."get_jobs_for_resume_generation_custom_sort"("p_page_number" integer, "p_page_size" integer) RETURNS TABLE("job_id" "text", "company" "text", "job_title" "text", "level" "text", "location" "text", "description" "text", "status" "text", "is_active" boolean, "application_date" timestamp with time zone, "resume_score" smallint, "notes" "text", "scraped_at" timestamp with time zone, "last_checked" timestamp with time zone, "job_state" "text", "resume_score_stage" "text", "is_interested" boolean, "customized_resume_id" "uuid", "provider" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        j.job_id,
        j.company,
        j.job_title,
        j.level,
        j.location,
        j.description,
        j.status,
        j.is_active,
        j.application_date,
        j.resume_score,
        j.notes,
        j.scraped_at,
        j.last_checked,
        j.job_state,
        j.resume_score_stage,
        j.is_interested,
        j.customized_resume_id,
        j.provider
    FROM
        jobs j
    WHERE
        j.is_active = TRUE
        AND j.status = 'new'
        AND j.job_state = 'new'
        AND j.resume_score >= 70
        AND j.customized_resume_id IS NULL
        AND j.is_interested IS NOT FALSE
    ORDER BY
        CASE
            WHEN j.is_interested IS TRUE THEN 1
            ELSE 2
        END ASC,
        j.resume_score DESC
    LIMIT p_page_size
    OFFSET (p_page_number - 1) * p_page_size;
END;
$$;

ALTER FUNCTION "public"."get_jobs_for_resume_generation_custom_sort"("p_page_number" integer, "p_page_size" integer) OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."get_jobs_for_resume_generation_custom_sort"("p_page_number" integer, "p_page_size" integer) TO "anon", "authenticated", "service_role";

-- 5. Record this migration as applied
INSERT INTO "public"."schema_migrations" ("version") VALUES ('20261029_01_migration_booster_and_interest_filter') ON CONFLICT DO NOTHING;`,
  },
];

/**
 * Extracts the Supabase project reference from a Supabase URL.
 * e.g. "https://abcdefghijkl.supabase.co" -> "abcdefghijkl"
 */
export function extractProjectRef(supabaseUrl: string): string | null {
  try {
    const url = new URL(supabaseUrl);
    const hostParts = url.hostname.split(".");
    if (hostParts.length >= 3 && hostParts[1] === "supabase" && hostParts[2] === "co") {
      return hostParts[0];
    }
  } catch {}
  return null;
}

/**
 * Generates the direct URL to the user's Supabase SQL Editor.
 */
export function getSupabaseSqlEditorUrl(supabaseUrl: string): string {
  const ref = extractProjectRef(supabaseUrl);
  if (ref) {
    return `https://supabase.com/dashboard/project/${ref}/sql/new`;
  }
  return "https://supabase.com/dashboard";
}

export type MigrationState =
  /** No Supabase credentials on disk yet - the setup wizard has not run. */
  | "not_configured"
  /** Credentials exist but the project could not be reached. */
  | "unreachable"
  /** schema_migrations exists and every known migration is recorded. */
  | "up_to_date"
  /** One or more migrations still need to be applied. */
  | "pending";

export interface MigrationStatus {
  state: MigrationState;
  pending: Migration[];
  /** True when the exec_migration booster RPC is callable. */
  boosterAvailable: boolean;
  error?: string;
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  // PGRST205 = table not found in schema cache, 42P01 = undefined_table
  if (error.code === "PGRST205" || error.code === "42P01") return true;
  return /schema_migrations.*(does not exist|not find)/i.test(error.message || "");
}

function isConnectivityError(error: { message?: string } | null): boolean {
  if (!error) return false;
  return /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network|getaddrinfo/i.test(
    error.message || ""
  );
}

/**
 * Probes whether the versioned exec_migration booster RPC exists.
 *
 * Strictly read-only: it calls has_migration_booster(), which only inspects the
 * catalog. Databases that predate this release lack that function entirely and
 * only expose the legacy single-argument overload, which cannot record a
 * version - so they correctly report false and fall back to the manual SQL path.
 */
export async function isBoosterAvailable(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("has_migration_booster");
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

/**
 * Inspects the database and reports which migrations are outstanding.
 *
 * Unlike a naive "any error means everything is pending" approach, this
 * distinguishes an unconfigured project, an unreachable project, and a project
 * that genuinely needs migrations - so the UI never shows a false update banner.
 */
export async function getMigrationStatus(
  supabase: SupabaseClient,
  isConfigured: boolean
): Promise<MigrationStatus> {
  if (!isConfigured) {
    return { state: "not_configured", pending: [], boosterAvailable: false };
  }

  const { data, error } = await supabase.from("schema_migrations").select("version");

  if (error) {
    if (isConnectivityError(error)) {
      return {
        state: "unreachable",
        pending: [],
        boosterAvailable: false,
        error: error.message,
      };
    }

    // A missing bookkeeping table means the project predates the migration
    // system, so every migration is genuinely outstanding.
    if (isMissingTableError(error)) {
      return { state: "pending", pending: ALL_MIGRATIONS, boosterAvailable: false };
    }

    return {
      state: "unreachable",
      pending: [],
      boosterAvailable: false,
      error: error.message,
    };
  }

  const applied = new Set((data || []).map((row: { version: string }) => row.version));
  const pending = ALL_MIGRATIONS.filter((m) => !applied.has(m.id));

  return {
    state: pending.length === 0 ? "up_to_date" : "pending",
    pending,
    boosterAvailable: pending.length > 0 ? await isBoosterAvailable(supabase) : false,
  };
}

/**
 * Applies pending migrations through the exec_migration booster RPC.
 *
 * Each migration is applied in its own transaction by the RPC, which also
 * records the version row. The caller re-reads the status afterwards to report
 * the true remaining state.
 */
export async function tryAutoApplyMigrations(
  supabase: SupabaseClient,
  pendingMigrations: Migration[]
): Promise<{ success: boolean; appliedCount: number; error?: string }> {
  if (pendingMigrations.length === 0) {
    return { success: true, appliedCount: 0 };
  }

  if (!(await isBoosterAvailable(supabase))) {
    return {
      success: false,
      appliedCount: 0,
      error: "exec_migration booster is not installed on this database.",
    };
  }

  let appliedCount = 0;
  for (const migration of pendingMigrations) {
    const { error } = await supabase.rpc("exec_migration", {
      p_version: migration.id,
      sql_query: migration.sql,
    });

    if (error) {
      return {
        success: false,
        appliedCount,
        error: `Failed on migration ${migration.id}: ${error.message}`,
      };
    }
    appliedCount++;
  }

  return { success: true, appliedCount };
}

