import {
  Resume,
  CurationPlan,
  CoverLetterTone,
  ScoreBreakdown,
  DreamJobProfile,
  JobSearchMode,
  OutreachVariants,
  JobInterviewPrep,
  TechnicalQuestionItem,
  BehavioralStarAnswer,
} from "@/types";

export interface JobEvaluationResult {
  resume_score: number;
  dream_score: number | null;
  total_score: number;
  score_breakdown: ScoreBreakdown;
}

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
export async function callLLM(
  options: CallLLMOptions,
  maxRetries = 3,
): Promise<string> {
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
        console.warn(
          `[callLLM] Rate limit encountered (${msg.slice(0, 80)}). Retrying in ${backoffMs}ms (attempt ${attempt}/${maxRetries})...`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error(
    "callLLM: Maximum retries exceeded due to rate limits or API errors.",
  );
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
      "LLM API key not configured. Please configure your AI provider and API key in Settings or complete the Setup Wizard.",
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

    const res = await fetch(
      "https://api.fireworks.ai/inference/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      },
    );

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
  const configuredModel = model
    .replace(/^gemini\//, "")
    .replace(/^google\//, "")
    .trim();
  const isGeneric =
    !configuredModel ||
    configuredModel === "gemini" ||
    configuredModel === "google" ||
    configuredModel === "auto" ||
    configuredModel === "gemini-auto";

  const modelsToTry = isGeneric
    ? modernGeminiFallbacks
    : [
        configuredModel,
        ...modernGeminiFallbacks.filter((m) => m !== configuredModel),
      ];

  let lastError: Error | null = null;

  for (const m of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;

      const contents: any[] = [];
      const parts: any[] = [];

      if (systemPrompt) {
        parts.push({
          text: `System Instructions:\n${systemPrompt}\n\nUser Request:\n`,
        });
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
        throw new Error(
          `Gemini error for model ${m} (${res.status}): ${errText}`,
        );
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return text;
      }
    } catch (err: any) {
      lastError = err;
      if (
        err.message?.includes("429") ||
        err.message?.includes("RESOURCE_EXHAUSTED")
      ) {
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
 * Replaces occurrences of the hiring company name in the job description
 * so the LLM never leaks the target company name into the tailored resume.
 */
function scrubCompanyName(text: string, company?: string): string {
  if (!text) return "N/A";
  const cleanCompany = (company || "").trim();
  if (cleanCompany.length < 2) return text;
  const escaped = cleanCompany.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "gi"), "the organization");
}

const CULTURE_BENEFIT_LABELS: Record<string, string> = {
  health_family: "Comprehensive Healthcare & Family Coverage (Medical, Dental, Vision, Dependent Coverage)",
  home_office_perks: "Home Office & Top-Spec Tech Equipment Stipend (MacBook, 4K Monitor, Ergonomic Setup)",
  learning_stipend: "Learning, Books & International Conference Budget ($1,500+)",
  parental_leave: "Generous Paid Parental Leave (16+ weeks maternity/paternity)",
  wellness_gym: "Wellness, Fitness Reimbursements & Commuter Passes",
  wlb: "Strict Work-Life Balance (Protected 40h, no weekend or off-hour pings)",
  generous_pto: "Generous / Unlimited Paid Time Off (25+ days & company shutdowns)",
  four_day_week: "4-Day Work Week or Flexible Core Hours",
  sabbatical: "Paid Sabbaticals & Extended Tenure Recharge Breaks",
  equity: "Meaningful Equity, RSUs, Stock Grants or ESPP",
  performance_bonus: "Annual Performance Bonuses & Profit Sharing (10-25%+)",
  retirement_match: "Retirement / Pension Contribution Match (401k/CPF top-up)",
  autonomy: "Async-First Culture & Minimal Recurring Meetings (Deep Work Focus)",
  ai_rd: "Cutting-Edge AI / Innovation / High GPU & Compute Budgets",
  mentorship: "Staff+ Engineering Mentorship & Rigorous Code Reviews",
  global_mobility: "Global Mobility & Work From Anywhere (30-90 days abroad or visa support)",
  transparency: "Transparent Leadership, Open Financials & Psychological Safety",
};

/**
 * Deep multi-dimensional evaluation of a job against a resume and optional dream preferences.
 * Produces an ATS Resume Score (0-100), Dream Match Score (0-100), and a structured skill gap breakdown.
 */
export async function evaluateJobFit(
  resumeText: string,
  jobDetails: {
    job_id?: string;
    job_title: string;
    company: string;
    level?: string;
    description: string;
  },
  dreamProfile?: DreamJobProfile | null,
  searchMode: JobSearchMode = "get_hired_fast"
): Promise<JobEvaluationResult | null> {
  const isDreamMode = searchMode === "dream_hunter" && !!dreamProfile;

  let prompt = "";
  if (isDreamMode) {
    const dreamProfileText = `
- Target Titles: ${(dreamProfile.target_titles || []).join(", ") || "Any"}
- Target Seniorities: ${(dreamProfile.target_seniorities || []).join(", ") || "Any"}
- Workplace Preference: ${(dreamProfile.workplace_models || []).join(", ") || "Any"}
- Favorite Tech Stack: ${(dreamProfile.favorite_tech_stack || []).join(", ") || "None"}
- Dealbreaker Technologies: ${(dreamProfile.dealbreaker_tech_stack || []).join(", ") || "None"}
- Culture & Perks Priorities: ${(dreamProfile.culture_priorities || []).map((id) => CULTURE_BENEFIT_LABELS[id] || id).join("; ") || "None specified"}
- Target Salary Floor: ${dreamProfile.salary_floor_min ? `${dreamProfile.salary_floor_currency || "SGD"} ${dreamProfile.salary_floor_min} per ${dreamProfile.salary_floor_period || "month"}` : "Not specified"}
- Target Companies / Slugs: ${(dreamProfile.target_ats_companies || []).join(", ") || "Any"}
`;

    prompt = `You are an expert technical recruiter, executive talent advisor, and ATS evaluation engine.
Evaluate the candidate's resume and dream job criteria against the target job description.

--- RESUME ---
${resumeText}
--- END RESUME ---

--- TARGET JOB DESCRIPTION ---
Job Title: ${jobDetails.job_title || "N/A"}
Company: ${jobDetails.company || "N/A"}
Level: ${jobDetails.level || "N/A"}

${jobDetails.description || "N/A"}
--- END JOB DESCRIPTION ---

--- CANDIDATE DREAM PREFERENCES ---
${dreamProfileText}
--- END DREAM PREFERENCES ---

Return a single JSON object with this exact structure:
{
  "resume_score": <integer 0-100: ATS alignment based on hard skills 40pts, experience 35pts, seniority 15pts, domain 10pts>,
  "dream_score": <integer 0-100: alignment with candidate's target tech, culture values, seniority direction, and dealbreakers>,
  "score_breakdown": {
    "hard_skills_score": <integer 0-40>,
    "experience_score": <integer 0-35>,
    "seniority_score": <integer 0-15>,
    "culture_fit_score": <integer 0-10>,
    "matched_skills": [<array of specific technical or domain skills candidate HAS that this job explicitly requires>],
    "skill_gaps": [<array of tools, languages, or domain concepts the job asks for that are MISSING or weak in resume>],
    "key_strengths": [<1-3 short bullet points summarizing why the candidate is competitive>],
    "red_flags": [<any detected job warnings such as "Unrealistic experience requirements", "24/7 on-call", "Vague compensation", or empty array if none>],
    "actionable_advice": "<1-2 sentence recommendation for the candidate on how to position themselves or address gaps>"
  }
}

Output strictly valid JSON only.`;
  } else {
    // "get_hired_fast" mode: Focus 100% on qualification and ATS fit, skipping dream checklist
    prompt = `You are an expert technical recruiter and ATS evaluation engine.
Evaluate the candidate's resume against the target job description purely on qualification, hard skills, experience, and domain fit.

--- RESUME ---
${resumeText}
--- END RESUME ---

--- TARGET JOB DESCRIPTION ---
Job Title: ${jobDetails.job_title || "N/A"}
Company: ${jobDetails.company || "N/A"}
Level: ${jobDetails.level || "N/A"}

${jobDetails.description || "N/A"}
--- END JOB DESCRIPTION ---

Return a single JSON object with this exact structure:
{
  "resume_score": <integer 0-100: ATS alignment based on hard skills 40pts, experience 35pts, seniority 15pts, domain 10pts>,
  "score_breakdown": {
    "hard_skills_score": <integer 0-40>,
    "experience_score": <integer 0-35>,
    "seniority_score": <integer 0-15>,
    "culture_fit_score": <integer 0-10>,
    "matched_skills": [<array of specific technical or domain skills candidate HAS that this job explicitly requires>],
    "skill_gaps": [<array of tools, languages, or domain concepts the job asks for that are MISSING or weak in resume>],
    "key_strengths": [<1-3 short bullet points summarizing why the candidate is competitive>],
    "red_flags": [<any detected job warnings such as "Unrealistic experience requirements", "24/7 on-call", "Vague compensation", or empty array if none>],
    "actionable_advice": "<1-2 sentence recommendation for the candidate on how to position themselves or address gaps>"
  }
}

Output strictly valid JSON only.`;
  }

  try {
    const raw = await callLLM({ prompt, temperature: 0.2, jsonMode: true });
    const parsed = extractJsonFromText(raw);

    const resumeScore = Math.max(0, Math.min(100, Math.round(Number(parsed.resume_score) || 0)));
    let dreamScore: number | null = null;
    let totalScore = resumeScore;

    if (isDreamMode && parsed.dream_score !== undefined && parsed.dream_score !== null) {
      dreamScore = Math.max(0, Math.min(100, Math.round(Number(parsed.dream_score) || resumeScore)));
      totalScore = Math.max(
        0,
        Math.min(100, Math.round((resumeScore * 0.5) + (dreamScore * 0.5)))
      );
    }

    const sb = parsed.score_breakdown || {};
    const breakdown: ScoreBreakdown = {
      hard_skills_score: typeof sb.hard_skills_score === "number" ? sb.hard_skills_score : undefined,
      experience_score: typeof sb.experience_score === "number" ? sb.experience_score : undefined,
      seniority_score: typeof sb.seniority_score === "number" ? sb.seniority_score : undefined,
      culture_fit_score: typeof sb.culture_fit_score === "number" ? sb.culture_fit_score : undefined,
      matched_skills: Array.isArray(sb.matched_skills) ? sb.matched_skills.map(String) : [],
      skill_gaps: Array.isArray(sb.skill_gaps) ? sb.skill_gaps.map(String) : [],
      key_strengths: Array.isArray(sb.key_strengths) ? sb.key_strengths.map(String) : [],
      red_flags: Array.isArray(sb.red_flags) ? sb.red_flags.map(String) : [],
      actionable_advice: typeof sb.actionable_advice === "string" ? sb.actionable_advice : undefined,
    };

    return {
      resume_score: resumeScore,
      dream_score: dreamScore,
      total_score: totalScore,
      score_breakdown: breakdown,
    };
  } catch (err) {
    console.error("Error evaluating job fit with LLM:", err);
    return null;
  }
}

/**
 * Scores a job against a resume text using a clear ATS & Recruiter evaluation rubric.
 * Backwards-compatible wrapper returning the ATS integer score (0-100).
 */
export async function scoreJobWithResume(
  resumeText: string,
  jobDetails: {
    job_id?: string;
    job_title: string;
    company: string;
    level?: string;
    description: string;
  },
): Promise<number | null> {
  const result = await evaluateJobFit(resumeText, jobDetails);
  return result ? result.resume_score : null;
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
    throw new Error(
      `Failed to extract valid JSON from LLM response. Raw output:\n${text.slice(0, 300)}`,
    );
  }
}

/**
 * Stage 1: The Strategist
 * Analyzes the Target Job Description against the Master Base Resume to build a Curation Plan:
 * identifies core pain points, bridges terminology, selects the best 1-3 projects and 8-15 skills,
 * flags missing skills to prevent fabrication, and outlines role-by-role tailoring angles.
 */
export async function curateResumeStrategy(
  baseResume: Resume,
  jobDetails: {
    job_title: string;
    company: string;
    level?: string;
    description: string;
  },
): Promise<CurationPlan> {
  // Strip personal identifiers so the LLM focuses purely on professional content
  const sanitizedResumeProfile = {
    summary: baseResume.summary,
    skills: baseResume.skills,
    experience: baseResume.experience,
    projects: baseResume.projects,
    education: baseResume.education,
    certifications: baseResume.certifications,
  };

  const cleanDescription = scrubCompanyName(
    jobDetails.description,
    jobDetails.company,
  );

  const systemPrompt = `You are an elite executive resume strategist and ATS optimization specialist.
Analyze the candidate's Master Resume against the Target Job Description and produce a strategic Curation Plan for a high-converting, 2-page tailored resume.

HOW TO BUILD THE STRATEGY:
1. DECODE THE ROLE PAIN POINTS:
   - Identify the 2-3 core operational or technical problems this role exists to solve ('target_role_pain_points').
2. POSITIONING PITCH ('strategy_summary'):
   - Write a 1-2 sentence positioning angle in implied first-person resume voice (e.g., "Senior Support Engineer with 5+ years of experience in incident triage and cloud reliability...") that connects the candidate's strongest truth to the role's primary need.
   - Never mention any hiring company name or use personal pronouns (I, he, she, they).
3. SKILLS & KEYWORD ALIGNMENT:
   - 'selected_skills': Pick 8 to 15 skills that match the job description AND are demonstrably present in the candidate's Master Resume (across skills, experience, or projects).
   - 'missing_skills_acknowledged': List up to 5 explicit tools or skills required by the job that the candidate does NOT have. This acts as a strict boundary so the writer never fabricates them.
4. PROJECT CURATION (2-PAGE FOCUS):
   - 'selected_project_names': Select the 1 to 3 projects from the Master Resume that best prove capability for this specific role. Use the exact project 'name' strings from the Master Resume.
5. ROLE-BY-ROLE TAILORING BLUEPRINT ('experience_guidance'):
   - Include every job from the candidate's work history.
   - 'key_achievements_to_highlight': Identify which accomplishments to feature first AND specify exact keywords/terminology from the job description to naturally bridge into those bullets.
   - 'points_to_condense_or_omit': Flag routine or unrelated tasks to trim so the most relevant impact stands out.`;

  const prompt = `Target Job Details:
- Role Title: ${jobDetails.job_title}
- Level: ${jobDetails.level || "N/A"}
- Job Description:
${cleanDescription}

---

Candidate's Master Resume Profile:
${JSON.stringify(sanitizedResumeProfile, null, 2)}

---

Return valid JSON matching this schema:
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
    temperature: 0.5,
    jsonMode: true,
  });

  const parsed = extractJsonFromText(raw);
  return {
    strategy_summary:
      parsed.strategy_summary || "Strategic alignment with role requirements.",
    target_role_pain_points: Array.isArray(parsed.target_role_pain_points)
      ? parsed.target_role_pain_points
      : [],
    selected_project_names: Array.isArray(parsed.selected_project_names)
      ? parsed.selected_project_names
      : [],
    selected_skills:
      Array.isArray(parsed.selected_skills) && parsed.selected_skills.length > 0
        ? parsed.selected_skills
        : baseResume.skills?.slice(0, 12) || [],
    missing_skills_acknowledged: Array.isArray(
      parsed.missing_skills_acknowledged,
    )
      ? parsed.missing_skills_acknowledged
      : [],
    experience_guidance: Array.isArray(parsed.experience_guidance)
      ? parsed.experience_guidance
      : [],
  };
}

/**
 * Stage 2: The ATS Copywriter
 * Rewrites the resume to maximize ATS keyword alignment and recruiter readability while staying
 * 100% grounded in the candidate's real history.
 */
export async function writeTailoredResumeContent(
  baseResume: Resume,
  jobDetails: {
    job_title: string;
    company: string;
    level?: string;
    description: string;
  },
  curationPlan: CurationPlan,
): Promise<any> {
  // Filter base projects to only those selected in curationPlan
  const selectedNamesLower = new Set(
    (curationPlan.selected_project_names || []).map((n) =>
      n.trim().toLowerCase(),
    ),
  );
  let filteredProjects = (baseResume.projects || []).filter((p) =>
    selectedNamesLower.has(p.name.trim().toLowerCase()),
  );
  if (filteredProjects.length === 0 && (baseResume.projects || []).length > 0) {
    filteredProjects = (baseResume.projects || []).slice(0, 2);
  }

  const cleanDescription = scrubCompanyName(
    jobDetails.description,
    jobDetails.company,
  );

  const skillGapGuardrail =
    curationPlan.missing_skills_acknowledged?.length > 0
      ? `\nSKILL BOUNDARY: Do not claim or imply experience with: ${curationPlan.missing_skills_acknowledged.join(", ")}. Pivot instead to the candidate's verified adjacent strengths.`
      : "";

  const systemPrompt = `You are an elite executive resume writer. Transform the candidate's Master Resume content into a sharp, ATS-optimized resume tailored to the target role using the provided Curation Plan.

PRINCIPLES OF HIGH-IMPACT RESUME WRITING:
1. AUTHENTICITY & GROUNDING:
   - Every claim, metric, and tool must come from the candidate's actual history. Never invent metrics, tools, or responsibilities.${skillGapGuardrail}
   - Write in crisp, implied first-person resume voice (no personal pronouns like I/my/he/she/they, no candidate names, and never mention any hiring company name).

2. EXECUTIVE SUMMARY (2-3 Sentences):
   - Sentence 1 (Identity & Scope): Professional title/identity, years of experience, and core specializations aligned with the target role.
   - Sentence 2 (Proven Track Record): Highlight 2-3 signature strengths or technical/operational capabilities from their history that directly address the target role's pain points.
   - Example tone: "Systems & Support Engineer with 5+ years of experience in enterprise incident triage, root cause analysis, and 24/7 high-availability operations. Proven track record reducing ticket resolution times through Python automation, structured escalation workflows, and cross-functional technical documentation."

3. EXPERIENCE BULLETS (3-4 Bullets per Role, separated by "\\n"):
   - FRONT-LOAD RELEVANCE: Order the bullets within each role so the achievement most relevant to the target job is Bullet #1.
   - BRIDGE TERMINOLOGY: Naturally mirror the job description's keywords where they accurately describe the candidate's past work (follow the Curation Plan's 'key_achievements_to_highlight').
   - ACTION + CONTEXT + IMPACT: Start every bullet with a strong action verb (e.g., "- Engineered...", "- Resolved...", "- Automated..."). Include exact metrics when present in the original text; when numbers aren't present, emphasize concrete technical scope, system reliability, or operational outcome rather than forcing unnatural phrasing.
   - CONCISE & SCANNABLE: Keep each bullet to 1-2 lines maximum. Preserve all original 'job_title', 'company', 'location', 'start_date', and 'end_date' fields unchanged.

4. PROJECTS (2-3 Bullets per Project, separated by "\\n"):
   - Frame each selected project around what was built, how the technologies were applied, and the practical problem solved. Keep 'name' and 'technologies' unchanged.`;

  const prompt = `Target Role Context:
- Target Title: ${jobDetails.job_title}
- Level: ${jobDetails.level || "N/A"}
- Core Role Pain Points to Address: ${curationPlan.target_role_pain_points.join("; ")}
- Positioning Strategy: ${curationPlan.strategy_summary}
- Target Job Description (for domain phrasing & keyword alignment):
${cleanDescription}

---

Curation Plan:
- Curated Skills (keep in priority order): ${JSON.stringify(curationPlan.selected_skills)}
- Role-by-Role Tailoring Guidance:
${JSON.stringify(curationPlan.experience_guidance, null, 2)}

---

Candidate's Original Summary:
${baseResume.summary || "N/A"}

Candidate's Original Experience (Keep job_title, company, location, dates identical; rewrite description into 3-4 newline-separated bullets starting with "- "):
${JSON.stringify(baseResume.experience || [], null, 2)}

Selected Projects to Tailor (Keep name & technologies identical; rewrite description into 2-3 newline-separated bullets starting with "- "):
${JSON.stringify(filteredProjects, null, 2)}

---

Return valid JSON matching this exact structure:
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
    temperature: 0.8,
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
  curationPlan: CurationPlan,
): Omit<
  Resume,
  "id" | "created_at" | "parsed_at" | "last_updated" | "resume_link"
> {
  // 1. Summary healing
  let summary = tailoredRaw?.summary;
  if (!summary || typeof summary !== "string" || summary.trim().length < 20) {
    summary =
      baseResume.summary ||
      curationPlan.strategy_summary ||
      "Experienced professional.";
  }

  // 2. Skills healing (ensure non-empty subset of base skills or curation plan)
  let skills: string[] = [];
  if (Array.isArray(tailoredRaw?.skills) && tailoredRaw.skills.length > 0) {
    skills = tailoredRaw.skills.filter(
      (s: any) => typeof s === "string" && s.trim(),
    );
  }
  if (skills.length === 0) {
    skills =
      curationPlan.selected_skills?.length > 0
        ? curationPlan.selected_skills
        : baseResume.skills?.slice(0, 15) || [];
  }

  // 3. Experience healing (Strictly preserve timeline, employers, titles, dates)
  const baseExp = baseResume.experience || [];
  const rawExp = Array.isArray(tailoredRaw?.experience)
    ? tailoredRaw.experience
    : [];

  const healedExperience = baseExp.map((origExp, index) => {
    // Match by both company AND job_title first (handles promotions/multiple roles at same company),
    // then by index, then by company name alone.
    const matchingTailored =
      rawExp.find(
        (e: any) =>
          e.company?.toLowerCase().trim() ===
            origExp.company?.toLowerCase().trim() &&
          e.job_title?.toLowerCase().trim() ===
            origExp.job_title?.toLowerCase().trim(),
      ) ||
      rawExp[index] ||
      rawExp.find(
        (e: any) =>
          e.company &&
          origExp.company &&
          e.company.toLowerCase().trim() ===
            origExp.company.toLowerCase().trim(),
      );

    let description = matchingTailored?.description;
    if (
      !description ||
      typeof description !== "string" ||
      description.trim().length < 15
    ) {
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
  const rawProjects = Array.isArray(tailoredRaw?.projects)
    ? tailoredRaw.projects
    : [];

  let healedProjects: any[] = [];
  for (const p of rawProjects) {
    if (!p || !p.name) continue;
    const origProj = baseProjects.find(
      (bp) =>
        bp.name && bp.name.toLowerCase().trim() === p.name.toLowerCase().trim(),
    );
    if (origProj) {
      healedProjects.push({
        name: origProj.name,
        description:
          p.description &&
          typeof p.description === "string" &&
          p.description.trim().length > 10
            ? p.description.trim()
            : origProj.description,
        technologies: origProj.technologies || p.technologies || [],
      });
    }
  }

  // If no projects matched or projects were dropped, take the curation plan / top base projects
  if (healedProjects.length === 0 && baseProjects.length > 0) {
    const selectedNames = new Set(
      (curationPlan.selected_project_names || []).map((n) =>
        n.toLowerCase().trim(),
      ),
    );
    const matching = baseProjects.filter((bp) =>
      selectedNames.has(bp.name.toLowerCase().trim()),
    );
    const fallbackProjects =
      matching.length > 0 ? matching : baseProjects.slice(0, 2);

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
    links: baseResume.links || {
      linkedin: null,
      github: null,
      portfolio: null,
    },
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
  jobDetails: {
    job_title: string;
    company: string;
    level?: string;
    description: string;
  },
): Promise<
  Omit<
    Resume,
    "id" | "created_at" | "parsed_at" | "last_updated" | "resume_link"
  >
> {
  console.log(
    `  [ResumeTailor] Stage 1/3: Formulating strategic Curation Plan (The Strategist)...`,
  );
  const curationPlan = await curateResumeStrategy(baseResume, jobDetails);
  console.log(
    `  [ResumeTailor] ✓ Curation Plan ready: Strategy: "${curationPlan.strategy_summary.slice(0, 70)}..." | ` +
      `Projects: ${curationPlan.selected_project_names.join(", ") || "None"} | ` +
      `Skills: ${curationPlan.selected_skills.length} skills.`,
  );

  // Rate-limiting safety pause between Stage 1 and Stage 2 (respects 15-30 RPM limits on free tiers)
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log(
    `  [ResumeTailor] Stage 2/3: Crafting high-impact tailored ATS copy (The Copywriter)...`,
  );
  const rawTailoredContent = await writeTailoredResumeContent(
    baseResume,
    jobDetails,
    curationPlan,
  );

  console.log(
    `  [ResumeTailor] Stage 2.5: Running deterministic code verification & timeline preservation...`,
  );
  const validatedResume = validateAndHealResume(
    baseResume,
    rawTailoredContent,
    curationPlan,
  );
  console.log(
    `  [ResumeTailor] ✓ Resume tailored and validated successfully (Ready for ATS Rescoring).`,
  );

  return validatedResume;
}

// --- On-Demand Cover Letter Generation ---

export interface GenerateCoverLetterOptions {
  tone?: CoverLetterTone;
  customInstructions?: string;
  senderName?: string;
}

/**
 * Generates a tailored, professional, ATS-optimized cover letter on-demand
 * using the candidate's master resume and target job description.
 */
export async function generateCoverLetterWithLLM(
  baseResume: Resume,
  jobDetails: {
    job_title: string;
    company: string;
    level?: string;
    description: string;
    location?: string;
  },
  options: GenerateCoverLetterOptions = {},
): Promise<string> {
  const tone = options.tone || "confident_professional";
  const candidateName = options.senderName || baseResume.name || "Candidate";

  let toneGuidance = "Tone: Confident, articulate, professional, and impact-driven (~250-320 words).";
  if (tone === "executive") {
    toneGuidance = "Tone: High-level executive, strategic, vision-oriented, emphasizing organizational leadership, scale, and business outcomes (~280-350 words).";
  } else if (tone === "technical") {
    toneGuidance = "Tone: Technically precise, engineering-driven, highlighting system architecture, stack mastery, and concrete technical problem-solving (~250-320 words).";
  } else if (tone === "short_note") {
    toneGuidance = "Tone: Short, punchy, high-impact elevator pitch (~150-180 words). Ideal for LinkedIn InMail or portals with tight character counts.";
  }

  const customPromptAddendum = options.customInstructions?.trim()
    ? `\nSPECIFIC USER GUIDANCE TO INCORPORATE:\n"${options.customInstructions.trim()}"\nEnsure this nuance or point of emphasis is woven naturally into the letter.\n`
    : "";

  // Prepare concise profile text
  const experienceSummary = (baseResume.experience || [])
    .slice(0, 4)
    .map((exp) => {
      const desc = (exp.description || "")
        .split("\n")
        .filter((l) => l.trim())
        .slice(0, 3)
        .join(" ");
      return `- ${exp.job_title} at ${exp.company} (${exp.start_date || ""} - ${exp.end_date || "Present"}): ${desc}`;
    })
    .join("\n");

  const projectSummary = (baseResume.projects || [])
    .slice(0, 3)
    .map((p) => `- ${p.name}: ${p.description || ""} [${(p.technologies || []).join(", ")}]`)
    .join("\n");

  const topSkills = (baseResume.skills || []).slice(0, 15).join(", ");

  const systemPrompt = `You are an elite career strategist and executive talent copywriter.
Write an authentic, highly tailored, ATS-ready cover letter for the candidate applying to ${jobDetails.company} for the role of ${jobDetails.job_title}.

STRICT ANTI-HALLUCINATION RULES:
1. ONLY reference real work experience, skills, technologies, and achievements from the candidate's profile.
2. NEVER invent degrees, previous companies, statistics, or metrics that do not exist in the candidate's background.
3. If specific metrics are in the candidate profile, leverage them accurately.

STRICT ANTI-CLICHÉ & VOICE RULES:
1. BANNED: Never open with "I am writing with great enthusiasm to apply for..." or "I hope this email finds you well".
2. BANNED: Do not use overused AI buzzwords ("delve", "tapestry", "plethora", "beacon", "testament", "in conclusion", "synergy").
3. Write in first person ("I", "my") with confident, active verbs and genuine professional voice.
4. ${toneGuidance}

FORMATTING REQUIREMENTS:
- Standard business letter format.
- Salutation: "Dear Hiring Team at ${jobDetails.company}," (or "Dear Hiring Manager,").
- 3 to 4 distinct paragraphs separated by double line breaks (or 2-3 paragraphs for short note):
  - Paragraph 1: Direct hook. Clearly state the role of ${jobDetails.job_title} at ${jobDetails.company}. Connect the candidate's core expertise immediately to the company's domain or challenge.
  - Paragraph 2: Spotlight 1-2 major accomplishments from the candidate's experience that directly address key requirements in the job description.
  - Paragraph 3: Reinforce domain/technical alignment (tools, methodologies, or collaborative strengths).
  - Paragraph 4: Confident, forward-looking closing proposing a discussion.
- Formal sign-off:
Sincerely,
${candidateName}

Output ONLY the final cover letter text. No preamble, no postscript, no commentary.`;

  const userPrompt = `TARGET ROLE & COMPANY:
Company: ${jobDetails.company}
Job Title: ${jobDetails.job_title}
${jobDetails.level ? `Level: ${jobDetails.level}\n` : ""}${jobDetails.location ? `Location: ${jobDetails.location}\n` : ""}
JOB DESCRIPTION:
${jobDetails.description.slice(0, 3500)}

---

CANDIDATE PROFILE:
Name: ${candidateName}
Summary: ${baseResume.summary || "Not provided"}
Top Skills: ${topSkills || "Not provided"}

Key Experience:
${experienceSummary || "Not provided"}

Notable Projects:
${projectSummary || "None"}
${customPromptAddendum}
Write the complete, tailored cover letter now.`;

  console.log(`[generateCoverLetterWithLLM] Generating ${tone} cover letter for ${jobDetails.job_title} at ${jobDetails.company}...`);
  const response = await callLLM({
    prompt: userPrompt,
    systemPrompt,
    temperature: 0.3,
  });

  return response.trim();
}

/**
 * On-Demand Recruiter Outreach & Networking Generator.
 * Creates a LinkedIn connection note (<300 chars), a cold InMail pitch, and an alumni referral request.
 */
export async function generateOutreachNotesWithLLM(
  baseResume: Resume,
  jobDetails: {
    job_title: string;
    company: string;
    description: string;
    location?: string;
  },
  options: {
    recipientName?: string;
    tone?: string;
    customNote?: string;
  } = {}
): Promise<OutreachVariants> {
  const candidateName = baseResume.name || "Candidate";
  const recipient = options.recipientName?.trim() || "Hiring Team";
  const tone = options.tone || "direct_impactful";

  const topSkills = (baseResume.skills || []).slice(0, 10).join(", ");
  const topProjects = (baseResume.projects || [])
    .slice(0, 2)
    .map((p) => `${p.name} (${(p.technologies || []).slice(0, 3).join(", ")})`)
    .join(", ");

  const prompt = `You are an elite career networking strategist and recruiter outreach expert.
Generate 3 distinct, high-conversion outreach messages for the candidate reaching out regarding the ${jobDetails.job_title} position at ${jobDetails.company}.

Target Recipient: ${recipient}
Target Company: ${jobDetails.company}
Target Role: ${jobDetails.job_title}
Candidate Name: ${candidateName}
Candidate Core Skills: ${topSkills}
Key Projects: ${topProjects}
Tone: ${tone}
${options.customNote ? `Special Context to Include: "${options.customNote}"` : ""}

CRITICAL RULES:
1. "linkedin_connection_note" MUST BE STRICTLY UNDER 300 CHARACTERS including spaces. Concise, respectful, hooks the recipient immediately.
2. "cold_inmail" must be approximately 120-160 words. Avoid cliché openings like "I hope this finds you well". State 1-2 concrete reasons the candidate solves their current challenges.
3. "referral_request" must be approximately 100-140 words. Written to an existing engineer/employee at the company asking politely for advice or a 10-minute chat/referral.

Return a single JSON object with this exact structure:
{
  "linkedin_connection_note": "<string <= 300 chars>",
  "cold_inmail": "<string ~140 words>",
  "referral_request": "<string ~120 words>"
}

Output strictly valid JSON only.`;

  try {
    const raw = await callLLM({ prompt, temperature: 0.3, jsonMode: true });
    const parsed = extractJsonFromText(raw);

    let connectionNote = typeof parsed.linkedin_connection_note === "string"
      ? parsed.linkedin_connection_note.trim()
      : `Hi ${recipient}, saw your team at ${jobDetails.company} is hiring for ${jobDetails.job_title}. With my background in ${topSkills.slice(0, 40)}, I'd love to connect!`;

    // Strict 300-char safety clamp
    if (connectionNote.length > 295) {
      connectionNote = connectionNote.slice(0, 292) + "...";
    }

    return {
      linkedin_connection_note: connectionNote,
      cold_inmail: typeof parsed.cold_inmail === "string" ? parsed.cold_inmail.trim() : "",
      referral_request: typeof parsed.referral_request === "string" ? parsed.referral_request.trim() : "",
    };
  } catch (err) {
    console.error("Error generating outreach notes:", err);
    return {
      linkedin_connection_note: `Hi ${recipient}, noticed ${jobDetails.company} is seeking a ${jobDetails.job_title}. My expertise aligns closely with your tech stack—would love to connect!`,
      cold_inmail: `Hi ${recipient},\n\nI noticed the ${jobDetails.job_title} role at ${jobDetails.company}. Given my background in ${topSkills}, I wanted to reach out directly to express my interest.\n\nBest,\n${candidateName}`,
      referral_request: `Hi ${recipient},\n\nI hope your week is going well! I saw an open ${jobDetails.job_title} role at ${jobDetails.company} and would love to ask about your experience on the team.\n\nBest,\n${candidateName}`,
    };
  }
}

/**
 * On-Demand AI Interview Preparation Copilot.
 * Generates tailored technical questions, behavioral STAR talking points, reverse questions, and company brief.
 */
export async function generateInterviewPrepWithLLM(
  baseResume: Resume,
  jobDetails: {
    job_id?: string;
    job_title: string;
    company: string;
    description: string;
  },
  options: {
    tone?: string;
    customNotes?: string;
  } = {}
): Promise<Omit<JobInterviewPrep, "id" | "created_at" | "updated_at">> {
  const candidateName = baseResume.name || "Candidate";
  const experienceSummary = (baseResume.experience || [])
    .slice(0, 3)
    .map((e) => `${e.job_title} at ${e.company}: ${e.description?.slice(0, 200)}`)
    .join("\n");

  const tone = options.tone || "balanced";
  let toneGuidance = "Style/Tone: Comprehensive & Balanced. Provide an even, rigorous balance of technical depth, architecture design, and STAR behavioral answers.";
  if (tone === "technical") {
    toneGuidance = "Style/Tone: Technical Deep-Dive. Emphasize deep architectural decisions, system design trade-offs, edge cases, and concrete engineering mechanisms in the technical questions and answers.";
  } else if (tone === "behavioral") {
    toneGuidance = "Style/Tone: Behavioral & Leadership Focus. Emphasize high-stakes situational challenges, team leadership, cross-functional collaboration, conflict resolution, and rich STAR answers.";
  } else if (tone === "executive") {
    toneGuidance = "Style/Tone: Executive & Strategic. Emphasize strategic business alignment, engineering culture, team scaling, organizational impact, and high-level strategic reverse questions.";
  }

  const prompt = `You are a Principal Engineering Interviewer and Executive Career Coach.
Create a comprehensive, personalized Interview Preparation Guide for ${candidateName} interviewing for the role of "${jobDetails.job_title}" at "${jobDetails.company}".

--- JOB DESCRIPTION ---
${jobDetails.description.slice(0, 3000)}
--- END JOB DESCRIPTION ---

--- CANDIDATE BACKGROUND ---
${experienceSummary}
Skills: ${(baseResume.skills || []).slice(0, 15).join(", ")}
--- END CANDIDATE BACKGROUND ---

${toneGuidance}
${options.customNotes ? `Candidate Focus / Special Context: "${options.customNotes}"` : ""}

Generate:
1. 5 Technical Questions likely to be asked for this exact role and stack, each with a bulleted "answer_guide" of what top answers must include.
2. 5 Behavioral Questions with customized STAR answers (Situation, Task, Action, Result) drawn directly from the candidate's actual projects and experience.
3. 5 Thoughtful Reverse Questions the candidate should ask the interviewer to evaluate team health, engineering culture, and strategic priorities.
4. A concise 2-paragraph "company_brief" highlighting their business model, tech landscape, and what they value in candidates.

Return a single JSON object with this exact structure:
{
  "company_brief": "<2 paragraph context summary>",
  "technical_questions": [
    {
      "question": "<question string>",
      "topic": "<e.g. Distributed Systems, React Performance, SQL Indexing>",
      "answer_guide": "<concise talking points to mention>"
    }
  ],
  "behavioral_star": [
    {
      "question": "<behavioral question e.g. Tell me about a time you resolved a major production incident>",
      "situation": "<specific situation from candidate's background>",
      "task": "<the objective/challenge>",
      "action": "<the key actions taken>",
      "result": "<measurable business outcome or learning>"
    }
  ],
  "reverse_questions": [
    "<insightful question 1>",
    "<insightful question 2>",
    "<insightful question 3>",
    "<insightful question 4>",
    "<insightful question 5>"
  ]
}

Output strictly valid JSON only.`;

  try {
    const raw = await callLLM({ prompt, temperature: 0.3, jsonMode: true });
    const parsed = extractJsonFromText(raw);

    return {
      job_id: jobDetails.job_id || "",
      company_brief: typeof parsed.company_brief === "string" ? parsed.company_brief.trim() : null,
      technical_questions: Array.isArray(parsed.technical_questions) ? parsed.technical_questions : [],
      behavioral_star: Array.isArray(parsed.behavioral_star) ? parsed.behavioral_star : [],
      reverse_questions: Array.isArray(parsed.reverse_questions) ? parsed.reverse_questions.map(String) : [],
    };
  } catch (err) {
    console.error("Error generating interview prep with LLM:", err);
    throw new Error("Failed to generate interview prep guide");
  }
}
