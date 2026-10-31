

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "job_id" "text" NOT NULL,
    "company" "text",
    "job_title" "text",
    "level" "text",
    "location" "text",
    "description" "text",
    "status" "text" DEFAULT 'new'::"text",
    "is_active" boolean DEFAULT true,
    "application_date" timestamp with time zone,
    "resume_score" smallint,
    "notes" "text",
    "scraped_at" timestamp with time zone DEFAULT "now"(),
    "last_checked" timestamp with time zone DEFAULT "now"(),
    "job_state" "text" DEFAULT 'new'::"text",
    "resume_score_stage" "text" DEFAULT 'initial'::"text" NOT NULL,
    "is_interested" boolean,
    "customized_resume_id" "uuid",
    "provider" "text",
    "posted_at" timestamp with time zone,
    "follow_up_at" timestamp with time zone,
    "next_event_at" timestamp with time zone,
    "next_event_label" "text",
    "status_history" "jsonb" DEFAULT '[]'::"jsonb"
);

-- Upgrade existing jobs tables if columns are missing from earlier versions
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "company" "text";
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "job_title" "text";
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "level" "text";
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "location" "text";
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "description" "text";
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "status" "text" DEFAULT 'new'::"text";
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "application_date" timestamp with time zone;
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "resume_score" smallint;
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "notes" "text";
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "scraped_at" timestamp with time zone DEFAULT "now"();
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "last_checked" timestamp with time zone DEFAULT "now"();
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "job_state" "text" DEFAULT 'new'::"text";
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "resume_score_stage" "text" DEFAULT 'initial'::"text";
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "is_interested" boolean;
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "customized_resume_id" "uuid";
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "provider" "text";
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "posted_at" timestamp with time zone;
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "follow_up_at" timestamp with time zone;
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "next_event_at" timestamp with time zone;
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "next_event_label" "text";
ALTER TABLE "public"."jobs" ADD COLUMN IF NOT EXISTS "status_history" "jsonb" DEFAULT '[]'::"jsonb";


ALTER TABLE "public"."jobs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."jobs"."job_id" IS 'LinkedIn''s unique job ID (from URN, e.g., ''3884913367'')';



COMMENT ON COLUMN "public"."jobs"."company" IS 'Company name';



COMMENT ON COLUMN "public"."jobs"."job_title" IS 'Job title';



COMMENT ON COLUMN "public"."jobs"."level" IS 'Seniority level (e.g., ''Entry level'', ''Mid-Senior level'')';



COMMENT ON COLUMN "public"."jobs"."location" IS 'Job location';



COMMENT ON COLUMN "public"."jobs"."description" IS 'Full job description';



COMMENT ON COLUMN "public"."jobs"."status" IS 'Workflow status (e.g., new, scored, applied, interviewing, rejected, expired, archived)';



COMMENT ON COLUMN "public"."jobs"."is_active" IS 'Is the job posting considered active on LinkedIn? (Checked periodically)';



COMMENT ON COLUMN "public"."jobs"."application_date" IS 'Timestamp when an application was submitted/attempted';



COMMENT ON COLUMN "public"."jobs"."resume_score" IS 'Score (0-100) indicating resume match, NULL if not scored yet';



COMMENT ON COLUMN "public"."jobs"."notes" IS 'User''s notes about the job/application';



COMMENT ON COLUMN "public"."jobs"."follow_up_at" IS 'Timestamp when the user wants a follow-up reminder for this application';



COMMENT ON COLUMN "public"."jobs"."next_event_at" IS 'Timestamp of the next scheduled event (e.g., interview, offer deadline)';



COMMENT ON COLUMN "public"."jobs"."next_event_label" IS 'Human-readable label for the next scheduled event (e.g., Technical Interview Round 2)';



COMMENT ON COLUMN "public"."jobs"."status_history" IS 'Append-only JSONB array of status transitions: [{from, to, at, note}]';



COMMENT ON COLUMN "public"."jobs"."scraped_at" IS 'Timestamp when the record was first added';



COMMENT ON COLUMN "public"."jobs"."last_checked" IS 'Timestamp when the record was last checked/updated by any script';



-- Drop any obsolete function overloads to prevent PostgREST PGRST203 ambiguity
DROP FUNCTION IF EXISTS "public"."get_applied_jobs_sorted"("p_page_number" integer, "p_page_size" integer);
DROP FUNCTION IF EXISTS "public"."get_applied_jobs_sorted"("p_page_number" integer, "p_page_size" integer, "p_provider" "text", "p_search_query" "text");
DROP FUNCTION IF EXISTS "public"."get_applied_jobs_sorted"("p_page_number" integer, "p_page_size" integer, "p_provider" "text", "p_search_query" "text", "p_application_status" "text");

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
    -- Conditionally apply application status filter
    (
      p_application_status IS NULL AND j.status IN ('applied', 'interviewing', 'offer', 'rejected') OR
      j.status = p_application_status
    )
    -- Conditionally apply provider filter
    AND (p_provider IS NULL OR j.provider = p_provider)
    -- Conditionally apply search query filter
    AND (
      p_search_query IS NULL OR
      j.job_title ILIKE '%' || p_search_query || '%' OR
      j.company ILIKE '%' || p_search_query || '%'
    )
  ORDER BY
    -- Primary sort based on p_sort_by and p_sort_order
    CASE
      WHEN p_sort_by = 'application_date' AND p_sort_order = 'asc' THEN j.application_date
      ELSE NULL -- Allows other CASE WHENs or the default sort to take over
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
    -- Secondary / Default sort: by status priority, then by application_date descending
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


CREATE OR REPLACE FUNCTION "public"."get_jobs_for_rescore"("p_limit_val" integer) RETURNS TABLE("job_id" "text", "job_title" "text", "company" "text", "description" "text", "level" "text", "resume_score" smallint, "resume_link" "text", "customized_resume_id" "uuid")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        j.job_id,
        j.job_title,
        j.company,
        j.description,
        j.level,
        j.resume_score,
        cr.resume_link,
        j.customized_resume_id
    FROM
        jobs j
    INNER JOIN
        customized_resumes cr ON j.customized_resume_id = cr.id
    WHERE
        j.is_active = TRUE
        AND j.status = 'new'
        AND j.job_state = 'new'
        AND j.customized_resume_id IS NOT NULL
        AND cr.resume_link IS NOT NULL
        AND j.resume_score_stage = 'initial'
        AND j.is_interested IS NOT FALSE
    ORDER BY
        j.resume_score DESC
    LIMIT
        p_limit_val;
END;
$$;


ALTER FUNCTION "public"."get_jobs_for_rescore"("p_limit_val" integer) OWNER TO "postgres";


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
        j.customized_resume_id, -- Still selected, will be NULL
        j.provider
    FROM
        jobs j
    WHERE
        j.is_active = TRUE
        AND j.status = 'new'
        AND j.job_state = 'new'
        AND j.resume_score >= 70
        AND j.customized_resume_id IS NULL -- Key new filter
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


-- Drop obsolete 6-parameter overload to prevent PostgREST PGRST203 ambiguity
DROP FUNCTION IF EXISTS "public"."get_top_scored_jobs_custom_sort"("p_page_number" integer, "p_page_size" integer, "p_provider" "text", "p_min_score" integer, "p_max_score" integer, "p_is_interested_option" "text");

CREATE OR REPLACE FUNCTION "public"."get_top_scored_jobs_custom_sort"("p_page_number" integer, "p_page_size" integer, "p_provider" "text" DEFAULT NULL::"text", "p_min_score" integer DEFAULT 50, "p_max_score" integer DEFAULT 100, "p_is_interested_option" "text" DEFAULT NULL::"text", "p_search_query" "text" DEFAULT NULL::"text") RETURNS TABLE("job_id" "text", "company" "text", "job_title" "text", "level" "text", "location" "text", "description" "text", "status" "text", "is_active" boolean, "application_date" timestamp with time zone, "resume_score" smallint, "notes" "text", "scraped_at" timestamp with time zone, "last_checked" timestamp with time zone, "job_state" "text", "resume_score_stage" "text", "is_interested" boolean, "customized_resume_id" "uuid", "resume_link" "text", "provider" "text")
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
        cr.resume_link,
        j.provider
    FROM
        jobs j
    INNER JOIN
        customized_resumes cr ON j.customized_resume_id = cr.id
    WHERE
        j.is_active = TRUE
        AND j.status = 'new'
        AND j.job_state = 'new'
        AND j.resume_score >= p_min_score
        AND j.resume_score <= p_max_score
        AND (p_provider IS NULL OR j.provider = p_provider)
        AND (
            p_is_interested_option IS NULL
            OR (p_is_interested_option = 'true' AND j.is_interested IS TRUE)
            OR (p_is_interested_option = 'false' AND j.is_interested IS FALSE)
            OR (p_is_interested_option = 'null_value' AND j.is_interested IS NULL)
        )
        AND ( -- Added search query condition
            p_search_query IS NULL 
            OR j.job_title ILIKE '%' || p_search_query || '%'
            OR j.company ILIKE '%' || p_search_query || '%'
        )
    ORDER BY
        CASE
            WHEN j.is_interested IS TRUE THEN 1
            WHEN j.is_interested IS NULL THEN 2
            WHEN j.is_interested IS FALSE THEN 3
            ELSE 4
        END,
        CASE
            WHEN j.resume_score_stage = 'custom' THEN 1
            WHEN j.resume_score_stage = 'initial' THEN 2
            ELSE 3
        END,
        j.resume_score DESC NULLS LAST,
        j.scraped_at DESC
    LIMIT p_page_size
    OFFSET (p_page_number - 1) * p_page_size;
END;
$$;


ALTER FUNCTION "public"."get_top_scored_jobs_custom_sort"("p_page_number" integer, "p_page_size" integer, "p_provider" "text", "p_min_score" integer, "p_max_score" integer, "p_is_interested_option" "text", "p_search_query" "text") OWNER TO "postgres";

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
        'totalTopMatches', count(*) FILTER (WHERE is_active = true AND status IN ('new', 'resume_generated') AND job_state = 'new' AND resume_score >= 50 AND resume_score <= 100),
        'expiredJobsCount', count(*) FILTER (WHERE job_state = 'expired'),
        'pendingScoreJobsCount', count(*) FILTER (WHERE is_active = true AND status = 'new' AND job_state = 'new' AND resume_score IS NULL),
        'scoredJobsCount', count(*) FILTER (WHERE is_active = true AND status IN ('new', 'resume_generated') AND job_state = 'new' AND resume_score IS NOT NULL),
        'customResumeJobsCount', count(*) FILTER (WHERE is_active = true AND customized_resume_id IS NOT NULL),
        'noCustomResumeJobsCount', count(*) FILTER (WHERE is_active = true AND customized_resume_id IS NULL),
        'scoredWithOriginalResumeCount', count(*) FILTER (WHERE is_active = true AND status = 'new' AND job_state = 'new' AND resume_score IS NOT NULL AND resume_score_stage = 'initial'),
        'scoredWithCustomResumeCount', count(*) FILTER (WHERE is_active = true AND status IN ('new', 'resume_generated') AND job_state = 'new' AND resume_score IS NOT NULL AND resume_score_stage = 'custom'),
        'linkedInJobsCount', count(*) FILTER (WHERE is_active = true AND job_state = 'new' AND provider = 'linkedin'),
        'careersFutureJobsCount', count(*) FILTER (WHERE is_active = true AND job_state = 'new' AND provider = 'careers_future'),
        'appliedTodayCount', count(*) FILTER (WHERE is_active = true AND status IN ('applied', 'interviewing', 'offer') AND job_state = 'new' AND application_date >= p_today_start AND application_date < p_today_end)
    )
    INTO result
    FROM "public"."jobs";

    RETURN result;
END;
$$;

ALTER FUNCTION "public"."get_dashboard_stats"("p_today_start" timestamp with time zone, "p_today_end" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_last_updated_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
   NEW.last_updated = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_last_updated_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customized_resumes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "location" "text",
    "summary" "text",
    "skills" "text"[],
    "education" "jsonb",
    "experience" "jsonb",
    "projects" "jsonb",
    "certifications" "jsonb",
    "languages" "text"[],
    "links" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "resume_link" "text"
);


ALTER TABLE "public"."customized_resumes" OWNER TO "postgres";
-- Upgrade existing customized_resumes table if columns are missing
ALTER TABLE "public"."customized_resumes" ADD COLUMN IF NOT EXISTS "phone" "text";
ALTER TABLE "public"."customized_resumes" ADD COLUMN IF NOT EXISTS "location" "text";
ALTER TABLE "public"."customized_resumes" ADD COLUMN IF NOT EXISTS "summary" "text";
ALTER TABLE "public"."customized_resumes" ADD COLUMN IF NOT EXISTS "skills" "text"[];
ALTER TABLE "public"."customized_resumes" ADD COLUMN IF NOT EXISTS "education" "jsonb";
ALTER TABLE "public"."customized_resumes" ADD COLUMN IF NOT EXISTS "experience" "jsonb";
ALTER TABLE "public"."customized_resumes" ADD COLUMN IF NOT EXISTS "projects" "jsonb";
ALTER TABLE "public"."customized_resumes" ADD COLUMN IF NOT EXISTS "certifications" "jsonb";
ALTER TABLE "public"."customized_resumes" ADD COLUMN IF NOT EXISTS "languages" "text"[];
ALTER TABLE "public"."customized_resumes" ADD COLUMN IF NOT EXISTS "links" "jsonb";
ALTER TABLE "public"."customized_resumes" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT "now"();
ALTER TABLE "public"."customized_resumes" ADD COLUMN IF NOT EXISTS "last_updated" timestamp with time zone DEFAULT "now"();
ALTER TABLE "public"."customized_resumes" ADD COLUMN IF NOT EXISTS "resume_link" "text";
ALTER TABLE "public"."customized_resumes" ADD COLUMN IF NOT EXISTS "theme_config" "jsonb";

















DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customized_resumes_pkey') THEN 
    ALTER TABLE ONLY "public"."customized_resumes" ADD CONSTRAINT "customized_resumes_pkey" PRIMARY KEY ("id"); 
  END IF; 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_pkey') THEN 
    ALTER TABLE ONLY "public"."jobs" ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("job_id"); 
  END IF; 
END $$;











CREATE INDEX IF NOT EXISTS "idx_jobs_company" ON "public"."jobs" USING "btree" ("company");



CREATE INDEX IF NOT EXISTS "idx_jobs_is_active" ON "public"."jobs" USING "btree" ("is_active");



CREATE INDEX IF NOT EXISTS "idx_jobs_job_title" ON "public"."jobs" USING "btree" ("job_title");



CREATE INDEX IF NOT EXISTS "idx_jobs_last_checked" ON "public"."jobs" USING "btree" ("last_checked");



CREATE INDEX IF NOT EXISTS "idx_jobs_resume_score" ON "public"."jobs" USING "btree" ("resume_score");



CREATE INDEX IF NOT EXISTS "idx_jobs_scraped_at" ON "public"."jobs" USING "btree" ("scraped_at");



CREATE INDEX IF NOT EXISTS "idx_jobs_status" ON "public"."jobs" USING "btree" ("status");

CREATE INDEX IF NOT EXISTS "idx_jobs_job_state" ON "public"."jobs" USING "btree" ("job_state");
CREATE INDEX IF NOT EXISTS "idx_jobs_provider" ON "public"."jobs" USING "btree" ("provider");
CREATE INDEX IF NOT EXISTS "idx_jobs_application_date" ON "public"."jobs" USING "btree" ("application_date");
CREATE INDEX IF NOT EXISTS "idx_jobs_follow_up_at" ON "public"."jobs" USING "btree" ("follow_up_at");
CREATE INDEX IF NOT EXISTS "idx_jobs_next_event_at" ON "public"."jobs" USING "btree" ("next_event_at");
CREATE INDEX IF NOT EXISTS "idx_jobs_active_status_state" ON "public"."jobs" ("is_active", "status", "job_state");



DROP TRIGGER IF EXISTS "update_customized_resumes_last_updated" ON "public"."customized_resumes";
CREATE TRIGGER "update_customized_resumes_last_updated" BEFORE UPDATE ON "public"."customized_resumes" FOR EACH ROW EXECUTE FUNCTION "public"."update_last_updated_column"();



DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_customized_resume_id_fkey') THEN 
    ALTER TABLE ONLY "public"."jobs"
      ADD CONSTRAINT "jobs_customized_resume_id_fkey" FOREIGN KEY ("customized_resume_id") REFERENCES "public"."customized_resumes"("id") ON UPDATE CASCADE ON DELETE SET NULL;
  END IF; 
END $$;



ALTER TABLE "public"."customized_resumes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;







ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_applied_jobs_sorted"("p_page_number" integer, "p_page_size" integer, "p_provider" "text", "p_search_query" "text", "p_application_status" "text", "p_sort_by" "text", "p_sort_order" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_applied_jobs_sorted"("p_page_number" integer, "p_page_size" integer, "p_provider" "text", "p_search_query" "text", "p_application_status" "text", "p_sort_by" "text", "p_sort_order" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_applied_jobs_sorted"("p_page_number" integer, "p_page_size" integer, "p_provider" "text", "p_search_query" "text", "p_application_status" "text", "p_sort_by" "text", "p_sort_order" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_jobs_for_rescore"("p_limit_val" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_jobs_for_rescore"("p_limit_val" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_jobs_for_rescore"("p_limit_val" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_jobs_for_resume_generation_custom_sort"("p_page_number" integer, "p_page_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_jobs_for_resume_generation_custom_sort"("p_page_number" integer, "p_page_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_jobs_for_resume_generation_custom_sort"("p_page_number" integer, "p_page_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_top_scored_jobs_custom_sort"("p_page_number" integer, "p_page_size" integer, "p_provider" "text", "p_min_score" integer, "p_max_score" integer, "p_is_interested_option" "text", "p_search_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_top_scored_jobs_custom_sort"("p_page_number" integer, "p_page_size" integer, "p_provider" "text", "p_min_score" integer, "p_max_score" integer, "p_is_interested_option" "text", "p_search_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_top_scored_jobs_custom_sort"("p_page_number" integer, "p_page_size" integer, "p_provider" "text", "p_min_score" integer, "p_max_score" integer, "p_is_interested_option" "text", "p_search_query" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_dashboard_stats"("p_today_start" timestamp with time zone, "p_today_end" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"("p_today_start" timestamp with time zone, "p_today_end" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"("p_today_start" timestamp with time zone, "p_today_end" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_last_updated_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_last_updated_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_last_updated_column"() TO "service_role";


GRANT ALL ON TABLE "public"."customized_resumes" TO "anon";
GRANT ALL ON TABLE "public"."customized_resumes" TO "authenticated";
GRANT ALL ON TABLE "public"."customized_resumes" TO "service_role";











ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






RESET ALL;

-- --- Base Resume Table ---
-- Stores the parsed resume JSON data securely in the database.
-- This avoids committing sensitive resume files to the public repository.
CREATE TABLE IF NOT EXISTS "public"."base_resume" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "resume_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."base_resume" OWNER TO "postgres";

DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'base_resume_pkey') THEN 
    ALTER TABLE ONLY "public"."base_resume" ADD CONSTRAINT "base_resume_pkey" PRIMARY KEY ("id"); 
  END IF; 
END $$;

-- Auto-update the updated_at column on changes
-- NOTE: Cannot reuse update_last_updated_column() because it references
-- "last_updated" which doesn't exist on base_resume (which uses "updated_at").
CREATE OR REPLACE FUNCTION "public"."update_base_resume_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_base_resume_updated_at_column"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "update_base_resume_updated_at" ON "public"."base_resume";
CREATE TRIGGER "update_base_resume_updated_at" BEFORE UPDATE ON "public"."base_resume" FOR EACH ROW EXECUTE FUNCTION "public"."update_base_resume_updated_at_column"();

ALTER TABLE "public"."base_resume" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."base_resume" TO "anon";
GRANT ALL ON TABLE "public"."base_resume" TO "authenticated";
GRANT ALL ON TABLE "public"."base_resume" TO "service_role";

-- --- Storage Setup (Deprecated) ---
-- PDFs are compiled dynamically on-the-fly in-memory via PDFKit (no object storage buckets required)

-- --- Resume Style Settings Table ---
CREATE TABLE IF NOT EXISTS "public"."resume_style_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "name" "text" NOT NULL DEFAULT 'Modern Tech',
    "preset" "text" NOT NULL DEFAULT 'modern_tech',
    "is_active" boolean DEFAULT true,
    "theme_config" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "public"."resume_style_settings" OWNER TO "postgres";
ALTER TABLE "public"."resume_style_settings" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."resume_style_settings" TO "anon";
GRANT ALL ON TABLE "public"."resume_style_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."resume_style_settings" TO "service_role";

-- --- App Configuration Settings Table ---
CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "llm_provider" "text" NOT NULL DEFAULT 'gemini',
    "llm_model" "text" NOT NULL DEFAULT 'gemini-3.8-flash',
    "llm_api_key" "text",
    "llm_tier" "text" NOT NULL DEFAULT 'free',
    "linkedin_search_queries" "jsonb" NOT NULL DEFAULT '["Software Engineer", "Full Stack Developer"]'::"jsonb",
    "linkedin_location" "text" NOT NULL DEFAULT 'Singapore',
    "linkedin_geo_id" "text" NOT NULL DEFAULT '102454443',
    "linkedin_job_type" "text" DEFAULT 'F',
    "linkedin_job_posting_date" "text" DEFAULT 'r86400',
    "linkedin_f_wt" "text" DEFAULT '1,2,3',
    "careers_future_search_queries" "jsonb" NOT NULL DEFAULT '["Software Engineer", "Frontend Developer"]'::"jsonb",
    "careers_future_search_categories" "jsonb" DEFAULT '["Information Technology"]'::"jsonb",
    "careers_future_search_employment_types" "jsonb" DEFAULT '["Full Time"]'::"jsonb",
    "scraping_sources" "jsonb" NOT NULL DEFAULT '["linkedin"]'::"jsonb",
    "jobs_to_score_per_run" integer NOT NULL DEFAULT 10,
    "jobs_to_customize_per_run" integer NOT NULL DEFAULT 2,
    "max_jobs_per_search" "jsonb" DEFAULT '{"linkedin": 10, "careers_future": 20}'::"jsonb",
    "llm_max_rpm" integer NOT NULL DEFAULT 10,
    "llm_request_delay_seconds" integer NOT NULL DEFAULT 8,
    "llm_daily_request_budget" integer NOT NULL DEFAULT 0,
    "setup_step" integer NOT NULL DEFAULT 1,
    "setup_completed" boolean NOT NULL DEFAULT false,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "public"."app_settings" OWNER TO "postgres";
ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."app_settings" TO "service_role";


-- Upgrade existing app_settings if columns are missing from earlier builds
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "llm_tier" "text" NOT NULL DEFAULT 'free';
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "setup_step" integer NOT NULL DEFAULT 1;
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "setup_completed" boolean NOT NULL DEFAULT false;
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "careers_future_search_queries" "jsonb" NOT NULL DEFAULT '["Software Engineer", "Frontend Developer"]'::"jsonb";
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "careers_future_search_categories" "jsonb" DEFAULT '["Information Technology"]'::"jsonb";
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "careers_future_search_employment_types" "jsonb" DEFAULT '["Full Time"]'::"jsonb";
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "scraping_sources" "jsonb" NOT NULL DEFAULT '["linkedin"]'::"jsonb";
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "jobs_to_score_per_run" integer NOT NULL DEFAULT 10;
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "jobs_to_customize_per_run" integer NOT NULL DEFAULT 2;
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "max_jobs_per_search" "jsonb" DEFAULT '{"linkedin": 10, "careers_future": 20}'::"jsonb";
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "llm_max_rpm" integer NOT NULL DEFAULT 10;
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "llm_request_delay_seconds" integer NOT NULL DEFAULT 8;
ALTER TABLE "public"."app_settings" ADD COLUMN IF NOT EXISTS "llm_daily_request_budget" integer NOT NULL DEFAULT 0;

-- Seed singleton default configuration if no row exists
INSERT INTO "public"."app_settings" (id)
SELECT '00000000-0000-0000-0000-000000000001'::uuid
WHERE NOT EXISTS (SELECT 1 FROM "public"."app_settings");

-- --- LinkedIn Geo Locations Catalog ---
CREATE TABLE IF NOT EXISTS "public"."linkedin_geo_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "name" "text" NOT NULL,
    "country" "text" NOT NULL,
    "geo_id" "text" NOT NULL UNIQUE,
    "entity_type" "text" DEFAULT 'Country',
    "is_preset" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "public"."linkedin_geo_locations" OWNER TO "postgres";
ALTER TABLE "public"."linkedin_geo_locations" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."linkedin_geo_locations" TO "anon";
GRANT ALL ON TABLE "public"."linkedin_geo_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."linkedin_geo_locations" TO "service_role";

DROP POLICY IF EXISTS "Allow public read access to geo locations" ON "public"."linkedin_geo_locations";
CREATE POLICY "Allow public read access to geo locations" ON "public"."linkedin_geo_locations"
    FOR SELECT TO "anon", "authenticated", "service_role" USING (true);

DROP POLICY IF EXISTS "Allow insert to geo locations" ON "public"."linkedin_geo_locations";
CREATE POLICY "Allow insert to geo locations" ON "public"."linkedin_geo_locations"
    FOR INSERT TO "anon", "authenticated", "service_role" WITH CHECK (true);

-- Seed initial preset locations
INSERT INTO "public"."linkedin_geo_locations" ("name", "country", "geo_id", "entity_type", "is_preset") VALUES
('Singapore', 'Singapore', '102454443', 'Country', true),
('Malaysia', 'Malaysia', '106604213', 'Country', true),
('Kuala Lumpur', 'Malaysia', '104246733', 'Capital / Metro', true),
('Selangor', 'Malaysia', '105151591', 'State / Region', true),
('India', 'India', '102713980', 'Country', true),
('Greater Bengaluru Area', 'India', '90009633', 'Major Metro Hub', true),
('Mumbai Metropolitan Region', 'India', '90009639', 'Major Metro Hub', true),
('Delhi', 'India', '106187582', 'Major Metro Hub', true),
('Dubai / United Arab Emirates', 'United Arab Emirates', '100205264', 'Metro / Country', true),
('United States', 'United States', '103644278', 'Country', true),
('United Kingdom', 'United Kingdom', '102257491', 'Country', true),
('Canada', 'Canada', '101174742', 'Country', true),
('Australia', 'Australia', '101452733', 'Country', true),
('Japan', 'Japan', '101355337', 'Country', true),
('China', 'China', '102890883', 'Country', true),
('Worldwide / Remote', 'Worldwide', '92000000', 'Global', true)
ON CONFLICT ("geo_id") DO NOTHING;

-- --- Schema Migrations & Automated DDL Execution Helper ---
CREATE TABLE IF NOT EXISTS "public"."schema_migrations" (
    "version" text PRIMARY KEY,
    "applied_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE "public"."schema_migrations" OWNER TO "postgres";
ALTER TABLE "public"."schema_migrations" ENABLE ROW LEVEL SECURITY;

-- Migration bookkeeping is server-side only. Clients must never be able to
-- forge or delete a version row, otherwise they could suppress real migrations.
REVOKE ALL ON TABLE "public"."schema_migrations" FROM PUBLIC, "anon", "authenticated";
GRANT ALL ON TABLE "public"."schema_migrations" TO "service_role";

-- Drop the legacy single-argument overload so PostgREST cannot resolve
-- exec_migration() ambiguously (PGRST203).
DROP FUNCTION IF EXISTS "public"."exec_migration"("sql_query" text);

-- Applies one versioned migration atomically.
--   * SECURITY DEFINER + pinned search_path prevents search_path hijacking.
--     public must come first so unqualified DDL in a migration targets the
--     application schema rather than pg_catalog.
--   * pg_advisory_xact_lock serializes concurrent callers (multiple tabs,
--     launcher + browser, retries) so DDL never runs twice.
--   * The version row is written by the function itself, so a migration can
--     never be applied without being recorded.
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

-- This script already contains the DDL for the booster migration, so record it
-- as applied. Without this seed every fresh install would immediately report a
-- pending migration and show a false "Database Update Available" banner.
INSERT INTO "public"."schema_migrations" ("version")
VALUES ('20261029_01_migration_booster_and_interest_filter')
ON CONFLICT ("version") DO NOTHING;



