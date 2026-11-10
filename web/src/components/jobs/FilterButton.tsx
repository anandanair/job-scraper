"use client";

import { Filter, ChevronDown, Check, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface FilterOption {
  value: string;
  label: string;
}

const PROVIDER_OPTIONS: FilterOption[] = [
  { value: "all", label: "All Providers" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "careers_future", label: "Careers Future" },
  { value: "greenhouse", label: "Greenhouse" },
  { value: "lever", label: "Lever" },
  { value: "ashby", label: "Ashby" },
  { value: "remote_ok", label: "RemoteOK" },
  { value: "imported", label: "Imported / Manual" },
];

const WORKPLACE_OPTIONS: FilterOption[] = [
  { value: "all", label: "All Workplaces" },
  { value: "remote", label: "100% Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

const INTEREST_OPTIONS: FilterOption[] = [
  { value: "all", label: "All Statuses" },
  { value: "true", label: "Interested" },
  { value: "false", label: "Not Interested" },
  { value: "null", label: "Not Marked" },
];

const APPLICATION_STATUS_OPTIONS: FilterOption[] = [
  { value: "all", label: "All Application Statuses" },
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offer", label: "Offer" }, // Matched to SQL function
  { value: "rejected", label: "Rejected" },
];

interface FilterButtonProps {
  disabled?: boolean;
  className?: string;
  providerOptions?: boolean;
  interestOptions?: boolean;
  scoreOptions?: boolean;
  applicationStatusOptions?: boolean; // New prop
}

export default function FilterButton({
  disabled = false,
  className = "",
  providerOptions = true,
  interestOptions = true,
  scoreOptions = true,
  applicationStatusOptions = false, // New prop with default false
}: FilterButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("all");
  const [selectedInterest, setSelectedInterest] = useState("all");
  const [selectedApplicationStatus, setSelectedApplicationStatus] =
    useState("all"); // New state
  const [minScore, setMinScore] = useState<string>("50");
  const [maxScore, setMaxScore] = useState<string>("100");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize filters from URL params
  useEffect(() => {
    const provider = searchParams.get("provider") || "all";
    setSelectedProvider(provider);

    const interest = searchParams.get("interest") || "all";
    setSelectedInterest(interest);

    const status = searchParams.get("applicationStatus") || "all"; // New: Initialize from URL
    setSelectedApplicationStatus(status);

    const urlMinScore = searchParams.get("minScore");
    if (urlMinScore) setMinScore(urlMinScore);

    const urlMaxScore = searchParams.get("maxScore");
    if (urlMaxScore) setMaxScore(urlMaxScore);
  }, [searchParams]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleResize = () => {
      if (isOpen) {
        // Force re-render on resize to recalculate position
        setIsOpen(false);
        setTimeout(() => setIsOpen(true), 0);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen]);

  const handleApplyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());

    // Provider filter
    if (selectedProvider === "all") {
      params.delete("provider");
    } else {
      params.set("provider", selectedProvider);
    }

    // Interest filter
    if (selectedInterest === "all") {
      params.delete("interest");
    } else {
      params.set("interest", selectedInterest);
    }

    // Application Status filter (New)
    if (selectedApplicationStatus === "all") {
      params.delete("applicationStatus");
    } else {
      params.set("applicationStatus", selectedApplicationStatus);
    }

    // Score filter
    const min = parseInt(minScore);
    const max = parseInt(maxScore);

    if (!isNaN(min) && min >= 0 && min <= 100) {
      if (min === 50 && params.get("maxScore") === "100") {
        if (max === 100 || !params.has("maxScore")) params.delete("minScore");
        else params.set("minScore", min.toString());
      } else {
        params.set("minScore", min.toString());
      }
    } else {
      params.delete("minScore");
    }

    if (!isNaN(max) && max >= 0 && max <= 100) {
      if (max === 100 && params.get("minScore") === "50") {
        if (min === 50 || !params.has("minScore")) params.delete("maxScore");
        else params.set("maxScore", max.toString());
      } else {
        params.set("maxScore", max.toString());
      }
    } else {
      params.delete("maxScore");
    }

    // Reset to page 1 when filtering
    params.delete("page");

    const newUrl = params.toString()
      ? `?${params.toString()}`
      : window.location.pathname;
    router.push(newUrl);
    setIsOpen(false);
  };

  const handleClearFilters = () => {
    setSelectedProvider("all");
    setSelectedInterest("all");
    setSelectedApplicationStatus("all"); // New: Reset application status
    setMinScore("50");
    setMaxScore("100");

    const params = new URLSearchParams(searchParams.toString());
    params.delete("provider");
    params.delete("interest");
    params.delete("applicationStatus"); // New: Clear application status from params
    params.delete("minScore");
    params.delete("maxScore");
    params.delete("page");

    const newUrl = params.toString()
      ? `?${params.toString()}`
      : window.location.pathname;
    router.push(newUrl);
    setIsOpen(false);
  };

  const handleProviderSelect = (providerValue: string) => {
    setSelectedProvider(providerValue);
  };

  const handleInterestSelect = (interestValue: string) => {
    setSelectedInterest(interestValue);
  };

  const handleApplicationStatusSelect = (statusValue: string) => {
    // New handler
    setSelectedApplicationStatus(statusValue);
  };

  const getDropdownStyles = () => {
    if (!buttonRef.current) return {};

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth < 640; // sm breakpoint
    const isTablet = window.innerWidth < 1024; // lg breakpoint

    if (isMobile) {
      // Mobile: Full width modal-style
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "calc(100vw - 32px)",
        maxWidth: "400px",
        maxHeight: "80vh",
      };
    } else if (isTablet) {
      // Tablet: Positioned near button but responsive
      return {
        top: buttonRect.bottom + 8,
        right: window.innerWidth - buttonRect.right,
        width: "360px",
        maxHeight: `${window.innerHeight - buttonRect.bottom - 20}px`,
      };
    } else {
      // Desktop: Wider dropdown with grid layout
      return {
        top: buttonRect.bottom + 8,
        right: window.innerWidth - buttonRect.right,
        width: "480px",
        maxHeight: `${window.innerHeight - buttonRect.bottom - 20}px`,
      };
    }
  };

  const currentMinScore = searchParams.get("minScore");
  const currentMaxScore = searchParams.get("maxScore");
  const currentProvider = searchParams.get("provider");
  const currentInterest = searchParams.get("interest");
  const currentApplicationStatus = searchParams.get("applicationStatus"); // New

  const hasActiveProviderFilter = currentProvider && currentProvider !== "all";
  const hasActiveInterestFilter = currentInterest && currentInterest !== "all";
  const hasActiveApplicationStatusFilter =
    currentApplicationStatus && currentApplicationStatus !== "all"; // New
  const hasActiveScoreFilter =
    (currentMinScore && currentMinScore !== "50") ||
    (currentMaxScore && currentMaxScore !== "100");

  const isActive =
    hasActiveProviderFilter ||
    hasActiveScoreFilter ||
    hasActiveInterestFilter ||
    hasActiveApplicationStatusFilter; // New

  // Determine button text
  let buttonText = "Filter";
  const activeFilterParts = [];
  if (hasActiveProviderFilter) {
    const providerOption = PROVIDER_OPTIONS.find(
      (opt) => opt.value === currentProvider
    );
    activeFilterParts.push(providerOption ? providerOption.label : "Provider");
  }
  if (hasActiveInterestFilter) {
    const interestOption = INTEREST_OPTIONS.find(
      (opt) => opt.value === currentInterest
    );
    activeFilterParts.push(interestOption ? interestOption.label : "Interest");
  }
  if (hasActiveApplicationStatusFilter) {
    // New
    const statusOption = APPLICATION_STATUS_OPTIONS.find(
      (opt) => opt.value === currentApplicationStatus
    );
    activeFilterParts.push(statusOption ? statusOption.label : "App. Status");
  }
  if (hasActiveScoreFilter) {
    activeFilterParts.push(
      `Score: ${currentMinScore || "Any"}-${currentMaxScore || "Any"}`
    );
  }

  if (activeFilterParts.length > 0) {
    buttonText = activeFilterParts.join(" & ");
    if (buttonText.length > 20) {
      buttonText = `${activeFilterParts.length} Filters Active`;
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg border transition-colors shadow-2xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ${
          isActive
            ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs"
            : "bg-white border-zinc-200/90 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300"
        } ${className}`}
      >
        <Filter className={`h-3.5 w-3.5 ${isActive ? "text-indigo-600" : "text-zinc-500"}`} />
        <span>{buttonText}</span>
        {isActive && <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></div>}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          } ${isActive ? "text-indigo-600" : "text-zinc-400"}`}
        />
      </button>

      {/* Dropdown Menu - Responsive positioning */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20 sm:bg-transparent"
            onClick={() => setIsOpen(false)}
          />

          {/* Responsive dropdown */}
          <div
            ref={dropdownRef}
            className="fixed z-50 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden"
            style={getDropdownStyles()}
          >
            {/* Header */}
            <div className="px-4 sm:px-6 py-3.5 border-b border-zinc-100 bg-indigo-50/30 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-900">Filters</h3>
                {isActive && (
                  <button
                    onClick={handleClearFilters}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                  >
                    Reset all
                  </button>
                )}
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto"
              style={{
                maxHeight:
                  window.innerWidth < 640
                    ? "60vh"
                    : buttonRef.current
                    ? `${
                        window.innerHeight -
                        buttonRef.current.getBoundingClientRect().bottom -
                        140
                      }px`
                    : "50vh",
              }}
            >
              {/* Provider Filter Section */}
              {providerOptions && (
                <div className="p-4 sm:p-5 border-b border-zinc-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900/80 mb-2.5">
                    Platform / Provider
                  </h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
                    {PROVIDER_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleProviderSelect(option.value)}
                        className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between group cursor-pointer ${
                          selectedProvider === option.value
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold"
                            : "text-zinc-700 hover:bg-zinc-100/70 border border-transparent"
                        }`}
                      >
                        <span className="truncate">{option.label}</span>
                        {selectedProvider === option.value && (
                          <Check className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0 ml-2" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Interest Filter Section */}
              {interestOptions && (
                <div className="p-4 sm:p-5 border-b border-zinc-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900/80 mb-2.5">
                    Interest Status
                  </h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
                    {INTEREST_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleInterestSelect(option.value)}
                        className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between group cursor-pointer ${
                          selectedInterest === option.value
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold"
                            : "text-zinc-700 hover:bg-zinc-100/70 border border-transparent"
                        }`}
                      >
                        <span className="truncate">{option.label}</span>
                        {selectedInterest === option.value && (
                          <Check className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0 ml-2" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Application Status Filter Section (New) */}
              {applicationStatusOptions && (
                <div className="p-4 sm:p-5 border-b border-zinc-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900/80 mb-2.5">
                    Application Status
                  </h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
                    {APPLICATION_STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() =>
                          handleApplicationStatusSelect(option.value)
                        }
                        className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between group cursor-pointer ${
                          selectedApplicationStatus === option.value
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold"
                            : "text-zinc-700 hover:bg-zinc-100/70 border border-transparent"
                        }`}
                      >
                        <span className="truncate">{option.label}</span>
                        {selectedApplicationStatus === option.value && (
                          <Check className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0 ml-2" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Score Filter Section */}
              {scoreOptions && (
                <div className="p-4 sm:p-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900/80 mb-2.5">
                    Resume Score Range (0 - 100)
                  </h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-600 mb-1">
                          Minimum
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={minScore}
                          onChange={(e) => setMinScore(e.target.value)}
                          className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs sm:text-sm"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-600 mb-1">
                          Maximum
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={maxScore}
                          onChange={(e) => setMaxScore(e.target.value)}
                          className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs sm:text-sm"
                          placeholder="100"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-3 border-t border-zinc-100 bg-zinc-50/60 flex-shrink-0">
              <div className="flex gap-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-3 py-2 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyFilters}
                  className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
