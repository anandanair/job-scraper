"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";

export default function SearchComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setSearchQuery(searchParams.get("query") || "");
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (searchQuery.trim()) {
      params.set("query", searchQuery.trim());
    } else {
      params.delete("query");
    }
    // Reset page to 1 when a new search is performed
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  const handleClear = () => {
    setSearchQuery("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("query");
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="w-full sm:w-60 lg:w-72">
      <form onSubmit={handleSearch} className="relative">
        <div
          className={`relative flex items-center bg-white border rounded-lg transition-all shadow-2xs ${
            isFocused
              ? "border-indigo-600 ring-1 ring-indigo-500/20"
              : "border-zinc-200/90 hover:border-zinc-300"
          }`}
        >
          {/* Search Icon */}
          <div className={`absolute left-3 flex items-center pointer-events-none transition-colors ${
            isFocused ? "text-indigo-600" : "text-zinc-400"
          }`}>
            <Search size={15} />
          </div>

          {/* Input Field */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Search title, company, skills..."
            className="w-full pl-9 pr-8 py-2 bg-transparent text-zinc-900 placeholder-zinc-400 text-xs sm:text-sm font-normal border-none outline-none"
          />

          {/* Clear Button */}
          {searchQuery && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2.5 p-1 text-zinc-400 hover:text-indigo-600 rounded-md transition-colors cursor-pointer"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
