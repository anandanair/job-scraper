import { ScrapedJob, CareersFutureConfig } from "./types";
import { convertHtmlToMarkdown } from "./html-to-markdown";
import { SupabaseClient } from "@supabase/supabase-js";
import { getExistingJobsCache, saveJobsToSupabase } from "./supabase-utils";

const CF_SUGGESTIONS_URL = "https://api.mycareersfuture.gov.sg/v2/skills/suggestions";
const CF_SEARCH_BASE_URL = "https://api.mycareersfuture.gov.sg/v2/search";

interface CFSuggestionsResponse {
  skills?: Array<{ uuid: string; skill?: string }>;
}

interface CFCompany {
  name?: string;
}

interface CFSearchResultItem {
  uuid?: string;
  title?: string;
  hiringCompany?: CFCompany;
  postedCompany?: CFCompany;
}

interface CFSearchResponse {
  results?: CFSearchResultItem[];
  total?: number;
  _links?: {
    next?: {
      href?: string;
    };
  };
}

interface CFJobDetailResponse {
  uuid?: string;
  title?: string;
  description?: string;
  hiringCompany?: CFCompany;
  postedCompany?: CFCompany;
  positionLevels?: Array<{ position?: string }>;
  metadata?: {
    createdAt?: string;
  };
}

function getCompanyName(item: { hiringCompany?: CFCompany; postedCompany?: CFCompany }): string | null {
  if (item.hiringCompany?.name && item.hiringCompany.name.trim()) {
    return item.hiringCompany.name.trim();
  }
  if (item.postedCompany?.name && item.postedCompany.name.trim()) {
    return item.postedCompany.name.trim();
  }
  return null;
}

/**
 * 1. Fetch skill UUIDs from CareersFuture skills suggestions endpoint.
 */
async function fetchSkillSuggestions(jobTitle: string, timeoutMs: number = 30000): Promise<string[]> {
  try {
    console.log(`[CareersFuture] Fetching skill suggestions for query: '${jobTitle}'`);
    const params = new URLSearchParams();
    params.append("jobTitle", jobTitle);

    const res = await fetch(CF_SUGGESTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      console.warn(`[CareersFuture] Skill suggestions returned status ${res.status}`);
      return [];
    }

    const data = (await res.json()) as CFSuggestionsResponse;
    const uuids = (data.skills || []).map((s) => s.uuid).filter(Boolean);
    console.log(`[CareersFuture] Retrieved ${uuids.length} skill UUIDs for '${jobTitle}'.`);
    return uuids;
  } catch (err) {
    console.warn("[CareersFuture] Error retrieving skill suggestions:", err);
    return [];
  }
}

/**
 * 2. Search for jobs and handle pagination.
 */
export async function fetchCareersFutureJobs(
  searchQuery: string,
  config: CareersFutureConfig
): Promise<CFSearchResultItem[]> {
  const skillUuids = await fetchSkillSuggestions(searchQuery, config.requestTimeoutSeconds * 1000);

  const allItems: CFSearchResultItem[] = [];
  let currentSearchUrl: string | null = `${CF_SEARCH_BASE_URL}?limit=100&page=0`;
  let totalApiCalls = 0;

  const payload = {
    sessionId: "",
    search: searchQuery,
    categories: config.categories,
    employmentTypes: config.employmentTypes,
    postingCompany: [],
    sortBy: ["new_posting_date"],
    skillUuids,
  };

  try {
    while (currentSearchUrl) {
      totalApiCalls++;
      console.log(`[CareersFuture] API Call ${totalApiCalls}: POST ${currentSearchUrl}`);

      const res = await fetch(currentSearchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(config.requestTimeoutSeconds * 1000),
      });

      if (!res.ok) {
        console.error(`[CareersFuture] Search returned status ${res.status} on page ${totalApiCalls}`);
        break;
      }

      const data = (await res.json()) as CFSearchResponse;
      const pageResults = data.results || [];
      allItems.push(...pageResults);

      console.log(`[CareersFuture] Page ${totalApiCalls} returned ${pageResults.length} items (Total: ${allItems.length}).`);

      if (totalApiCalls === 1 && typeof data.total === "number") {
        console.log(`[CareersFuture] API reports total potential matching jobs: ${data.total}`);
      }

      // Check next page link
      const nextHref = data._links?.next?.href;
      currentSearchUrl = nextHref && nextHref.startsWith("http") ? nextHref : null;
    }
  } catch (err) {
    console.error("[CareersFuture] Exception during job search pagination:", err);
  }

  console.log(`[CareersFuture] Completed search for '${searchQuery}'. Total candidate items: ${allItems.length}`);
  return allItems;
}

/**
 * 3. Fetch detailed posting for a single CareersFuture job ID.
 */
export async function fetchCareersFutureJobDetails(
  jobId: string,
  timeoutMs: number = 30000
): Promise<ScrapedJob | null> {
  if (!jobId || !jobId.trim()) return null;

  const apiUrl = `https://api.mycareersfuture.gov.sg/v2/jobs/${jobId.trim()}`;

  try {
    const res = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      if (res.status === 404) {
        console.warn(`[CareersFuture] Job details not found (404) for ID: ${jobId}`);
      } else {
        console.error(`[CareersFuture] Job details fetch returned ${res.status} for ID: ${jobId}`);
      }
      return null;
    }

    const jobData = (await res.json()) as CFJobDetailResponse;
    const rawHtml = jobData.description || "";
    const markdown = convertHtmlToMarkdown(rawHtml);

    if (!markdown || !markdown.trim()) {
      console.warn(`[CareersFuture] Empty description after Markdown conversion for ID ${jobId}. Skipping.`);
      return null;
    }

    return {
      job_id: jobData.uuid || jobId,
      company: getCompanyName(jobData),
      job_title: jobData.title || null,
      location: "Singapore",
      level: jobData.positionLevels?.[0]?.position || "Not applicable",
      provider: "careers_future",
      description: markdown,
      posted_at: jobData.metadata?.createdAt || new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[CareersFuture] Error fetching details for job ID ${jobId}:`, err);
    return null;
  }
}

/**
 * Orchestrates scraping, candidate filtering against Supabase cache, and detail fetching.
 */
export async function processCareersFutureQuery(
  searchQuery: string,
  supabase: SupabaseClient | null | undefined,
  config: CareersFutureConfig,
  limit?: number
): Promise<ScrapedJob[]> {
  // 1. Fetch all candidate items
  const candidates = await fetchCareersFutureJobs(searchQuery, config);
  if (candidates.length === 0) {
    console.log(`[CareersFuture] No candidates found for query '${searchQuery}'.`);
    return [];
  }

  // 2. Filter against Supabase cache
  const { existingIds, companyTitleKeys } = await getExistingJobsCache(supabase);

  const newJobIdsToProcess: string[] = [];
  let skippedById = 0;
  let skippedByCombo = 0;

  for (const item of candidates) {
    const uuid = item.uuid ? String(item.uuid).trim() : "";
    if (!uuid) continue;

    if (existingIds.has(uuid)) {
      skippedById++;
      continue;
    }

    const comp = getCompanyName(item);
    const title = item.title;
    if (comp && title) {
      const comboKey = `${comp.trim().toLowerCase()}:::${title.trim().toLowerCase()}`;
      if (companyTitleKeys.has(comboKey)) {
        skippedByCombo++;
        continue;
      }
    }

    newJobIdsToProcess.push(uuid);
  }

  console.log(`[CareersFuture] Found ${candidates.length} candidates. Skipped ${skippedById} existing IDs, ${skippedByCombo} company/title duplicates.`);
  console.log(`[CareersFuture] Identified ${newJobIdsToProcess.length} genuinely new job(s) to fetch details for.`);

  if (newJobIdsToProcess.length === 0) {
    return [];
  }

  const idsToFetch = limit && newJobIdsToProcess.length > limit
    ? newJobIdsToProcess.slice(0, limit)
    : newJobIdsToProcess;

  console.log(`\n--- [CareersFuture] Fetching details for ${idsToFetch.length} new job(s) ---`);
  const detailedJobs: ScrapedJob[] = [];

  for (const id of idsToFetch) {
    const details = await fetchCareersFutureJobDetails(id, config.requestTimeoutSeconds * 1000);
    if (details && details.description) {
      detailedJobs.push(details);
    }
  }

  console.log(`[CareersFuture] Successfully extracted details for ${detailedJobs.length} new job(s).`);
  return detailedJobs;
}
