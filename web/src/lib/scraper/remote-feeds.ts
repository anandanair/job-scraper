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

interface ConceptRule {
  name: string;
  keywords: string[];
  techTag: string;
}

const KNOWN_CONCEPTS: ConceptRule[] = [
  { name: "full stack", keywords: ["full stack", "fullstack"], techTag: "full stack" },
  { name: "solutions", keywords: ["solutions", "solution", "solutions architect", "solutions engineer"], techTag: "solutions" },
  { name: "product support", keywords: ["product support", "support engineer", "technical support", "application support", "customer engineer"], techTag: "support" },
  { name: "integration", keywords: ["integration", "integrations", "integration engineer"], techTag: "integration" },
  { name: "internal tools", keywords: ["internal tools", "tools engineer"], techTag: "tools" },
  { name: "backend", keywords: ["backend", "back end"], techTag: "backend" },
  { name: "frontend", keywords: ["frontend", "front end"], techTag: "front end" },
  { name: "devops", keywords: ["devops", "platform", "infrastructure", "sre", "cloud"], techTag: "devops" },
  { name: "ai / ml", keywords: ["ai", "machine learning", "ml", "nlp", "llm"], techTag: "ai" },
  { name: "data", keywords: ["data engineer", "data analyst", "data scientist"], techTag: "data" },
];

const STOP_WORDS = new Set(["and", "or", "the", "in", "of", "for", "with", "&", "a", "an"]);
const ROLE_WORDS = new Set(["engineer", "developer", "dev", "architect", "programmer", "specialist", "consultant", "lead", "manager", "analyst"]);

// Disqualifiers for non-tech roles
const NON_TECH_REGEX = /\b(nurse|registered nurse|medical|dental|doctor|accountant|wedding|property manager|real estate|teacher|tutor|flight attendant|human resources|recruiter|recruiting|business development|sales executive|account executive|general practitioner|compliance administrator)\b/i;

// Minimum requirement: job title must contain a technical role indicator
const TECH_TITLE_INDICATOR = /\b(engineer|developer|dev|architect|programmer|software|platform|infrastructure|full stack|frontend|front end|backend|back end|solutions|integration|analyst|data|qa|technical|devops|sre|sysadmin|product manager|designer|support)\b/i;

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/\bdeveloper\b/g, "engineer").replace(/\bdev\b/g, "engineer");
}

function extractConcepts(queryList: string[]): ConceptRule[] {
  const active: ConceptRule[] = [];

  for (const raw of queryList) {
    const q = raw.toLowerCase().trim();
    if (!q) continue;

    // 1. Check known concepts
    for (const k of KNOWN_CONCEPTS) {
      if (k.keywords.some((w) => q.includes(w))) {
        if (!active.some((a) => a.name === k.name)) {
          active.push(k);
        }
      }
    }

    // 2. Derive dynamic concepts from query
    const tokens = q.split(/\s+/).filter((t) => !STOP_WORDS.has(t));
    const nonRoleTokens = tokens.filter((t) => !ROLE_WORDS.has(t));
    if (nonRoleTokens.length > 0) {
      const phrase = nonRoleTokens.join(" ");
      if (!active.some((a) => a.name === phrase)) {
        active.push({
          name: phrase,
          keywords: [phrase, ...nonRoleTokens],
          techTag: nonRoleTokens[0],
        });
      }
    }
  }

  return active;
}

/**
 * Fetches free remote tech jobs from RemoteOK's public open JSON feed.
 * Uses smart concept matching, role synonym expansion, and tech-tag scoring.
 */
export async function fetchRemoteOkJobs(
  keywords: string[] = [],
  limit: number = 10,
  favoriteTechStack: string[] = []
): Promise<ScrapedJob[]> {
  try {
    const urls = [
      "https://remoteok.com/api?tag=engineer",
      "https://remoteok.com/api?tag=dev",
    ];

    const responses = await Promise.allSettled(
      urls.map((u) =>
        fetch(u, {
          headers: {
            "User-Agent": "JobTrack/2.0 (Open Source Job Discovery Engine)",
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(20000),
        }).then((r) => (r.ok ? r.json() : []))
      )
    );

    const itemsMap = new Map<string, RemoteOkItem>();
    for (const r of responses) {
      if (r.status === "fulfilled" && Array.isArray(r.value)) {
        for (const item of r.value.slice(1)) {
          if (item?.id && item?.position && item?.company) {
            itemsMap.set(String(item.id), item);
          }
        }
      }
    }

    // Fallback if tag endpoints returned empty
    if (itemsMap.size === 0) {
      const res = await fetch("https://remoteok.com/api", {
        headers: {
          "User-Agent": "JobTrack/2.0 (Open Source Job Discovery Engine)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          for (const item of data.slice(1)) {
            if (item?.id && item?.position && item?.company) {
              itemsMap.set(String(item.id), item);
            }
          }
        }
      }
    }

    const rawJobs = Array.from(itemsMap.values());
    if (rawJobs.length === 0) {
      console.warn("[RemoteOK] No candidate jobs retrieved from RemoteOK API.");
      return [];
    }

    const lowerKeywords = keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
    const techFavorites = favoriteTechStack.map((t) => t.toLowerCase().trim()).filter(Boolean);
    const activeConcepts = extractConcepts(lowerKeywords);

    const scoredJobs: Array<{ item: RemoteOkItem; score: number }> = [];

    for (const item of rawJobs) {
      const title = (item.position || "").trim();
      const company = (item.company || "").trim();
      if (!title || !company) continue;

      // Filter out non-tech jobs
      if (NON_TECH_REGEX.test(title)) continue;
      if (!TECH_TITLE_INDICATOR.test(title)) continue;

      const normTitle = normalizeTitle(title);
      const tags = (item.tags || []).map((t) => t.toLowerCase().trim());
      const desc = (item.description || "").toLowerCase();

      let score = 0;

      // When no keywords configured, evaluate all tech jobs equally
      if (lowerKeywords.length === 0) {
        score = 50;
      } else {
        for (const q of lowerKeywords) {
          const normQ = normalizeTitle(q);

          // 1. Exact or normalized phrase match in title
          if (title.toLowerCase().includes(q)) {
            score = Math.max(score, 70);
          } else if (normTitle.includes(normQ)) {
            score = Math.max(score, 60);
          }

          // 2. All words of query appear in title
          const words = q.split(/\s+/).filter((w) => !STOP_WORDS.has(w));
          const wordsInTitle = words.filter((w) => normTitle.includes(normalizeTitle(w)));
          if (wordsInTitle.length === words.length && words.length > 0) {
            score = Math.max(score, 50);
          }
        }

        // 3. Concept matching in title and tags
        for (const concept of activeConcepts) {
          const inTitle = concept.keywords.some((k) => normTitle.includes(k));
          if (inTitle) {
            score = Math.max(score, score + 40);
          }
          const inTags = tags.includes(concept.techTag) || tags.some((t) => concept.keywords.includes(t));
          if (inTags) {
            score = Math.max(score, score + 30);
          }
        }

        // 4. Boost for user's favorite tech stack
        for (const tech of techFavorites) {
          if (tags.includes(tech) || normTitle.includes(tech)) {
            score += 10;
          }
        }

        // 5. Description keyword boost
        for (const q of lowerKeywords) {
          if (desc.includes(q)) {
            score += 5;
            break;
          }
        }
      }

      // Keep candidates that pass the confidence threshold
      if (score >= 35 || (lowerKeywords.length > 0 && score >= 25)) {
        scoredJobs.push({ item, score });
      }
    }

    // Sort descending by relevance score
    scoredJobs.sort((a, b) => b.score - a.score);
    const topScored = scoredJobs.slice(0, limit);

    const jobs: ScrapedJob[] = [];
    for (const { item } of topScored) {
      const title = item.position!.trim();
      const company = item.company!.trim();
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

    console.log(`[RemoteOK] Extracted ${jobs.length} top-ranked remote jobs matching role concepts & tech stack (Limit: ${limit}).`);
    return jobs;
  } catch (err: any) {
    console.warn("[RemoteOK] Error fetching remote jobs:", err.message);
    return [];
  }
}
