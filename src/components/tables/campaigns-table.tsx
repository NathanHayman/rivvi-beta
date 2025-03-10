"use client";

// src/components/campaigns/campaigns-table.tsx
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { formatDistance } from "date-fns";
import {
  ArrowUpDown,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge, BadgeProps } from "@/components/ui/badge";
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
import { useCampaigns } from "@/hooks/campaigns/use-campaigns";
// import { CreateRunModal } from "../app/run/create-run-modal";

export interface Campaign {
  id: string;
  name: string;
  direction: string;
  agentId: string;
  createdAt: Date;
  runCount?: number;
  callCount?: number;
}

interface CampaignsTableProps {
  initialCampaigns?: Campaign[];
  totalCount?: number;
}

const removeInboundCampaigns = (campaigns: Campaign[]) => {
  return campaigns.filter((campaign) => campaign.direction !== "inbound");
};

export function CampaignsTable({
  initialCampaigns,
  totalCount: initialTotalCount,
}: CampaignsTableProps = {}) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    null,
  );
  const [isCreateRunModalOpen, setIsCreateRunModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // Get campaigns data using the custom hook if no initialCampaigns provided
  const { data, isLoading, refetch } = useCampaigns();

  // Use either the provided campaigns or the ones from the hook
  const allCampaigns: Campaign[] = initialCampaigns || data || [];

  // Then filter out inbound campaigns
  const filteredCampaigns = removeInboundCampaigns(allCampaigns);

  const handleCreateRun = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setIsCreateRunModalOpen(true);
  };

  const columns: ColumnDef<Campaign>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Campaign Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name")}</div>
      ),
    },
    {
      accessorKey: "direction",
      header: "Direction",
      cell: ({ row }) => {
        const direction = row.getValue("direction") as string;

        const campaignTypeColor: BadgeProps["variant"] =
          direction === "inbound" || direction === "outbound"
            ? "violet_solid"
            : "yellow_solid";

        return <Badge variant={campaignTypeColor}>{direction}</Badge>;
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Created
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        return (
          <div className="text-sm">
            {formatDistance(new Date(row.getValue("createdAt")), new Date(), {
              addSuffix: true,
            })}
          </div>
        );
      },
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
        <div className="text-center font-medium">
          {row.original.runCount ?? 0}
        </div>
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
        <div className="text-center font-medium">
          {row.original.callCount ?? 0}
        </div>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const campaign = row.original;

        return (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCreateRun(campaign.id)}
              className="mr-2"
            >
              <CalendarIcon className="mr-1.5 h-4 w-4" />
              Create Run
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => router.push(`/campaigns/${campaign.id}`)}
                >
                  View Campaign
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push(`/campaigns/${campaign.id}/runs`)}
                >
                  View Runs
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCreateRun(campaign.id)}>
                  Create Run
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const table = useReactTable<Campaign>({
    data: filteredCampaigns,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    state: {
      sorting,
      pagination,
    },
    manualPagination: true,
    pageCount: filteredCampaigns.length
      ? Math.ceil(filteredCampaigns.length / pagination.pageSize)
      : 0,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex w-full max-w-sm items-center space-x-2">
          <Input
            placeholder="Search campaigns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-2"
            onClick={() => {
              void refetch?.();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="rounded-md">
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
            {isLoading && !initialCampaigns ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <div className="flex items-center justify-center">
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer"
                  onClick={() => router.push(`/campaigns/${row.original.id}`)}
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
                  No campaigns found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {table.getRowModel().rows.length} of{" "}
          {filteredCampaigns.length} campaigns
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous page</span>
          </Button>
          <div className="text-sm font-medium">
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
            <span className="sr-only">Next page</span>
          </Button>
        </div>
      </div>

      {/* {selectedCampaignId && (
        <CreateRunModal
          campaignId={selectedCampaignId}
          open={isCreateRunModalOpen}
          onOpenChange={setIsCreateRunModalOpen}
        />
      )} */}
    </div>
  );
}
