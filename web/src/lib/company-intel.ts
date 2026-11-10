import { Impit } from "impit";
import * as cheerio from "cheerio";
import { SupabaseClient } from "@supabase/supabase-js";
import { CompanyProfile } from "@/types";
import { createSupabaseStaticClient } from "@/utils/supabase/server";

const CACHE_TTL_DAYS = 30;
const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

// Impit client with native Chrome TLS (JA3/JA4) fingerprint emulation to prevent bot challenges
const browserClient = new Impit({ browser: "chrome" });

/**
 * Normalizes company names by stripping corporate suffixes, locations, and punctuation
 * so searches and database cache keys match reliably.
 * e.g. "Grab Holdings Pte. Ltd. (Singapore)" -> "Grab"
 * e.g. "KAISHI PARTNERS PTE. LTD." -> "KAISHI PARTNERS"
 */
export function cleanCompanyName(rawName: string): string {
  if (!rawName) return "";

  let cleaned = rawName
    // Strip parenthetical location/department notes: (Singapore), (SG), [APAC]
    .replace(/\s*[\(\[][^\)\]]*[\)\]]/g, " ")
    // Strip trailing descriptions after hyphen or pipe: e.g. " - Government Technology Agency", " | Singapore"
    .replace(/\s*[-|–—]\s*.*$/i, " ")
    // Strip common legal entity words
    .replace(
      /\b(pte\.?\s*ltd\.?|private\s+limited|ltd\.?|limited|inc\.?|incorporated|llc|corp\.?|corporation|holdings?|group|co\.?)\b/gi,
      " "
    )
    // Strip trailing regional noise only if at the end of the name (e.g. "Shopee Singapore" -> "Shopee", but preserve "Singapore Airlines")
    .replace(/\s+\b(singapore|apac|sg)\b\s*$/gi, " ")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // If stripping left nothing or too short, revert to rawName stripped of punctuation
  if (cleaned.length < 2) {
    cleaned = rawName.replace(/[^\w\s]/g, " ").trim();
  }

  return cleaned;
}

/**
 * Unwraps DuckDuckGo redirect URLs (uddg=...) into direct, clean web URLs.
 */
function unwrapDuckDuckGoUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  try {
    if (rawUrl.includes("uddg=")) {
      const match = rawUrl.match(/uddg=([^&]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }
    if (rawUrl.startsWith("//")) {
      return `https:${rawUrl}`;
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

/**
 * Parses Glassdoor/Trustpilot/Indeed star ratings and review counts from snippet text or titles.
 */
function extractRatingAndReviews(text: string): { rating: number | null; reviewsCount: number | null } {
  let rating: number | null = null;
  let reviewsCount: number | null = null;

  // Match rating e.g. "4.0 out of 5", "rating of 3.8", "4.2 stars", "3.5 / 5", "Rating: 4.1", "4-star rating"
  const ratingMatch =
    text.match(/(?:rating(?:\s+of)?:\s*|rated\s*|employee rating of\s*)?([1-5](?:\.[0-9])?)\s*(?:out of 5|\/5|\s*stars|\s*★)/i) ||
    text.match(/Rating:\s*([1-5]\.[0-9])/i) ||
    text.match(/\b([1-5]\.[0-9])\s*·/) ||
    text.match(/([1-5](?:\.[0-9])?)\s*out of 5/i) ||
    text.match(/([1-5])-star rating/i);

  if (ratingMatch && ratingMatch[1]) {
    const parsed = parseFloat(ratingMatch[1]);
    if (parsed >= 1.0 && parsed <= 5.0) {
      rating = Math.round(parsed * 10) / 10;
    }
  }

  // Match review count e.g. "25 company reviews", "1,284 reviews", "2.5k reviews", "20 Alignerr reviews", "3,095 people have written"
  const reviewMatch =
    text.match(/([0-9]+(?:,[0-9]+)?|\d+(?:\.\d+)?k)\s+(?:[a-zA-Z0-9&'.-]+\s+)?reviews/i) ||
    text.match(/([0-9]+(?:,[0-9]+)?)\s+people have written/i) ||
    text.match(/([0-9]+(?:,[0-9]+)?)\s+Reddit comments/i);

  if (reviewMatch && reviewMatch[1]) {
    const rawVal = reviewMatch[1].toLowerCase().replace(/,/g, "");
    if (rawVal.endsWith("k")) {
      reviewsCount = Math.round(parseFloat(rawVal.replace("k", "")) * 1000);
    } else {
      const parsed = parseInt(rawVal, 10);
      if (!isNaN(parsed)) {
        reviewsCount = parsed;
      }
    }
  }

  return { rating, reviewsCount };
}

/**
 * Executes a single search query against DuckDuckGo using impit browser impersonation.
 */
async function searchDuckDuckGo(query: string): Promise<Array<{ title: string; link: string; snippet: string }>> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const res = await browserClient.fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Ch-Ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    if (!res.ok) {
      console.warn(`[CompanyIntel] DuckDuckGo returned HTTP ${res.status} for query: "${query}"`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const results: Array<{ title: string; link: string; snippet: string }> = [];

    $(".result").each((_, el) => {
      const title = $(el).find(".result__title").text().replace(/\s+/g, " ").trim();
      const snippet = $(el).find(".result__snippet").text().replace(/\s+/g, " ").trim();
      const rawLink =
        $(el).find(".result__url").attr("href") ||
        $(el).find("a.result__title").attr("href") ||
        "";
      const link = unwrapDuckDuckGoUrl(rawLink);

      if (title && snippet) {
        results.push({ title, link, snippet });
      }
    });

    return results;
  } catch (err: any) {
    console.warn(`[CompanyIntel] Error fetching DuckDuckGo query "${query}":`, err.message);
    return [];
  }
}

/**
 * Verifies that a search result is genuinely about the target company
 * and not an off-topic forum post or generic discussion mentioning common words.
 */
function isSnippetRelevant(title: string, snippet: string, link: string, company: string): boolean {
  const compLower = company.toLowerCase().trim();
  const titleLower = title.toLowerCase();
  const snippetLower = snippet.toLowerCase();
  const linkLower = link.toLowerCase();

  // If source is a general forum (like reddit), strictly require company name in title or dedicated subreddit
  if (linkLower.includes("reddit.com")) {
    const subMatch = linkLower.match(/reddit\.com\/r\/([^/?#]+)/);
    const subreddit = subMatch ? subMatch[1] : "";
    const isCompanySubreddit = subreddit.includes(compLower.replace(/\s+/g, ""));
    const titleMentionsCompany = titleLower.includes(compLower);
    if (!isCompanySubreddit && !titleMentionsCompany) {
      return false; // Discard off-topic forum posts
    }
  }

  // Check relevance against company brand/phrase
  if (compLower.includes(" ")) {
    if (titleLower.includes(compLower) || snippetLower.includes(compLower)) return true;
    const slug = compLower.replace(/\s+/g, "-");
    return linkLower.includes(slug);
  } else {
    const regex = new RegExp(`\\b${compLower}\\b`, "i");
    return regex.test(title) || regex.test(snippet) || linkLower.includes(compLower);
  }
}

/**
 * Queries public search indexes using a multi-stage strategy:
 * Stage 1: Verified employer reviews (Glassdoor, Indeed, Jobstreet).
 * Stage 2: Localized reviews and star ratings.
 * Deduplicates and filters for verified relevance before extracting ratings.
 */
export async function searchPublicCompanyIntel(
  company: string,
  location: string = "Singapore"
): Promise<{
  glassdoorRating: number | null;
  glassdoorReviewsCount: number | null;
  snippets: Array<{ title: string; snippet: string; link: string }>;
  cultureSummary: string;
}> {
  const clean = cleanCompanyName(company);
  if (!clean || clean.length < 2) {
    return { glassdoorRating: null, glassdoorReviewsCount: null, snippets: [], cultureSummary: "" };
  }

  // Clean location (e.g. "Singapore, Singapore" -> "Singapore")
  const cleanLoc = (location || "Singapore").split(",")[0].trim();

  // Multi-query search: focus on verified employer reviews and ratings
  const q1 = `${clean} company reviews glassdoor`;
  const q2 = `${clean} ${cleanLoc} reviews glassdoor rating`;

  console.log(`[CompanyIntel] Searching verified employer intel for "${clean}"...`);
  const [res1, res2] = await Promise.all([
    searchDuckDuckGo(q1),
    searchDuckDuckGo(q2),
  ]);

  const seenUrls = new Set<string>();
  const snippets: Array<{ title: string; snippet: string; link: string }> = [];
  let glassdoorRating: number | null = null;
  let glassdoorReviewsCount: number | null = null;

  for (const item of [...res1, ...res2]) {
    if (snippets.length >= 8) break;

    // Filter out off-topic forum posts or mismatched company names
    if (!isSnippetRelevant(item.title, item.snippet, item.link, clean)) {
      continue;
    }

    // Deduplicate by normalized URL
    const normUrl = item.link.replace(/https?:\/\//, "").replace(/\/$/, "");
    if (seenUrls.has(normUrl)) continue;
    seenUrls.add(normUrl);

    snippets.push(item);

    // Extract rating and review count from snippet or title
    if (!glassdoorRating || !glassdoorReviewsCount) {
      const extracted = extractRatingAndReviews(`${item.title} ${item.snippet}`);
      if (!glassdoorRating && extracted.rating) {
        glassdoorRating = extracted.rating;
      }
      if (!glassdoorReviewsCount && extracted.reviewsCount) {
        glassdoorReviewsCount = extracted.reviewsCount;
      }
    }
  }

  // Synthesize a concise culture summary from top snippets
  let cultureSummary = "";
  if (snippets.length > 0) {
    cultureSummary = snippets
      .slice(0, 4)
      .map((s) => s.snippet)
      .join(" ")
      .slice(0, 500);
  }

  return {
    glassdoorRating,
    glassdoorReviewsCount,
    snippets,
    cultureSummary,
  };
}

/**
 * Retrieves company intelligence, first checking the Supabase cache.
 * If cached and < 30 days old, returns the cached profile immediately.
 * If forceLive is true, bypasses the cache and performs live zero-cost public search.
 * Updates the Supabase cache with the latest intel and returns the profile.
 */
export async function getCompanyIntelligence(
  companyName: string,
  location: string = "Singapore",
  customSupabaseClient?: SupabaseClient | null,
  forceLive: boolean = false
): Promise<CompanyProfile | null> {
  if (!companyName || typeof companyName !== "string") {
    return null;
  }

  const cleanName = cleanCompanyName(companyName);
  if (!cleanName || cleanName.length < 2) {
    return null;
  }

  const supabase = customSupabaseClient || createSupabaseStaticClient();
  const cacheKey = cleanName.toLowerCase();

  // 1. Check Supabase cache (skipped if forceLive is true)
  if (!forceLive) {
    try {
      const { data: cached, error } = await supabase
        .from("company_profiles")
        .select("*")
        .eq("company_name", cacheKey)
        .maybeSingle();

      if (!error && cached) {
        const updatedAt = cached.updated_at ? new Date(cached.updated_at).getTime() : 0;
        const isFresh = Date.now() - updatedAt < CACHE_TTL_MS;

        // Ensure cached entry has at least 2 snippets or valid rating/summary to qualify as good cache
        const hasContent =
          cached.glassdoor_rating ||
          (cached.source_snippets && cached.source_snippets.length >= 2) ||
          (cached.culture_summary && cached.culture_summary.length > 50);

        if (isFresh && hasContent) {
          return {
            company_name: cleanName,
            domain: cached.domain,
            industry: cached.industry,
            size_band: cached.size_band,
            headquarters: cached.headquarters,
            glassdoor_rating: cached.glassdoor_rating ? Number(cached.glassdoor_rating) : null,
            glassdoor_reviews_count: cached.glassdoor_reviews_count ? Number(cached.glassdoor_reviews_count) : null,
            culture_summary: cached.culture_summary,
            source_snippets: cached.source_snippets || [],
            created_at: cached.created_at,
            updated_at: cached.updated_at,
            is_cached: true,
          };
        }
      }
    } catch (err: any) {
      console.warn(`[CompanyIntel] Cache lookup error for "${cacheKey}":`, err.message);
    }
  } else {
    console.log(`[CompanyIntel] Force live mode active for "${cleanName}". Skipping database cache.`);
  }

  // 2. Perform live multi-source public search
  console.log(`[CompanyIntel] Fetching live public intelligence for "${cleanName}"...`);
  const liveData = await searchPublicCompanyIntel(cleanName, location);

  const profile: CompanyProfile = {
    company_name: cleanName,
    glassdoor_rating: liveData.glassdoorRating,
    glassdoor_reviews_count: liveData.glassdoorReviewsCount,
    culture_summary: liveData.cultureSummary || null,
    source_snippets: liveData.snippets,
    updated_at: new Date().toISOString(),
    is_cached: false,
  };

  // 3. Upsert into Supabase cache asynchronously
  try {
    await supabase.from("company_profiles").upsert(
      {
        company_name: cacheKey,
        glassdoor_rating: profile.glassdoor_rating,
        glassdoor_reviews_count: profile.glassdoor_reviews_count,
        culture_summary: profile.culture_summary,
        source_snippets: profile.source_snippets,
        updated_at: profile.updated_at,
      },
      { onConflict: "company_name" }
    );
    console.log(`[CompanyIntel] Cached intelligence for "${cleanName}" in Supabase (${profile.source_snippets?.length || 0} sources).`);
  } catch (err: any) {
    console.warn(`[CompanyIntel] Failed to cache profile for "${cleanName}":`, err.message);
  }

  return profile;
}
