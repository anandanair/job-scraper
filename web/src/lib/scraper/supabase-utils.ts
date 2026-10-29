import { SupabaseClient } from "@supabase/supabase-js";
import { ScrapedJob, LinkedInConfig, CareersFutureConfig } from "./types";

export interface LoadedScraperSettings {
  scrapingSources: string[];
  maxJobsPerSearch: Record<string, number>;
  linkedinQueries: string[];
  linkedinConfig: LinkedInConfig;
  careersFutureQueries: string[];
  careersFutureConfig: CareersFutureConfig;
}

// Module-level cache for in-memory deduplication across multiple queries in a single execution
let cachedExistingIds: Set<string> | null = null;
let cachedCompanyTitleKeys: Set<string> | null = null;

export const SAFE_MAX_SCRAPE_PER_SOURCE = 30;

export const DEFAULT_LINKEDIN_CONFIG: LinkedInConfig = {
  maxStart: 25,
  requestTimeoutSeconds: 30,
  maxRetries: 3,
  retryDelaySeconds: 60,
  detailFetchMinDelay: 12.0,
  detailFetchMaxDelay: 22.0,
  searchQueryMinDelay: 15.0,
  searchQueryMaxDelay: 30.0,
  location: "Singapore",
  geoId: 102454443,
  jobType: "F",
  jobPostingDate: "r86400",
  f_WT: "1,2,3",
};

export const DEFAULT_CAREERS_FUTURE_CONFIG: CareersFutureConfig = {
  categories: [],
  employmentTypes: [],
  maxRetries: 3,
  requestTimeoutSeconds: 30,
};

/**
 * Loads dynamic scraper settings from the Supabase `app_settings` table.
 * Falls back to default configurations if Supabase is unconfigured or empty.
 */
export async function loadScraperSettings(
  supabase?: SupabaseClient | null
): Promise<LoadedScraperSettings> {
  const defaults: LoadedScraperSettings = {
    scrapingSources: ["linkedin"],
    maxJobsPerSearch: {
      linkedin: 5,
      careers_future: 5,
      daily_scrape_linkedin: 15,
      daily_scrape_careers_future: 15,
    },
    linkedinQueries: [],
    linkedinConfig: { ...DEFAULT_LINKEDIN_CONFIG },
    careersFutureQueries: [],
    careersFutureConfig: { ...DEFAULT_CAREERS_FUTURE_CONFIG },
  };

  if (!supabase) {
    console.warn("⚠️ No Supabase client provided. Using default in-memory scraper settings.");
    return defaults;
  }

  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.warn("⚠️ Could not load remote app_settings (falling back to defaults):", error?.message || "Empty table");
      return defaults;
    }

    const rawMaxJobs = data.max_jobs_per_search || defaults.maxJobsPerSearch;
    const lQueries = data.linkedin_search_queries || [];
    const cfQueries = (data.careers_future_search_queries && data.careers_future_search_queries.length > 0)
      ? data.careers_future_search_queries
      : lQueries;

    const dailyScrapeLinkedin = Math.min(
      SAFE_MAX_SCRAPE_PER_SOURCE,
      typeof rawMaxJobs.daily_scrape_linkedin === "number"
        ? rawMaxJobs.daily_scrape_linkedin
        : (typeof rawMaxJobs.linkedin === "number" ? Math.min(SAFE_MAX_SCRAPE_PER_SOURCE, rawMaxJobs.linkedin) : 15)
    );

    const dailyScrapeCf = Math.min(
      SAFE_MAX_SCRAPE_PER_SOURCE,
      typeof rawMaxJobs.daily_scrape_careers_future === "number"
        ? rawMaxJobs.daily_scrape_careers_future
        : (typeof rawMaxJobs.careers_future === "number" ? Math.min(SAFE_MAX_SCRAPE_PER_SOURCE, rawMaxJobs.careers_future) : 15)
    );

    const linkedinPerQuery = Math.max(1, Math.floor(dailyScrapeLinkedin / Math.max(1, lQueries.length)));
    const cfPerQuery = Math.max(1, Math.floor(dailyScrapeCf / Math.max(1, cfQueries.length)));

    const maxJobs: Record<string, number> = {
      ...rawMaxJobs,
      daily_scrape_linkedin: dailyScrapeLinkedin,
      daily_scrape_careers_future: dailyScrapeCf,
      linkedin: Math.min(SAFE_MAX_SCRAPE_PER_SOURCE, linkedinPerQuery),
      careers_future: Math.min(SAFE_MAX_SCRAPE_PER_SOURCE, cfPerQuery),
    };

    const sources = Array.isArray(data.scraping_sources) && data.scraping_sources.length > 0
      ? data.scraping_sources
      : defaults.scrapingSources;

    return {
      scrapingSources: sources,
      maxJobsPerSearch: maxJobs,
      linkedinQueries: data.linkedin_search_queries || [],
      linkedinConfig: {
        ...DEFAULT_LINKEDIN_CONFIG,
        location: data.linkedin_location || DEFAULT_LINKEDIN_CONFIG.location,
        geoId: data.linkedin_geo_id ? Number(data.linkedin_geo_id) || data.linkedin_geo_id : DEFAULT_LINKEDIN_CONFIG.geoId,
        jobType: data.linkedin_job_type || DEFAULT_LINKEDIN_CONFIG.jobType,
        jobPostingDate: data.linkedin_job_posting_date || DEFAULT_LINKEDIN_CONFIG.jobPostingDate,
        f_WT: data.linkedin_f_wt || DEFAULT_LINKEDIN_CONFIG.f_WT,
      },
      careersFutureQueries: data.careers_future_search_queries || [],
      careersFutureConfig: {
        ...DEFAULT_CAREERS_FUTURE_CONFIG,
        categories: data.careers_future_search_categories || [],
        employmentTypes: data.careers_future_search_employment_types || [],
      },
    };
  } catch (err) {
    console.warn("⚠️ Error fetching app_settings from Supabase:", err);
    return defaults;
  }
}

/**
 * Fetches all existing job IDs and company-title pairs from the Supabase `jobs` table.
 * Caches results in memory so subsequent query runs don't re-query Supabase.
 */
export async function getExistingJobsCache(
  supabase?: SupabaseClient | null,
  batchSize: number = 1000,
  forceRefresh: boolean = false
): Promise<{ existingIds: Set<string>; companyTitleKeys: Set<string> }> {
  if (!forceRefresh && cachedExistingIds !== null && cachedCompanyTitleKeys !== null) {
    return { existingIds: cachedExistingIds, companyTitleKeys: cachedCompanyTitleKeys };
  }

  const existingIds = new Set<string>();
  const companyTitleKeys = new Set<string>();

  if (!supabase) {
    cachedExistingIds = existingIds;
    cachedCompanyTitleKeys = companyTitleKeys;
    return { existingIds, companyTitleKeys };
  }

  try {
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("jobs")
        .select("job_id, company, job_title")
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.warn("⚠️ Could not query existing jobs from Supabase:", error.message);
        break;
      }

      if (!data || data.length === 0) {
        break;
      }

      for (const item of data) {
        if (item.job_id) {
          existingIds.add(String(item.job_id));
        }
        if (item.company && item.job_title) {
          const comboKey = `${item.company.trim().toLowerCase()}:::${item.job_title.trim().toLowerCase()}`;
          companyTitleKeys.add(comboKey);
        }
      }

      if (data.length < batchSize) {
        break;
      }
      offset += batchSize;
    }

    console.log(`✓ Fetched ${existingIds.size} existing job IDs and ${companyTitleKeys.size} company-title pairs from Supabase.`);
    cachedExistingIds = existingIds;
    cachedCompanyTitleKeys = companyTitleKeys;
  } catch (err) {
    console.warn("⚠️ Error while checking existing jobs in Supabase:", err);
  }

  return { existingIds, companyTitleKeys };
}

/**
 * Saves a list of scraped jobs into the Supabase `jobs` table using upsert.
 */
export async function saveJobsToSupabase(
  supabase: SupabaseClient | null | undefined,
  jobs: ScrapedJob[]
): Promise<number> {
  if (!jobs || jobs.length === 0) {
    return 0;
  }

  const validJobs = jobs.filter((j) => j.job_id && j.job_id.trim() !== "");
  if (validJobs.length === 0) {
    return 0;
  }

  if (!supabase) {
    console.log(`[Dry-Run/Unconfigured] Would have saved ${validJobs.length} jobs to Supabase.`);
    return validJobs.length;
  }

  try {
    const payload = validJobs.map((j) => ({
      job_id: String(j.job_id),
      company: j.company,
      job_title: j.job_title,
      level: j.level,
      location: j.location,
      description: j.description,
      provider: j.provider,
      posted_at: j.posted_at || null,
      scraped_at: new Date().toISOString(),
      last_checked: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("jobs")
      .upsert(payload, { onConflict: "job_id" })
      .select("job_id");

    if (error) {
      console.error("✗ Error saving jobs to Supabase:", error.message);
      return 0;
    }

    const savedCount = data ? data.length : validJobs.length;
    console.log(`✓ Successfully upserted ${savedCount} job(s) to Supabase.`);

    // Update in-memory deduplication cache
    if (cachedExistingIds && cachedCompanyTitleKeys) {
      for (const j of validJobs) {
        cachedExistingIds.add(String(j.job_id));
        if (j.company && j.job_title) {
          cachedCompanyTitleKeys.add(`${j.company.trim().toLowerCase()}:::${j.job_title.trim().toLowerCase()}`);
        }
      }
    }

    return savedCount;
  } catch (err) {
    console.error("✗ Exception occurred while upserting jobs to Supabase:", err);
    return 0;
  }
}
