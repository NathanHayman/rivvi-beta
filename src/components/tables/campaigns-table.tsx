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
import { useEffect, useState } from "react";

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
  runCount?: number | string | null;
  callCount?: number | string | null;
}

interface CampaignsTableProps {
  initialCampaigns?: Campaign[];
  totalCount?: number;
}

const removeInboundCampaigns = (campaigns: Campaign[]) => {
  console.log(
    "Before filtering:",
    JSON.stringify(
      campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        direction: c.direction,
        runCount: c.runCount,
        callCount: c.callCount,
      })),
      null,
      2,
    ),
  );

  const filtered = campaigns.filter(
    (campaign) => campaign.direction !== "inbound",
  );

  console.log(
    "After filtering:",
    JSON.stringify(
      filtered.map((c) => ({
        id: c.id,
        name: c.name,
        direction: c.direction,
        runCount: c.runCount,
        callCount: c.callCount,
      })),
      null,
      2,
    ),
  );

  return filtered;
};

// Helper function to safely convert value to number with enhanced debugging
const safeToNumber = (value: unknown): number => {
  console.log("safeToNumber input:", {
    value,
    type: typeof value,
    isObject: value !== null && typeof value === "object",
    constructor:
      value !== null && typeof value === "object"
        ? value.constructor.name
        : "N/A",
    stringValue:
      value !== null && value !== undefined ? String(value) : "null/undefined",
  });

  // Handle null/undefined
  if (value === null || value === undefined) {
    return 0;
  }

  // Handle numeric values directly
  if (typeof value === "number" && !isNaN(value)) {
    return value;
  }

  // Handle special cases like objects or BigInt
  if (typeof value === "object") {
    // If the object has a valueOf method that returns a number, use that
    if (typeof (value as any).valueOf === "function") {
      const valueOfResult = (value as any).valueOf();
      if (typeof valueOfResult === "number" && !isNaN(valueOfResult)) {
        return valueOfResult;
      }
    }
    // Try to convert object to string, then to number
    const numValue = Number(String(value));
    return isNaN(numValue) ? 0 : numValue;
  }

  // Handle string with special conversion
  if (typeof value === "string") {
    // Empty string case
    if (value.trim() === "") {
      return 0;
    }

    // Try direct conversion first
    const directNum = Number(value);
    if (!isNaN(directNum)) {
      return directNum;
    }

    // If direct conversion fails, try to extract numeric parts
    const cleaned = value.replace(/[^\d.]/g, "");
    return cleaned === "" ? 0 : Number(cleaned);
  }

  // Handle boolean
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  // For other types, try direct conversion
  const num = Number(value);
  return isNaN(num) ? 0 : num;
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

  // Add debug logging to inspect the actual data structure
  useEffect(() => {
    if (data) {
      console.log(
        "Campaigns data from hook:",
        JSON.stringify(
          data.map((c: any) => ({
            id: c.id,
            name: c.name,
            runCount: c.runCount,
            callCount: c.callCount,
            runCountType: typeof c.runCount,
            callCountType: typeof c.callCount,
          })),
          null,
          2,
        ),
      );
    }
    if (initialCampaigns) {
      console.log(
        "Initial campaigns:",
        JSON.stringify(
          initialCampaigns.map((c) => ({
            id: c.id,
            name: c.name,
            runCount: c.runCount,
            callCount: c.callCount,
            runCountType: typeof c.runCount,
            callCountType: typeof c.callCount,
          })),
          null,
          2,
        ),
      );
    }
  }, [data, initialCampaigns]);

  // Use either the provided campaigns or the ones from the hook
  // Ensure runCount and callCount are properly normalized to numbers
  const allCampaigns: Campaign[] = (initialCampaigns || data || []).map(
    (campaign) => {
      // Deep clone to avoid mutation issues
      const campaignCopy = { ...campaign };

      // Ensure runCount and callCount properties exist with default values
      if (
        campaignCopy.runCount === undefined ||
        campaignCopy.runCount === null
      ) {
        console.log(`Setting default runCount for campaign ${campaignCopy.id}`);
        campaignCopy.runCount = 0;
      }

      if (
        campaignCopy.callCount === undefined ||
        campaignCopy.callCount === null
      ) {
        console.log(
          `Setting default callCount for campaign ${campaignCopy.id}`,
        );
        campaignCopy.callCount = 0;
      }

      // Get raw values for logging
      const rawRunCount = campaignCopy.runCount;
      const rawCallCount = campaignCopy.callCount;

      // Convert to safe numbers
      const runCount = safeToNumber(rawRunCount);
      const callCount = safeToNumber(rawCallCount);

      console.log("Processing campaign:", campaignCopy.id, campaignCopy.name, {
        runCount: {
          raw: rawRunCount,
          type: typeof rawRunCount,
          converted: runCount,
        },
        callCount: {
          raw: rawCallCount,
          type: typeof rawCallCount,
          converted: callCount,
        },
        fullCampaign: campaignCopy,
      });

      // Always ensure we have proper number values for the counts
      return {
        ...campaignCopy,
        runCount,
        callCount,
      };
    },
  );

  // Then filter out inbound campaigns
  const filteredCampaigns = removeInboundCampaigns(allCampaigns);

  // After the filteredCampaigns are created, add this code:
  // Log the final filtered campaigns that will be shown in the table
  useEffect(() => {
    console.log(
      "FINAL TABLE DATA:",
      JSON.stringify(
        filteredCampaigns.map((c) => ({
          id: c.id,
          name: c.name,
          direction: c.direction,
          runCount: c.runCount,
          runCountType: typeof c.runCount,
          callCount: c.callCount,
          callCountType: typeof c.callCount,
        })),
        null,
        2,
      ),
    );
  }, [filteredCampaigns]);

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
      cell: ({ row }) => {
        // Direct access to the original data
        const rawValue = row.original.runCount;
        const count = safeToNumber(rawValue);

        console.log(`Run count for ${row.original.id}:`, {
          raw: rawValue,
          type: typeof rawValue,
          converted: count,
          originalObject: row.original,
        });

        // Ensure we always display a number rather than letting the system choose how to display it
        return (
          <div className="text-center font-medium">{count.toString()}</div>
        );
      },
      // Force numeric sorting
      sortingFn: (rowA, rowB, columnId) => {
        const valueA = safeToNumber(rowA.original.runCount);
        const valueB = safeToNumber(rowB.original.runCount);
        return valueA - valueB;
      },
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
      cell: ({ row }) => {
        // Direct access to the original data
        const rawValue = row.original.callCount;
        const count = safeToNumber(rawValue);

        console.log(`Call count for ${row.original.id}:`, {
          raw: rawValue,
          type: typeof rawValue,
          converted: count,
          originalObject: row.original,
        });

        // Ensure we always display a number rather than letting the system choose how to display it
        return (
          <div className="text-center font-medium">{count.toString()}</div>
        );
      },
      // Force numeric sorting
      sortingFn: (rowA, rowB, columnId) => {
        const valueA = safeToNumber(rowA.original.callCount);
        const valueB = safeToNumber(rowB.original.callCount);
        return valueA - valueB;
      },
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

  // Before creating the table instance, add:
  // Add more detailed debugging for each column cell rendering
  const debugColumns = columns.map((column) => {
    // Only modify the runCount and callCount columns with proper type checking
    if (
      "accessorKey" in column &&
      (column.accessorKey === "runCount" || column.accessorKey === "callCount")
    ) {
      const accessorKey = column.accessorKey as string;
      return {
        ...column,
        cell: (info: any) => {
          const { row } = info;
          // Get the raw value from the row
          const rawValue =
            row.original[accessorKey as keyof typeof row.original];
          // Log detailed info about the cell value
          console.log(
            `Rendering ${accessorKey} for row ${row.original.id} (${row.original.name}):`,
            {
              rawValue,
              valueType: typeof rawValue,
              originalRow: row.original,
              accessorValue: row.getValue(accessorKey),
            },
          );

          // Call the original cell renderer with the same context
          if (typeof column.cell === "function") {
            return column.cell(info);
          }
          return null;
        },
      };
    }
    return column;
  });

  const table = useReactTable<Campaign>({
    data: filteredCampaigns,
    columns: debugColumns, // Use the enhanced debug columns
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
              table.getRowModel().rows.map((row) => {
                // Debug row data right before rendering
                console.log(`TABLE ROW ${row.id} DATA:`, {
                  rowData: row.original,
                  runCount: row.original.runCount,
                  runCountType: typeof row.original.runCount,
                  callCount: row.original.callCount,
                  callCountType: typeof row.original.callCount,
                  getValueRunCount: row.getValue("runCount"),
                  getValueCallCount: row.getValue("callCount"),
                });

                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="cursor-pointer"
                    onClick={() => router.push(`/campaigns/${row.original.id}`)}
                  >
                    {row.getVisibleCells().map((cell) => {
                      // Extra debug for the cell rendering process
                      const columnId = cell.column.id;
                      if (columnId === "runCount" || columnId === "callCount") {
                        console.log(
                          `CELL ${columnId} for campaign ${row.original.id}:`,
                          {
                            value: cell.getValue(),
                            renderValue: flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            ),
                          },
                        );
                      }

                      return (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
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
