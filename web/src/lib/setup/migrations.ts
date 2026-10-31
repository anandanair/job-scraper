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
  {
    id: "20261101_01_applied_jobs_tracking",
    title: "Applied Jobs Tracking (Follow-ups, Events & Status History)",
    description:
      "Adds follow_up_at, next_event_at, next_event_label and status_history columns to jobs for application tracking, updates get_applied_jobs_sorted to include rejected jobs by default and support follow-up sorting, and adds supporting indexes.",
    sql: `-- 1. Add tracking columns to jobs
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "follow_up_at" timestamp with time zone;
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "next_event_at" timestamp with time zone;
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "next_event_label" "text";
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "status_history" "jsonb" DEFAULT '[]'::"jsonb";

COMMENT ON COLUMN "public"."jobs"."follow_up_at" IS 'Timestamp when the user wants a follow-up reminder for this application';
COMMENT ON COLUMN "public"."jobs"."next_event_at" IS 'Timestamp of the next scheduled event (e.g., interview, offer deadline)';
COMMENT ON COLUMN "public"."jobs"."next_event_label" IS 'Human-readable label for the next scheduled event (e.g., Technical Interview Round 2)';
COMMENT ON COLUMN "public"."jobs"."status_history" IS 'Append-only JSONB array of status transitions: [{from, to, at, note}]';

-- 2. Supporting indexes for follow-up and event queries
CREATE INDEX IF NOT EXISTS "idx_jobs_follow_up_at" ON "public"."jobs" USING "btree" ("follow_up_at");
CREATE INDEX IF NOT EXISTS "idx_jobs_next_event_at" ON "public"."jobs" USING "btree" ("next_event_at");

-- 3. Update get_applied_jobs_sorted: include rejected in default set, add follow_up_at sort
DROP FUNCTION IF EXISTS "public"."get_applied_jobs_sorted"("p_page_number" integer, "p_page_size" integer, "p_provider" "text", "p_search_query" "text", "p_application_status" "text");
DROP FUNCTION IF EXISTS "public"."get_applied_jobs_sorted"("p_page_number" integer, "p_page_size" integer, "p_provider" "text", "p_search_query" "text", "p_application_status" "text", "p_sort_by" "text", "p_sort_order" "text");

CREATE OR REPLACE FUNCTION "public"."get_applied_jobs_sorted"("p_page_number" integer, "p_page_size" integer, "p_provider" "text" DEFAULT NULL::"text", "p_search_query" "text" DEFAULT NULL::"text", "p_application_status" "text" DEFAULT NULL::"text", "p_sort_by" "text" DEFAULT NULL::"text", "p_sort_order" "text" DEFAULT 'desc'::"text") RETURNS SETOF "public"."jobs"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM jobs j
  WHERE
    j.is_active = TRUE AND
    j.job_state = 'new' AND
    (
      p_application_status IS NULL AND j.status IN ('applied', 'interviewing', 'offer', 'rejected') OR
      j.status = p_application_status
    )
    AND (p_provider IS NULL OR j.provider = p_provider)
    AND (
      p_search_query IS NULL OR
      j.job_title ILIKE '%' || p_search_query || '%' OR
      j.company ILIKE '%' || p_search_query || '%'
    )
  ORDER BY
    CASE
      WHEN p_sort_by = 'application_date' AND p_sort_order = 'asc' THEN j.application_date
      ELSE NULL
    END ASC NULLS LAST,
    CASE
      WHEN p_sort_by = 'application_date' AND p_sort_order = 'desc' THEN j.application_date
      ELSE NULL
    END DESC NULLS LAST,
    CASE
      WHEN p_sort_by = 'resume_score' AND p_sort_order = 'asc' THEN j.resume_score
      ELSE NULL
    END ASC NULLS LAST,
    CASE
      WHEN p_sort_by = 'resume_score' AND p_sort_order = 'desc' THEN j.resume_score
      ELSE NULL
    END DESC NULLS LAST,
    CASE
      WHEN p_sort_by = 'follow_up_at' AND p_sort_order = 'asc' THEN j.follow_up_at
      ELSE NULL
    END ASC NULLS LAST,
    CASE
      WHEN p_sort_by = 'follow_up_at' AND p_sort_order = 'desc' THEN j.follow_up_at
      ELSE NULL
    END DESC NULLS LAST,
    CASE j.status
      WHEN 'offer' THEN 1
      WHEN 'interviewing' THEN 2
      WHEN 'applied' THEN 3
      WHEN 'rejected' THEN 4
      ELSE 5
    END ASC,
    j.application_date DESC
  LIMIT p_page_size
  OFFSET (p_page_number - 1) * p_page_size;
END;
$$;

ALTER FUNCTION "public"."get_applied_jobs_sorted"("p_page_number" integer, "p_page_size" integer, "p_provider" "text", "p_search_query" "text", "p_application_status" "text", "p_sort_by" "text", "p_sort_order" "text") OWNER TO "postgres";
GRANT ALL ON FUNCTION "public"."get_applied_jobs_sorted"("p_page_number" integer, "p_page_size" integer, "p_provider" "text", "p_search_query" "text", "p_application_status" "text", "p_sort_by" "text", "p_sort_order" "text") TO "anon", "authenticated", "service_role";

-- 4. Record this migration as applied
INSERT INTO "public"."schema_migrations" ("version") VALUES ('20261101_01_applied_jobs_tracking') ON CONFLICT DO NOTHING;`,
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

