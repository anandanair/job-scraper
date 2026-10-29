import { Resume } from "@/types";

interface CallLLMOptions {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  jsonMode?: boolean;
  apiKeyOverride?: string;
  modelOverride?: string;
  providerOverride?: string;
}

/**
 * Universal LLM caller supporting Google Gemini, OpenAI, Fireworks AI, and Anthropic.
 * Uses the Supabase app_settings table as the single source of truth for AI configuration.
 */
export async function callLLM({
  prompt,
  systemPrompt,
  temperature = 0.2,
  jsonMode = false,
  apiKeyOverride,
  modelOverride,
  providerOverride,
}: CallLLMOptions): Promise<string> {
  let apiKey = apiKeyOverride;
  let model = modelOverride;
  let explicitProvider = providerOverride?.toLowerCase();

  // 1. Fetch dynamic config from Supabase app_settings (Single Source of Truth)
  if (!apiKey || !model || !explicitProvider) {
    try {
      const { getAppSettings } = await import("@/lib/supabase/queries");
      const dbSettings = await getAppSettings();
      if (!apiKey && dbSettings?.llm_api_key) {
        apiKey = dbSettings.llm_api_key;
      }
      if (!model && dbSettings?.llm_model) {
        model = dbSettings.llm_model;
      }
      if (!explicitProvider && dbSettings?.llm_provider) {
        explicitProvider = dbSettings.llm_provider.toLowerCase();
      }
    } catch {
      // Ignore database lookup error if DB not yet reachable
    }
  }

  if (!model) {
    model = "gemini-3.8-flash";
  }

  apiKey = (apiKey || "").replace(/["']/g, "").trim();
  model = (model || "").replace(/["']/g, "").trim();

  if (!apiKey) {
    throw new Error(
      "LLM API key not configured. Please configure your AI provider and API key in Settings or complete the Setup Wizard."
    );
  }

  const modelLower = model.toLowerCase();

  // 1. Detect Anthropic Claude
  const isAnthropic =
    explicitProvider === "anthropic" ||
    modelLower.includes("claude") ||
    apiKey.startsWith("sk-ant-");

  if (isAnthropic) {
    const cleanModel = model.replace(/^anthropic\//, "");
    const messages = [{ role: "user", content: prompt }];
    const payload: any = {
      model: cleanModel,
      messages,
      max_tokens: 4096,
      temperature,
    };
    if (systemPrompt) {
      payload.system = systemPrompt;
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text || "";
  }

  // 2. Detect Fireworks AI
  const isFireworks =
    explicitProvider === "fireworks" ||
    modelLower.includes("fireworks") ||
    apiKey.startsWith("fw_") ||
    model.startsWith("accounts/fireworks/");

  if (isFireworks) {
    const fireworksModel = model.startsWith("accounts/fireworks/")
      ? model
      : model.replace(/^fireworks_ai\//, "").replace(/^fireworks\//, "");

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const payload: any = {
      model: fireworksModel.includes("/")
        ? fireworksModel
        : `accounts/fireworks/models/${fireworksModel}`,
      messages,
      temperature,
    };

    if (jsonMode) {
      payload.response_format = { type: "json_object" };
    }

    const res = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Fireworks API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  // 3. Detect OpenAI
  const isOpenAI =
    explicitProvider === "openai" ||
    modelLower.includes("gpt") ||
    modelLower.startsWith("openai/") ||
    apiKey.startsWith("sk-proj-");

  if (isOpenAI) {
    const cleanModel = model.replace(/^openai\//, "");
    const messages: any[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const payload: any = {
      model: cleanModel,
      messages,
      temperature,
    };

    if (jsonMode) {
      payload.response_format = { type: "json_object" };
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  // 4. Default: Google Gemini
  const modernGeminiFallbacks = [
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
  ];

  // If a specific gemini model was configured, try it first, then fall back to stable models
  const configuredModel = model.replace(/^gemini\//, "").replace(/^google\//, "").trim();
  const isGeneric =
    !configuredModel ||
    configuredModel === "gemini" ||
    configuredModel === "google" ||
    configuredModel === "auto" ||
    configuredModel === "gemini-auto";

  const modelsToTry = isGeneric
    ? modernGeminiFallbacks
    : [configuredModel, ...modernGeminiFallbacks.filter((m) => m !== configuredModel)];

  let lastError: Error | null = null;

  for (const m of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;

      const contents: any[] = [];
      const parts: any[] = [];

      if (systemPrompt) {
        parts.push({ text: `System Instructions:\n${systemPrompt}\n\nUser Request:\n` });
      }
      parts.push({ text: prompt });
      contents.push({ parts });

      const requestBody: any = {
        contents,
        generationConfig: {
          temperature,
        },
      };

      if (jsonMode) {
        requestBody.generationConfig.responseMimeType = "application/json";
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini error for model ${m} (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return text;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Failed model ${m}, attempting next fallback:`, err.message);
    }
  }

  throw lastError || new Error("All Gemini models failed");
}

/**
 * Formats a structured Resume object into clean plain text for AI scoring.
 * Matches Python score_jobs.py format_resume_to_text implementation.
 */
export function formatResumeToText(resumeData: any): string {
  if (!resumeData) return "Resume data is not available.";

  const lines: string[] = [];

  // Basic Info
  lines.push(`Name: ${resumeData.name || "N/A"}`);
  lines.push(`Email: ${resumeData.email || "N/A"}`);
  if (resumeData.phone) lines.push(`Phone: ${resumeData.phone}`);
  if (resumeData.location) lines.push(`Location: ${resumeData.location}`);
  if (resumeData.links) {
    const linksStr = Object.entries(resumeData.links)
      .filter(([_, v]) => Boolean(v))
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    if (linksStr) lines.push(`Links: ${linksStr}`);
  }
  lines.push("\n---\n");

  // Summary
  if (resumeData.summary) {
    lines.push("Summary:");
    lines.push(resumeData.summary);
    lines.push("\n---\n");
  }

  // Skills
  if (resumeData.skills && resumeData.skills.length > 0) {
    lines.push("Skills:");
    lines.push(resumeData.skills.join(", "));
    lines.push("\n---\n");
  }

  // Experience
  if (resumeData.experience && resumeData.experience.length > 0) {
    lines.push("Experience:");
    for (const exp of resumeData.experience) {
      lines.push(`\n* ${exp.job_title || "N/A"} at ${exp.company || "N/A"}`);
      if (exp.location) lines.push(`  Location: ${exp.location}`);
      const dateRange = `${exp.start_date || "?"} - ${exp.end_date || "Present"}`;
      lines.push(`  Dates: ${dateRange}`);
      if (exp.description) {
        lines.push("  Description:");
        const descLines = exp.description.split("\n");
        for (const line of descLines) {
          if (line.trim()) lines.push(`    - ${line.trim()}`);
        }
      }
    }
    lines.push("\n---\n");
  }

  // Education
  if (resumeData.education && resumeData.education.length > 0) {
    lines.push("Education:");
    for (const edu of resumeData.education) {
      let degreeInfo = `${edu.degree || "N/A"}`;
      if (edu.field_of_study) degreeInfo += `, ${edu.field_of_study}`;
      if (edu.institution) degreeInfo += ` from ${edu.institution}`;
      lines.push(`* ${degreeInfo}`);
    }
    lines.push("\n---\n");
  }

  // Projects
  if (resumeData.projects && resumeData.projects.length > 0) {
    lines.push("Projects:");
    for (const proj of resumeData.projects) {
      lines.push(`\n* ${proj.name || "N/A"}`);
      if (proj.description) lines.push(`  Description: ${proj.description}`);
      if (proj.technologies && proj.technologies.length > 0) {
        lines.push(`  Technologies: ${proj.technologies.join(", ")}`);
      }
    }
    lines.push("\n---\n");
  }

  // Certifications
  if (resumeData.certifications && resumeData.certifications.length > 0) {
    lines.push("Certifications:");
    for (const cert of resumeData.certifications) {
      let certInfo = `${cert.name || "N/A"}`;
      if (cert.issuer) certInfo += ` (${cert.issuer})`;
      if (cert.year) certInfo += ` - ${cert.year}`;
      lines.push(`* ${certInfo}`);
    }
    lines.push("\n---\n");
  }

  // Languages
  if (resumeData.languages && resumeData.languages.length > 0) {
    lines.push("Languages:");
    lines.push(resumeData.languages.join(", "));
    lines.push("\n---\n");
  }

  return lines.join("\n");
}

/**
 * Scores a job against a resume text using the exact prompt from score_jobs.py.
 */
export async function scoreJobWithResume(
  resumeText: string,
  jobDetails: { job_id?: string; job_title: string; company: string; level?: string; description: string }
): Promise<number | null> {
  const prompt = `
    You are a scoring assistant. You will be given a resume and a job description.  
    Based **only** on the information provided, **return exactly one integer between 0 and 100** (inclusive) that represents the candidate’s suitability for the role.  
    Do **not** return any words, punctuation, or explanation—only the integer.

    --- RESUME ---
    ${resumeText}
    --- END RESUME ---

    --- JOB DESCRIPTION ---
    Job Title: ${jobDetails.job_title || "N/A"}
    Company: ${jobDetails.company || "N/A"}
    Level: ${jobDetails.level || "N/A"}

    ${jobDetails.description || "N/A"}
    --- END JOB DESCRIPTION ---

    Score (0–100):
  `;

  try {
    const raw = await callLLM({ prompt, temperature: 0.1 });
    const match = raw.match(/\b\d{1,3}\b/);
    if (!match) return null;
    const score = parseInt(match[0], 10);
    if (score >= 0 && score <= 100) return score;
    return null;
  } catch (err) {
    console.error("Error scoring job with LLM:", err);
    return null;
  }
}

/**
 * Generates a tailored custom resume JSON matching the candidate's base resume
 * and the specific job description. Strictly avoids fabrication.
 */
export async function customizeResumeWithLLM(
  baseResume: Resume,
  jobDetails: { job_title: string; company: string; level?: string; description: string }
): Promise<Omit<Resume, "id" | "created_at" | "parsed_at" | "last_updated" | "resume_link">> {
  const systemPrompt = `
You are an expert executive resume strategist and technical recruiter.
Your task is to tailor a candidate's Master Base Resume for a specific Target Job Description.

CORE RULES:
1. NO FABRICATION: Never invent new roles, tools, projects, or credentials. Everything must be grounded in the Master Resume.
2. SUMMARY: Craft a strong 3-4 sentence professional summary targeted specifically to this role, highlighting the candidate's most relevant qualifications.
3. SKILLS: Select the 8-15 most relevant skills that match the target job requirements from the candidate's actual skill set.
4. EXPERIENCE: Keep all positions, but refine bullet descriptions to emphasize relevant achievements, tools, and responsibilities that match the target job.
5. PROJECTS: Select the 1 to 3 most relevant projects and polish their descriptions to highlight matching technologies.
6. OUTPUT FORMAT: Output valid JSON matching the schema below.
`;

  const prompt = `
Target Job Details:
- Title: ${jobDetails.job_title}
- Company: ${jobDetails.company}
- Level: ${jobDetails.level || "N/A"}
- Description:
${jobDetails.description}

Master Base Resume:
${JSON.stringify(baseResume, null, 2)}

Return JSON adhering to this structure:
{
  "name": string,
  "email": string,
  "phone": string,
  "location": string,
  "summary": string,
  "skills": string[],
  "education": [
    { "degree": string, "field_of_study": string, "institution": string, "start_year": string, "end_year": string }
  ],
  "experience": [
    { "job_title": string, "company": string, "location": string, "start_date": string, "end_date": string, "description": string }
  ],
  "projects": [
    { "name": string, "description": string, "technologies": string[] }
  ],
  "certifications": [
    { "name": string, "issuer": string, "year": string }
  ],
  "languages": string[],
  "links": { "linkedin": string, "github": string, "portfolio": string }
}
`;

  const rawJson = await callLLM({
    prompt,
    systemPrompt,
    temperature: 0.2,
    jsonMode: true,
  });

  // Extract clean JSON
  const match = rawJson.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Failed to parse JSON response from LLM");
  }

  const parsed = JSON.parse(match[0]);
  return parsed;
}
