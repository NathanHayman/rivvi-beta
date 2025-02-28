"use client";

// src/components/admin/organizations-table.tsx
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/trpc/react";
import { formatDistance } from "date-fns";
import { useRouter } from "next/navigation";
import { CreateOrganizationDialog } from "./create-organization-dialog";

interface Organization {
  org: {
    id: string;
    name: string;
    clerkId: string;
    phone: string | null;
    timezone: string | null;
    officeHours: Record<string, unknown> | null;
    concurrentCallLimit: number | null;
    isSuperAdmin: boolean | null;
    createdAt: Date;
    updatedAt: Date | null;
  };
  campaignCount: number;
  runCount: number;
  callCount: number;
}

export function OrganizationsTable() {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOrgDialogOpen, setIsCreateOrgDialogOpen] = useState(false);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // Get organizations data
  const { data, isLoading, isError, refetch } =
    api.admin.getOrganizationsWithStats.useQuery({
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
      search: searchTerm.length >= 3 ? searchTerm : undefined,
    });

  // Define columns
  const columns: ColumnDef<Organization>[] = [
    {
      accessorKey: "org.name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Organization
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.org.name}</div>
          <div className="text-xs text-muted-foreground">
            Created{" "}
            {formatDistance(new Date(row.original.org.createdAt), new Date(), {
              addSuffix: true,
            })}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "org.phone",
      header: "Phone",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{row.original.org.phone || "Not set"}</span>
        </div>
      ),
    },
    {
      accessorKey: "campaignCount",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Campaigns
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.campaignCount}</Badge>
      ),
    },
    {
      accessorKey: "runCount",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Runs
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.runCount}</Badge>
      ),
    },
    {
      accessorKey: "callCount",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Calls
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.callCount}</Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const orgId = row.original.org.id;

        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => router.push(`/admin/orgs/${orgId}`)}
                >
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push(`/admin/orgs/${orgId}/campaigns`)}
                >
                  View Campaigns
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push(`/admin/orgs/${orgId}/edit`)}
                >
                  Edit Organization
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  // Create table
  const table = useReactTable<Organization>({
    data: data?.organizations || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    state: {
      pagination,
      sorting,
    },
    manualPagination: true,
    pageCount: data ? Math.ceil(data.totalCount / pagination.pageSize) : 0,
  });

  // Handle search
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    // Reset to first page when searching
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  // Handle create organization success
  const handleCreateOrgSuccess = () => {
    setIsCreateOrgDialogOpen(false);
    void refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search organizations..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-[250px] pl-8"
            />
          </div>
        </div>

        <Button onClick={() => setIsCreateOrgDialogOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Organization
        </Button>
      </div>

      <div className="rounded-md border">
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
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Loading organizations...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
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
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No organizations found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {table.getRowModel().rows.length} of {data?.totalCount || 0}{" "}
          organizations
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous Page</span>
          </Button>
          <div className="text-sm">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next Page</span>
          </Button>
        </div>
      </div>

      <CreateOrganizationDialog
        open={isCreateOrgDialogOpen}
        onOpenChange={setIsCreateOrgDialogOpen}
        onSuccess={handleCreateOrgSuccess}
      />
    </div>
  );
}
