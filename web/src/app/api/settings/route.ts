import { NextResponse } from "next/server";
import { getAppSettings, updateAppSettings } from "@/lib/supabase/queries";
import { resolveGeoLocation } from "@/lib/setup/geoLocations";
import { AppSettings } from "@/types";

export async function GET() {
  try {
    const settings = await getAppSettings();
    return NextResponse.json({ settings });
  } catch (err: any) {
    console.error("GET /api/settings error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve app settings", details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AppSettings>;

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    if (body.linkedin_location && typeof body.linkedin_location === "string") {
      const resolved = resolveGeoLocation(body.linkedin_location, body.linkedin_geo_id);
      body.linkedin_location = resolved.name;
      body.linkedin_geo_id = resolved.geoId;
      if (!resolved.name.toLowerCase().includes("singapore") && Array.isArray(body.scraping_sources)) {
        body.scraping_sources = body.scraping_sources.filter((s: string) => s !== "careers_future");
      }
    }

    const updated = await updateAppSettings(body);
    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    console.error("POST /api/settings error:", err);
    return NextResponse.json(
      { error: "Failed to update app settings", details: err.message },
      { status: 500 }
    );
  }
}
