"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Check,
  ExternalLink,
  FileText,
  Search,
  Plus,
  X,
  MapPin,
} from "lucide-react";
import { AppSettings } from "@/types";
import { LocationCombobox } from "@/components/setup/LocationCombobox";
import { PRESET_GEO_LOCATIONS, GeoLocationItem } from "@/lib/setup/geoLocations";

interface JobSearchSettingsProps {
  settings: AppSettings;
  onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export function JobSearchSettings({ settings, onChange }: JobSearchSettingsProps) {
  const [locationsList, setLocationsList] = useState<GeoLocationItem[]>(PRESET_GEO_LOCATIONS);
  const [queryInput, setQueryInput] = useState("");
  const [cfQueryInput, setCfQueryInput] = useState("");

  // Fetch all locations (including any custom saved locations) from Supabase
  useEffect(() => {
    fetch("/api/setup/locations")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.locations && Array.isArray(data.locations) && data.locations.length > 0) {
          setLocationsList(data.locations);
        }
      })
      .catch(() => {});
  }, []);

  // Multi-select for LinkedIn Job Types (F, C, P, I)
  const activeJobTypes = (settings.linkedin_job_type || "F").split(",").filter(Boolean);

  const toggleJobType = (code: string) => {
    let updated: string[];
    if (activeJobTypes.includes(code)) {
      updated = activeJobTypes.filter((c) => c !== code);
      if (updated.length === 0) updated = [code]; // Keep at least one
    } else {
      updated = [...activeJobTypes, code];
    }
    onChange("linkedin_job_type", updated.join(","));
  };

  // Multi-select for LinkedIn Workplace Models (1=On-site, 2=Remote, 3=Hybrid)
  const activeWorkplaceTypes = (settings.linkedin_f_wt || "1,2,3").split(",").filter(Boolean);

  const toggleWorkplaceType = (code: string) => {
    let updated: string[];
    if (activeWorkplaceTypes.includes(code)) {
      updated = activeWorkplaceTypes.filter((c) => c !== code);
      if (updated.length === 0) updated = [code]; // Keep at least one
    } else {
      updated = [...activeWorkplaceTypes, code];
    }
    onChange("linkedin_f_wt", updated.join(","));
  };

  // Scraping platform toggles
  const toggleSource = (source: string) => {
    const current = new Set(settings.scraping_sources);
    if (current.has(source)) {
      if (current.size > 1) current.delete(source);
    } else {
      current.add(source);
    }
    onChange("scraping_sources", Array.from(current));
  };

  const handleLocationSelect = (loc: { name: string; geoId: string }) => {
    onChange("linkedin_location", loc.name);
    onChange("linkedin_geo_id", loc.geoId);
  };

  // Tag chip handlers for Target Job Titles
  const searchQueries = Array.isArray(settings.linkedin_search_queries)
    ? settings.linkedin_search_queries
    : [];

  const handleAddQuery = () => {
    const trimmed = queryInput.trim();
    if (trimmed && !searchQueries.some((q) => q.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...searchQueries, trimmed];
      onChange("linkedin_search_queries", updated);
      setQueryInput("");
    }
  };

  const handleRemoveQuery = (indexToRemove: number) => {
    const updated = searchQueries.filter((_, idx) => idx !== indexToRemove);
    onChange("linkedin_search_queries", updated);
  };

  const handleQueryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddQuery();
    }
  };

  // CareersFuture Queries if enabled
  const cfQueries = Array.isArray(settings.careers_future_search_queries)
    ? settings.careers_future_search_queries
    : [];

  const handleAddCfQuery = () => {
    const trimmed = cfQueryInput.trim();
    if (trimmed && !cfQueries.some((q) => q.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...cfQueries, trimmed];
      onChange("careers_future_search_queries", updated);
      setCfQueryInput("");
    }
  };

  const handleRemoveCfQuery = (indexToRemove: number) => {
    const updated = cfQueries.filter((_, idx) => idx !== indexToRemove);
    onChange("careers_future_search_queries", updated);
  };

  return (
    <div className="space-y-6">
      {/* 1. Job Boards / Scraping Platforms */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 sm:p-6 space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
            Job Boards
          </label>
          <p className="text-xs text-slate-500 mt-0.5">
            Active sources scraped during scheduled automation cycles.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* LinkedIn Jobs */}
          <div
            onClick={() => toggleSource("linkedin")}
            className={`p-4 rounded-xl border text-left cursor-pointer transition flex items-center justify-between ${
              settings.scraping_sources.includes("linkedin")
                ? "border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500/20"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                in
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">LinkedIn Jobs</p>
                <p className="text-[11px] text-slate-500">Global search across millions of listings</p>
              </div>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                settings.scraping_sources.includes("linkedin")
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {settings.scraping_sources.includes("linkedin") ? "Active" : "Disabled"}
            </span>
          </div>

          {/* MyCareersFuture */}
          <div
            onClick={() => toggleSource("careers_future")}
            className={`p-4 rounded-xl border text-left cursor-pointer transition flex items-center justify-between ${
              settings.scraping_sources.includes("careers_future")
                ? "border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500/20"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                SG
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">MyCareersFuture</p>
                <p className="text-[11px] text-slate-500">Government portal for Singapore listings</p>
              </div>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                settings.scraping_sources.includes("careers_future")
                  ? "bg-indigo-100 text-indigo-800 border-indigo-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {settings.scraping_sources.includes("careers_future") ? "Active" : "Disabled"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Target Location (Search as you type Combobox - Identical to Setup) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Target Location
            </label>
            {settings.linkedin_geo_id && (
              <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                Geo ID: <strong>{settings.linkedin_geo_id}</strong>
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mb-3">
            Search for a country, major metro hub, or add a custom city with its LinkedIn Geo ID.
          </p>
          <LocationCombobox
            locations={locationsList}
            selectedLocation={settings.linkedin_location}
            onSelect={handleLocationSelect}
          />
        </div>
      </div>

      {/* 3. Target Job Titles & Search Keywords (Setup Step 3 Tag Chip UI) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Target Job Titles & Search Keywords
            </label>
            <p className="text-[11px] text-slate-500 mt-0.5">
              The scraper loops through each job title sequentially across active job boards.
            </p>
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
              searchQueries.length >= 3 && searchQueries.length <= 5
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            {searchQueries.length} {searchQueries.length === 1 ? "title" : "titles"} set
          </span>
        </div>

        {/* Existing tags */}
        <div className="flex flex-wrap gap-2 pt-1 min-h-[36px]">
          {searchQueries.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-1">
              No job titles added yet. Type a title below and press Enter or Add.
            </p>
          ) : (
            searchQueries.map((q, idx) => (
              <span
                key={`${q}-${idx}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold"
              >
                <Search className="w-3 h-3 text-indigo-500" />
                <span>{q}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveQuery(idx)}
                  title="Remove"
                  className="hover:bg-indigo-100 rounded p-0.5 text-indigo-500 hover:text-indigo-800 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))
          )}
        </div>

        {/* Input to add more */}
        <div className="flex gap-2 pt-1">
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyDown={handleQueryKeyDown}
            placeholder="e.g. AI Engineer, Python Backend Developer (Press Enter)"
            className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            type="button"
            disabled={!queryInput.trim()}
            onClick={handleAddQuery}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>

        {/* MyCareersFuture Queries if enabled */}
        {settings.scraping_sources.includes("careers_future") && (
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  MyCareersFuture Search Keywords
                </label>
                <p className="text-[11px] text-slate-500">
                  Target search queries used specifically when scraping MyCareersFuture.
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {cfQueries.length} set
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1 min-h-[36px]">
              {cfQueries.map((q, idx) => (
                <span
                  key={`${q}-${idx}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-semibold"
                >
                  <Search className="w-3 h-3 text-red-500" />
                  <span>{q}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCfQuery(idx)}
                    title="Remove"
                    className="hover:bg-red-100 rounded p-0.5 text-red-500 hover:text-red-800 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={cfQueryInput}
                onChange={(e) => setCfQueryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCfQuery();
                  }
                }}
                placeholder="e.g. Full Stack Developer, Singapore (Press Enter)"
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                type="button"
                disabled={!cfQueryInput.trim()}
                onClick={handleAddCfQuery}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. LinkedIn Filters: Workplace Model & Employment Types */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 sm:p-6 space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
            LinkedIn Search Parameters
          </label>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure workplace environments and contract types to match your target job profile.
          </p>
        </div>

        {/* Workplace Model */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Workplace Model (<code className="text-indigo-600 font-mono">f_WT</code>)
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { code: "1", label: "On-site" },
              { code: "2", label: "Remote" },
              { code: "3", label: "Hybrid" },
            ].map((item) => {
              const isSelected = activeWorkplaceTypes.includes(item.code);
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => toggleWorkplaceType(item.code)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Employment Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Employment Types (<code className="text-indigo-600 font-mono">f_JT</code>)
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { code: "F", label: "Full-Time" },
              { code: "C", label: "Contract" },
              { code: "P", label: "Part-Time" },
              { code: "I", label: "Internship" },
            ].map((item) => {
              const isSelected = activeJobTypes.includes(item.code);
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => toggleJobType(item.code)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Master Baseline Resume Shortcut */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50/70 via-white to-slate-50 border border-blue-100 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900">
              Master Baseline Resume Profile
            </h4>
            <p className="text-xs text-slate-600 mt-0.5">
              Used by AI match scoring to evaluate newly scraped jobs and generate tailored resumes.
            </p>
          </div>
        </div>

        <Link
          href="/resume-studio"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition shrink-0"
        >
          <span>Open Resume Studio</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
