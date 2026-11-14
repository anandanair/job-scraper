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
  filterKeywords: string[] = [],
  limit?: number
): Promise<ScrapedJob[]> {
  const allJobs: ScrapedJob[] = [];
  const maxLimit = typeof limit === "number" && limit > 0 ? limit : Infinity;

  for (const company of companies) {
    if (allJobs.length >= maxLimit) break;
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
  return allJobs.slice(0, maxLimit);
}

export interface SingleAtsJobDetails {
  job_id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  workplace_type: "remote" | "hybrid" | "onsite" | null;
  application_url: string;
  provider: "greenhouse" | "lever" | "ashby";
}

/**
 * Fetch a single job directly from Ashby's public job board API.
 * E.g. https://jobs.ashbyhq.com/supabase/62945518-2468-4cf5-9f36-904b60f75183
 */
export async function fetchAshbyJobDetails(
  companySlug: string,
  jobId: string
): Promise<SingleAtsJobDetails | null> {
  const slug = companySlug.trim().toLowerCase();
  const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const rawJobs: AshbyJobItem[] = Array.isArray(data.jobs) ? data.jobs : [];
    const item = rawJobs.find(
      (j) => j.id === jobId || String(j.id).toLowerCase() === jobId.toLowerCase()
    );
    if (!item) return null;

    const title = item.title?.trim() || "";
    const rawHtml = item.descriptionHtml || "";
    const markdown = convertHtmlToMarkdown(rawHtml) || `${title} at ${slug}`;
    const loc = item.location?.trim() || (item.isRemote ? "Remote" : "Not specified");

    const descLower = (title + " " + loc + " " + markdown.slice(0, 1000)).toLowerCase();
    let workplaceType: "remote" | "hybrid" | "onsite" = "onsite";
    if (item.isRemote === true || descLower.includes("remote")) {
      workplaceType = "remote";
    } else if (descLower.includes("hybrid")) {
      workplaceType = "hybrid";
    }

    const companyFormatted = slug.charAt(0).toUpperCase() + slug.slice(1);

    return {
      job_id: `ashby_${slug}_${item.id}`,
      title,
      company: companyFormatted,
      location: loc,
      description: markdown,
      workplace_type: workplaceType,
      application_url: item.jobUrl || `https://jobs.ashbyhq.com/${slug}/${item.id}`,
      provider: "ashby",
    };
  } catch (err: any) {
    console.warn(`[Ashby] Failed to fetch single job '${jobId}' for '${slug}':`, err.message);
    return null;
  }
}

/**
 * Fetch a single job directly from Greenhouse's public board API.
 * E.g. https://boards.greenhouse.io/stripe/jobs/8172487
 */
export async function fetchGreenhouseJobDetails(
  companySlug: string,
  jobId: string
): Promise<SingleAtsJobDetails | null> {
  const slug = companySlug.trim().toLowerCase();
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs/${jobId}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return null;
    const item = await res.json();
    const title = item.title?.trim() || "";
    if (!title) return null;

    let rawHtml = item.content || "";
    if (rawHtml.includes("&lt;") && rawHtml.includes("&gt;")) {
      rawHtml = rawHtml
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&amp;", "&")
        .replaceAll("&quot;", '"')
        .replaceAll("&#39;", "'");
    }
    const markdown = convertHtmlToMarkdown(rawHtml) || `${title} at ${slug}`;
    const loc = item.location?.name?.trim() || "Not specified";

    const descLower = (title + " " + loc + " " + markdown.slice(0, 1000)).toLowerCase();
    let workplaceType: "remote" | "hybrid" | "onsite" = "onsite";
    if (descLower.includes("remote")) {
      workplaceType = "remote";
    } else if (descLower.includes("hybrid")) {
      workplaceType = "hybrid";
    }

    const companyFormatted = slug.charAt(0).toUpperCase() + slug.slice(1);

    return {
      job_id: `gh_${slug}_${item.id}`,
      title,
      company: companyFormatted,
      location: loc,
      description: markdown,
      workplace_type: workplaceType,
      application_url: item.absolute_url || `https://boards.greenhouse.io/${slug}/jobs/${item.id}`,
      provider: "greenhouse",
    };
  } catch (err: any) {
    console.warn(`[Greenhouse] Failed to fetch single job '${jobId}' for '${slug}':`, err.message);
    return null;
  }
}

/**
 * Fetch a single job directly from Lever's public postings API.
 * E.g. https://jobs.lever.co/palantir/6ed76ce8-4156-4b60-b120-403538bd66cd
 */
export async function fetchLeverJobDetails(
  companySlug: string,
  jobId: string
): Promise<SingleAtsJobDetails | null> {
  const slug = companySlug.trim().toLowerCase();
  const url = `https://api.lever.co/v0/postings/${slug}/${jobId}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return null;
    const item = await res.json();
    const title = item.text?.trim() || "";
    if (!title) return null;

    let fullHtml = item.description || "";
    if (Array.isArray(item.lists)) {
      for (const list of item.lists) {
        if (list.text) fullHtml += `<h3>${list.text}</h3>`;
        if (list.content) fullHtml += `<ul>${list.content}</ul>`;
      }
    }
    if (item.additional) {
      fullHtml += item.additional;
    }

    const markdown = convertHtmlToMarkdown(fullHtml) || `${title} at ${slug}`;
    const loc = item.categories?.location?.trim() || "Not specified";

    const descLower = (title + " " + loc + " " + markdown.slice(0, 1000)).toLowerCase();
    let workplaceType: "remote" | "hybrid" | "onsite" = "onsite";
    if (item.workplaceType === "remote" || descLower.includes("remote")) {
      workplaceType = "remote";
    } else if (item.workplaceType === "hybrid" || descLower.includes("hybrid")) {
      workplaceType = "hybrid";
    }

    const companyFormatted = slug.charAt(0).toUpperCase() + slug.slice(1);

    return {
      job_id: `lever_${slug}_${item.id}`,
      title,
      company: companyFormatted,
      location: loc,
      description: markdown,
      workplace_type: workplaceType,
      application_url: item.hostedUrl || item.applyUrl || `https://jobs.lever.co/${slug}/${item.id}`,
      provider: "lever",
    };
  } catch (err: any) {
    console.warn(`[Lever] Failed to fetch single job '${jobId}' for '${slug}':`, err.message);
    return null;
  }
}

