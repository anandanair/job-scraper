import * as cheerio from "cheerio";
import { Impit } from "impit";
import { ScrapedJob, CandidateJob, LinkedInConfig } from "./types";
import { convertHtmlToMarkdown } from "./html-to-markdown";
import { SupabaseClient } from "@supabase/supabase-js";
import { getExistingJobsCache } from "./supabase-utils";

let linkedinSession: Impit | null = null;

function getLinkedInClient(): Impit {
  if (!linkedinSession) {
    linkedinSession = new Impit({
      browser: "chrome",
    });
    console.log("[LinkedIn] Initialized persistent Impit Chrome session with native TLS/JA4 impersonation.");
  }
  return linkedinSession;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * 1. Fetch job card candidates (ID, title, company, location) from LinkedIn guest search API.
 */
export async function fetchLinkedInJobIds(
  searchQuery: string,
  location: string,
  config: LinkedInConfig
): Promise<CandidateJob[]> {
  const candidateJobs: CandidateJob[] = [];
  const seenIds = new Set<string>();
  let start = 0;
  const maxStart = config.maxStart;

  const fWtParam = config.f_WT ? `&f_WT=${encodeURIComponent(config.f_WT)}` : "";
  const client = getLinkedInClient();

  console.log(`[LinkedIn] --- Starting Phase 1: Scraping Candidate IDs (Max Start: ${maxStart}) ---`);

  while (start <= maxStart) {
    const targetUrl = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(
      searchQuery
    )}&location=${encodeURIComponent(location)}&geoId=${config.geoId}&f_TPR=${config.jobPostingDate}&f_JT=${
      config.jobType
    }${fWtParam}&start=${start}`;

    if (start > 0) {
      const sleepTime = randomBetween(8.0, 16.0);
      console.log(`[LinkedIn] Waiting for ${sleepTime.toFixed(2)}s before next search page...`);
      await sleep(sleepTime * 1000);
    }

    console.log(`[LinkedIn] Scraping URL: ${targetUrl}`);

    let responseText: string | null = null;
    let retries = 0;

    while (retries <= config.maxRetries) {
      try {
        const res = await client.fetch(targetUrl, {
          method: "GET",
          headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin",
            "Upgrade-Insecure-Requests": "1",
          },
        });

        if (res.status === 429) {
          retries++;
          if (retries <= config.maxRetries) {
            const waitTime = config.retryDelaySeconds * Math.pow(2, retries - 1) + randomBetween(2, 8);
            console.warn(`[LinkedIn] HTTP 429: Too Many Requests. Cooling down attempt ${retries}/${config.maxRetries} for ${waitTime.toFixed(2)}s...`);
            await sleep(waitTime * 1000);
            continue;
          } else {
            console.error(`[LinkedIn] HTTP 429 exceeded maximum retries (${config.maxRetries}).`);
            break;
          }
        }

        if (!res.ok) {
          console.error(`[LinkedIn] HTTP Error fetching search page: Status ${res.status}`);
          break;
        }

        responseText = await res.text();
        break;
      } catch (err) {
        console.error(`[LinkedIn] Request exception while fetching search page:`, err);
        break;
      }
    }

    if (!responseText || !responseText.trim()) {
      console.log(`[LinkedIn] Received empty response at start=${start}. Stopping pagination.`);
      break;
    }

    const $ = cheerio.load(responseText);
    const jobElements = $("li").toArray();

    if (jobElements.length === 0) {
      console.log(`[LinkedIn] No job listings ('li' elements) found on page at start=${start}. Stopping.`);
      break;
    }

    console.log(`[LinkedIn] Found ${jobElements.length} potential job elements on this page.`);
    let jobsFoundThisIteration = 0;

    for (const el of jobElements) {
      const $el = $(el);
      const baseCard = $el.find("div.base-card");
      const jobUrn = baseCard.attr("data-entity-urn");

      if (jobUrn && jobUrn.includes("jobPosting:")) {
        try {
          const parts = jobUrn.split(":");
          const jobId = parts[3];

          if (jobId && !seenIds.has(jobId)) {
            const title = $el.find("h3.base-search-card__title").text().trim() || null;
            const company = $el.find("h4.base-search-card__subtitle").text().trim() || null;
            const loc = $el.find("span.job-search-card__location").text().trim() || null;

            seenIds.add(jobId);
            candidateJobs.push({
              job_id: jobId,
              job_title: title,
              company,
              location: loc,
            });
            jobsFoundThisIteration++;
          }
        } catch (parseErr) {
          console.warn(`[LinkedIn] Could not parse job ID from URN: ${jobUrn}`, parseErr);
        }
      }
    }

    console.log(`[LinkedIn] Added ${jobsFoundThisIteration} unique job IDs from this page.`);
    if (jobsFoundThisIteration === 0 && jobElements.length > 0) {
      console.log("[LinkedIn] Found elements but no new job IDs extracted. End of relevant results.");
      break;
    }

    start += Math.max(jobElements.length, 10);
  }

  console.log(`[LinkedIn] --- Finished Phase 1: Found ${candidateJobs.length} candidate jobs ---`);
  return candidateJobs;
}

/**
 * 2. Fetch detailed information for a single LinkedIn job posting ID.
 */
export async function fetchLinkedInJobDetails(
  jobId: string,
  candidateFallback?: CandidateJob,
  config?: LinkedInConfig
): Promise<ScrapedJob | null> {
  const minDelay = config?.detailFetchMinDelay ?? 12.0;
  const maxDelay = config?.detailFetchMaxDelay ?? 22.0;
  const maxRetries = config?.maxRetries ?? 3;
  const retryDelay = config?.retryDelaySeconds ?? 60;

  const sleepTime = randomBetween(minDelay, maxDelay);
  console.log(`[LinkedIn] Waiting ${sleepTime.toFixed(2)}s before fetching details for job ID: ${jobId}...`);
  await sleep(sleepTime * 1000);

  const detailUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
  const client = getLinkedInClient();

  let responseText: string | null = null;
  let retries = 0;

  while (retries <= maxRetries) {
    try {
      const res = await client.fetch(detailUrl, {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (res.status === 429) {
        retries++;
        if (retries <= maxRetries) {
          const waitTime = retryDelay * Math.pow(2, retries - 1) + randomBetween(2, 8);
          console.warn(`[LinkedIn] HTTP 429 on job ID ${jobId}. Cooling down attempt ${retries}/${maxRetries} for ${waitTime.toFixed(2)}s...`);
          await sleep(waitTime * 1000);
          continue;
        } else {
          console.error(`[LinkedIn] HTTP 429 exceeded retries for job ID ${jobId}.`);
          return null;
        }
      }

      if (!res.ok) {
        console.error(`[LinkedIn] HTTP error ${res.status} fetching details for job ID ${jobId}.`);
        return null;
      }

      responseText = await res.text();
      break;
    } catch (err) {
      console.error(`[LinkedIn] Exception fetching details for job ID ${jobId}:`, err);
      return null;
    }
  }

  if (!responseText || !responseText.trim()) {
    console.warn(`[LinkedIn] Empty response text for job ID ${jobId}.`);
    return null;
  }

  try {
    const $ = cheerio.load(responseText);

    // Extract Company
    let company: string | null = null;
    const companyImgAlt = $("div.top-card-layout__card a img").attr("alt");
    if (companyImgAlt && companyImgAlt.trim()) {
      company = companyImgAlt.trim();
    }
    if (!company) {
      const companyLink = $("a.topcard__org-name-link").text().trim();
      if (companyLink) company = companyLink;
    }
    if (!company) {
      const subTitleSpan = $("span.topcard__flavor").text().trim();
      if (subTitleSpan) company = subTitleSpan;
    }
    if (!company && candidateFallback?.company) {
      company = candidateFallback.company;
    }

    // Extract Job Title
    let jobTitle: string | null = null;
    const titleH1 = $("h1.top-card-layout__title, h2.topcard__title").text().trim();
    if (titleH1) {
      jobTitle = titleH1;
    }
    if (!jobTitle) {
      const rawTitle = $("div.top-card-layout__entity-info a").first().text().trim();
      if (rawTitle) {
        jobTitle = rawTitle.split(/\r?\n/)[0].trim();
      }
    }
    if (!jobTitle && candidateFallback?.job_title) {
      jobTitle = candidateFallback.job_title;
    }
    if (jobTitle && jobTitle.includes("\n")) {
      jobTitle = jobTitle.split(/\r?\n/)[0].trim() || candidateFallback?.job_title || jobTitle;
    }

    // Extract Seniority Level
    let level: string | null = null;
    $("ul.description__job-criteria-list li").each((_, li) => {
      const header = $(li).find("h3.description__job-criteria-subheader").text();
      if (header && header.includes("Seniority level")) {
        const levelText = $(li).find("span.description__job-criteria-text").text().trim();
        if (levelText) {
          level = levelText;
          return false; // Break
        }
      }
    });

    // Extract Location
    let location: string | null = null;
    const locSpan = $("span.topcard__flavor.topcard__flavor--bullet").text().trim();
    if (locSpan) location = locSpan;
    if (!location) {
      const locFallback = $("div.topcard__flavor-row span.topcard__flavor").text().trim();
      if (locFallback) location = locFallback;
    }
    if (!location && candidateFallback?.location) {
      location = candidateFallback.location;
    }

    // Extract Description
    const descDiv = $("div.show-more-less-html__markup");
    let descriptionHtml = descDiv.length > 0 ? descDiv.html() || "" : "";
    const markdown = convertHtmlToMarkdown(descriptionHtml);

    if (!markdown || !markdown.trim()) {
      console.warn(`[LinkedIn] Skipping job ID ${jobId} due to empty description after conversion.`);
      return null;
    }

    return {
      job_id: jobId,
      company,
      job_title: jobTitle,
      level,
      location,
      provider: "linkedin",
      description: markdown,
      posted_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[LinkedIn] Error parsing details for job ID ${jobId}:`, err);
    return null;
  }
}

/**
 * Orchestrates scraping and detail fetching for a single query,
 * pre-filtering candidates against Supabase (by ID and company/title) BEFORE fetching details.
 */
export async function processLinkedInQuery(
  searchQuery: string,
  location: string,
  supabase: SupabaseClient | null | undefined,
  config: LinkedInConfig,
  limit?: number
): Promise<ScrapedJob[]> {
  const candidateJobs = await fetchLinkedInJobIds(searchQuery, location, config);
  if (candidateJobs.length === 0) {
    console.log("[LinkedIn] No job candidates found in Phase 1. Skipping detail fetching.");
    return [];
  }

  console.log("\n[LinkedIn] --- Starting Filtering Step: Checking against Supabase ---");
  const { existingIds, companyTitleKeys } = await getExistingJobsCache(supabase);

  const newCandidatesToProcess: CandidateJob[] = [];
  let skippedById = 0;
  let skippedByCombo = 0;

  for (const item of candidateJobs) {
    const jid = String(item.job_id);
    if (existingIds.has(jid)) {
      skippedById++;
      continue;
    }

    const comp = item.company;
    const title = item.job_title;
    if (comp && title) {
      const comboKey = `${comp.trim().toLowerCase()}:::${title.trim().toLowerCase()}`;
      if (companyTitleKeys.has(comboKey)) {
        skippedByCombo++;
        continue;
      }
    }

    newCandidatesToProcess.push(item);
  }

  console.log(
    `[LinkedIn] Phase 1 found ${candidateJobs.length} total candidates. ` +
    `Filtered against Supabase: ${skippedById} skipped by existing ID, ${skippedByCombo} skipped by company/title duplicate.`
  );
  console.log(`[LinkedIn] Identified ${newCandidatesToProcess.length} genuinely new jobs to fetch details for.`);

  if (newCandidatesToProcess.length === 0) {
    return [];
  }

  const candidatesToFetch = limit && newCandidatesToProcess.length > limit
    ? newCandidatesToProcess.slice(0, limit)
    : newCandidatesToProcess;

  console.log(`\n[LinkedIn] --- Starting Phase 2: Fetching Job Details for ${candidatesToFetch.length} New IDs ---`);
  const detailedNewJobs: ScrapedJob[] = [];

  for (const candidate of candidatesToFetch) {
    const details = await fetchLinkedInJobDetails(candidate.job_id, candidate, config);
    if (details && details.description) {
      detailedNewJobs.push(details);
    }
  }

  console.log(`[LinkedIn] --- Finished Phase 2: Successfully fetched details for ${detailedNewJobs.length} new job(s) ---`);
  return detailedNewJobs;
}
