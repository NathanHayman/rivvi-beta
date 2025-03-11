"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Loader2, Search } from "lucide-react";
import { ReactNode, useState } from "react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  pagination?: {
    hasNextPage: boolean;
    onNextPage: () => void;
  };
  searchable?: boolean;
  onSearch?: (query: string) => void;
  onRowClick?: (row: TData, event: React.MouseEvent) => void;
  rowClassName?: (row: TData) => string;
  emptyState?: ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  pagination,
  searchable = false,
  onSearch,
  onRowClick,
  rowClassName,
  emptyState,
}: DataTableProps<TData, TValue>) {
  const [searchQuery, setSearchQuery] = useState("");

  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = event.target.value;
    setSearchQuery(newQuery);
    if (onSearch) {
      onSearch(newQuery);
    }
  };

  // Initialize the table
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  });

  return (
    <div className="space-y-4">
      {/* Search input */}
      {searchable && (
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-9"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading state
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-40 text-center"
                >
                  <div className="flex h-full flex-col items-center justify-center">
                    <Loader2 className="mb-2 h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-muted-foreground">Loading data...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              // Data rows
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={`cursor-pointer ${
                    rowClassName ? rowClassName(row.original) : ""
                  }`}
                  onClick={(e) => onRowClick && onRowClick(row.original, e)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              // Empty state
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-40 text-center"
                >
                  {emptyState || (
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <p className="text-muted-foreground">No results found</p>
                      {searchQuery && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchQuery("");
                            if (onSearch) onSearch("");
                          }}
                        >
                          Clear search
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-end space-x-2">
          <div className="flex-1 text-sm text-muted-foreground">
            Showing {table.getRowModel().rows.length} results
          </div>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onNextPage()}
              disabled={!pagination.hasNextPage || isLoading}
            >
              Load More
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
