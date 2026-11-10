"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
}

export default function PaginationControls({
  currentPage,
  totalPages,
}: PaginationControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    router.push(`?${params.toString()}`);
  };

  // Only render pagination if we have more than one page
  if (totalPages <= 1) {
    return null;
  }

  // Calculate which page numbers to show
  const getPageNumbers = () => {
    const maxPagesToShow = 3;

    if (totalPages <= maxPagesToShow) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 2) {
      return [1, 2, 3];
    }

    if (currentPage >= totalPages - 1) {
      return [totalPages - 2, totalPages - 1, totalPages];
    }

    return [currentPage - 1, currentPage, currentPage + 1];
  };

  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <div className="text-zinc-500 font-medium">
        Page {currentPage} of {totalPages}
      </div>

      <div className="flex items-center space-x-1">
        {/* Previous button */}
        <button
          onClick={() => currentPage > 1 && goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="flex items-center justify-center h-7 w-7 rounded-md text-zinc-600 disabled:text-zinc-300 disabled:cursor-not-allowed hover:bg-zinc-100 transition-colors cursor-pointer"
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>

        {/* Page numbers */}
        {getPageNumbers().map((page) => (
          <button
            key={page}
            onClick={() => goToPage(page)}
            className={`flex cursor-pointer items-center justify-center h-7 w-7 rounded-md text-xs font-medium transition-colors ${
              currentPage === page
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-100"
            }`}
            aria-label={`Page ${page}`}
            aria-current={currentPage === page ? "page" : undefined}
          >
            {page}
          </button>
        ))}

        {/* Next button */}
        <button
          onClick={() => currentPage < totalPages && goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="flex items-center cursor-pointer justify-center h-7 w-7 rounded-md text-zinc-600 disabled:text-zinc-300 disabled:cursor-not-allowed hover:bg-zinc-100 transition-colors"
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
