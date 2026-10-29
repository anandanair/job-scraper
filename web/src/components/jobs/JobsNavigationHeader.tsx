"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Zap, Star, Sparkles } from "lucide-react";
import SearchComponent from "./SearchComponent";
import FilterButton from "./FilterButton";
import RefreshButton from "./RefreshButton";
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
    icon: React.ReactNode;
    count?: number;
  }[] = [
    {
      key: "new",
      label: "New Jobs",
      href: getTabHref("/jobs/new"),
      icon: <Zap size={16} className={activeTab === "new" ? "text-amber-500" : ""} />,
      count: tabCounts?.newCount,
    },
    {
      key: "top-matches",
      label: "Top Matches",
      href: getTabHref("/jobs/top-matches"),
      icon: <Star size={16} className={activeTab === "top-matches" ? "text-indigo-600" : ""} />,
      count: tabCounts?.matchesCount,
    },
    {
      key: "tailored",
      label: "Tailored & Ready",
      href: getTabHref("/jobs/tailored"),
      icon: <Sparkles size={16} className={activeTab === "tailored" ? "text-emerald-600" : ""} />,
      count: tabCounts?.tailoredCount,
    },
  ];

  return (
    <div className="mb-6 space-y-4">
      {/* Top row: Title and Search / Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>

        <div className="flex items-center space-x-3 flex-wrap">
          <SearchComponent />
          <FilterButton />
          <RefreshButton currentPage={currentPage} />
        </div>
      </div>

      {/* Segmented Tab Control */}
      <div className="flex border-b border-gray-200">
        <nav className="flex space-x-2 -mb-px" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                prefetch={true}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-all duration-150 ${
                  isActive
                    ? "border-indigo-600 text-indigo-600 font-semibold"
                    : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {typeof tab.count === "number" && (
                  <span
                    className={`ml-1.5 py-0.5 px-2 rounded-full text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-200/80"
                        : "bg-gray-100 text-gray-600"
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
