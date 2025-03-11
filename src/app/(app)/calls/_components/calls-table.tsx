"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCalls } from "@/hooks/calls/use-calls";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  Check,
  CircleAlert,
  Clock,
  ExternalLink,
  MoreHorizontal,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  RefreshCw,
  Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { CallsTableFilters } from "./calls-table-filters";

// Define the call type based on the schema
type Call = {
  id: string;
  agentId: string;
  direction: "inbound" | "outbound";
  status:
    | "pending"
    | "in-progress"
    | "completed"
    | "failed"
    | "voicemail"
    | "no-answer";
  toNumber: string;
  fromNumber: string;
  startTime: Date | null;
  endTime: Date | null;
  duration: number | null;
  createdAt: Date;
  relatedOutboundCallId?: string | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    patientHash: string;
    dob?: string;
    isMinor?: boolean;
    primaryPhone?: string;
    secondaryPhone?: string;
    externalIds?: Record<string, string>;
    metadata?: Record<string, unknown>;
    createdAt?: string | Date;
    updatedAt?: string | Date;
  } | null;
  campaignId?: string | null;
  campaign?: {
    id: string;
    name: string;
    config?: {
      analysis?: {
        campaign?: {
          fields?: Array<{
            key: string;
            label: string;
            type: string;
            required: boolean;
            isMainKPI?: boolean;
          }>;
        };
      };
    };
  } | null;
  analysis?: Record<string, any>;
};

interface CallsTableProps {
  initialData: {
    calls: any[];
    totalCount: number;
    hasMore: boolean;
  };
  callIdToView?: string;
}

export function CallsTable({ initialData, callIdToView }: CallsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedCallId, setSelectedCallId] = useState<string | null>(
    callIdToView || null,
  );

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Extract filters from URL search params
  const status = searchParams.get("status") || undefined;
  const direction = searchParams.get("direction") || undefined;
  const campaignId = searchParams.get("campaignId") || undefined;
  const dateRange = searchParams.get("dateRange") || undefined;

  const [filters, setFilters] = useState({
    status,
    direction,
    campaignId,
    dateRange,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebounce(searchQuery, 300);

  // Sync URL params when they change
  useEffect(() => {
    setFilters({
      status: searchParams.get("status") || undefined,
      direction: searchParams.get("direction") || undefined,
      campaignId: searchParams.get("campaignId") || undefined,
      dateRange: searchParams.get("dateRange") || undefined,
    });

    const newSearchQuery = searchParams.get("search") || "";
    if (newSearchQuery !== searchQuery) {
      setSearchQuery(newSearchQuery);
    }
  }, [searchParams, searchQuery]);

  // Function to reset filters
  const resetFilters = () => {
    setFilters({
      status: undefined,
      direction: undefined,
      campaignId: undefined,
      dateRange: undefined,
    });

    setSearchQuery("");

    // Reset URL params
    const url = new URL(window.location.href);

    // Explicitly delete all filter params
    const filterParams = [
      "status",
      "direction",
      "campaignId",
      "dateRange",
      "search",
    ];
    filterParams.forEach((param) => {
      url.searchParams.delete(param);
    });

    // Keep the callId if it exists
    const callId = searchParams.get("callId");
    if (callId) {
      url.searchParams.set("callId", callId);
    }

    // Preserve pagination params
    const limit = searchParams.get("limit");
    if (limit) {
      url.searchParams.set("limit", limit);
    }

    const offset = searchParams.get("offset");
    if (offset) {
      url.searchParams.set("offset", offset);
    }

    router.replace(`${pathname}${url.search}`, { scroll: false });
  };

  // Process date range filter
  const getDateRangeFilter = useCallback(() => {
    if (!dateRange || dateRange === "all") return {};

    const now = new Date();
    let startDate = new Date();
    let endDate: Date | undefined = undefined;

    switch (dateRange) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "yesterday":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setDate(now.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "week":
        startDate.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        startDate.setHours(0, 0, 0, 0);
        break;
      case "month":
        startDate.setDate(1); // Start of month
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        return {};
    }

    return { startDate, endDate };
  }, [dateRange]);

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    // Update URL with search parameter
    const url = new URL(window.location.href);
    if (value) {
      url.searchParams.set("search", value);
    } else {
      url.searchParams.delete("search");
    }

    // Preserve other params
    if (selectedCallId) {
      url.searchParams.set("callId", selectedCallId);
    }

    router.replace(url.pathname + url.search);
  };

  // Use our custom hook for fetching data
  const { data, isLoading, error, refetch } = useCalls({
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
    status: filters.status,
    direction: filters.direction,
    campaignId: filters.campaignId,
    search: debouncedSearch,
    ...getDateRangeFilter(),
  });

  // Manual refresh function
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Use initialData until we have data from the hook
  const displayData = data || initialData;

  // Handle row click to view call details
  const handleRowClick = (callId: string, event: React.MouseEvent) => {
    // Check if the click occurred on a button, link or other interactive element
    const target = event.target as HTMLElement;
    const isClickableElement = target.closest(
      "button, a, select, input, .data-table-no-click",
    );

    // Don't trigger row click if clicking on an interactive element
    if (isClickableElement) {
      return;
    }

    // Update URL preserving other search parameters
    const url = new URL(window.location.href);
    url.searchParams.set("callId", callId);
    router.replace(url.pathname + url.search, { scroll: false });

    setSelectedCallId(callId);
  };

  // Update URL when pagination changes
  useEffect(() => {
    const url = new URL(window.location.href);

    // Set pagination params
    url.searchParams.set("limit", pagination.pageSize.toString());
    url.searchParams.set(
      "offset",
      (pagination.pageIndex * pagination.pageSize).toString(),
    );

    // Preserve search params and callId
    if (searchQuery) {
      url.searchParams.set("search", searchQuery);
    }

    if (selectedCallId) {
      url.searchParams.set("callId", selectedCallId);
    }

    router.replace(url.pathname + url.search, { scroll: false });
  }, [pagination, router, pathname, selectedCallId, searchQuery]);

  // Format phone number for display
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return "N/A";

    // Basic formatting for US numbers
    if (phone.length === 10) {
      return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
    }

    if (phone.length === 11 && phone.startsWith("1")) {
      return `+1 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7)}`;
    }

    return phone;
  };

  // Format duration in mm:ss
  const formatDuration = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Define columns for the data table
  const columns: ColumnDef<Call>[] = [
    {
      accessorKey: "direction",
      header: "Direction",
      cell: ({ row }) => {
        const direction = row.getValue("direction") as Call["direction"];
        return (
          <div className="flex items-center gap-2">
            {direction === "inbound" ? (
              <>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-50 dark:bg-yellow-900/30">
                  <PhoneIncoming className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                </div>
                <span className="text-sm font-medium">Inbound</span>
              </>
            ) : (
              <>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-50 dark:bg-violet-900/30">
                  <PhoneOutgoing className="h-4 w-4 text-violet-600 dark:text-violet-500" />
                </div>
                <span className="text-sm font-medium">Outbound</span>
              </>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "patient",
      header: "Patient",
      cell: ({ row }) => {
        const patient = row.original.patient;

        if (!patient) {
          return (
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-muted">?</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm text-muted-foreground">Unknown</span>
              </div>
            </div>
          );
        }

        const initials = `${patient.firstName?.[0] || ""}${
          patient.lastName?.[0] || ""
        }`.toUpperCase();

        const name = `${patient.firstName} ${patient.lastName}`;
        const formattedPhone = formatPhoneNumber(patient.primaryPhone || "");

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex cursor-pointer items-center gap-3">
                  <Avatar className="border">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formattedPhone}
                    </span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" align="start" className="w-80 p-0">
                <Card className="border-0 shadow-none">
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-base">Patient Details</CardTitle>
                    <CardDescription className="text-xs">
                      More information about {name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2 p-3 pt-0">
                    <div className="grid grid-cols-3 items-center gap-4">
                      <span className="text-xs font-medium">Phone</span>
                      <span className="col-span-2 text-xs">
                        {formattedPhone}
                      </span>
                    </div>
                    {patient.dob && (
                      <div className="grid grid-cols-3 items-center gap-4">
                        <span className="text-xs font-medium">DOB</span>
                        <span className="col-span-2 text-xs">
                          {patient.dob}
                        </span>
                      </div>
                    )}
                    {patient.externalIds &&
                      Object.keys(patient.externalIds).length > 0 && (
                        <div className="grid grid-cols-3 items-center gap-4">
                          <span className="text-xs font-medium">
                            External IDs
                          </span>
                          <div className="col-span-2">
                            {Object.entries(patient.externalIds).map(
                              ([key, value]) => (
                                <div key={key} className="text-xs">
                                  <span className="font-medium">{key}:</span>{" "}
                                  {value}
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                    <div className="mt-2 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        asChild
                      >
                        <Link href={`/patients/${patient.id}`} prefetch={false}>
                          View Profile
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      accessorKey: "campaign",
      header: "Campaign",
      cell: ({ row }) => {
        const campaign = row.original.campaign;

        if (!campaign) {
          return <span className="text-sm text-muted-foreground">-</span>;
        }

        // Find main KPI if available
        const mainKpiField = campaign.config?.analysis?.campaign?.fields?.find(
          (field) => field.isMainKPI,
        );

        const mainKpiValue = mainKpiField
          ? row.original.analysis?.[mainKpiField.key]
          : null;

        const hasCallback =
          row.original.direction === "inbound" &&
          row.original.relatedOutboundCallId;

        return (
          <div className="max-w-[200px]">
            <div className="truncate text-sm font-medium">{campaign.name}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {mainKpiField && (
                <Badge
                  variant="blue_solid_outline"
                  className="px-1.5 py-0 text-xs font-normal"
                >
                  {mainKpiField.label}:{" "}
                  {typeof mainKpiValue === "boolean"
                    ? mainKpiValue
                      ? "Yes"
                      : "No"
                    : mainKpiValue || "N/A"}
                </Badge>
              )}
              {hasCallback && (
                <Badge
                  variant="yellow_solid_outline"
                  className="px-1.5 py-0 text-xs font-normal"
                >
                  Callback
                </Badge>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as Call["status"];
        const call = row.original;
        const hasAnalysisData =
          call.analysis && Object.keys(call.analysis).length > 0;

        // If the call has analysis data but status is still "in-progress",
        // we should display it as "completed" instead
        const displayStatus =
          status === "in-progress" && hasAnalysisData ? "completed" : status;

        let StatusIcon = Clock;
        let badgeVariant = "neutral_solid";
        let statusLabel = "";

        if (displayStatus === "pending") {
          StatusIcon = Clock;
          badgeVariant = "yellow_solid";
          statusLabel = "Pending";
        } else if (displayStatus === "in-progress") {
          StatusIcon = PhoneCall;
          badgeVariant = "blue_solid";
          statusLabel = "In Progress";
        } else if (displayStatus === "completed") {
          StatusIcon = Check;
          badgeVariant = "success_solid";
          statusLabel = "Completed";
        } else if (displayStatus === "failed") {
          StatusIcon = CircleAlert;
          badgeVariant = "failure_solid";
          statusLabel = "Failed";
        } else if (displayStatus === "voicemail") {
          StatusIcon = Phone;
          badgeVariant = "violet_solid";
          statusLabel = "Voicemail";
        } else if (displayStatus === "no-answer") {
          StatusIcon = CircleAlert;
          badgeVariant = "neutral_solid";
          statusLabel = "No Answer";
        }

        return (
          <Badge
            variant={badgeVariant as BadgeProps["variant"]}
            className="flex w-fit items-center gap-1 px-2 py-1"
          >
            <StatusIcon className="h-3 w-3" />
            {statusLabel}
          </Badge>
        );
      },
    },
    {
      accessorKey: "date",
      header: "Date & Time",
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt);
        return (
          <div className="flex flex-col">
            <span className="text-sm">{format(date, "MMM d, yyyy")}</span>
            <span className="text-xs text-muted-foreground">
              {format(date, "h:mm a")}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "duration",
      header: "Duration",
      cell: ({ row }) => {
        const duration = row.original.duration;
        return (
          <div className="font-mono text-sm">{formatDuration(duration)}</div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        return (
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="data-table-no-click h-8 w-8 rounded-full"
          >
            <Link
              href={`/calls?callId=${row.original.id}`}
              className="data-table-no-click"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">View details</span>
            </Link>
          </Button>
        );
      },
    },
  ];

  // Calculate total pages for pagination
  const totalPages = Math.ceil(displayData.totalCount / pagination.pageSize);
  const currentPage = pagination.pageIndex + 1;

  // Type check and convert the data to the required format
  const callsData = (displayData?.calls || []) as unknown as Call[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <CallsTableFilters />

        <div className="flex w-full gap-2 lg:w-auto">
          <div className="relative flex-1 lg:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name or phone..."
              className="w-full pl-9"
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            className="h-9 w-9 flex-shrink-0"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border shadow-sm">
        <CardContent className="p-0">
          {error ? (
            <div className="flex h-[300px] w-full flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 text-destructive">
                <CircleAlert className="h-12 w-12" />
              </div>
              <h3 className="text-lg font-medium">Error loading calls</h3>
              <p className="mt-2 max-w-md text-muted-foreground">
                {error.message ||
                  "There was an error loading the calls data. Please try again."}
              </p>
              <Button
                variant="outline"
                className="mt-6"
                onClick={handleRefresh}
              >
                Retry
              </Button>
            </div>
          ) : isLoading && !displayData?.calls.length ? (
            <div className="p-4">
              <CallsTableSkeleton />
            </div>
          ) : displayData?.calls.length === 0 ? (
            <div className="flex h-[300px] w-full flex-col items-center justify-center p-8 text-center">
              <Phone className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-medium">No calls found</h3>
              <p className="mt-2 max-w-md text-muted-foreground">
                No calls match your current filters. Try adjusting your filters
                or check back later.
              </p>
              <Button variant="outline" className="mt-6" onClick={resetFilters}>
                Reset Filters
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <DataTable
                  columns={columns}
                  data={displayData?.calls || []}
                  onRowClick={(row, event) => handleRowClick(row.id, event)}
                  rowClassName={(row) => {
                    const status = row?.original?.status;
                    let className = "";

                    // Status-based styling
                    if (status === "in-progress") {
                      className += "bg-yellow-50 dark:bg-yellow-900/20 ";
                    } else if (status === "completed") {
                      className +=
                        "hover:bg-green-50 dark:hover:bg-green-900/10 ";
                    }

                    // Add general hover effect
                    className += "hover:bg-accent/50 ";

                    return className.trim();
                  }}
                />
              </div>

              {/* Custom Enhanced Pagination */}
              <div className="border-t bg-background px-4 py-4">
                <div className="flex flex-col-reverse items-center justify-between gap-4 sm:flex-row">
                  {/* Page size and record info */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      Showing{" "}
                      {Math.min(
                        pagination.pageSize,
                        displayData?.calls.length || 0,
                      )}{" "}
                      of {displayData.totalCount} calls
                    </span>

                    <span className="mx-2">|</span>

                    <div className="flex items-center gap-2">
                      <span>Rows per page:</span>
                      <select
                        className="data-table-no-click h-8 w-16 rounded-md border border-input bg-background px-2 text-sm"
                        value={pagination.pageSize}
                        onChange={(e) => {
                          setPagination((prev) => ({
                            pageIndex: 0, // Reset to first page when changing page size
                            pageSize: Number(e.target.value),
                          }));
                        }}
                      >
                        {[5, 10, 20, 50, 100].map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Pagination controls */}
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() =>
                            setPagination((prev) => ({
                              ...prev,
                              pageIndex: Math.max(0, prev.pageIndex - 1),
                            }))
                          }
                          className={cn(
                            "data-table-no-click",
                            currentPage === 1 &&
                              "pointer-events-none opacity-50",
                          )}
                        />
                      </PaginationItem>

                      {/* First page */}
                      {currentPage > 3 && (
                        <PaginationItem>
                          <PaginationLink
                            onClick={() =>
                              setPagination((prev) => ({
                                ...prev,
                                pageIndex: 0,
                              }))
                            }
                            isActive={currentPage === 1}
                            className="data-table-no-click"
                          >
                            1
                          </PaginationLink>
                        </PaginationItem>
                      )}

                      {/* Ellipsis for start */}
                      {currentPage > 4 && (
                        <PaginationItem>
                          <PaginationEllipsis className="data-table-no-click" />
                        </PaginationItem>
                      )}

                      {/* Previous page if not first */}
                      {currentPage > 1 && currentPage <= totalPages && (
                        <PaginationItem>
                          <PaginationLink
                            onClick={() =>
                              setPagination((prev) => ({
                                ...prev,
                                pageIndex: prev.pageIndex - 1,
                              }))
                            }
                            className="data-table-no-click"
                          >
                            {currentPage - 1}
                          </PaginationLink>
                        </PaginationItem>
                      )}

                      {/* Current page */}
                      <PaginationItem>
                        <PaginationLink
                          isActive
                          className="data-table-no-click"
                        >
                          {currentPage}
                        </PaginationLink>
                      </PaginationItem>

                      {/* Next page if not last */}
                      {currentPage < totalPages && (
                        <PaginationItem>
                          <PaginationLink
                            onClick={() =>
                              setPagination((prev) => ({
                                ...prev,
                                pageIndex: prev.pageIndex + 1,
                              }))
                            }
                            className="data-table-no-click"
                          >
                            {currentPage + 1}
                          </PaginationLink>
                        </PaginationItem>
                      )}

                      {/* Ellipsis for end */}
                      {currentPage < totalPages - 3 && (
                        <PaginationItem>
                          <PaginationEllipsis className="data-table-no-click" />
                        </PaginationItem>
                      )}

                      {/* Last page */}
                      {totalPages > 1 && currentPage < totalPages - 2 && (
                        <PaginationItem>
                          <PaginationLink
                            onClick={() =>
                              setPagination((prev) => ({
                                ...prev,
                                pageIndex: totalPages - 1,
                              }))
                            }
                            className="data-table-no-click"
                          >
                            {totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      )}

                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            setPagination((prev) => ({
                              ...prev,
                              pageIndex: Math.min(
                                totalPages - 1,
                                prev.pageIndex + 1,
                              ),
                            }))
                          }
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Add missing utility function
function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

// Add skeleton loading state for better UX
function CallsTableSkeleton() {
  return (
    <div className="w-full animate-pulse">
      <div className="mb-4 grid grid-cols-7 gap-4 pb-2">
        {/* Header */}
        {Array(7)
          .fill(0)
          .map((_, i) => (
            <div key={i} className="h-6 rounded bg-muted"></div>
          ))}
      </div>

      {/* Rows */}
      {Array(5)
        .fill(0)
        .map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="mb-4 grid grid-cols-7 gap-4 border-b pb-4"
          >
            {Array(7)
              .fill(0)
              .map((_, colIdx) => (
                <div key={colIdx} className="flex items-center">
                  {colIdx === 1 ? (
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div>
                        <Skeleton className="mb-1 h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ) : colIdx === 3 ? (
                    <Skeleton className="h-6 w-24 rounded-full" />
                  ) : (
                    <Skeleton className="h-6 w-full max-w-32 rounded" />
                  )}
                </div>
              ))}
          </div>
        ))}
    </div>
  );
}
