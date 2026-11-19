import { NextResponse } from "next/server";
import { updateAppSettings, getAppSettings } from "@/lib/supabase/queries";
import { resolveGeoLocation } from "@/lib/setup/geoLocations";

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
      scheduleTimezone,
      scheduleHour,
      scheduleMinute,
    } = body;

    if (!Array.isArray(linkedinSearchQueries) || linkedinSearchQueries.length < 3 || linkedinSearchQueries.length > 5) {
      return NextResponse.json(
        { error: "Please provide between 3 and 5 job search queries." },
        { status: 400 }
      );
    }

    if (!linkedinLocation) {
      return NextResponse.json(
        { error: "Location is required." },
        { status: 400 }
      );
    }

    const resolved = resolveGeoLocation(linkedinLocation, linkedinGeoId);
    const finalLocation = resolved.name;
    const finalGeoId = resolved.geoId;
    const isSingapore = finalLocation.toLowerCase().includes("singapore");

    let finalSources = Array.isArray(scrapingSources) && scrapingSources.length > 0 ? scrapingSources : ["linkedin"];
    if (!isSingapore) {
      finalSources = finalSources.filter((s: string) => s !== "careers_future");
    }

    // Save preferences to app_settings in Supabase
    const updated = await updateAppSettings({
      linkedin_search_queries: linkedinSearchQueries,
      linkedin_location: finalLocation,
      linkedin_geo_id: String(finalGeoId),
      linkedin_job_type: linkedinJobType,
      linkedin_job_posting_date: linkedinJobPostingDate,
      linkedin_f_wt: linkedinFWt,
      // CareersFuture inherits the exact same queries
      careers_future_search_queries: linkedinSearchQueries,
      careers_future_search_categories: careersFutureSearchCategories,
      careers_future_search_employment_types: careersFutureSearchEmploymentTypes,
      scraping_sources: finalSources,
      ...(scheduleTimezone ? { schedule_timezone: scheduleTimezone } : {}),
      ...(typeof scheduleHour === "number" ? { schedule_hour: scheduleHour } : {}),
      ...(typeof scheduleMinute === "number" ? { schedule_minute: scheduleMinute } : {}),
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
