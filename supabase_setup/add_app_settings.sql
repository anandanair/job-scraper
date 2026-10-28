-- Migration: Add app_settings table for dynamic configuration
CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "llm_provider" "text" NOT NULL DEFAULT 'gemini',
    "llm_model" "text" NOT NULL DEFAULT 'gemini-3.8-flash',
    "llm_api_key" "text",
    "llm_tier" "text" NOT NULL DEFAULT 'free', -- 'free' | 'paid'
    
    -- Search preferences
    "linkedin_search_queries" "jsonb" NOT NULL DEFAULT '["Software Engineer", "Full Stack Developer"]'::"jsonb",
    "linkedin_location" "text" NOT NULL DEFAULT 'Singapore',
    "linkedin_geo_id" "text" NOT NULL DEFAULT '102454443',
    "linkedin_job_type" "text" DEFAULT 'F',
    "linkedin_job_posting_date" "text" DEFAULT 'r86400',
    "linkedin_f_wt" "text" DEFAULT '1,2,3',
    
    "careers_future_search_queries" "jsonb" NOT NULL DEFAULT '["Software Engineer", "Frontend Developer"]'::"jsonb",
    "careers_future_search_categories" "jsonb" DEFAULT '["Information Technology"]'::"jsonb",
    "careers_future_search_employment_types" "jsonb" DEFAULT '["Full Time"]'::"jsonb",
    
    -- Scraping & Processing limits
    "scraping_sources" "jsonb" NOT NULL DEFAULT '["linkedin"]'::"jsonb",
    "jobs_to_score_per_run" integer NOT NULL DEFAULT 10,
    "jobs_to_customize_per_run" integer NOT NULL DEFAULT 2,
    "max_jobs_per_search" "jsonb" DEFAULT '{"linkedin": 10, "careers_future": 20}'::"jsonb",
    
    -- Rate limits & timing
    "llm_max_rpm" integer NOT NULL DEFAULT 10,
    "llm_request_delay_seconds" integer NOT NULL DEFAULT 8,
    "llm_daily_request_budget" integer NOT NULL DEFAULT 0,
    
    -- Timestamps
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "public"."app_settings" OWNER TO "postgres";
ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."app_settings" TO "service_role";

-- Seed singleton default configuration if no row exists
INSERT INTO "public"."app_settings" (id)
SELECT '00000000-0000-0000-0000-000000000001'::uuid
WHERE NOT EXISTS (SELECT 1 FROM "public"."app_settings");
