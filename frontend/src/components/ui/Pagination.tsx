"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-1 py-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {getPageNumbers().map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} className="px-2 text-sm text-zinc-400 dark:text-zinc-500">
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`min-w-[36px] rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              p === page
                ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
