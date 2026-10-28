import { NextResponse } from "next/server";
import { updateAppSettings, getAppSettings } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      linkedinSearchQueries = [],
      linkedinLocation = "Singapore",
      linkedinGeoId = "102454443",
      linkedinJobType = "F",
      linkedinJobPostingDate = "r86400",
      linkedinFWt = "1,2,3",
      scrapingSources = ["linkedin"],
      careersFutureSearchCategories = [],
      careersFutureSearchEmploymentTypes = ["Full Time"],
    } = body;

    if (!Array.isArray(linkedinSearchQueries) || linkedinSearchQueries.length < 3 || linkedinSearchQueries.length > 5) {
      return NextResponse.json(
        { error: "Please provide between 3 and 5 job search queries." },
        { status: 400 }
      );
    }

    if (!linkedinLocation || !linkedinGeoId) {
      return NextResponse.json(
        { error: "Location and LinkedIn Geo ID are required." },
        { status: 400 }
      );
    }

    // Save preferences to app_settings in Supabase
    const updated = await updateAppSettings({
      linkedin_search_queries: linkedinSearchQueries,
      linkedin_location: linkedinLocation,
      linkedin_geo_id: String(linkedinGeoId),
      linkedin_job_type: linkedinJobType,
      linkedin_job_posting_date: linkedinJobPostingDate,
      linkedin_f_wt: linkedinFWt,
      // CareersFuture inherits the exact same queries
      careers_future_search_queries: linkedinSearchQueries,
      careers_future_search_categories: careersFutureSearchCategories,
      careers_future_search_employment_types: careersFutureSearchEmploymentTypes,
      scraping_sources: scrapingSources,
    });

    return NextResponse.json({
      success: true,
      message: "Job preferences saved successfully.",
      settings: updated,
    });
  } catch (error: any) {
    console.error("Error saving job preferences:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save job preferences." },
      { status: 500 }
    );
  }
}
