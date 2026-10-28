export interface GeoLocationItem {
  id?: string;
  name: string;
  country: string;
  geo_id: string;
  entity_type?: string;
  is_preset?: boolean;
}

export const PRESET_GEO_LOCATIONS: GeoLocationItem[] = [
  {
    name: "Singapore",
    country: "Singapore",
    geo_id: "102454443",
    entity_type: "Country",
    is_preset: true,
  },
  {
    name: "Malaysia",
    country: "Malaysia",
    geo_id: "106604213",
    entity_type: "Country",
    is_preset: true,
  },
  {
    name: "Kuala Lumpur",
    country: "Malaysia",
    geo_id: "104246733",
    entity_type: "Capital / Metro",
    is_preset: true,
  },
  {
    name: "Selangor",
    country: "Malaysia",
    geo_id: "105151591",
    entity_type: "State / Region",
    is_preset: true,
  },
  {
    name: "India",
    country: "India",
    geo_id: "102713980",
    entity_type: "Country",
    is_preset: true,
  },
  {
    name: "Greater Bengaluru Area",
    country: "India",
    geo_id: "90009633",
    entity_type: "Major Metro Hub",
    is_preset: true,
  },
  {
    name: "Mumbai Metropolitan Region",
    country: "India",
    geo_id: "90009639",
    entity_type: "Major Metro Hub",
    is_preset: true,
  },
  {
    name: "Delhi",
    country: "India",
    geo_id: "106187582",
    entity_type: "Major Metro Hub",
    is_preset: true,
  },
  {
    name: "Dubai / United Arab Emirates",
    country: "United Arab Emirates",
    geo_id: "100205264",
    entity_type: "Metro / Country",
    is_preset: true,
  },
  {
    name: "United States",
    country: "United States",
    geo_id: "103644278",
    entity_type: "Country",
    is_preset: true,
  },
  {
    name: "United Kingdom",
    country: "United Kingdom",
    geo_id: "102257491",
    entity_type: "Country",
    is_preset: true,
  },
  {
    name: "Canada",
    country: "Canada",
    geo_id: "101174742",
    entity_type: "Country",
    is_preset: true,
  },
  {
    name: "Australia",
    country: "Australia",
    geo_id: "101452733",
    entity_type: "Country",
    is_preset: true,
  },
  {
    name: "Japan",
    country: "Japan",
    geo_id: "101355337",
    entity_type: "Country",
    is_preset: true,
  },
  {
    name: "China",
    country: "China",
    geo_id: "102890883",
    entity_type: "Country",
    is_preset: true,
  },
  {
    name: "Worldwide / Remote",
    country: "Worldwide",
    geo_id: "92000000",
    entity_type: "Global",
    is_preset: true,
  },
];
