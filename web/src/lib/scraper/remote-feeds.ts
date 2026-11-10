import { ScrapedJob } from "./types";
import { convertHtmlToMarkdown } from "./html-to-markdown";

interface RemoteOkItem {
  id?: string | number;
  position?: string;
  company?: string;
  location?: string;
  tags?: string[];
  description?: string;
  date?: string;
  url?: string;
  salary_min?: number;
  salary_max?: number;
}

/**
 * Fetches free remote tech jobs from RemoteOK's public open JSON feed.
 * Zero API keys, zero rate limiting on standard interval.
 */
export async function fetchRemoteOkJobs(
  keywords: string[] = [],
  limit: number = 10
): Promise<ScrapedJob[]> {
  try {
    const res = await fetch("https://remoteok.com/api", {
      headers: {
        "User-Agent": "JobTrack/2.0 (Open Source Job Discovery Engine)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      console.warn(`[RemoteOK] HTTP ${res.status} response from API.`);
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    // The first item in remoteOK api is a legal/metadata object, so skip it
    const rawJobs = data.slice(1) as RemoteOkItem[];
    const jobs: ScrapedJob[] = [];

    const lowerKeywords = keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);

    for (const item of rawJobs) {
      if (jobs.length >= limit) break;
      if (!item.id || !item.position || !item.company) continue;

      const title = item.position.trim();
      const company = item.company.trim();
      const tags = (item.tags || []).join(" ").toLowerCase();
      const searchBlob = `${title} ${tags} ${company}`.toLowerCase();

      if (lowerKeywords.length > 0) {
        const matches = lowerKeywords.some((k) => searchBlob.includes(k));
        if (!matches) continue;
      }

      const markdown = convertHtmlToMarkdown(item.description || "") || `${title} at ${company}`;

      jobs.push({
        job_id: `remoteok_${item.id}`,
        company,
        job_title: title,
        location: item.location || "Remote Worldwide",
        level: "Not specified",
        provider: "remote_ok",
        description: markdown,
        posted_at: item.date || new Date().toISOString(),
        salary_min: typeof item.salary_min === "number" ? item.salary_min : null,
        salary_max: typeof item.salary_max === "number" ? item.salary_max : null,
        salary_currency: item.salary_min || item.salary_max ? "USD" : null,
        salary_period: item.salary_min || item.salary_max ? "year" : null,
        workplace_type: "remote",
        application_url: item.url || `https://remoteok.com/remote-jobs/${item.id}`,
      });
    }

    console.log(`[RemoteOK] Extracted ${jobs.length} remote jobs matching keywords: [${keywords.join(", ")}].`);
    return jobs;
  } catch (err: any) {
    console.warn("[RemoteOK] Error fetching remote jobs:", err.message);
    return [];
  }
}
