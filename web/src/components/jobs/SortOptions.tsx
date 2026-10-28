"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
interface SortOptionsProps {
  showApplicationSort?: boolean;
  showResumeScoreSort?: boolean;
}

const SORT_FIELDS = {
  APPLICATION_DATE: "application_date",
  RESUME_SCORE: "resume_score",
};

export default function SortOptions({
  showApplicationSort = true,
  showResumeScoreSort = true,
}: SortOptionsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSortBy = searchParams.get("sortBy");
  const currentSortOrder = searchParams.get("sortOrder");

  const createQueryString = useCallback(
    (paramsToUpdate: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(paramsToUpdate).forEach(([name, value]) => {
        if (value) {
          params.set(name, value);
        } else {
          params.delete(name);
        }
      });
      return params.toString();
    },
    [searchParams]
  );

  const handleSort = (field: string) => {
    let newSortOrder = "desc"; // Default to descending
    if (currentSortBy === field) {
      newSortOrder = currentSortOrder === "asc" ? "desc" : "asc";
    }
    router.push(
      pathname +
        "?" +
        createQueryString({ sortBy: field, sortOrder: newSortOrder }),
      { scroll: false }
    );
  };

  const renderSortIcon = (field: string) => {
    if (currentSortBy === field) {
      return currentSortOrder === "asc" ? (
        <ArrowUp className="ml-1" />
      ) : (
        <ArrowDown className="ml-1" />
      );
    }
    return null;
  };

  return (
    <div className="flex items-center space-x-3">
      {showApplicationSort && (
        <button
          onClick={() => handleSort(SORT_FIELDS.APPLICATION_DATE)}
          className={`flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors
            ${
              currentSortBy === SORT_FIELDS.APPLICATION_DATE
                ? "bg-gray-200 text-gray-800"
                : "text-gray-600 hover:bg-gray-100"
            }`}
        >
          Sort by Date
          {renderSortIcon(SORT_FIELDS.APPLICATION_DATE)}
        </button>
      )}
      {showResumeScoreSort && (
        <button
          onClick={() => handleSort(SORT_FIELDS.RESUME_SCORE)}
          className={`flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors
            ${
              currentSortBy === SORT_FIELDS.RESUME_SCORE
                ? "bg-gray-200 text-gray-800"
                : "text-gray-600 hover:bg-gray-100"
            }`}
        >
          Sort by Score
          {renderSortIcon(SORT_FIELDS.RESUME_SCORE)}
        </button>
      )}
    </div>
  );
}
