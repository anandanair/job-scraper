"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Briefcase,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Search,
  Plus,
  X,
  Check,
} from "lucide-react";
import { PRESET_GEO_LOCATIONS, GeoLocationItem } from "@/lib/setup/geoLocations";
import { LocationCombobox } from "./LocationCombobox";
import { AppSettings } from "@/types";

interface Step3PreferencesProps {
  initialSettings?: AppSettings | null;
  onBack: () => void;
  onNext: (preferences: {
    queries: string[];
    location: string;
    geoId: string;
    jobTypes: string;
    workplaceTypes: string;
    scrapingSources: string[];
  }) => Promise<void>;
  isSaving?: boolean;
}

export function Step3Preferences({
  initialSettings,
  onBack,
  onNext,
  isSaving = false,
}: Step3PreferencesProps) {
  // --- 1. Search Queries State ---
  const [queries, setQueries] = useState<string[]>(() => {
    if (
      initialSettings?.linkedin_search_queries &&
      Array.isArray(initialSettings.linkedin_search_queries) &&
      initialSettings.linkedin_search_queries.length > 0
    ) {
      return initialSettings.linkedin_search_queries;
    }
    return [
      "Software Engineer",
      "Full Stack Developer",
      "Frontend Developer",
    ];
  });
  const [queryInput, setQueryInput] = useState("");

  // --- 2. Location & Geo ID State ---
  const [locationList, setLocationList] = useState<GeoLocationItem[]>(PRESET_GEO_LOCATIONS);
  const [selectedLocation, setSelectedLocation] = useState<string>(
    initialSettings?.linkedin_location || "Singapore"
  );
  const [selectedGeoId, setSelectedGeoId] = useState<string>(
    initialSettings?.linkedin_geo_id || "102454443"
  );

  // --- 3. Scraping Sources ---
  const [includeCareersFuture, setIncludeCareersFuture] = useState(
    initialSettings?.scraping_sources?.includes("careers_future") ?? true
  );

  // --- 4. Employment Types & Workplace Models ---
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>(() => {
    if (initialSettings?.linkedin_job_type) {
      return initialSettings.linkedin_job_type.split(",").filter(Boolean);
    }
    return ["F"];
  });
  const [selectedWorkplaceTypes, setSelectedWorkplaceTypes] = useState<string[]>(() => {
    if (initialSettings?.linkedin_f_wt) {
      return initialSettings.linkedin_f_wt.split(",").filter(Boolean);
    }
    return ["1", "2", "3"];
  });

  // --- 5. Resume Upload ---
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [parsedInfo, setParsedInfo] = useState<{
    name?: string;
    skillsCount?: number;
    experienceCount?: number;
  } | null>(null);

  // --- Errors ---
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync form when initialSettings changes / loads
  useEffect(() => {
    if (initialSettings) {
      if (
        Array.isArray(initialSettings.linkedin_search_queries) &&
        initialSettings.linkedin_search_queries.length > 0
      ) {
        setQueries(initialSettings.linkedin_search_queries);
      }
      if (initialSettings.linkedin_location) {
        setSelectedLocation(initialSettings.linkedin_location);
      }
      if (initialSettings.linkedin_geo_id) {
        setSelectedGeoId(initialSettings.linkedin_geo_id);
      }
      if (initialSettings.linkedin_job_type) {
        setSelectedJobTypes(initialSettings.linkedin_job_type.split(",").filter(Boolean));
      }
      if (initialSettings.linkedin_f_wt) {
        setSelectedWorkplaceTypes(initialSettings.linkedin_f_wt.split(",").filter(Boolean));
      }
      if (initialSettings.scraping_sources) {
        setIncludeCareersFuture(initialSettings.scraping_sources.includes("careers_future"));
      }
    }
  }, [initialSettings]);

  // Check if a Master Resume already exists in database
  useEffect(() => {
    let isMounted = true;
    fetch("/api/base-resume")
      .then((res) => {
        if (!res.ok) return null;
        const ct = res.headers.get("content-type");
        if (ct && ct.includes("application/json")) return res.json();
        return null;
      })
      .then((resume) => {
        if (isMounted && resume && resume.name && resume.name !== "NA") {
          setResumeUploaded(true);
          setParsedInfo({
            name: resume.name,
            skillsCount: Array.isArray(resume.skills) ? resume.skills.length : 0,
            experienceCount: Array.isArray(resume.experience) ? resume.experience.length : 0,
          });
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Load locations catalog from API on mount
  useEffect(() => {
    let isMounted = true;
    fetch("/api/setup/locations")
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.locations && Array.isArray(data.locations) && data.locations.length > 0) {
          setLocationList(data.locations);
        }
      })
      .catch(() => {
        // Fallback to static presets already set
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const isSingaporeActive = selectedLocation.toLowerCase().includes("singapore");

  // Only disable CareersFuture if location is changed to non-Singapore; do not force-enable on mount
  const prevLocationRef = useRef(selectedLocation);
  useEffect(() => {
    const prevLoc = prevLocationRef.current.toLowerCase();
    const currentLoc = selectedLocation.toLowerCase();
    prevLocationRef.current = selectedLocation;

    const prevWasSingapore = prevLoc.includes("singapore");
    const currentIsSingapore = currentLoc.includes("singapore");

    if (!currentIsSingapore) {
      setIncludeCareersFuture(false);
    } else if (!prevWasSingapore && currentIsSingapore) {
      // User switched from an international location back to Singapore
      setIncludeCareersFuture(true);
    }
  }, [selectedLocation]);

  // Query tag management: allow free removal anytime
  const handleAddQuery = () => {
    const trimmed = queryInput.trim();
    if (!trimmed) return;
    if (queries.length >= 5) {
      setErrorMsg("Maximum of 5 job titles allowed.");
      return;
    }
    if (queries.some((q) => q.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(`"${trimmed}" is already in your list.`);
      return;
    }
    setQueries([...queries, trimmed]);
    setQueryInput("");
    setErrorMsg(null);
  };

  const handleRemoveQuery = (indexToRemove: number) => {
    setQueries(queries.filter((_, idx) => idx !== indexToRemove));
    setErrorMsg(null);
  };

  const handleQueryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddQuery();
    }
  };

  // Employment Type toggle
  const toggleJobType = (code: string) => {
    if (selectedJobTypes.includes(code)) {
      if (selectedJobTypes.length === 1) {
        setErrorMsg("Please select at least one employment type.");
        return;
      }
      setSelectedJobTypes(selectedJobTypes.filter((c) => c !== code));
    } else {
      setSelectedJobTypes([...selectedJobTypes, code]);
    }
    setErrorMsg(null);
  };

  // Workplace Type toggle
  const toggleWorkplaceType = (code: string) => {
    if (selectedWorkplaceTypes.includes(code)) {
      if (selectedWorkplaceTypes.length === 1) {
        setErrorMsg("Please select at least one workplace type.");
        return;
      }
      setSelectedWorkplaceTypes(selectedWorkplaceTypes.filter((c) => c !== code));
    } else {
      setSelectedWorkplaceTypes([...selectedWorkplaceTypes, code]);
    }
    setErrorMsg(null);
  };

  // Location selection from Combobox
  const handleLocationSelect = (loc: { name: string; geoId: string }) => {
    setSelectedLocation(loc.name);
    setSelectedGeoId(loc.geoId);
    setErrorMsg(null);
  };

  // Resume file change (stage file only, do not upload yet)
  const handleResumeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setErrorMsg("Please select a valid PDF file.");
      return;
    }

    setResumeFile(file);
    setResumeUploaded(false);
    setParsedInfo(null);
    setErrorMsg(null);
  };

  // Proceed / Save Validation: upload and parse resume now, then save preferences
  const handleProceed = async () => {
    setErrorMsg(null);

    // Validation strictly on proceed
    if (queries.length < 3) {
      setErrorMsg(`Please provide at least 3 target job titles (currently ${queries.length}).`);
      return;
    }
    if (queries.length > 5) {
      setErrorMsg("Please select at most 5 target job titles.");
      return;
    }

    if (!selectedLocation.trim()) {
      setErrorMsg("Please select or enter a target location.");
      return;
    }

    // 1. Process Master Resume if a file was selected
    if (resumeFile && !resumeUploaded) {
      setIsUploadingResume(true);
      try {
        const formData = new FormData();
        formData.append("file", resumeFile);

        const res = await fetch("/api/setup/upload-resume", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to upload and parse resume.");
        }

        setResumeUploaded(true);
        if (data.profile) {
          setParsedInfo(data.profile);
        }
      } catch (err: any) {
        setIsUploadingResume(false);
        setErrorMsg(err.message || "Failed to process resume.");
        return; // Prevent advancing if resume parsing failed
      } finally {
        setIsUploadingResume(false);
      }
    }

    // 2. Save search preferences
    const scrapingSources = ["linkedin"];
    if (includeCareersFuture && isSingaporeActive) {
      scrapingSources.push("careers_future");
    }

    try {
      await onNext({
        queries,
        location: selectedLocation.trim(),
        geoId: selectedGeoId,
        jobTypes: selectedJobTypes.join(","),
        workplaceTypes: selectedWorkplaceTypes.join(","),
        scrapingSources,
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save preferences.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
          <Briefcase className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Job Preferences & Master Resume</h2>
          <p className="text-xs text-slate-500">
            Customize the job titles you want to track, your target location, and upload your baseline resume.
          </p>
        </div>
      </div>

      {/* Error alert */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Action Required</p>
            <p className="mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* 1. Target Search Titles (Tag-Chip Editor) */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-xs font-bold text-slate-800">
              Target Job Titles
            </label>
            <p className="text-[11px] text-slate-500">
              Specify 3 to 5 job titles you are looking for.
            </p>
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
              queries.length >= 3 && queries.length <= 5
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {queries.length} / 5 set {queries.length < 3 && "(at least 3 required)"}
          </span>
        </div>

        {/* Existing tags */}
        <div className="flex flex-wrap gap-2 pt-1 min-h-[36px]">
          {queries.length === 0 && (
            <p className="text-xs text-slate-400 italic py-1">
              No job titles added yet. Type a title below and press Enter.
            </p>
          )}
          {queries.map((q, idx) => (
            <span
              key={idx}
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
          ))}
        </div>

        {/* Input to add more */}
        {queries.length < 5 && (
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
              onClick={handleAddQuery}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Target Location (Search as you type Combobox) */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            Target Location
          </label>
          <p className="text-[11px] text-slate-500 mb-2">
            Search for a country, major metro hub, or type your preferred city.
          </p>
          <LocationCombobox
            locations={locationList}
            selectedLocation={selectedLocation}
            onSelect={handleLocationSelect}
          />
        </div>
      </div>

      {/* 3. Job Boards (Only shows MyCareersFuture if Singapore is selected) */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
        <label className="block text-xs font-bold text-slate-800">
          Job Boards
        </label>

        <div className={`grid gap-3 ${isSingaporeActive ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
          {/* LinkedIn (Always Active) */}
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                in
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">LinkedIn</p>
                <p className="text-[11px] text-slate-500">Searching jobs in {selectedLocation}</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Active
            </span>
          </div>

          {/* MyCareersFuture (Visible ONLY for Singapore) */}
          {isSingaporeActive && (
            <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/30 flex items-center justify-between transition animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold text-xs">
                  SG
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">MyCareersFuture</p>
                  <p className="text-[11px] text-slate-500">For Singapore Citizens & PRs</p>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCareersFuture}
                  onChange={(e) => setIncludeCareersFuture(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-xs font-semibold text-slate-700">Include</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* 4. Employment & Workplace Preferences */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
        {/* Employment Type */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5">
            Employment Types
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { code: "F", label: "Full-Time" },
              { code: "C", label: "Contract" },
              { code: "P", label: "Part-Time" },
              { code: "I", label: "Internship" },
            ].map((item) => {
              const isSelected = selectedJobTypes.includes(item.code);
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => toggleJobType(item.code)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Workplace Type */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5">
            Workplace Model
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { code: "1", label: "On-site" },
              { code: "2", label: "Remote" },
              { code: "3", label: "Hybrid" },
            ].map((item) => {
              const isSelected = selectedWorkplaceTypes.includes(item.code);
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => toggleWorkplaceType(item.code)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Master Baseline Resume PDF */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-800">
            Master Resume (PDF)
          </label>
          <p className="text-[11px] text-slate-500">
            Upload your baseline resume. Your AI engine will parse it and use it to score job matches.
          </p>
        </div>

        {resumeUploaded && parsedInfo?.name && !resumeFile ? (
          <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-950">
                  Master Resume Profile Active: {parsedInfo.name}
                </p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  {parsedInfo.experienceCount ?? 0} experiences &bull; {parsedInfo.skillsCount ?? 0} skills &bull; Stored in Supabase
                </p>
              </div>
            </div>
            <div>
              <input
                type="file"
                accept=".pdf"
                id="resume-upload"
                onChange={handleResumeFileChange}
                className="hidden"
              />
              <label
                htmlFor="resume-upload"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold cursor-pointer transition shadow-xs"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Replace PDF</span>
              </label>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-5 text-center bg-slate-50/50 transition">
            <input
              type="file"
              accept=".pdf"
              id="resume-upload"
              onChange={handleResumeFileChange}
              className="hidden"
            />
            <label htmlFor="resume-upload" className="cursor-pointer block">
              <div className="mx-auto w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-2">
                {isUploadingResume ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <UploadCloud className="w-5 h-5" />
                )}
              </div>
              <p className="text-xs font-semibold text-slate-800">
                {resumeFile ? resumeFile.name : "Click or drag & drop your Master Resume (PDF)"}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {resumeFile ? (
                  <span className="text-indigo-600 font-semibold inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    {(resumeFile.size / 1024).toFixed(1)} KB selected — will be parsed with AI when you continue
                  </span>
                ) : (
                  "PDF format up to 10MB (Optional: you can also upload or update later in Resume Studio)"
                )}
              </p>
            </label>
            {resumeFile && !isUploadingResume && (
              <button
                type="button"
                onClick={() => {
                  setResumeFile(null);
                }}
                className="mt-2 text-[11px] text-rose-500 hover:text-rose-700 inline-flex items-center gap-1 font-semibold transition"
              >
                <X className="w-3 h-3" /> Remove selected file
              </button>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 transition"
        >
          Back to AI Engine
        </button>
        <button
          type="button"
          onClick={handleProceed}
          disabled={isSaving || isUploadingResume}
          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 text-xs"
        >
          {isUploadingResume ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Parsing Master Resume with AI...</span>
            </>
          ) : isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Preferences...</span>
            </>
          ) : (
            <>
              <span>Save & Continue to Step 4 (Resume Studio)</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
