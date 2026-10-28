"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  MapPin,
  Search,
  Check,
  ChevronsUpDown,
  X,
  Globe,
  Plus,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { GeoLocationItem } from "@/lib/setup/geoLocations";

interface LocationComboboxProps {
  locations: GeoLocationItem[];
  selectedLocation: string;
  onSelect: (location: { name: string; geoId: string }) => void;
}

export function LocationCombobox({
  locations: initialLocations,
  selectedLocation,
  onSelect,
}: LocationComboboxProps) {
  const [locations, setLocations] = useState<GeoLocationItem[]>(initialLocations);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Custom location entry mode
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customGeoId, setCustomGeoId] = useState("");
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  // Sync external locations prop if updated
  useEffect(() => {
    if (initialLocations && initialLocations.length > 0) {
      setLocations((prev) => {
        // Merge without losing any dynamically added custom locations
        const existingGeoIds = new Set(initialLocations.map((l) => l.geo_id));
        const customAdded = prev.filter((l) => !existingGeoIds.has(l.geo_id));
        return [...initialLocations, ...customAdded];
      });
    }
  }, [initialLocations]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsAddingCustom(false);
        setCustomError(null);
        setSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filtered locations based on search query
  const query = searchQuery.trim().toLowerCase();
  const filtered = locations.filter((loc) => {
    if (!query) return true;
    return (
      loc.name.toLowerCase().includes(query) ||
      loc.country.toLowerCase().includes(query) ||
      (loc.entity_type && loc.entity_type.toLowerCase().includes(query))
    );
  });

  const handleSelect = (loc: GeoLocationItem) => {
    onSelect({ name: loc.name, geoId: loc.geo_id });
    setIsOpen(false);
    setIsAddingCustom(false);
    setSearchQuery("");
  };

  const handleStartCustom = (presetName?: string) => {
    setCustomName(presetName || searchQuery.trim() || "");
    setCustomGeoId("");
    setCustomError(null);
    setIsAddingCustom(true);
  };

  const handleSaveCustomLocation = async () => {
    const trimmedName = customName.trim();
    const trimmedGeoId = customGeoId.trim();

    if (!trimmedName) {
      setCustomError("Location name is required.");
      return;
    }
    if (!trimmedGeoId) {
      setCustomError("LinkedIn Geo ID is required. (e.g. 100477049)");
      return;
    }

    setIsSavingCustom(true);
    setCustomError(null);

    try {
      const res = await fetch("/api/setup/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          country: trimmedName,
          geo_id: trimmedGeoId,
          entity_type: "Custom",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save custom location.");
      }

      const newLoc: GeoLocationItem = {
        name: trimmedName,
        country: trimmedName,
        geo_id: trimmedGeoId,
        entity_type: "Custom",
        is_preset: false,
      };

      setLocations((prev) => [newLoc, ...prev.filter((l) => l.geo_id !== trimmedGeoId)]);
      onSelect({ name: trimmedName, geoId: trimmedGeoId });
      setIsOpen(false);
      setIsAddingCustom(false);
      setSearchQuery("");
    } catch (err: any) {
      setCustomError(err.message || "Failed to save custom location to database.");
    } finally {
      setIsSavingCustom(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Combobox Trigger / Search Input */}
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`relative w-full flex items-center bg-white border rounded-xl transition cursor-text ${
          isOpen
            ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs"
            : "border-slate-300 hover:border-slate-400"
        }`}
      >
        <div className="pl-3.5 pr-2 py-2.5 text-slate-400 pointer-events-none flex items-center">
          <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchQuery : selectedLocation}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            if (isAddingCustom) setIsAddingCustom(false);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={selectedLocation || "Search country, city, or metro hub..."}
          className="w-full py-2.5 pr-9 text-xs sm:text-sm font-semibold text-slate-900 bg-transparent focus:outline-none placeholder:text-slate-400"
        />

        <div className="absolute right-2.5 flex items-center gap-1">
          {isOpen && searchQuery && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSearchQuery("");
                inputRef.current?.focus();
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronsUpDown className="w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Floating Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/80 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          {!isAddingCustom ? (
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100/80 p-1">
              {filtered.length > 0 ? (
                filtered.map((loc) => {
                  const isSelected =
                    loc.name.toLowerCase() === selectedLocation.toLowerCase();

                  return (
                    <button
                      key={loc.geo_id || loc.name}
                      type="button"
                      onClick={() => handleSelect(loc)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-lg flex items-center justify-between text-xs transition ${
                        isSelected
                          ? "bg-indigo-50/80 text-indigo-900 font-bold"
                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                          {loc.name.includes("Worldwide") ? (
                            <Globe className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                          )}
                        </div>
                        <div className="truncate">
                          <span className="font-semibold block truncate">
                            {loc.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate font-mono">
                            Geo ID: {loc.geo_id} {loc.entity_type ? `• ${loc.entity_type}` : ""}
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="p-3 text-center text-xs text-slate-500">
                  No matching presets found.
                </div>
              )}

              {/* Custom Location Option */}
              <div className="p-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleStartCustom(searchQuery.trim())}
                  className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>
                    {searchQuery.trim()
                      ? `Add "${searchQuery.trim()}" as custom location...`
                      : "Add new custom location & Geo ID..."}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* Custom Location Form Inline */
            <div className="p-4 space-y-3 bg-slate-50/80">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <MapPin className="w-4 h-4 text-indigo-600" />
                  <span>Add New Custom Location</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingCustom(false)}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {customError && (
                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2 rounded-lg font-medium">
                  {customError}
                </p>
              )}

              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">
                    Location Name
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Munich, Germany or Austin, TX"
                    className="w-full mt-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase">
                      LinkedIn Geo ID
                    </label>
                    <a
                      href={`https://www.linkedin.com/jobs/search/?keywords=developer&location=${encodeURIComponent(
                        customName || "Singapore"
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-indigo-600 hover:underline inline-flex items-center gap-0.5"
                    >
                      <span>Find on LinkedIn</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <input
                    type="text"
                    value={customGeoId}
                    onChange={(e) => setCustomGeoId(e.target.value)}
                    placeholder="e.g. 100477049"
                    className="w-full mt-1 px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Copy the numeric value after <code>geoId=</code> in your LinkedIn search URL.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddingCustom(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingCustom || !customName.trim() || !customGeoId.trim()}
                  onClick={handleSaveCustomLocation}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingCustom ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Saving to DB...</span>
                    </>
                  ) : (
                    <span>Save & Select</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
