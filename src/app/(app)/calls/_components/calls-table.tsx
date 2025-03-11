"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCalls } from "@/hooks/calls/use-calls";
import { cn } from "@/lib/utils";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  Check,
  CircleAlert,
  Clock,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
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
    pageSize: 10, // Changed to 10 for better visual design
  });

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
  const [debouncedSearch] = useDebounce(searchQuery, 500);

  // Function to reset filters
  const resetFilters = () => {
    setFilters({
      status: undefined,
      direction: undefined,
      campaignId: undefined,
      dateRange: undefined,
    });

    // Reset URL params
    const url = new URL(window.location.href);
    url.searchParams.delete("status");
    url.searchParams.delete("direction");
    url.searchParams.delete("campaignId");
    url.searchParams.delete("dateRange");

    // Keep the callId if it exists
    const callId = searchParams.get("callId");
    if (callId) {
      url.searchParams.set("callId", callId);
    }

    router.replace(url.pathname + url.search);
  };

  // Process date range filter
  const getDateRangeFilter = useCallback(() => {
    if (!dateRange || dateRange === "all") return {};

    const now = new Date();
    let startDate = new Date();

    switch (dateRange) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
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

    return { startDate };
  }, [dateRange]);

  // Use our custom hook for fetching data
  const { data, isLoading, error } = useCalls({
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
    status: filters.status,
    direction: filters.direction,
    campaignId: filters.campaignId,
    search: debouncedSearch,
    ...getDateRangeFilter(),
  });

  // Use initialData until we have data from the hook
  const displayData = data || initialData;

  // Handle row click to view call details
  const handleRowClick = (callId: string) => {
    // Update URL without triggering navigation
    const url = new URL(window.location.href);
    url.searchParams.set("callId", callId);
    router.replace(url.pathname + url.search);

    setSelectedCallId(callId);
  };

  // Update URL when pagination or filters change
  useEffect(() => {
    const url = new URL(window.location.href);

    // Set pagination params
    url.searchParams.set("limit", pagination.pageSize.toString());
    url.searchParams.set(
      "offset",
      (pagination.pageIndex * pagination.pageSize).toString(),
    );

    // Set filter params
    if (filters.status) {
      url.searchParams.set("status", filters.status);
    } else {
      url.searchParams.delete("status");
    }

    if (filters.direction) {
      url.searchParams.set("direction", filters.direction);
    } else {
      url.searchParams.delete("direction");
    }

    if (filters.campaignId) {
      url.searchParams.set("campaignId", filters.campaignId);
    } else {
      url.searchParams.delete("campaignId");
    }

    if (filters.dateRange) {
      url.searchParams.set("dateRange", filters.dateRange);
    } else {
      url.searchParams.delete("dateRange");
    }

    // Preserve callId if present
    if (selectedCallId) {
      url.searchParams.set("callId", selectedCallId);
    }

    router.replace(url.pathname + url.search);
  }, [pagination, filters, router, pathname, selectedCallId]);

  // Format phone number
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return "N/A";

    // Basic formatting for US numbers - adjust as needed
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
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
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
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-50 dark:bg-yellow-900/30">
                <PhoneIncoming className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
              </div>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-50 dark:bg-violet-900/30">
                <PhoneOutgoing className="h-4 w-4 text-violet-600 dark:text-violet-500" />
              </div>
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
          <div className="max-w-[180px]">
            <div className="truncate text-sm font-medium">{campaign.name}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {mainKpiField && (
                <Badge
                  variant="outline"
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
                  variant="outline"
                  className="border-yellow-200 bg-yellow-50 px-1.5 py-0 text-xs font-normal text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400"
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
        let badgeVariant = "";
        let statusLabel = "";

        if (displayStatus === "pending") {
          StatusIcon = Clock;
          badgeVariant =
            "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800";
          statusLabel = "Pending";
        } else if (displayStatus === "in-progress") {
          StatusIcon = PhoneCall;
          badgeVariant =
            "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800";
          statusLabel = "In Progress";
        } else if (displayStatus === "completed") {
          StatusIcon = Check;
          badgeVariant =
            "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800";
          statusLabel = "Completed";
        } else if (displayStatus === "failed") {
          StatusIcon = CircleAlert;
          badgeVariant =
            "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800";
          statusLabel = "Failed";
        } else if (displayStatus === "voicemail") {
          StatusIcon = Phone;
          badgeVariant =
            "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800";
          statusLabel = "Voicemail";
        } else if (displayStatus === "no-answer") {
          StatusIcon = CircleAlert;
          badgeVariant =
            "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800";
          statusLabel = "No Answer";
        }

        return (
          <Badge
            variant="outline"
            className={cn("flex items-center gap-1 px-2 py-1", badgeVariant)}
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
            className="h-8 w-8 rounded-full"
          >
            <Link href={`/calls?callId=${row.original.id}`}>
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
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row">
        <CallsTableFilters />

        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name or phone..."
            className="w-full pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card>
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
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
            </div>
          ) : isLoading && !displayData?.calls.length ? (
            <div className="flex h-[300px] w-full items-center justify-center p-8">
              <div className="flex flex-col items-center">
                <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading calls data...</p>
              </div>
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
              <DataTable
                columns={columns}
                data={displayData?.calls || []}
                onRowClick={(row) => handleRowClick(row.id)}
                rowClassName={(row) => {
                  if (row.original.campaignId) {
                    return "border-b";
                  }
                  return "";
                }}
              />

              {/* Custom Enhanced Pagination */}
              <div className="px-2 py-4">
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
                        className={
                          currentPage === 1
                            ? "pointer-events-none opacity-50"
                            : ""
                        }
                      />
                    </PaginationItem>

                    {/* First page */}
                    {currentPage > 3 && (
                      <PaginationItem>
                        <PaginationLink
                          onClick={() =>
                            setPagination((prev) => ({ ...prev, pageIndex: 0 }))
                          }
                          isActive={currentPage === 1}
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>
                    )}

                    {/* Ellipsis for start */}
                    {currentPage > 4 && (
                      <PaginationItem>
                        <PaginationEllipsis />
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
                        >
                          {currentPage - 1}
                        </PaginationLink>
                      </PaginationItem>
                    )}

                    {/* Current page */}
                    <PaginationItem>
                      <PaginationLink isActive>{currentPage}</PaginationLink>
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
                        >
                          {currentPage + 1}
                        </PaginationLink>
                      </PaginationItem>
                    )}

                    {/* Ellipsis for end */}
                    {currentPage < totalPages - 3 && (
                      <PaginationItem>
                        <PaginationEllipsis />
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
                        className={
                          currentPage === totalPages
                            ? "pointer-events-none opacity-50"
                            : ""
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>

                {/* Page size and record info */}
                <div className="mt-4 flex items-center justify-between px-2">
                  <div className="text-sm text-muted-foreground">
                    Showing{" "}
                    {Math.min(
                      pagination.pageSize,
                      displayData?.calls.length || 0,
                    )}{" "}
                    of {displayData.totalCount} calls
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Rows per page:
                    </span>
                    <select
                      className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm"
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
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
