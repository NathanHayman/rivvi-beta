// src/app/(app)/calls/_components/calls-table-pagination.tsx
"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

interface CallsTablePaginationProps {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function CallsTablePagination({
  currentPage,
  pageSize,
  totalPages,
  totalCount,
  onPageChange,
  onPageSizeChange,
}: CallsTablePaginationProps) {
  // Generate visible page numbers based on current position
  const getPageNumbers = () => {
    // Always show first page, last page, current page, and pages immediately before and after current
    const pageNumbers: (number | "ellipsis")[] = [];

    // First page
    pageNumbers.push(1);

    // Ellipsis before current page if current page is more than 3
    if (currentPage > 3) {
      pageNumbers.push("ellipsis");
    }

    // Page before current if current is greater than 2
    if (currentPage > 2) {
      pageNumbers.push(currentPage - 1);
    }

    // Current page if not first page
    if (currentPage !== 1 && currentPage !== totalPages) {
      pageNumbers.push(currentPage);
    }

    // Page after current if current is less than totalPages - 1
    if (currentPage < totalPages - 1) {
      pageNumbers.push(currentPage + 1);
    }

    // Ellipsis after current page if current page is less than totalPages - 2
    if (currentPage < totalPages - 2) {
      pageNumbers.push("ellipsis");
    }

    // Last page if more than one page
    if (totalPages > 1) {
      pageNumbers.push(totalPages);
    }

    return pageNumbers;
  };

  // Handle page changes while preventing out of bounds values
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };

  return (
    <div className="w-full bg-background px-4 py-4">
      <div className="flex w-full flex-col-reverse items-center justify-between gap-4 sm:flex-row">
        {/* Page size and record info */}
        <div className="flex w-full items-center gap-2 text-sm text-muted-foreground">
          <span>
            Showing{" "}
            {Math.min(pageSize, totalCount - (currentPage - 1) * pageSize)} of{" "}
            {totalCount} calls
          </span>

          <span className="mx-2">|</span>

          <div className="data-table-no-click flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              className="data-table-no-click my-auto flex h-8 w-16 items-center justify-center rounded-md border border-input bg-background px-2 text-sm leading-none"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {[5, 10, 20, 50, 100].map((size) => (
                <option key={size} value={size} className="text-sm">
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pagination controls */}
        <Pagination className="w-fit">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => handlePageChange(currentPage - 1)}
                className={cn(
                  "data-table-no-click",
                  currentPage === 1 && "pointer-events-none opacity-50",
                )}
              />
            </PaginationItem>

            {/* Dynamic page numbers */}
            {getPageNumbers().map((item, i) =>
              item === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${i}`}>
                  <PaginationEllipsis className="data-table-no-click" />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    onClick={() => handlePageChange(item)}
                    isActive={currentPage === item}
                    className="data-table-no-click h-8 w-8"
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}

            <PaginationItem>
              <PaginationNext
                onClick={() => handlePageChange(currentPage + 1)}
                className={cn(
                  "data-table-no-click",
                  currentPage === totalPages &&
                    "pointer-events-none opacity-50",
                )}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
