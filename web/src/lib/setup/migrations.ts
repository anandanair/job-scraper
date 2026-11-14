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
  {
    id: "20261102_01_schedule_timezone_and_timing",
    title: "Schedule Timezone and Daily Run Timing",
    description:
      "Adds schedule_timezone, schedule_hour, schedule_minute, and last_scraped_at to app_settings for personalized local timezone job scraping.",
    sql: `-- 1. Add scheduling and last run tracking columns to app_settings
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "schedule_timezone" text NOT NULL DEFAULT 'Asia/Singapore';
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "schedule_hour" integer NOT NULL DEFAULT 19;
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "schedule_minute" integer NOT NULL DEFAULT 0;
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "last_scraped_at" timestamp with time zone;

COMMENT ON COLUMN "public"."app_settings"."schedule_timezone" IS 'IANA timezone string (e.g. Asia/Singapore, Asia/Kolkata, America/New_York) for scheduling background jobs';
COMMENT ON COLUMN "public"."app_settings"."schedule_hour" IS 'Preferred local hour (0-23) to run the daily job scraper';
COMMENT ON COLUMN "public"."app_settings"."schedule_minute" IS 'Preferred local minute (0-59) to run the daily job scraper';
COMMENT ON COLUMN "public"."app_settings"."last_scraped_at" IS 'Timestamp when the daily scraper last ran and saved jobs';

-- 2. Record this migration as applied
INSERT INTO "public"."schema_migrations" ("version") VALUES ('20261102_01_schedule_timezone_and_timing') ON CONFLICT DO NOTHING;`,
  },
  {
    id: "20261103_01_automation_runs_telemetry",
    title: "Automation Execution Telemetry & Error Tracking",
    description:
      "Creates the automation_runs table to record workflow execution history, domain metrics, in-run non-fatal warnings (e.g. 429s), errors, and terminal logs.",
    sql: `-- 1. Create automation_runs table
CREATE TABLE IF NOT EXISTS "public"."automation_runs" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "workflow_name" text NOT NULL,
    "workflow_id" text NOT NULL,
    "status" text NOT NULL,
    "trigger_type" text NOT NULL,
    "started_at" timestamp with time zone DEFAULT now() NOT NULL,
    "completed_at" timestamp with time zone,
    "duration_seconds" integer,
    "summary" text,
    "metrics" jsonb DEFAULT '{}'::jsonb,
    "error_count" integer DEFAULT 0 NOT NULL,
    "warning_count" integer DEFAULT 0 NOT NULL,
    "error_message" text,
    "errors_list" jsonb DEFAULT '[]'::jsonb,
    "log_output" text,
    "github_run_id" text,
    "github_run_number" text,
    "github_run_url" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. Indexes for efficient lookup and pruning
CREATE INDEX IF NOT EXISTS "idx_automation_runs_started_at" ON "public"."automation_runs" ("started_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_automation_runs_workflow_id" ON "public"."automation_runs" ("workflow_id");
CREATE INDEX IF NOT EXISTS "idx_automation_runs_status" ON "public"."automation_runs" ("status");

-- 3. Security & permissions
ALTER TABLE "public"."automation_runs" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE "public"."automation_runs" TO "anon", "authenticated", "service_role";

-- 4. Record this migration as applied
INSERT INTO "public"."schema_migrations" ("version") VALUES ('20261103_01_automation_runs_telemetry') ON CONFLICT DO NOTHING;`,
  },
  {
    id: "20261103_02_cover_letters",
    title: "On-Demand Custom Cover Letters",
    description:
      "Creates the cover_letters table to store custom generated and edited cover letters for jobs.",
    sql: `-- 1. Create cover_letters table
CREATE TABLE IF NOT EXISTS "public"."cover_letters" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "job_id" text NOT NULL UNIQUE REFERENCES "public"."jobs"("job_id") ON DELETE CASCADE,
    "content" text NOT NULL,
    "tone" text DEFAULT 'confident_professional' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. Index for job_id lookup
CREATE INDEX IF NOT EXISTS "idx_cover_letters_job_id" ON "public"."cover_letters" ("job_id");

-- 3. Security & permissions
ALTER TABLE "public"."cover_letters" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE "public"."cover_letters" TO "anon", "authenticated", "service_role";

-- 4. Record this migration as applied
INSERT INTO "public"."schema_migrations" ("version") VALUES ('20261103_02_cover_letters') ON CONFLICT DO NOTHING;`,
  },
  {
    id: "20261109_01_dream_job_enhancements",
    title: "Dream Job Engine (Salary, Workplace Type, Dual Scores & Interview Prep)",
    description:
      "Adds salary_min, salary_max, salary_currency, salary_period, workplace_type, dream_score, score_breakdown, and application_url to jobs; adds dream_job_profile and search_locations to app_settings; creates job_interview_prep table.",
    sql: `-- 1. Add salary, workplace, dream score, and breakdown to jobs
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "salary_min" numeric;
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "salary_max" numeric;
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "salary_currency" text;
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "salary_period" text;
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "workplace_type" text;
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "dream_score" smallint;
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "score_breakdown" jsonb;
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "application_url" text;

COMMENT ON COLUMN "public"."jobs"."salary_min" IS 'Minimum salary/compensation if provided';
COMMENT ON COLUMN "public"."jobs"."salary_max" IS 'Maximum salary/compensation if provided';
COMMENT ON COLUMN "public"."jobs"."salary_currency" IS 'Currency code, e.g. SGD, USD, EUR, INR';
COMMENT ON COLUMN "public"."jobs"."salary_period" IS 'Salary period: month, year, or hour';
COMMENT ON COLUMN "public"."jobs"."workplace_type" IS 'Workplace arrangement: remote, hybrid, or onsite';
COMMENT ON COLUMN "public"."jobs"."dream_score" IS 'AI fit score (0-100) evaluated against user dream job criteria';
COMMENT ON COLUMN "public"."jobs"."score_breakdown" IS 'Detailed AI evaluation: matched skills, skill gaps, red flags, pros/cons';
COMMENT ON COLUMN "public"."jobs"."application_url" IS 'Direct external application URL if different from provider view URL';

-- 2. Add dream profile and multi-region locations to app_settings
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "dream_job_profile" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "search_locations" jsonb DEFAULT '[]'::jsonb;

-- 3. Create job_interview_prep table for on-demand interview preparation
CREATE TABLE IF NOT EXISTS "public"."job_interview_prep" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "job_id" text NOT NULL UNIQUE REFERENCES "public"."jobs"("job_id") ON DELETE CASCADE,
    "technical_questions" jsonb DEFAULT '[]'::jsonb,
    "behavioral_star" jsonb DEFAULT '[]'::jsonb,
    "reverse_questions" jsonb DEFAULT '[]'::jsonb,
    "company_brief" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 4. Create indexes for efficient filtering and sorting
CREATE INDEX IF NOT EXISTS "idx_jobs_dream_score" ON "public"."jobs" ("dream_score" DESC);
CREATE INDEX IF NOT EXISTS "idx_jobs_workplace_type" ON "public"."jobs" ("workplace_type");
CREATE INDEX IF NOT EXISTS "idx_jobs_salary_min" ON "public"."jobs" ("salary_min");
CREATE INDEX IF NOT EXISTS "idx_job_interview_prep_job_id" ON "public"."job_interview_prep" ("job_id");

-- 5. Security & permissions
ALTER TABLE "public"."job_interview_prep" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE "public"."job_interview_prep" TO "anon", "authenticated", "service_role";

-- 6. Record this migration as applied
INSERT INTO "public"."schema_migrations" ("version") VALUES ('20261109_01_dream_job_enhancements') ON CONFLICT DO NOTHING;`,
  },
  {
    id: "20261110_01_composite_score_and_dream_gating",
    title: "Composite Match Scoring (50/50 Blended) and Dream Gating",
    description:
      "Adds total_score column to jobs combining ATS qualification and dream alignment, creates index for top matches sorting, and backfills existing scored jobs.",
    sql: `-- 1. Add total_score column to jobs
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "total_score" smallint;
COMMENT ON COLUMN "public"."jobs"."total_score" IS 'Composite score (0-100) combining ATS qualification (resume_score) and dream checklist fit (dream_score)';

-- 2. Index for fast top-match composite sorting
CREATE INDEX IF NOT EXISTS "idx_jobs_total_score" ON "public"."jobs" ("total_score" DESC);

-- 3. Backfill existing scored jobs
UPDATE "public"."jobs"
SET "total_score" = ROUND(
  ("resume_score" * 0.5) + (COALESCE("dream_score", "resume_score") * 0.5)
)::smallint
WHERE "resume_score" IS NOT NULL;

-- 4. Record this migration as applied
INSERT INTO "public"."schema_migrations" ("version") VALUES ('20261110_01_composite_score_and_dream_gating') ON CONFLICT DO NOTHING;`,
  },
  {
    id: "20261110_02_job_search_mode_and_strategy",
    title: "Job Search Strategy Mode (Get Hired Fast vs Dream Hunter)",
    description:
      "Adds job_search_mode column to app_settings defaulting to 'get_hired_fast', allowing users to toggle between pure ATS qualification fit and strict dream checklist gating.",
    sql: `-- 1. Add job_search_mode column to app_settings
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "job_search_mode" text DEFAULT 'get_hired_fast';
COMMENT ON COLUMN "public"."app_settings"."job_search_mode" IS 'Job search strategy mode: get_hired_fast (pure ATS fit) or dream_hunter (blended ATS + dream checklist)';

-- 2. Backfill existing rows to get_hired_fast if null
UPDATE "public"."app_settings"
SET "job_search_mode" = 'get_hired_fast'
WHERE "job_search_mode" IS NULL;

-- 3. Record this migration as applied
INSERT INTO "public"."schema_migrations" ("version") VALUES ('20261110_02_job_search_mode_and_strategy') ON CONFLICT DO NOTHING;`,
  },
  {
    id: "20261110_03_company_profiles_and_grounded_scoring",
    title: "Company Profiles & Grounded Scoring",
    description:
      "Creates the company_profiles table for caching real-time company intelligence, public review sentiments, and official overviews to ground AI Dream Job evaluations.",
    sql: `-- 1. Create company_profiles table
CREATE TABLE IF NOT EXISTS "public"."company_profiles" (
    "company_name" text NOT NULL PRIMARY KEY,
    "domain" text,
    "industry" text,
    "size_band" text,
    "headquarters" text,
    "glassdoor_rating" numeric(3, 1),
    "glassdoor_reviews_count" integer,
    "culture_summary" text,
    "source_snippets" jsonb DEFAULT '[]'::jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. Indexes and security
CREATE INDEX IF NOT EXISTS "idx_company_profiles_updated_at" ON "public"."company_profiles" ("updated_at" DESC);
ALTER TABLE "public"."company_profiles" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE "public"."company_profiles" TO "anon", "authenticated", "service_role";

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'company_profiles' AND policyname = 'Allow public all access on company_profiles'
    ) THEN
        CREATE POLICY "Allow public all access on company_profiles" ON "public"."company_profiles" FOR ALL USING (true);
    END IF;
END $$;

-- 3. Record migration
INSERT INTO "public"."schema_migrations" ("version") VALUES ('20261110_03_company_profiles_and_grounded_scoring') ON CONFLICT DO NOTHING;`,
  },
  {
    id: "20261110_04_realtime_jobs_publication",
    title: "Supabase Realtime Publication for Jobs",
    description:
      "Enables Realtime postgres_changes publication on jobs table, sets replica identity to full, and ensures public RLS policy for browser WebSocket subscriptions.",
    sql: `-- 1. Ensure jobs table has RLS policy allowing public access for WebSocket streaming
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'jobs' AND policyname = 'Allow public all access on jobs'
    ) THEN
        CREATE POLICY "Allow public all access on jobs" ON "public"."jobs" FOR ALL USING (true);
    END IF;
END $$;

-- 2. Add jobs table to supabase_realtime publication
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'jobs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE "public"."jobs";
    END IF;
END $$;

-- 3. Set REPLICA IDENTITY FULL so updates broadcast old and new values
ALTER TABLE "public"."jobs" REPLICA IDENTITY FULL;

-- 4. Record migration
INSERT INTO "public"."schema_migrations" ("version") VALUES ('20261110_04_realtime_jobs_publication') ON CONFLICT DO NOTHING;`,
  },
  {
    id: "20261110_05_dashboard_stats_ats_remoteok",
    title: "Dashboard Stats for RemoteOK & Direct ATS and Composite Score Migration",
    description:
      "Populates total_score on legacy scored jobs, updates get_dashboard_stats RPC to count RemoteOK and Direct ATS providers, and measures Top Matches by composite match score.",
    sql: `-- 1. Ensure any legacy scored jobs have total_score initialized
UPDATE "public"."jobs"
SET "total_score" = "resume_score"
WHERE "resume_score" IS NOT NULL AND "total_score" IS NULL;

-- 2. Update get_dashboard_stats to include RemoteOK, Direct ATS, and count totalTopMatches by composite match
CREATE OR REPLACE FUNCTION "public"."get_dashboard_stats"(
    "p_today_start" timestamp with time zone,
    "p_today_end" timestamp with time zone
) RETURNS "json"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'totalNewJobs', count(*) FILTER (WHERE is_active = true AND status = 'new' AND job_state = 'new'),
        'totalAppliedJobs', count(*) FILTER (WHERE is_active = true AND status IN ('applied', 'interviewing', 'offer') AND job_state = 'new'),
        'totalTopMatches', count(*) FILTER (WHERE is_active = true AND status IN ('new', 'resume_generated') AND job_state = 'new' AND (total_score >= 50 OR (total_score IS NULL AND resume_score >= 50))),
        'expiredJobsCount', count(*) FILTER (WHERE job_state = 'expired'),
        'pendingScoreJobsCount', count(*) FILTER (WHERE is_active = true AND status = 'new' AND job_state = 'new' AND resume_score IS NULL),
        'scoredJobsCount', count(*) FILTER (WHERE is_active = true AND status IN ('new', 'resume_generated') AND job_state = 'new' AND resume_score IS NOT NULL),
        'customResumeJobsCount', count(*) FILTER (WHERE is_active = true AND customized_resume_id IS NOT NULL),
        'noCustomResumeJobsCount', count(*) FILTER (WHERE is_active = true AND customized_resume_id IS NULL),
        'scoredWithOriginalResumeCount', count(*) FILTER (WHERE is_active = true AND status = 'new' AND job_state = 'new' AND resume_score IS NOT NULL AND resume_score_stage = 'initial'),
        'scoredWithCustomResumeCount', count(*) FILTER (WHERE is_active = true AND status IN ('new', 'resume_generated') AND job_state = 'new' AND resume_score IS NOT NULL AND resume_score_stage = 'custom'),
        'linkedInJobsCount', count(*) FILTER (WHERE is_active = true AND job_state = 'new' AND provider = 'linkedin'),
        'careersFutureJobsCount', count(*) FILTER (WHERE is_active = true AND job_state = 'new' AND provider = 'careers_future'),
        'remoteOkJobsCount', count(*) FILTER (WHERE is_active = true AND job_state = 'new' AND provider = 'remote_ok'),
        'atsJobsCount', count(*) FILTER (WHERE is_active = true AND job_state = 'new' AND provider IN ('greenhouse', 'lever', 'ashby')),
        'appliedTodayCount', count(*) FILTER (WHERE is_active = true AND status IN ('applied', 'interviewing', 'offer') AND job_state = 'new' AND application_date >= p_today_start AND application_date < p_today_end)
    )
    INTO result
    FROM "public"."jobs";

    RETURN result;
END;
$$;

ALTER FUNCTION "public"."get_dashboard_stats"("p_today_start" timestamp with time zone, "p_today_end" timestamp with time zone) OWNER TO "postgres";

-- 3. Record migration
INSERT INTO "public"."schema_migrations" ("version") VALUES ('20261110_05_dashboard_stats_ats_remoteok') ON CONFLICT DO NOTHING;`,
  },
  {
    id: "20261114_01_heal_tailored_jobs_status",
    title: "Heal Active Tailored Jobs Status to New",
    description:
      "Heals active unapplied jobs with status 'tailored' back to 'new' so they are visible in Top Matches, New Jobs, and Tailored & Ready feeds.",
    sql: `-- 1. Revert active jobs marked as 'tailored' back to 'new'
UPDATE "public"."jobs"
SET "status" = 'new'
WHERE "status" = 'tailored' AND "is_active" = true;

-- 2. Record migration
INSERT INTO "public"."schema_migrations" ("version") VALUES ('20261114_01_heal_tailored_jobs_status') ON CONFLICT DO NOTHING;`,
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

