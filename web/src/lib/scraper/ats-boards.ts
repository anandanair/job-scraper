import { ScrapedJob } from "./types";
import { convertHtmlToMarkdown } from "./html-to-markdown";

interface GreenhouseJobItem {
  id: number | string;
  title?: string;
  location?: { name?: string };
  absolute_url?: string;
  content?: string;
  updated_at?: string;
}

interface LeverJobItem {
  id: string;
  text?: string;
  hostedUrl?: string;
  applyUrl?: string;
  categories?: {
    location?: string;
    commitment?: string;
    team?: string;
  };
  description?: string;
  descriptionPlain?: string;
  createdAt?: number;
}

interface AshbyJobItem {
  id: string;
  title?: string;
  location?: string;
  department?: string;
  employmentType?: string;
  jobUrl?: string;
  isRemote?: boolean;
  descriptionHtml?: string;
  publishedAt?: string;
}

/**
 * Normalizes query matching against job title and department.
 */
function matchesKeywords(title: string, keywords: string[]): boolean {
  if (!keywords || keywords.length === 0) return true;
  const t = title.toLowerCase();
  return keywords.some((k) => t.includes(k.trim().toLowerCase()));
}

/**
 * 1. Fetch public jobs directly from a company's Greenhouse job board.
 * E.g. companySlug: "stripe", "figma", "airbnb", "grab", "carousell"
 */
export async function fetchGreenhouseCompanyJobs(
  companySlug: string,
  filterKeywords: string[] = []
): Promise<ScrapedJob[]> {
  const slug = companySlug.trim().toLowerCase();
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      if (res.status === 404) {
        console.warn(`[Greenhouse] Company slug '${slug}' not found (404).`);
      } else {
        console.warn(`[Greenhouse] Fetch failed for '${slug}': HTTP ${res.status}`);
      }
      return [];
    }

    const data = await res.json();
    const rawJobs: GreenhouseJobItem[] = Array.isArray(data.jobs) ? data.jobs : [];
    const jobs: ScrapedJob[] = [];

    for (const item of rawJobs) {
      const title = item.title?.trim() || "";
      if (!title || !matchesKeywords(title, filterKeywords)) {
        continue;
      }

      const rawHtml = item.content || "";
      const markdown = convertHtmlToMarkdown(rawHtml);
      if (!markdown || !markdown.trim()) continue;

      const loc = item.location?.name?.trim() || "Remote";
      const descLower = (title + " " + loc + " " + markdown.slice(0, 1000)).toLowerCase();
      const workplaceType: "remote" | "hybrid" | "onsite" = descLower.includes("remote")
        ? "remote"
        : descLower.includes("hybrid")
          ? "hybrid"
          : "onsite";

      jobs.push({
        job_id: `gh_${slug}_${item.id}`,
        company: slug.charAt(0).toUpperCase() + slug.slice(1),
        job_title: title,
        location: loc,
        level: "Not specified",
        provider: "greenhouse",
        description: markdown,
        posted_at: item.updated_at || new Date().toISOString(),
        workplace_type: workplaceType,
        application_url: item.absolute_url || `https://boards.greenhouse.io/${slug}/jobs/${item.id}`,
      });
    }

    console.log(`[Greenhouse] Extracted ${jobs.length} matching jobs for company '${slug}'.`);
    return jobs;
  } catch (err: any) {
    console.warn(`[Greenhouse] Error fetching jobs for '${slug}':`, err.message);
    return [];
  }
}

/**
 * 2. Fetch public jobs directly from a company's Lever job board.
 * E.g. companySlug: "canva", "netflix", "spotify"
 */
export async function fetchLeverCompanyJobs(
  companySlug: string,
  filterKeywords: string[] = []
): Promise<ScrapedJob[]> {
  const slug = companySlug.trim().toLowerCase();
  const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      console.warn(`[Lever] Fetch failed for '${slug}': HTTP ${res.status}`);
      return [];
    }

    const rawJobs: LeverJobItem[] = await res.json();
    if (!Array.isArray(rawJobs)) return [];

    const jobs: ScrapedJob[] = [];
    for (const item of rawJobs) {
      const title = item.text?.trim() || "";
      if (!title || !matchesKeywords(title, filterKeywords)) {
        continue;
      }

      const rawHtml = item.description || "";
      const markdown = convertHtmlToMarkdown(rawHtml);
      if (!markdown || !markdown.trim()) continue;

      const loc = item.categories?.location?.trim() || "Remote";
      const descLower = (title + " " + loc + " " + markdown.slice(0, 1000)).toLowerCase();
      const workplaceType: "remote" | "hybrid" | "onsite" = descLower.includes("remote")
        ? "remote"
        : descLower.includes("hybrid")
          ? "hybrid"
          : "onsite";

      jobs.push({
        job_id: `lever_${slug}_${item.id}`,
        company: slug.charAt(0).toUpperCase() + slug.slice(1),
        job_title: title,
        location: loc,
        level: item.categories?.commitment || "Full-time",
        provider: "lever",
        description: markdown,
        posted_at: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
        workplace_type: workplaceType,
        application_url: item.hostedUrl || item.applyUrl || `https://jobs.lever.co/${slug}/${item.id}`,
      });
    }

    console.log(`[Lever] Extracted ${jobs.length} matching jobs for company '${slug}'.`);
    return jobs;
  } catch (err: any) {
    console.warn(`[Lever] Error fetching jobs for '${slug}':`, err.message);
    return [];
  }
}

/**
 * 3. Fetch public jobs directly from a company's Ashby job board.
 */
export async function fetchAshbyCompanyJobs(
  companySlug: string,
  filterKeywords: string[] = []
): Promise<ScrapedJob[]> {
  const slug = companySlug.trim().toLowerCase();
  const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const rawJobs: AshbyJobItem[] = Array.isArray(data.jobs) ? data.jobs : [];
    const jobs: ScrapedJob[] = [];

    for (const item of rawJobs) {
      const title = item.title?.trim() || "";
      if (!title || !matchesKeywords(title, filterKeywords)) {
        continue;
      }

      const rawHtml = item.descriptionHtml || "";
      const markdown = convertHtmlToMarkdown(rawHtml) || `${title} at ${slug}`;
      const loc = item.location?.trim() || (item.isRemote ? "Remote" : "Not specified");

      jobs.push({
        job_id: `ashby_${slug}_${item.id}`,
        company: slug.charAt(0).toUpperCase() + slug.slice(1),
        job_title: title,
        location: loc,
        level: item.employmentType || "Full-time",
        provider: "ashby",
        description: markdown,
        posted_at: item.publishedAt || new Date().toISOString(),
        workplace_type: item.isRemote ? "remote" : "onsite",
        application_url: item.jobUrl || `https://jobs.ashbyhq.com/${slug}/${item.id}`,
      });
    }

    console.log(`[Ashby] Extracted ${jobs.length} matching jobs for company '${slug}'.`);
    return jobs;
  } catch (err: any) {
    console.warn(`[Ashby] Error fetching jobs for '${slug}':`, err.message);
    return [];
  }
}

/**
 * Dispatches company ATS searches across Greenhouse, Lever, and Ashby.
 */
export async function scrapeTargetCompanies(
  companies: string[],
  filterKeywords: string[] = []
): Promise<ScrapedJob[]> {
  const allJobs: ScrapedJob[] = [];
  for (const company of companies) {
    const clean = company.trim().toLowerCase();
    if (!clean) continue;

    // Try Greenhouse first
    let found = await fetchGreenhouseCompanyJobs(clean, filterKeywords);
    if (found.length === 0) {
      // Try Lever
      found = await fetchLeverCompanyJobs(clean, filterKeywords);
    }
    if (found.length === 0) {
      // Try Ashby
      found = await fetchAshbyCompanyJobs(clean, filterKeywords);
    }
    allJobs.push(...found);
  }
  return allJobs;
}
