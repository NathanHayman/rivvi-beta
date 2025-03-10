"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  Check,
  CircleAlert,
  Clock,
  ExternalLink,
  InfoIcon,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Search,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { useCalls } from "@/hooks/calls/use-calls";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
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
    pageSize: 50,
  });

  // Extract filters from URL search params
  const status = searchParams.get("status") || undefined;
  const direction = searchParams.get("direction") || undefined;

  const [filters, setFilters] = useState({
    status,
    direction,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebounce(searchQuery, 500);

  // Function to reset filters
  const resetFilters = () => {
    setFilters({
      status: undefined,
      direction: undefined,
    });

    // Reset URL params
    const url = new URL(window.location.href);
    url.searchParams.delete("status");
    url.searchParams.delete("direction");
    url.searchParams.delete("campaignId");

    // Keep the callId if it exists
    const callId = searchParams.get("callId");
    if (callId) {
      url.searchParams.set("callId", callId);
    }

    router.replace(url.pathname + url.search);
  };

  // Use our custom hook for fetching data
  const { data, isLoading, error } = useCalls({
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
    status: filters.status,
    direction: filters.direction,
    search: debouncedSearch,
  });

  // Use initialData until we have data from the hook
  const displayData = data || initialData;

  // Add console logging for debugging
  useEffect(() => {
    if (error) {
      console.error("Error fetching calls:", error);
    }
    console.log("Display data:", displayData);
  }, [displayData, error]);

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

    // Preserve callId if present
    if (selectedCallId) {
      url.searchParams.set("callId", selectedCallId);
    }

    router.replace(url.pathname + url.search);
  }, [pagination, filters, router, pathname, selectedCallId]);

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
                <PhoneIncoming className="h-5 w-5 fill-yellow-50 text-yellow-500 dark:fill-yellow-400/20 dark:text-yellow-500" />
                <span>Inbound</span>
              </>
            ) : (
              <>
                <PhoneOutgoing className="h-5 w-5 fill-violet-50 text-violet-500 dark:fill-violet-400/20 dark:text-violet-500" />
                <span>Outbound</span>
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
          return <span className="text-muted-foreground">Unknown Patient</span>;
        }

        const initials = `${patient.firstName?.[0] || ""}${
          patient.lastName?.[0] || ""
        }`.toUpperCase();

        const name = `${patient.firstName} ${patient.lastName}`;
        const formattedPhone = patient.primaryPhone || "No phone";

        return (
          <Popover>
            <PopoverTrigger asChild>
              <div className="flex cursor-pointer items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formattedPhone}
                  </div>
                </div>
                <InfoIcon className="ml-1 h-4 w-4 text-muted-foreground" />
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">Patient Details</h4>
                  <div className="text-sm text-muted-foreground">
                    Complete information about this patient.
                  </div>
                </div>
                <div className="grid gap-2">
                  <div className="grid grid-cols-3 items-center gap-4">
                    <span className="text-sm font-medium">Name</span>
                    <span className="col-span-2 text-sm">{name}</span>
                  </div>
                  <div className="grid grid-cols-3 items-center gap-4">
                    <span className="text-sm font-medium">Phone</span>
                    <span className="col-span-2 text-sm">{formattedPhone}</span>
                  </div>
                  {patient.dob && (
                    <div className="grid grid-cols-3 items-center gap-4">
                      <span className="text-sm font-medium">DOB</span>
                      <span className="col-span-2 text-sm">{patient.dob}</span>
                    </div>
                  )}
                  {patient.externalIds &&
                    Object.keys(patient.externalIds).length > 0 && (
                      <div className="grid grid-cols-3 items-center gap-4">
                        <span className="text-sm font-medium">
                          External IDs
                        </span>
                        <div className="col-span-2">
                          {Object.entries(patient.externalIds).map(
                            ([key, value]) => (
                              <div key={key} className="text-sm">
                                <span className="font-medium">{key}:</span>{" "}
                                {value}
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  <div className="mt-2 flex justify-end">
                    <Link
                      href={`/patients/${patient.id}`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "gap-1",
                      )}
                    >
                      View Profile
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        );
      },
    },
    {
      accessorKey: "campaign",
      header: "Campaign",
      cell: ({ row }) => {
        const campaign = row.original.campaign;

        if (!campaign) {
          return <span className="text-muted-foreground">No Campaign</span>;
        }

        // Find main KPI if available
        const mainKpiField = campaign.config?.analysis?.campaign?.fields?.find(
          (field) => field.isMainKPI,
        );

        const mainKpiValue = mainKpiField
          ? row.original.analysis?.[mainKpiField.key]
          : null;

        return (
          <div>
            <div className="font-medium">{campaign.name}</div>
            {mainKpiField && (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {mainKpiField.label}:
                </span>
                <Badge variant="outline" className="text-xs">
                  {typeof mainKpiValue === "boolean"
                    ? mainKpiValue
                      ? "Yes"
                      : "No"
                    : mainKpiValue || "N/A"}
                </Badge>
              </div>
            )}
            {row.original.direction === "inbound" &&
              row.original.relatedOutboundCallId && (
                <div className="mt-1">
                  <Badge
                    variant="outline"
                    className="border-yellow-200 bg-yellow-50 text-xs text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400"
                  >
                    Callback
                  </Badge>
                </div>
              )}
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
        let badgeVariant = "neutral_solid" as
          | "neutral_solid"
          | "success_solid"
          | "failure_solid";

        if (displayStatus === "completed") {
          StatusIcon = Check;
          badgeVariant = "success_solid";
        } else if (
          displayStatus === "failed" ||
          displayStatus === "no-answer"
        ) {
          StatusIcon = CircleAlert;
          badgeVariant = "failure_solid";
        } else if (displayStatus === "in-progress") {
          StatusIcon = PhoneCall;
        }

        return (
          <Badge
            variant={badgeVariant}
            className="flex w-fit items-center gap-1.5"
          >
            <StatusIcon className="h-3 w-3" />
            {displayStatus === "in-progress"
              ? "In Progress"
              : displayStatus === "no-answer"
                ? "No Answer"
                : displayStatus.charAt(0).toUpperCase() +
                  displayStatus.slice(1)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt);
        return (
          <span className="whitespace-nowrap">
            {format(date, "MMM d, yyyy h:mm a")}
          </span>
        );
      },
    },
    {
      accessorKey: "duration",
      header: "Duration",
      cell: ({ row }) => {
        const duration = row.original.duration;
        if (!duration) return <span>-</span>;

        // Format duration in mm:ss
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        return (
          <span>
            {minutes}:{seconds.toString().padStart(2, "0")}
          </span>
        );
      },
    },
    // Additional columns from original component...
    {
      id: "actions",
      header: "Details",
      cell: ({ row }) => {
        return (
          <Link
            href={`/calls?callId=${row.original.id}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "whitespace-nowrap",
            )}
          >
            View Details
          </Link>
        );
      },
    },
  ];

  // Type check and convert the data to the required format
  const callsData = (displayData?.calls || []) as unknown as Call[];

  return (
    <div className="space-y-4">
      <CallsTableFilters />

      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by patient name, phone number, or campaign..."
          className="w-full pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="">
        {error ? (
          <div className="flex h-[300px] w-full flex-col items-center justify-center p-8 text-center">
            <div className="mb-2 text-destructive">
              <CircleAlert className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-medium">Error loading calls</h3>
            <p className="mt-1 max-w-md text-muted-foreground">
              {error.message ||
                "There was an error loading the calls data. Please try again."}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </Button>
          </div>
        ) : isLoading && !displayData?.calls.length ? (
          <div className="flex h-[300px] w-full items-center justify-center p-8">
            <div className="flex flex-col items-center">
              <div className="mb-4 animate-spin">
                <svg
                  className="h-8 w-8 text-primary"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
              <p className="text-muted-foreground">Loading calls data...</p>
            </div>
          </div>
        ) : displayData?.calls.length === 0 ? (
          <div className="flex h-[300px] w-full flex-col items-center justify-center p-8 text-center">
            <div className="mb-2 text-muted-foreground">
              <PhoneCall className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-medium">No calls found</h3>
            <p className="mt-1 max-w-md text-muted-foreground">
              No calls match your current filters. Try adjusting your filters or
              check back later.
            </p>
            <Button variant="outline" className="mt-4" onClick={resetFilters}>
              Reset Filters
            </Button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={displayData?.calls || []}
            pagination={{
              hasNextPage: displayData?.hasMore || false,
              onNextPage: () => {
                setPagination((prev) => ({
                  ...prev,
                  pageIndex: prev.pageIndex + 1,
                }));
              },
            }}
            onRowClick={(row) => handleRowClick(row.id)}
          />
        )}
      </div>

      {displayData?.calls.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {displayData.calls.length} of {displayData.totalCount} calls
          </p>
          {displayData.hasMore && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPagination((prev) => ({
                  ...prev,
                  pageIndex: prev.pageIndex + 1,
                }));
              }}
            >
              Load More
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
