import { Resume, CurationPlan } from "@/types";

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
 * Universal LLM caller with automated exponential backoff on rate limits (HTTP 429 / quota).
 * Uses the Supabase app_settings table as the single source of truth for AI configuration.
 */
export async function callLLM(options: CallLLMOptions, maxRetries = 3): Promise<string> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await executeCallLLM(options);
    } catch (err: any) {
      attempt++;
      const msg = err.message || "";
      const isRateLimit =
        msg.includes("429") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("rate limit") ||
        msg.includes("quota") ||
        msg.includes("Too Many Requests");

      if (isRateLimit && attempt < maxRetries) {
        const backoffMs = attempt * 2500;
        console.warn(`[callLLM] Rate limit encountered (${msg.slice(0, 80)}). Retrying in ${backoffMs}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error("callLLM: Maximum retries exceeded due to rate limits or API errors.");
}

async function executeCallLLM({
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
        signal: AbortSignal.timeout(25000),
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
      if (err.message?.includes("429") || err.message?.includes("RESOURCE_EXHAUSTED")) {
        // Break early on rate limit so exponential backoff retry kicks in
        break;
      }
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
 * Robust JSON extractor for LLM output across all models.
 * Strips markdown code blocks and finds the outermost JSON object.
 */
function extractJsonFromText(text: string): any {
  if (!text) throw new Error("Empty response from LLM");

  // 1. Try markdown code block
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonCandidate = fencedMatch ? fencedMatch[1].trim() : text.trim();

  try {
    return JSON.parse(jsonCandidate);
  } catch {
    // 2. Fallback: find outermost curly braces
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const slice = text.slice(firstBrace, lastBrace + 1);
      return JSON.parse(slice);
    }
    throw new Error(`Failed to extract valid JSON from LLM response. Raw output:\n${text.slice(0, 300)}`);
  }
}

/**
 * Stage 1: The Strategist
 * Evaluates the Target Job Description against the Master Base Resume.
 * Formulates a strategic Curation Plan: extracts core pain points, selects 1-3 best projects,
 * curates 8-15 matching skills, sets an anti-hallucination forbidden list, and creates role-by-role guidance.
 */
export async function curateResumeStrategy(
  baseResume: Resume,
  jobDetails: { job_title: string; company: string; level?: string; description: string }
): Promise<CurationPlan> {
  const systemPrompt = `You are an expert executive resume strategist and technical recruiter.
Your task is to analyze a candidate's Master Base Resume against a Target Job Description and formulate a strategic Curation Plan.

The Master Resume is comprehensive and contains details across multiple domains, projects, and experiences.
Your goal is to select and prioritize what belongs on a focused, targeted 2-page ATS resume to maximize the candidate's interview conversion rate, WITHOUT EVER fabricating or lying.

CORE RULES FOR STRATEGY:
1. NO FABRICATION: Every skill, achievement, or project MUST be grounded in the candidate's actual history. Never invent new roles, tools, or projects.
2. PROJECT SELECTION (CRITICAL FOR 2-PAGE CEILING):
   - Review ALL projects in the Master Resume.
   - Select between 1 and 3 projects that best demonstrate qualifications for this Target Job.
   - If a project is irrelevant or does not add value for this role, DO NOT include it.
   - The names in 'selected_project_names' MUST EXACTLY match the 'name' field of projects present in the Master Resume.
3. SKILLS CURATION:
   - Select 8 to 15 skills that directly match the Target Job requirements.
   - Every single selected skill MUST already be explicitly present in the Master Resume (in skills, project technologies, or experience descriptions).
4. MISSING SKILLS ACKNOWLEDGMENT (ANTI-HALLUCINATION SHIELD):
   - Identify up to 5 explicit skills or tools required by the Target Job that the candidate does NOT possess in the Master Resume.
   - This list serves as an explicit barrier to prevent subsequent copywriting steps from inventing them.
5. EXPERIENCE GUIDANCE:
   - All positions in the candidate's work history must be kept (to avoid unexplained employment gaps).
   - For each job, identify:
     a) 'key_achievements_to_highlight': specific tasks, technologies, or achievements from the original description to emphasize.
     b) 'points_to_condense_or_omit': routine, administrative, or irrelevant tasks to downplay or omit completely.
6. STRATEGY SUMMARY & PAIN POINTS:
   - Provide a 1-2 sentence positioning summary explaining how the candidate's actual background directly aligns with this target job.
   - Identify 2-3 target role pain points that the hiring manager needs solved.
7. OUTPUT FORMAT: Return valid JSON matching the CurationPlan schema.`;

  const prompt = `Target Job Details:
- Title: ${jobDetails.job_title}
- Company: ${jobDetails.company}
- Level: ${jobDetails.level || "N/A"}
- Description:
${jobDetails.description}

---

Candidate's Master Base Resume:
${JSON.stringify(baseResume, null, 2)}

---

Formulate the CurationPlan JSON matching this schema:
{
  "strategy_summary": string,
  "target_role_pain_points": string[],
  "selected_project_names": string[],
  "selected_skills": string[],
  "missing_skills_acknowledged": string[],
  "experience_guidance": [
    {
      "company": string,
      "job_title": string,
      "key_achievements_to_highlight": string[],
      "points_to_condense_or_omit": string[]
    }
  ]
}`;

  const raw = await callLLM({
    prompt,
    systemPrompt,
    temperature: 0.2,
    jsonMode: true,
  });

  const parsed = extractJsonFromText(raw);
  return {
    strategy_summary: parsed.strategy_summary || "Strategic alignment with role requirements.",
    target_role_pain_points: Array.isArray(parsed.target_role_pain_points) ? parsed.target_role_pain_points : [],
    selected_project_names: Array.isArray(parsed.selected_project_names) ? parsed.selected_project_names : [],
    selected_skills: Array.isArray(parsed.selected_skills) && parsed.selected_skills.length > 0
      ? parsed.selected_skills
      : (baseResume.skills?.slice(0, 12) || []),
    missing_skills_acknowledged: Array.isArray(parsed.missing_skills_acknowledged) ? parsed.missing_skills_acknowledged : [],
    experience_guidance: Array.isArray(parsed.experience_guidance) ? parsed.experience_guidance : [],
  };
}

/**
 * Stage 2: The ATS Copywriter
 * Crafts tailored, recruiter-grade resume content adhering to Google XYZ formula:
 * "Accomplished [X] as measured by [Y] by doing [Z]" with active action verbs.
 */
export async function writeTailoredResumeContent(
  baseResume: Resume,
  jobDetails: { job_title: string; company: string; level?: string; description: string },
  curationPlan: CurationPlan
): Promise<any> {
  // Filter base projects to only those selected in curationPlan
  const selectedNamesLower = new Set(
    (curationPlan.selected_project_names || []).map((n) => n.trim().toLowerCase())
  );
  let filteredProjects = (baseResume.projects || []).filter((p) =>
    selectedNamesLower.has(p.name.trim().toLowerCase())
  );
  if (filteredProjects.length === 0 && (baseResume.projects || []).length > 0) {
    // Fallback: take first 2 projects if names did not match
    filteredProjects = (baseResume.projects || []).slice(0, 2);
  }

  const forbiddenSkillsNote = curationPlan.missing_skills_acknowledged?.length > 0
    ? `\nCRITICAL ANTI-HALLUCINATION GUARDRAIL:\nThe candidate does NOT have experience in: ${curationPlan.missing_skills_acknowledged.join(", ")}.\nDO NOT claim or imply proficiency in these tools.`
    : "";

  const systemPrompt = `You are an elite executive resume writer and precise ATS JSON generator.
Your task is to craft tailored, compelling resume content for a target job application based on the provided Curation Plan and candidate's Master Resume.

WRITING RULES:
1. SUMMARY:
   - Write a compelling 2-3 sentence elevator pitch tailored to the target job and positioning strategy: "${curationPlan.strategy_summary}".
   - Preserve the candidate's core professional identity and actual years of experience. Do NOT falsely invent titles the candidate never held.
2. SKILLS:
   - Provide the curated list of 8 to 15 skills strictly selected from the Curation Plan.
3. EXPERIENCE (IMMUTABLE TIMELINE):
   - Include ALL work experience entries from the Master Resume (all employers, job titles, locations, and dates MUST remain EXACTLY identical).
   - Rewrite each role's 'description' into 3 to 4 punchy, high-impact bullet points separated by newlines (e.g., "- Engineered...\n- Optimized...\n- Delivered...").
   - Follow Google's XYZ formula: 'Accomplished [X] as measured by [Y] by doing [Z]'.
   - Emphasize the 'key_achievements_to_highlight' from the Curation Plan.
   - Omit the 'points_to_condense_or_omit'.
   - Quantify impact wherever supported by the candidate's original history.
   - NEVER invent new achievements, companies, or tools.${forbiddenSkillsNote}
4. PROJECTS:
   - Include ONLY the selected projects provided in the prompt.
   - Preserve the 'name' and 'technologies' fields from the original project.
   - Rewrite each project's 'description' into 2 to 3 concise, impactful bullet points separated by newlines (e.g., "- Built...\n- Deployed...").
5. LENGTH & CONCISENESS (CRITICAL FOR 2-PAGE ATS BUDGET):
   - Keep bullet points punchy and concise (maximum 1 to 2 lines per bullet point).
   - Ensure the content is focused so the complete resume fits comfortably within a clean 2-page layout.
6. OUTPUT FORMAT: Output valid JSON matching the schema below.`;

  const prompt = `Target Job Details:
- Title: ${jobDetails.job_title}
- Company: ${jobDetails.company}
- Level: ${jobDetails.level || "N/A"}
- Description:
${jobDetails.description}

---

Curation Plan Strategy:
- Strategy Summary: ${curationPlan.strategy_summary}
- Target Pain Points: ${curationPlan.target_role_pain_points.join(", ")}
- Selected Skills to Include: ${JSON.stringify(curationPlan.selected_skills)}
- Role-by-Role Guidance: ${JSON.stringify(curationPlan.experience_guidance, null, 2)}

---

Original Experience Entries (Keep job_title, company, location, dates UNCHANGED; rewrite description only into newline-separated bullets):
${JSON.stringify(baseResume.experience || [], null, 2)}

---

Selected Projects to Include (Keep name & technologies UNCHANGED; rewrite description only into newline-separated bullets):
${JSON.stringify(filteredProjects, null, 2)}

---

Original Master Resume Summary:
${baseResume.summary || "N/A"}

---

Return JSON adhering to this structure:
{
  "summary": string,
  "skills": string[],
  "experience": [
    {
      "job_title": string,
      "company": string,
      "location": string,
      "start_date": string,
      "end_date": string,
      "description": string
    }
  ],
  "projects": [
    {
      "name": string,
      "description": string,
      "technologies": string[]
    }
  ]
}`;

  const raw = await callLLM({
    prompt,
    systemPrompt,
    temperature: 0.3,
    jsonMode: true,
  });

  return extractJsonFromText(raw);
}

/**
 * Stage 2.5: Deterministic Code Validation & Integrity Healing (0 LLM Cost)
 * Enforces zero dropped jobs, strict timeline fidelity, exact project subsets,
 * and seamlessly merges base static sections (education, certs, links) to guarantee schema completeness.
 */
export function validateAndHealResume(
  baseResume: Resume,
  tailoredRaw: any,
  curationPlan: CurationPlan
): Omit<Resume, "id" | "created_at" | "parsed_at" | "last_updated" | "resume_link"> {
  // 1. Summary healing
  let summary = tailoredRaw?.summary;
  if (!summary || typeof summary !== "string" || summary.trim().length < 20) {
    summary = baseResume.summary || curationPlan.strategy_summary || "Experienced professional.";
  }

  // 2. Skills healing (ensure non-empty subset of base skills or curation plan)
  let skills: string[] = [];
  if (Array.isArray(tailoredRaw?.skills) && tailoredRaw.skills.length > 0) {
    skills = tailoredRaw.skills.filter((s: any) => typeof s === "string" && s.trim());
  }
  if (skills.length === 0) {
    skills = curationPlan.selected_skills?.length > 0
      ? curationPlan.selected_skills
      : (baseResume.skills?.slice(0, 15) || []);
  }

  // 3. Experience healing (Strictly preserve timeline, employers, titles, dates)
  const baseExp = baseResume.experience || [];
  const rawExp = Array.isArray(tailoredRaw?.experience) ? tailoredRaw.experience : [];

  const healedExperience = baseExp.map((origExp, index) => {
    // Try to find matching tailored entry by company name or index
    const matchingTailored = rawExp.find(
      (e: any) => e.company && origExp.company && e.company.toLowerCase().trim() === origExp.company.toLowerCase().trim()
    ) || rawExp[index];

    let description = matchingTailored?.description;
    if (!description || typeof description !== "string" || description.trim().length < 15) {
      description = origExp.description || "";
    }

    return {
      job_title: origExp.job_title,
      company: origExp.company,
      location: origExp.location,
      start_date: origExp.start_date,
      end_date: origExp.end_date,
      description: description.trim(),
    };
  });

  // 4. Projects healing (Ensure only valid base projects, max 3)
  const baseProjects = baseResume.projects || [];
  const rawProjects = Array.isArray(tailoredRaw?.projects) ? tailoredRaw.projects : [];

  let healedProjects: any[] = [];
  for (const p of rawProjects) {
    if (!p || !p.name) continue;
    const origProj = baseProjects.find(
      (bp) => bp.name && bp.name.toLowerCase().trim() === p.name.toLowerCase().trim()
    );
    if (origProj) {
      healedProjects.push({
        name: origProj.name,
        description: (p.description && typeof p.description === "string" && p.description.trim().length > 10)
          ? p.description.trim()
          : origProj.description,
        technologies: origProj.technologies || p.technologies || [],
      });
    }
  }

  // If no projects matched or projects were dropped, take the curation plan / top base projects
  if (healedProjects.length === 0 && baseProjects.length > 0) {
    const selectedNames = new Set((curationPlan.selected_project_names || []).map((n) => n.toLowerCase().trim()));
    const matching = baseProjects.filter((bp) => selectedNames.has(bp.name.toLowerCase().trim()));
    const fallbackProjects = matching.length > 0 ? matching : baseProjects.slice(0, 2);

    healedProjects = fallbackProjects.map((bp) => ({
      name: bp.name,
      description: bp.description,
      technologies: bp.technologies || [],
    }));
  }

  // Cap at 3 projects to preserve 2-page ATS ceiling
  healedProjects = healedProjects.slice(0, 3);

  // 5. Assemble complete Resume object (preserving base static sections)
  return {
    name: baseResume.name || "",
    email: baseResume.email || "",
    phone: baseResume.phone || "",
    location: baseResume.location || "",
    summary: summary.trim(),
    skills,
    education: baseResume.education || [],
    experience: healedExperience,
    projects: healedProjects,
    certifications: baseResume.certifications || [],
    languages: baseResume.languages || [],
    links: baseResume.links || { linkedin: null, github: null, portfolio: null },
  };
}

/**
 * Multi-Stage Orchestrator for Resume Customization.
 * Coordinates Stage 1 (The Strategist), Stage 2 (The ATS Copywriter), and Stage 2.5 (Deterministic Validation).
 * Callers immediately execute Stage 3 (ATS Rescore via scoreJobWithResume).
 * Maintains 100% backward-compatible signature.
 */
export async function customizeResumeWithLLM(
  baseResume: Resume,
  jobDetails: { job_title: string; company: string; level?: string; description: string }
): Promise<Omit<Resume, "id" | "created_at" | "parsed_at" | "last_updated" | "resume_link">> {
  console.log(`  [ResumeTailor] Stage 1/3: Formulating strategic Curation Plan (The Strategist)...`);
  const curationPlan = await curateResumeStrategy(baseResume, jobDetails);
  console.log(
    `  [ResumeTailor] ✓ Curation Plan ready: Strategy: "${curationPlan.strategy_summary.slice(0, 70)}..." | ` +
    `Projects: ${curationPlan.selected_project_names.join(", ") || "None"} | ` +
    `Skills: ${curationPlan.selected_skills.length} skills.`
  );

  // Rate-limiting safety pause between Stage 1 and Stage 2 (respects 15-30 RPM limits on free tiers)
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log(`  [ResumeTailor] Stage 2/3: Crafting tailored ATS copy with Google XYZ formula (The Copywriter)...`);
  const rawTailoredContent = await writeTailoredResumeContent(baseResume, jobDetails, curationPlan);

  console.log(`  [ResumeTailor] Stage 2.5: Running deterministic code verification & timeline preservation...`);
  const validatedResume = validateAndHealResume(baseResume, rawTailoredContent, curationPlan);
  console.log(`  [ResumeTailor] ✓ Resume tailored and validated successfully (Ready for ATS Rescoring).`);

  return validatedResume;
}
