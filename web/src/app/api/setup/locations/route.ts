import { NextResponse } from "next/server";
import { createSupabaseStaticClient } from "@/utils/supabase/server";
import { PRESET_GEO_LOCATIONS, GeoLocationItem, resolveGeoLocation } from "@/lib/setup/geoLocations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseStaticClient();
    const { data, error } = await supabase
      .from("linkedin_geo_locations")
      .select("*")
      .order("name", { ascending: true });

    if (error || !data || data.length === 0) {
      // Table might not exist yet, return static presets
      return NextResponse.json({
        locations: PRESET_GEO_LOCATIONS,
        source: "presets",
      });
    }

    const merged = (data as any[]).map((d) => {
      const preset = PRESET_GEO_LOCATIONS.find((p) => p.geo_id === d.geo_id);
      return {
        ...d,
        aliases: preset?.aliases || d.aliases || [],
      };
    });

    return NextResponse.json({
      locations: merged as GeoLocationItem[],
      source: "database",
    });
  } catch (err: any) {
    // Graceful fallback to static presets
    return NextResponse.json({
      locations: PRESET_GEO_LOCATIONS,
      source: "presets_fallback",
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, country, geo_id, entity_type = "Custom" } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Location name is required." },
        { status: 400 }
      );
    }

    const resolved = resolveGeoLocation(name, geo_id);
    const finalGeoId = (geo_id || resolved.geoId || "").trim();

    if (!finalGeoId) {
      return NextResponse.json(
        { error: "LinkedIn Geo ID is required. (e.g. 100205264)" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseStaticClient();
    const { data, error } = await supabase
      .from("linkedin_geo_locations")
      .upsert(
        {
          name: name.trim(),
          country: (country || name).trim(),
          geo_id: geo_id.trim(),
          entity_type: entity_type.trim(),
          is_preset: false,
        },
        { onConflict: "geo_id" }
      )
      .select()
      .single();

    if (error) {
      // If table doesn't exist, we still return success with the submitted item
      return NextResponse.json({
        success: true,
        location: {
          name,
          country: country || name,
          geo_id,
          entity_type: "Custom",
          is_preset: false,
        },
        persisted: false,
        notice: "Saved for this session (table not yet migrated in Supabase).",
      });
    }

    return NextResponse.json({
      success: true,
      location: data,
      persisted: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save location." },
      { status: 500 }
    );
  }
}
