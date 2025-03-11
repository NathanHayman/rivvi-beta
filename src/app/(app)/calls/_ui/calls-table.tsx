// src/app/(app)/calls/_components/calls-table.tsx
"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
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
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CallsTableFilters } from "./calls-table-filters";
import { CallsTablePagination } from "./calls-table-pagination";
import { CallsTableSearch } from "./calls-table-search";

// Define Call Type
type Call = {
  id: string;
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
    primaryPhone?: string;
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

  // Parse pagination params from URL
  const paramLimit = searchParams.get("limit");
  const paramOffset = searchParams.get("offset");

  // State for UI
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(
    callIdToView || null,
  );

  // Pagination state with defaults from URL
  const [pagination, setPagination] = useState({
    pageIndex: paramOffset
      ? Math.floor(
          parseInt(paramOffset, 10) /
            (paramLimit ? parseInt(paramLimit, 10) : 10),
        )
      : 0,
    pageSize: paramLimit ? parseInt(paramLimit, 10) : 10,
  });

  // Extract current filters from URL
  const currentFilters = useMemo(
    () => ({
      status: searchParams.get("status") || undefined,
      direction: searchParams.get("direction") || undefined,
      campaignId: searchParams.get("campaignId") || undefined,
      dateRange: searchParams.get("dateRange") || undefined,
      search: searchParams.get("search") || undefined,
    }),
    [searchParams],
  );

  // Process date range filter once
  const dateRangeFilter = useMemo(() => {
    if (!currentFilters.dateRange || currentFilters.dateRange === "all")
      return {};

    const now = new Date();
    let startDate = new Date();
    let endDate: Date | undefined = undefined;

    switch (currentFilters.dateRange) {
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
  }, [currentFilters.dateRange]);

  // Use the custom hook for data fetching with memoized parameters
  const { data, isLoading, error, refetch } = useCalls({
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
    status: currentFilters.status,
    direction: currentFilters.direction,
    campaignId: currentFilters.campaignId,
    search: currentFilters.search,
    ...dateRangeFilter,
  });

  // Memoized display data
  const displayData = useMemo(() => data || initialData, [data, initialData]);

  // Manual refresh with debounce to prevent excessive refreshes
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return; // Prevent multiple refreshes

    setIsRefreshing(true);
    await refetch();

    // Reset the refreshing state after a minimum delay to prevent flicker
    setTimeout(() => setIsRefreshing(false), 500);
  }, [refetch, isRefreshing]);

  // Handle row click to view call details
  const handleRowClick = useCallback(
    (callId: string, event: React.MouseEvent) => {
      // Don't trigger row click if clicking on a button, link or other interactive element
      const target = event.target as HTMLElement;
      const isClickableElement = target.closest(
        "button, a, select, input, .data-table-no-click",
      );

      if (isClickableElement) return;

      // Update URL with callId while preserving other search parameters
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set("callId", callId);

      router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });
      setSelectedCallId(callId);
    },
    [router, pathname, searchParams],
  );

  // Reset filters callback
  const resetFilters = useCallback(() => {
    // Create new params from current, removing filter params
    const newParams = new URLSearchParams();

    // Copy over non-filter params
    const paramsToKeep = ["limit", "offset", "callId"];
    paramsToKeep.forEach((param) => {
      const value = searchParams.get(param);
      if (value) newParams.set(param, value);
    });

    // Update URL with cleaned params
    router.replace(
      `${pathname}${newParams.toString() ? `?${newParams.toString()}` : ""}`,
      {
        scroll: false,
      },
    );
  }, [router, pathname, searchParams]);

  // Update URL when pagination changes (but not on initial render)
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set("limit", pagination.pageSize.toString());
    params.set(
      "offset",
      (pagination.pageIndex * pagination.pageSize).toString(),
    );

    // Only update URL if pagination actually changed
    const currentLimit = searchParams.get("limit");
    const currentOffset = searchParams.get("offset");

    if (
      currentLimit !== pagination.pageSize.toString() ||
      currentOffset !== (pagination.pageIndex * pagination.pageSize).toString()
    ) {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [pagination, router, pathname, searchParams]);

  // Helper to format phone number for display
  const formatPhoneNumber = useCallback((phone: string) => {
    if (!phone) return "N/A";

    // Basic formatting for US numbers
    if (phone.length === 10) {
      return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
    }

    if (phone.length === 11 && phone.startsWith("1")) {
      return `+1 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7)}`;
    }

    return phone;
  }, []);

  // Format duration in mm:ss
  const formatDuration = useCallback((seconds: number | null) => {
    if (seconds === null || seconds === undefined) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Memoized columns definition to prevent rerenders
  const columns = useMemo<ColumnDef<Call>[]>(
    () => [
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
                  <div className="rounded-md border p-3">
                    <div className="mb-2 text-base font-medium">{name}</div>
                    <div className="grid gap-1 text-sm">
                      <div className="grid grid-cols-3 items-center gap-4">
                        <span className="text-xs font-medium">Phone</span>
                        <span className="col-span-2 text-xs">
                          {formattedPhone}
                        </span>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 text-xs"
                          asChild
                        >
                          <Link
                            href={`/patients/${patient.id}`}
                            prefetch={false}
                          >
                            View Profile
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
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
          const mainKpiField =
            campaign.config?.analysis?.campaign?.fields?.find(
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
              <div className="truncate text-sm font-medium">
                {campaign.name}
              </div>
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
          let badgeVariant: any = "neutral_solid";
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
              variant={badgeVariant}
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
    ],
    [formatDuration, formatPhoneNumber],
  );

  // Calculate total pages for pagination
  const totalPages = Math.ceil(displayData.totalCount / pagination.pageSize);

  // Type check and convert the data to the required format
  const callsData = (displayData?.calls || []) as unknown as Call[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <CallsTableFilters />

        <div className="flex w-full gap-2 lg:w-auto">
          <CallsTableSearch />

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

      <Card className="overflow-hidden shadow-sm">
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
                  data={callsData}
                  onRowClick={(row, event) => handleRowClick(row.id, event)}
                  rowClassName={(row) => {
                    const status = row.status;
                    let className = "";

                    // Status-based styling
                    if (status === "in-progress") {
                      className += "bg-yellow-50/50 dark:bg-yellow-900/20 ";
                    }

                    // Add general hover effect
                    className += "hover:bg-accent/50 ";

                    return className.trim();
                  }}
                />
              </div>

              {/* Custom Pagination */}
              <CallsTablePagination
                currentPage={pagination.pageIndex + 1}
                pageSize={pagination.pageSize}
                totalPages={totalPages}
                totalCount={displayData.totalCount}
                onPageChange={(page) =>
                  setPagination((prev) => ({
                    ...prev,
                    pageIndex: page - 1,
                  }))
                }
                onPageSizeChange={(size) =>
                  setPagination({
                    pageIndex: 0,
                    pageSize: size,
                  })
                }
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
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
