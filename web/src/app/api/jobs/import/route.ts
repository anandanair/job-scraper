import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { convertHtmlToMarkdown } from "@/lib/scraper/html-to-markdown";
import { fetchLinkedInJobDetails } from "@/lib/scraper/linkedin";
import { fetchCareersFutureJobDetails } from "@/lib/scraper/careers-future";
import { evaluateJobFit, formatResumeToText } from "@/lib/llm";
import { Resume } from "@/types";
import * as cheerio from "cheerio";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, title, company, location, description, salary, workplace_type } = body;

    let finalTitle = title?.trim() || "";
    let finalCompany = company?.trim() || "";
    let finalLocation = location?.trim() || "Not specified";
    let finalDescription = description?.trim() || "";
    let finalWorkplaceType = workplace_type || null;
    let provider = "imported";
    let extractedJobId = "";

    // 1. If URL is provided, try provider-specific extractors or general web fetch
    if (url && url.trim()) {
      const cleanUrl = url.trim();

      // Case A: LinkedIn URL
      if (cleanUrl.includes("linkedin.com/jobs")) {
        const idMatch = cleanUrl.match(/\/jobs\/(?:view\/)?(\d+)/);
        if (idMatch && idMatch[1]) {
          extractedJobId = idMatch[1];
          const linkedinData = await fetchLinkedInJobDetails(extractedJobId);
          if (linkedinData) {
            finalTitle = finalTitle || linkedinData.job_title || "";
            finalCompany = finalCompany || linkedinData.company || "";
            finalLocation = finalLocation !== "Not specified" ? finalLocation : (linkedinData.location || "Not specified");
            finalDescription = finalDescription || linkedinData.description || "";
            finalWorkplaceType = finalWorkplaceType || linkedinData.workplace_type || null;
            provider = "linkedin";
          }
        }
      }

      // Case B: CareersFuture URL
      if (cleanUrl.includes("mycareersfuture.gov.sg")) {
        const idMatch = cleanUrl.match(/\/job\/([a-zA-Z0-9-]+)/);
        if (idMatch && idMatch[1]) {
          extractedJobId = idMatch[1];
          const cfData = await fetchCareersFutureJobDetails(extractedJobId);
          if (cfData) {
            finalTitle = finalTitle || cfData.job_title || "";
            finalCompany = finalCompany || cfData.company || "";
            finalLocation = "Singapore";
            finalDescription = finalDescription || cfData.description || "";
            finalWorkplaceType = finalWorkplaceType || cfData.workplace_type || null;
            provider = "careers_future";
          }
        }
      }

      // Case C: General URL fallback if description is still empty
      if (!finalDescription) {
        try {
          const pageRes = await fetch(cleanUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            signal: AbortSignal.timeout(15000),
          });

          if (pageRes.ok) {
            const html = await pageRes.text();
            const $ = cheerio.load(html);

            // Strip non-content tags
            $("script, style, noscript, nav, footer, header, svg").remove();

            if (!finalTitle) {
              const h1 = $("h1").first().text().trim();
              const pageTitle = $("title").text().trim();
              finalTitle = h1 || pageTitle.split(/[-|]/)[0].trim() || "Imported Job";
            }

            if (!finalCompany) {
              const ogSite = $('meta[property="og:site_name"]').attr("content");
              finalCompany = ogSite || "Unknown Company";
            }

            // Look for main body
            const mainContent = $("main, article, [role='main'], div[class*='job'], div[class*='description']").first();
            const rawBody = mainContent.length > 0 ? mainContent.html() || "" : $("body").html() || "";
            finalDescription = convertHtmlToMarkdown(rawBody);
          }
        } catch (fetchErr: any) {
          console.warn("[ImportJob] Could not auto-fetch URL:", fetchErr.message);
        }
      }
    }

    if (!finalTitle || !finalDescription) {
      return NextResponse.json(
        { error: "Could not extract job title or description. Please provide them manually." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const jobId = extractedJobId || `imported_${crypto.randomBytes(6).toString("hex")}`;

    // Infer workplace type if not set
    if (!finalWorkplaceType) {
      const combined = `${finalTitle} ${finalLocation} ${finalDescription.slice(0, 1000)}`.toLowerCase();
      if (combined.includes("remote")) finalWorkplaceType = "remote";
      else if (combined.includes("hybrid")) finalWorkplaceType = "hybrid";
      else finalWorkplaceType = "onsite";
    }

    const newJobPayload = {
      job_id: jobId,
      company: finalCompany || "Unknown Company",
      job_title: finalTitle,
      level: "Not specified",
      location: finalLocation,
      description: finalDescription,
      provider,
      workplace_type: finalWorkplaceType,
      application_url: url ? url.trim() : null,
      status: "new",
      job_state: "new",
      is_active: true,
      scraped_at: new Date().toISOString(),
      last_checked: new Date().toISOString(),
    };

    const { data: insertedJob, error: insertError } = await supabase
      .from("jobs")
      .upsert(newJobPayload, { onConflict: "job_id" })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Trigger AI Scoring in background or immediately
    try {
      const { data: baseResumeData } = await supabase
        .from("base_resume")
        .select("resume_data")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (baseResumeData?.resume_data) {
        const { data: dbSettings } = await supabase
          .from("app_settings")
          .select("dream_job_profile, job_search_mode")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const resumeText = formatResumeToText(baseResumeData.resume_data as Resume);
        const evalResult = await evaluateJobFit(
          resumeText,
          {
            job_id: jobId,
            job_title: finalTitle,
            company: finalCompany,
            description: finalDescription,
          },
          dbSettings?.dream_job_profile,
          (dbSettings?.job_search_mode as any) || "get_hired_fast"
        );

        if (evalResult) {
          await supabase
            .from("jobs")
            .update({
              resume_score: evalResult.resume_score,
              dream_score: evalResult.dream_score,
              total_score: evalResult.total_score,
              score_breakdown: evalResult.score_breakdown,
              resume_score_stage: "initial",
            })
            .eq("job_id", jobId);
        }
      }
    } catch (scoreErr) {
      console.warn("[ImportJob] Scoring failed after import:", scoreErr);
    }

    return NextResponse.json({ success: true, job: insertedJob });
  } catch (err: any) {
    console.error("[ImportJob] Unexpected error:", err);
    return NextResponse.json({ error: err.message || "Failed to import job" }, { status: 500 });
  }
}
