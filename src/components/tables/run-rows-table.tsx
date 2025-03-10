"use client";

// src/components/runs/run-rows-table.tsx
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  InfoIcon,
  Phone,
  RefreshCw,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRun } from "@/hooks/runs/use-runs";
import { useRunEvents } from "@/hooks/use-run-events";
import { cn } from "@/lib/utils";
import { fetchRunRows } from "@/server/actions/rows";
import { formatPhoneDisplay } from "@/services/outdated/file/utils";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type RowStatus = "pending" | "calling" | "completed" | "failed" | "skipped";

// Row type definition based on your DB schema
type Row = {
  id: string;
  runId: string;
  orgId: string;
  patientId: string | null;
  variables: Record<string, unknown>;
  processedVariables?: Record<string, unknown>;
  analysis?: Record<string, unknown> | null;
  status: RowStatus;
  error?: string | null;
  retellCallId?: string | null;
  sortIndex: number;
  priority?: number;
  batchEligible?: boolean;
  retryCount?: number;
  callAttempts?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string | null;
  patient?: {
    id: string;
    patientHash: string;
    secondaryHash?: string;
    normalizedPhone?: string;
    firstName: string;
    lastName: string;
    dob: string;
    isMinor?: boolean;
    primaryPhone: string;
    secondaryPhone?: string;
    externalIds?: Record<string, string>;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string | null;
  } | null;
};

interface RunRowsTableProps {
  runId: string;
}

export function RunRowsTable({ runId }: RunRowsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "sortIndex", desc: false },
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [totalRows, setTotalRows] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // Get basic run info
  const { run: runData, isLoading: isRunLoading } = useRun(runId);

  // Format variable labels for display
  function formatVariableLabel(key: string): string {
    // Convert camelCase to Title Case with spaces
    return key
      .replace(/([A-Z])/g, " $1") // Insert a space before all capital letters
      .replace(/^./, (str) => str.toUpperCase()) // Capitalize the first letter
      .replace(/_/g, " ") // Replace underscores with spaces
      .trim();
  }

  // Format variable values for display
  function formatVariableValue(value: unknown): string {
    if (value === null || value === undefined) {
      return "—";
    }

    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    return String(value);
  }

  // Helper function to get the main campaign variable to display
  function getCampaignMainVariable(variables: Record<string, unknown>) {
    // Priority list of variables to check
    const priorityKeys = [
      "appointmentType",
      "appointment_type",
      "appointmentDateTime",
      "appointment_date_time",
      "appointmentDate",
      "appointment_date",
      "procedure",
      "procedureType",
      "procedure_type",
      "reason",
      "reasonForVisit",
      "reason_for_visit",
    ];

    // Check if any priority keys exist
    for (const key of priorityKeys) {
      if (
        key in variables &&
        variables[key] !== undefined &&
        variables[key] !== null &&
        variables[key] !== ""
      ) {
        return {
          key,
          value: `${formatVariableLabel(key)}: ${formatVariableValue(variables[key])}`,
        };
      }
    }

    // If no priority keys found, return the first non-empty field
    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined && value !== null && value !== "") {
        return {
          key,
          value: `${formatVariableLabel(key)}: ${formatVariableValue(value)}`,
        };
      }
    }

    // If no fields found, return default
    return {
      key: "",
      value: "No data",
    };
  }

  // Fetch row data from the server - memoize to prevent infinite renders
  const fetchData = useCallback(
    async (isInitialLoad = false) => {
      if (isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsRefetching(true);
      }

      try {
        const data = await fetchRunRows({
          runId,
          limit: pagination.pageSize,
          offset: pagination.pageIndex * pagination.pageSize,
          filter: searchQuery || undefined,
        });

        setRows((prev) => {
          // If we have the same number of rows and the same IDs, merge the data instead of replacing
          if (prev.length === data.rows.length && !isInitialLoad) {
            return data.rows.map((newRow, index) => {
              const prevRow = prev.find((r) => r.id === newRow.id);
              if (prevRow) {
                // Keep existing row reference if nothing changed to prevent re-renders
                if (JSON.stringify(prevRow) === JSON.stringify(newRow)) {
                  return prevRow;
                }
                return newRow;
              }
              return newRow;
            });
          }
          // Otherwise just replace with the new data
          return data.rows || [];
        });

        setTotalRows(data.pagination?.totalItems || 0);
        setError(null);
      } catch (err) {
        console.error("Error fetching run rows:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to fetch rows"),
        );
      } finally {
        setIsLoading(false);
        setIsRefetching(false);
      }
    },
    [runId, pagination.pageIndex, pagination.pageSize, searchQuery],
  );

  // Initial data fetch
  useEffect(() => {
    fetchData(true);
  }, [fetchData, refreshKey]);

  // Debounce search query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, fetchData]);

  // Memoized event handlers to prevent recreation on each render
  const handleCallStarted = useCallback((data) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === data.rowId
          ? {
              ...row,
              status: "calling" as RowStatus,
              retellCallId: data.callId,
              metadata: {
                ...row.metadata,
                lastCallTime: new Date().toISOString(),
                callDispatched: true,
              },
            }
          : row,
      ),
    );
  }, []);

  const handleCallCompleted = useCallback((data) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === data.rowId
          ? {
              ...row,
              status: data.status as RowStatus,
              analysis: data.analysis || row.analysis,
              metadata: {
                ...row.metadata,
                ...(data.metadata || {}),
                completedAt: new Date().toISOString(),
              },
            }
          : row,
      ),
    );
  }, []);

  const handleCallFailed = useCallback((data) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === data.rowId
          ? {
              ...row,
              status: "failed" as RowStatus,
              error: data.error,
              metadata: {
                ...row.metadata,
                lastError: data.error,
                lastErrorAt: new Date().toISOString(),
              },
            }
          : row,
      ),
    );
  }, []);

  // Set up real-time updates with Pusher
  useRunEvents(
    runId,
    {
      onCallStarted: handleCallStarted,
      onCallCompleted: handleCallCompleted,
      onCallFailed: handleCallFailed,
    },
    { enabled: !!runId },
  );

  // Refresh data periodically as a fallback - but don't re-render the entire table
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchData(false); // Pass false to indicate this is a background refresh
    }, 30000);
    return () => clearInterval(refreshInterval);
  }, [fetchData]);

  // Get campaign variables from the run's campaign
  const campaignVariables = useMemo(
    () => runData?.campaign?.config?.variables?.campaign?.fields || [],
    [runData?.campaign?.config?.variables?.campaign?.fields],
  );

  // Get campaign analysis fields and find the main KPI
  const campaignAnalysisFields = useMemo(
    () => runData?.campaign?.config?.analysis?.campaign?.fields || [],
    [runData?.campaign?.config?.analysis?.campaign?.fields],
  );

  const mainKpiField = useMemo(
    () => campaignAnalysisFields.find((field) => field.isMainKPI),
    [campaignAnalysisFields],
  );

  // Define columns with memoization to prevent re-renders
  const columns = useMemo(() => {
    const cols: ColumnDef<Row>[] = [
      {
        accessorKey: "patient",
        header: "Patient",
        size: 220,
        cell: ({ row }) => {
          const patient = row.original.patient;
          const variables = row.original.variables || {};

          // Extract patient data from either the patient object or variables
          const firstName = patient?.firstName || variables.firstName || "";
          const lastName = patient?.lastName || variables.lastName || "";
          const phoneNumber =
            patient?.primaryPhone ||
            variables.primaryPhone ||
            variables.phoneNumber ||
            variables.phone ||
            "No phone";

          const name =
            firstName && lastName ? `${firstName} ${lastName}` : "Unknown";

          const initials =
            firstName && lastName
              ? `${String(firstName).charAt(0)}${String(lastName).charAt(0)}`
              : "?";

          // Format the phone number for display
          const formattedPhone = phoneNumber
            ? formatPhoneDisplay(String(phoneNumber))
            : "No phone";

          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 bg-primary/10">
                <AvatarFallback className="text-sm font-medium text-primary/80">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{name}</div>
                <div className="text-xs text-muted-foreground">
                  {formattedPhone}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 120,
        cell: ({ row }) => {
          const status = row.getValue("status") as RowStatus;

          // Define status badges
          const statusMap = {
            pending: {
              label: "Pending",
              className: "bg-gray-100 text-gray-700",
            },
            calling: {
              label: "Calling",
              className: "bg-orange-100 text-orange-700",
            },
            completed: {
              label: "Completed",
              className: "bg-green-100 text-green-700",
            },
            failed: {
              label: "Failed",
              className: "bg-red-100 text-red-700",
            },
            skipped: {
              label: "Skipped",
              className: "bg-blue-100 text-blue-700",
            },
          };

          const statusInfo = statusMap[status] || statusMap.pending;

          // Show animated pulse for calling status
          const isAnimated = status === "calling";

          return (
            <Badge
              variant="outline"
              className={cn(
                "rounded-full border-0 px-2.5 py-0.5 font-normal",
                statusInfo.className,
                isAnimated && "animate-pulse",
              )}
            >
              {statusInfo.label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "campaignData",
        header: "Campaign Data",
        size: 250,
        cell: ({ row }) => {
          const variables = row.original.variables || {};
          const processedVariables = row.original.processedVariables || {};

          // Combine all variables for display
          const allVariables = { ...variables, ...processedVariables };

          // Find the main campaign variable to display
          // For example, look for appointment type or other important variable
          const mainVar = getCampaignMainVariable(allVariables);

          return (
            <Popover>
              <PopoverTrigger asChild>
                <div className="flex max-w-full cursor-pointer items-center">
                  <div className="truncate text-sm">{mainVar.value}</div>
                  <InfoIcon className="ml-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0" align="start">
                <div className="border-b border-border bg-muted/30 px-4 py-3">
                  <h4 className="text-sm font-medium">Campaign Variables</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Data variables for this call
                  </p>
                </div>
                <div className="max-h-[400px] overflow-y-auto p-4">
                  {Object.entries(allVariables).length > 0 ? (
                    <div className="grid gap-2">
                      {Object.entries(allVariables).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-3 gap-2 py-1">
                          <span className="text-sm font-medium">{key}</span>
                          <span className="col-span-2 break-words text-sm">
                            {formatVariableValue(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No campaign variables available
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          );
        },
      },
      // Add main KPI column or appointment confirmed column
      mainKpiField
        ? {
            accessorKey: "mainKpi",
            header: "Appt Confirmed",
            size: 150,
            cell: ({ row }) => {
              const analysis = row.original.analysis;

              if (!analysis) {
                return (
                  <span className="text-sm text-muted-foreground">No data</span>
                );
              }

              // Get the value from the analysis data
              const value = analysis[mainKpiField.key];

              if (value === undefined) {
                return <span className="text-sm">-</span>;
              }

              // Format the value based on type
              if (
                typeof value === "boolean" ||
                value === "true" ||
                value === "false"
              ) {
                const isPositive = value === true || value === "true";
                return (
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-0 font-normal",
                      isPositive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700",
                    )}
                  >
                    {isPositive ? "Yes" : "No"}
                  </Badge>
                );
              }

              return <span className="text-sm">{String(value)}</span>;
            },
          }
        : {
            accessorKey: "appointmentConfirmed",
            header: "Appt Confirmed",
            size: 150,
            cell: () => {
              return (
                <span className="text-sm text-muted-foreground">No data</span>
              );
            },
          },
      {
        accessorKey: "outcome",
        header: "Call Outcome",
        size: 150,
        cell: ({ row }) => {
          const analysis = row.original.analysis;
          const status = row.original.status;

          if (status === "pending" || status === "calling") {
            return (
              <span className="text-sm text-muted-foreground">Waiting...</span>
            );
          }

          if (status === "failed") {
            return (
              <Badge
                variant="outline"
                className="border-0 bg-red-100 font-normal text-red-700"
              >
                Failed
              </Badge>
            );
          }

          if (!analysis) {
            return (
              <span className="text-sm text-muted-foreground">No data</span>
            );
          }

          // Try to find the main outcome
          let outcomeText = "Unknown";

          // Common post-call fields to check
          const fieldsToCheck = [
            "appointment_confirmed",
            "appointmentConfirmed",
            "patient_reached",
            "patientReached",
            "voicemail_left",
            "voicemailLeft",
            "successful",
            "call_successful",
          ];

          // Check for boolean outcomes
          for (const field of fieldsToCheck) {
            if (field in analysis && typeof analysis[field] !== "undefined") {
              const value = analysis[field];
              const isPositive =
                value === true || value === "true" || value === "yes";
              outcomeText = isPositive ? "Successful" : "Unsuccessful";

              // If the field is about voicemail, show special outcome
              if (
                field.includes("voicemail") &&
                (value === true || value === "true" || value === "yes")
              ) {
                outcomeText = "Voicemail";
              }

              break;
            }
          }

          // Check for string status outcomes
          if (outcomeText === "Unknown" && "outcome" in analysis) {
            outcomeText = String(analysis.outcome);
          }

          // Style the outcome appropriately
          let badgeClass = "bg-gray-100 text-gray-700";

          if (outcomeText.toLowerCase().includes("success")) {
            badgeClass = "bg-green-100 text-green-700";
          } else if (outcomeText.toLowerCase().includes("unsuccess")) {
            badgeClass = "bg-red-100 text-red-700";
          } else if (outcomeText.toLowerCase().includes("voicemail")) {
            badgeClass = "bg-yellow-100 text-yellow-700";
          }

          return (
            <Badge
              variant="outline"
              className={cn("border-0 font-normal", badgeClass)}
            >
              {outcomeText}
            </Badge>
          );
        },
      },
      {
        accessorKey: "actions",
        header: "Actions",
        size: 160,
        cell: ({ row }) => {
          const patientId = row.original.patientId;
          const rowId = row.original.id;
          const callId =
            row.original.metadata?.lastCallId || row.original.retellCallId;

          // Create the call details URL - using search params as specified
          const callDetailsUrl = callId
            ? `/calls?runId=${runId}&rowId=${rowId}${callId ? `&callId=${callId}` : ""}`
            : null;

          return (
            <div className="flex items-center gap-2">
              {patientId && (
                <Link href={`/patients/${patientId}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
                  >
                    <User className="mr-1.5 h-3.5 w-3.5" />
                    Patient
                  </Button>
                </Link>
              )}
              {callDetailsUrl && (
                <Link href={callDetailsUrl}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
                  >
                    <Phone className="mr-1.5 h-3.5 w-3.5" />
                    Details
                  </Button>
                </Link>
              )}
            </div>
          );
        },
      },
    ];

    return cols as ColumnDef<Row>[];
  }, [mainKpiField, runId]);

  // Memoize pagination state to prevent infinite re-renders
  const paginationState = useMemo(
    () => ({
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
    }),
    [pagination.pageIndex, pagination.pageSize],
  );

  // Memoize pagination handlers
  const handlePaginationChange = useCallback((updater) => {
    setPagination(updater);
  }, []);

  const handlePreviousPage = useCallback(() => {
    setPagination((prev) => ({
      ...prev,
      pageIndex: Math.max(0, prev.pageIndex - 1),
    }));
  }, []);

  const handleNextPage = useCallback(() => {
    setPagination((prev) => ({
      ...prev,
      pageIndex: prev.pageIndex + 1,
    }));
  }, []);

  const handleSearchChange = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleRefreshClick = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  // Create a table instance with memoized options
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      pagination: paginationState,
    },
    onPaginationChange: handlePaginationChange,
    manualPagination: true,
    defaultColumn: {
      size: 150,
    },
  });

  return (
    <div className="space-y-5">
      {/* Search and refresh controls */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex w-full max-w-sm items-center space-x-2">
          <Input
            placeholder="Search rows..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="h-9"
          />
          <Button
            variant="outline"
            size="sm"
            className="flex aspect-square h-9 items-center justify-center p-0"
            onClick={handleRefreshClick}
            disabled={isLoading || isRefetching}
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                (isLoading || isRefetching) && "animate-spin",
              )}
            />
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Table container with overflow handling */}
      <div className="overflow-hidden rounded-md border border-border">
        <div className="relative">
          {/* Table wrapper with controlled overflow */}
          <div className="w-full overflow-x-auto">
            <Table className="w-full border-collapse">
              <TableHeader className="bg-muted/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="h-10 px-4 text-xs font-medium text-muted-foreground"
                        style={{
                          width: header.getSize(),
                          minWidth: header.getSize(),
                        }}
                      >
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
                  // Show skeletons during initial loading
                  Array.from({ length: pagination.pageSize }).map(
                    (_, index) => (
                      <TableRow
                        key={`skeleton-${index}`}
                        className="hover:bg-muted/30"
                      >
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-3 w-16" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Skeleton className="h-4 w-36" />
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Skeleton className="h-6 w-16" />
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Skeleton className="h-6 w-24" />
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex gap-2">
                            <Skeleton className="h-8 w-20" />
                            <Skeleton className="h-8 w-20" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ),
                  )
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No rows found
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className="border-b border-border/50 px-4 py-3"
                          style={{
                            width: cell.column.getSize(),
                            minWidth: cell.column.getSize(),
                          }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Background refetch indicator */}
          {isRefetching && !isLoading && (
            <div className="absolute right-2 top-2">
              <Badge
                variant="outline"
                className="border border-border bg-white"
              >
                <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                Updating...
              </Badge>
            </div>
          )}
        </div>

        {/* Pagination footer */}
        {totalRows > 0 && (
          <div className="flex items-center justify-between border-t border-border p-4">
            <div className="text-xs text-muted-foreground">
              Showing{" "}
              {Math.min(
                rows.length,
                1 + pagination.pageIndex * pagination.pageSize,
              )}{" "}
              to{" "}
              {Math.min(
                totalRows,
                (pagination.pageIndex + 1) * pagination.pageSize,
              )}{" "}
              of {totalRows} rows
            </div>
            <div className="flex items-center">
              <div className="flex items-center space-x-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={
                    pagination.pageIndex === 0 || isLoading || isRefetching
                  }
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="mx-2 text-xs font-medium">
                  Page {pagination.pageIndex + 1} of{" "}
                  {Math.ceil(totalRows / pagination.pageSize) || 1}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={
                    pagination.pageIndex ===
                      Math.ceil(totalRows / pagination.pageSize) - 1 ||
                    totalRows === 0 ||
                    isLoading ||
                    isRefetching
                  }
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
