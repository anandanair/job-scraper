export interface GeoLocationItem {
  id?: string;
  name: string;
  country: string;
  geo_id: string;
  entity_type?: string;
  is_preset?: boolean;
  aliases?: string[];
}

export const PRESET_GEO_LOCATIONS: GeoLocationItem[] = [
  {
    name: "Dubai / United Arab Emirates",
    country: "United Arab Emirates",
    geo_id: "100205264",
    entity_type: "Metro / Country",
    is_preset: true,
    aliases: [
      "dubai",
      "uae",
      "dubai uae",
      "dubai / uae",
      "dubai, uae",
      "united arab emirates",
      "dxb",
      "abu dhabi",
      "sharjah",
    ],
  },
  {
    name: "Singapore",
    country: "Singapore",
    geo_id: "102454443",
    entity_type: "Country",
    is_preset: true,
    aliases: ["singapore", "sg", "singapore sg"],
  },
  {
    name: "Malaysia",
    country: "Malaysia",
    geo_id: "106604213",
    entity_type: "Country",
    is_preset: true,
    aliases: ["malaysia", "my"],
  },
  {
    name: "Kuala Lumpur",
    country: "Malaysia",
    geo_id: "104246733",
    entity_type: "Capital / Metro",
    is_preset: true,
    aliases: ["kuala lumpur", "kl", "klcc"],
  },
  {
    name: "Selangor",
    country: "Malaysia",
    geo_id: "105151591",
    entity_type: "State / Region",
    is_preset: true,
    aliases: ["selangor", "petaling jaya", "pj", "subang"],
  },
  {
    name: "India",
    country: "India",
    geo_id: "102713980",
    entity_type: "Country",
    is_preset: true,
    aliases: ["india", "in", "bharat"],
  },
  {
    name: "Greater Bengaluru Area",
    country: "India",
    geo_id: "90009633",
    entity_type: "Major Metro Hub",
    is_preset: true,
    aliases: ["bengaluru", "bangalore", "blr"],
  },
  {
    name: "Mumbai Metropolitan Region",
    country: "India",
    geo_id: "90009639",
    entity_type: "Major Metro Hub",
    is_preset: true,
    aliases: ["mumbai", "bombay", "mmr"],
  },
  {
    name: "Delhi",
    country: "India",
    geo_id: "106187582",
    entity_type: "Major Metro Hub",
    is_preset: true,
    aliases: ["delhi", "new delhi", "ncr", "gurugram", "noida"],
  },
  {
    name: "United States",
    country: "United States",
    geo_id: "103644278",
    entity_type: "Country",
    is_preset: true,
    aliases: ["united states", "us", "usa", "united states of america", "america"],
  },
  {
    name: "United Kingdom",
    country: "United Kingdom",
    geo_id: "102257491",
    entity_type: "Country",
    is_preset: true,
    aliases: ["united kingdom", "uk", "great britain", "britain", "england", "london"],
  },
  {
    name: "Canada",
    country: "Canada",
    geo_id: "101174742",
    entity_type: "Country",
    is_preset: true,
    aliases: ["canada", "ca", "toronto", "vancouver", "montreal"],
  },
  {
    name: "Australia",
    country: "Australia",
    geo_id: "101452733",
    entity_type: "Country",
    is_preset: true,
    aliases: ["australia", "au", "sydney", "melbourne", "brisbane"],
  },
  {
    name: "Japan",
    country: "Japan",
    geo_id: "101355337",
    entity_type: "Country",
    is_preset: true,
    aliases: ["japan", "jp", "tokyo"],
  },
  {
    name: "China",
    country: "China",
    geo_id: "102890883",
    entity_type: "Country",
    is_preset: true,
    aliases: ["china", "cn", "beijing", "shanghai", "shenzhen"],
  },
  {
    name: "Worldwide / Remote",
    country: "Worldwide",
    geo_id: "92000000",
    entity_type: "Global",
    is_preset: true,
    aliases: ["worldwide", "remote", "global", "anywhere", "work from home", "wfh"],
  },
];

/**
 * Resolves a given location string and optional existing Geo ID against known presets and aliases.
 *
 * Critical Safety Rules:
 * 1. Matches aliases like "Dubai / UAE", "UAE", "Dubai", "US", "UK" directly to canonical preset & Geo ID.
 * 2. If the location is non-Singapore, but the existing Geo ID is Singapore's default (102454443),
 *    the stale Singapore Geo ID is discarded to prevent LinkedIn's guest API from incorrectly scoping
 *    the query to Singapore.
 */
export function resolveGeoLocation(
  locationName?: string | null,
  existingGeoId?: string | number | null
): { name: string; geoId: string; isPreset: boolean } {
  if (!locationName || typeof locationName !== "string" || !locationName.trim()) {
    return { name: "Singapore", geoId: "102454443", isPreset: true };
  }

  const trimmed = locationName.trim();
  const lower = trimmed.toLowerCase();

  // 1. Exact match on preset name or country
  const directMatch = PRESET_GEO_LOCATIONS.find(
    (p) => p.name.toLowerCase() === lower || p.country.toLowerCase() === lower
  );
  if (directMatch) {
    return { name: directMatch.name, geoId: directMatch.geo_id, isPreset: true };
  }

  // 2. Alias match (e.g. "Dubai / UAE", "UAE", "Dubai", "UK", "US")
  const aliasMatch = PRESET_GEO_LOCATIONS.find(
    (p) =>
      p.aliases &&
      p.aliases.some((a) => {
        const aLow = a.toLowerCase();
        return aLow === lower || lower === aLow.replace(/\s*\/\s*/g, " ") || lower.includes(aLow) || aLow.includes(lower);
      })
  );
  if (aliasMatch) {
    return { name: aliasMatch.name, geoId: aliasMatch.geo_id, isPreset: true };
  }

  // 3. Substring match against preset name or country
  const subMatch = PRESET_GEO_LOCATIONS.find(
    (p) => lower.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(lower)
  );
  if (subMatch) {
    return { name: subMatch.name, geoId: subMatch.geo_id, isPreset: true };
  }

  // 4. Custom Location Handling
  const isSingapore = lower.includes("singapore") || lower === "sg";
  const strGeoId = existingGeoId !== undefined && existingGeoId !== null ? String(existingGeoId).trim() : "";

  // Guard against stale Singapore Geo ID when location is non-Singapore
  if (!isSingapore && strGeoId === "102454443") {
    return { name: trimmed, geoId: "", isPreset: false };
  }

  return {
    name: trimmed,
    geoId: strGeoId,
    isPreset: false,
  };
}
