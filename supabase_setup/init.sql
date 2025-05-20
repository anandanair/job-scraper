

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


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."get_jobs_for_rescore"("p_limit_val" integer) RETURNS TABLE("job_id" "text", "job_title" "text", "company" "text", "description" "text", "level" "text", "resume_score" smallint, "resume_link" "text")
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
        cr.resume_link
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
        AND j.resume_score >= 50
        AND j.customized_resume_id IS NULL -- Key new filter
    ORDER BY
        CASE
            WHEN j.is_interested IS TRUE THEN 1
            WHEN j.is_interested IS NULL THEN 2
            ELSE 3
        END ASC,
        j.resume_score DESC
    LIMIT p_page_size
    OFFSET (p_page_number - 1) * p_page_size;
END;
$$;


ALTER FUNCTION "public"."get_jobs_for_resume_generation_custom_sort"("p_page_number" integer, "p_page_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_top_scored_jobs_custom_sort"("p_page_number" integer, "p_page_size" integer) RETURNS TABLE("job_id" "text", "company" "text", "job_title" "text", "level" "text", "location" "text", "description" "text", "status" "text", "is_active" boolean, "application_date" timestamp with time zone, "resume_score" smallint, "notes" "text", "scraped_at" timestamp with time zone, "last_checked" timestamp with time zone, "job_state" "text", "resume_score_stage" "text", "is_interested" boolean, "customized_resume_id" "uuid", "provider" "text", "resume_link" "text")
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
        j.provider,
        -- Select the resume_link from the joined table
        cr.resume_link
    FROM
        jobs j
    LEFT JOIN
        customized_resumes cr ON j.customized_resume_id = cr.id -- IMPORTANT: Ensure 'cr.id' is the PK of customized_resumes
    WHERE
        j.is_active = TRUE
        AND j.status = 'new'       -- Your filter criteria
        AND j.job_state = 'new'    -- Your filter criteria
        AND j.resume_score >= 50
    ORDER BY
        CASE
            WHEN j.is_interested IS TRUE THEN 1
            WHEN j.is_interested IS NULL THEN 2
            ELSE 3
        END ASC,
        j.resume_score DESC
    LIMIT p_page_size
    OFFSET (p_page_number - 1) * p_page_size;
END;
$$;


ALTER FUNCTION "public"."get_top_scored_jobs_custom_sort"("p_page_number" integer, "p_page_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_last_updated_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
   NEW.last_updated = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_last_updated_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


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
    "posted_at" timestamp with time zone
);


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



COMMENT ON COLUMN "public"."jobs"."scraped_at" IS 'Timestamp when the record was first added';



COMMENT ON COLUMN "public"."jobs"."last_checked" IS 'Timestamp when the record was last checked/updated by any script';



CREATE TABLE IF NOT EXISTS "public"."resumes" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "location" "text",
    "summary" "text",
    "skills" "jsonb",
    "education" "jsonb",
    "experience" "jsonb",
    "projects" "jsonb",
    "certifications" "jsonb",
    "languages" "jsonb",
    "links" "jsonb",
    "parsed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."resumes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."resumes"."skills" IS 'List of skill strings';



COMMENT ON COLUMN "public"."resumes"."education" IS 'List of education history objects';



COMMENT ON COLUMN "public"."resumes"."experience" IS 'List of work experience objects';



COMMENT ON COLUMN "public"."resumes"."projects" IS 'List of project objects';



COMMENT ON COLUMN "public"."resumes"."certifications" IS 'List of certification objects';



COMMENT ON COLUMN "public"."resumes"."languages" IS 'List of language strings';



COMMENT ON COLUMN "public"."resumes"."links" IS 'Object containing links like LinkedIn, GitHub, Portfolio';



COMMENT ON COLUMN "public"."resumes"."parsed_at" IS 'Timestamp indicating when the resume was last parsed and saved';



ALTER TABLE "public"."resumes" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."resumes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."customized_resumes"
    ADD CONSTRAINT "customized_resumes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("job_id");



ALTER TABLE ONLY "public"."resumes"
    ADD CONSTRAINT "resumes_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."resumes"
    ADD CONSTRAINT "resumes_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_jobs_company" ON "public"."jobs" USING "btree" ("company");



CREATE INDEX "idx_jobs_is_active" ON "public"."jobs" USING "btree" ("is_active");



CREATE INDEX "idx_jobs_job_title" ON "public"."jobs" USING "btree" ("job_title");



CREATE INDEX "idx_jobs_last_checked" ON "public"."jobs" USING "btree" ("last_checked");



CREATE INDEX "idx_jobs_resume_score" ON "public"."jobs" USING "btree" ("resume_score");



CREATE INDEX "idx_jobs_scraped_at" ON "public"."jobs" USING "btree" ("scraped_at");



CREATE INDEX "idx_jobs_status" ON "public"."jobs" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "update_customized_resumes_last_updated" BEFORE UPDATE ON "public"."customized_resumes" FOR EACH ROW EXECUTE FUNCTION "public"."update_last_updated_column"();



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_customized_resume_id_fkey" FOREIGN KEY ("customized_resume_id") REFERENCES "public"."customized_resumes"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE "public"."customized_resumes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resumes" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_jobs_for_rescore"("p_limit_val" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_jobs_for_rescore"("p_limit_val" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_jobs_for_rescore"("p_limit_val" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_jobs_for_resume_generation_custom_sort"("p_page_number" integer, "p_page_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_jobs_for_resume_generation_custom_sort"("p_page_number" integer, "p_page_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_jobs_for_resume_generation_custom_sort"("p_page_number" integer, "p_page_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_top_scored_jobs_custom_sort"("p_page_number" integer, "p_page_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_top_scored_jobs_custom_sort"("p_page_number" integer, "p_page_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_top_scored_jobs_custom_sort"("p_page_number" integer, "p_page_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_last_updated_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_last_updated_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_last_updated_column"() TO "service_role";



GRANT ALL ON TABLE "public"."customized_resumes" TO "anon";
GRANT ALL ON TABLE "public"."customized_resumes" TO "authenticated";
GRANT ALL ON TABLE "public"."customized_resumes" TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON TABLE "public"."resumes" TO "anon";
GRANT ALL ON TABLE "public"."resumes" TO "authenticated";
GRANT ALL ON TABLE "public"."resumes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."resumes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."resumes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."resumes_id_seq" TO "service_role";



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
