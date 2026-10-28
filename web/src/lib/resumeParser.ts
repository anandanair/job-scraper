import { Resume } from "@/types";
import { callLLM } from "./llm";

/**
 * Extracts visible text and embedded hyperlinks from a PDF buffer using pdfjs-dist.
 */
export async function extractTextAndLinksFromPdf(pdfBuffer: Buffer): Promise<string> {
  // Use legacy build for Node.js compatibility
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const uint8 = new Uint8Array(
    pdfBuffer.buffer,
    pdfBuffer.byteOffset,
    pdfBuffer.byteLength
  );

  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  let fullText = "";

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    
    // 1. Visible text items
    const textContent = await page.getTextContent();
    const pageStrings = textContent.items
      .map((item: any) => (item.str !== undefined ? item.str : ""))
      .filter((s: string) => s.length > 0);
    
    if (pageStrings.length > 0) {
      fullText += pageStrings.join(" ") + "\n";
    }

    // 2. Embedded hyperlink annotations (similar to pdfplumber in Python)
    try {
      const annotations = await page.getAnnotations();
      for (const annot of annotations) {
        if (annot.subtype === "Link" && annot.url) {
          fullText += `Embedded Link: ${annot.url}\n`;
        }
      }
    } catch {
      // Ignore annotation extraction failures on non-standard pages
    }
  }

  return fullText.trim();
}

/**
 * Normalizes raw LLM output into strict Resume structure:
 * - List fields (languages, skills, projects, etc.) default to an empty array []
 * - Scalar fields (phone, location, summary, links, etc.) default to an empty string ""
 */
function normalizeResumeData(raw: any): Omit<Resume, "id" | "created_at"> {
  const cleanStr = (val: unknown) => (typeof val === "string" ? val.trim() : "");
  const cleanArr = (arr: unknown) =>
    Array.isArray(arr)
      ? arr
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      : [];

  return {
    name: cleanStr(raw.name),
    email: cleanStr(raw.email),
    phone: cleanStr(raw.phone),
    location: cleanStr(raw.location),
    summary: cleanStr(raw.summary),
    skills: cleanArr(raw.skills),
    languages: cleanArr(raw.languages),
    links: {
      linkedin: cleanStr(raw.links?.linkedin),
      github: cleanStr(raw.links?.github),
      portfolio: cleanStr(raw.links?.portfolio),
    },
    education: Array.isArray(raw.education)
      ? raw.education
          .map((edu: any) => ({
            degree: cleanStr(edu?.degree),
            field_of_study: cleanStr(edu?.field_of_study),
            institution: cleanStr(edu?.institution),
            start_year: cleanStr(edu?.start_year),
            end_year: cleanStr(edu?.end_year),
          }))
          .filter((edu: any) => edu.degree || edu.institution || edu.field_of_study)
      : [],
    experience: Array.isArray(raw.experience)
      ? raw.experience
          .map((exp: any) => ({
            job_title: cleanStr(exp?.job_title),
            company: cleanStr(exp?.company),
            location: cleanStr(exp?.location),
            start_date: cleanStr(exp?.start_date),
            end_date: cleanStr(exp?.end_date),
            description: cleanStr(exp?.description),
          }))
          .filter((exp: any) => exp.job_title || exp.company || exp.description)
      : [],
    projects: Array.isArray(raw.projects)
      ? raw.projects
          .map((proj: any) => ({
            name: cleanStr(proj?.name),
            description: cleanStr(proj?.description),
            technologies: cleanArr(proj?.technologies),
          }))
          .filter((proj: any) => proj.name || proj.description || proj.technologies.length > 0)
      : [],
    certifications: Array.isArray(raw.certifications)
      ? raw.certifications
          .map((cert: any) => ({
            name: cleanStr(cert?.name),
            issuer: cleanStr(cert?.issuer),
            year: cleanStr(cert?.year),
          }))
          .filter((cert: any) => cert.name || cert.issuer)
      : [],
    parsed_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  };
}

export interface ParseResumeOptions {
  apiKeyOverride?: string;
  modelOverride?: string;
  providerOverride?: string;
}

/**
 * Parses raw resume text into structured Resume JSON using AI.
 */
export async function parseResumeWithAI(
  resumeText: string,
  options?: ParseResumeOptions
): Promise<Omit<Resume, "id" | "created_at">> {
  const prompt = `Extract and return the structured resume information from the text below. 
Only use what is explicitly stated in the text and do not infer or invent any details.

If a section or list has no items mentioned in the text (such as languages, certifications, or projects), return an empty array [].
If any scalar field is missing or not available in the text, use an empty string "".

Return JSON adhering strictly to this structure:
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

Resume text:
${resumeText}
`;

  const rawJson = await callLLM({
    prompt,
    systemPrompt: "You are an expert resume parsing system. Output strict, valid JSON matching the requested schema.",
    temperature: 0.1,
    jsonMode: true,
    apiKeyOverride: options?.apiKeyOverride,
    modelOverride: options?.modelOverride,
    providerOverride: options?.providerOverride,
  });

  const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to extract valid JSON from LLM response");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return normalizeResumeData(parsed);
}

/**
 * End-to-end resume parser: takes a PDF Buffer and produces a structured Resume object.
 */
export async function parseResumePdf(
  pdfBuffer: Buffer,
  options?: ParseResumeOptions
): Promise<Omit<Resume, "id" | "created_at">> {
  const extractedText = await extractTextAndLinksFromPdf(pdfBuffer);
  if (!extractedText || extractedText.trim().length === 0) {
    throw new Error("Could not extract any readable text from the uploaded PDF.");
  }

  return await parseResumeWithAI(extractedText, options);
}
