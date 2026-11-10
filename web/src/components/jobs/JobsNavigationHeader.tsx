"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Clock, Star, FileCheck2, Plus } from "lucide-react";
import SearchComponent from "./SearchComponent";
import FilterButton from "./FilterButton";
import RefreshButton from "./RefreshButton";
import { JobImportModal } from "./JobImportModal";
import { JobsTabCounts } from "@/lib/supabase/queries";

export type JobsTabKey = "new" | "top-matches" | "tailored";

interface JobsNavigationHeaderProps {
  activeTab: JobsTabKey;
  tabCounts?: JobsTabCounts;
  currentPage: number;
  title: string;
  subtitle: string;
}

export default function JobsNavigationHeader({
  activeTab,
  tabCounts,
  currentPage,
  title,
  subtitle,
}: JobsNavigationHeaderProps) {
  const searchParams = useSearchParams();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Helper to preserve filters and search query when switching tabs
  const getTabHref = (basePath: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page"); // Reset pagination to page 1 on tab switch
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const tabs: {
    key: JobsTabKey;
    label: string;
    href: string;
    icon: (isActive: boolean) => React.ReactNode;
    activeBorder: string;
    activeText: string;
    activeBadge: string;
    count?: number;
  }[] = [
    {
      key: "new",
      label: "New Jobs",
      href: getTabHref("/jobs/new"),
      activeBorder: "border-amber-500",
      activeText: "text-amber-800",
      activeBadge: "bg-amber-100 text-amber-900 border border-amber-200/80",
      icon: (isActive) => (
        <Clock size={15} className={isActive ? "text-amber-600" : "text-zinc-400"} />
      ),
      count: tabCounts?.newCount,
    },
    {
      key: "top-matches",
      label: "Top Matches",
      href: getTabHref("/jobs/top-matches"),
      activeBorder: "border-indigo-600",
      activeText: "text-indigo-700",
      activeBadge: "bg-indigo-100 text-indigo-800 border border-indigo-200/80",
      icon: (isActive) => (
        <Star size={15} className={isActive ? "text-indigo-600 fill-indigo-100" : "text-zinc-400"} />
      ),
      count: tabCounts?.matchesCount,
    },
    {
      key: "tailored",
      label: "Tailored & Ready",
      href: getTabHref("/jobs/tailored"),
      activeBorder: "border-emerald-600",
      activeText: "text-emerald-800",
      activeBadge: "bg-emerald-100 text-emerald-900 border border-emerald-200/80",
      icon: (isActive) => (
        <FileCheck2 size={15} className={isActive ? "text-emerald-600" : "text-zinc-400"} />
      ),
      count: tabCounts?.tailoredCount,
    },
  ];

  return (
    <div className="mb-6 space-y-4">
      {/* Top row: Title and Search / Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-zinc-500">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <SearchComponent />
          <FilterButton />
          <RefreshButton currentPage={currentPage} />
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={15} />
            <span>Import Job</span>
          </button>
        </div>
      </div>

      <JobImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      {/* Modern Color-Coded Tabs */}
      <div className="flex border-b border-zinc-200/80">
        <nav className="flex space-x-1 sm:space-x-3 -mb-px" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                prefetch={true}
                className={`flex items-center gap-2 py-2.5 px-3 sm:px-4 border-b-2 text-xs sm:text-sm transition-all duration-150 ${
                  isActive
                    ? `${tab.activeBorder} ${tab.activeText} font-semibold`
                    : "border-transparent text-zinc-500 hover:text-zinc-900 hover:border-zinc-300 font-medium"
                }`}
              >
                {tab.icon(isActive)}
                <span>{tab.label}</span>
                {typeof tab.count === "number" && (
                  <span
                    className={`ml-0.5 py-0.5 px-2 rounded-full text-[11px] font-medium transition-colors ${
                      isActive
                        ? tab.activeBadge
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
