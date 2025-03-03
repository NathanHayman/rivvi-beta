"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { type ColumnDef } from "@tanstack/react-table";
import { formatDistance } from "date-fns";
import {
  CheckCircle,
  CircleAlert,
  Clock,
  InfoIcon,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
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

export function CallsTable() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Get filter values from the URL
  const statusFilter =
    (searchParams.get("status") as Call["status"] | "all") || "all";
  const directionFilter =
    (searchParams.get("direction") as Call["direction"] | "all") || "all";

  // Reset pagination when filters change
  useEffect(() => {
    setPage(0);
  }, [statusFilter, directionFilter]);

  // Fetch calls data
  const { data, isLoading } = api.calls.getAll.useQuery({
    limit: 50,
    offset: page * 50,
    status: statusFilter !== "all" ? statusFilter : undefined,
    direction: directionFilter !== "all" ? directionFilter : undefined,
  });

  // Handle call row click to open call details
  const handleCallRowClick = (callId: string) => {
    // Create new search params with current filters plus the callId
    const params = new URLSearchParams(searchParams.toString());
    params.set("callId", callId);

    // Update URL to include callId which will open the sheet
    router.push(`${pathname}?${params.toString()}`);
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
                <PhoneIncoming className="h-4 w-4 text-blue-500" />
                <span>Inbound</span>
              </>
            ) : (
              <>
                <PhoneOutgoing className="h-4 w-4 text-green-500" />
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
                      <span className="col-span-2 text-sm">
                        {String(patient.dob)}
                      </span>
                    </div>
                  )}
                  {patient.id && (
                    <div className="mt-2">
                      <Link
                        href={`/patients/${patient.id}`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "w-full",
                        )}
                      >
                        View Patient Profile
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as Call["status"];

        let StatusIcon = Clock;
        let statusColor = "text-zinc-500";
        let badgeVariant = "neutral_solid" as
          | "neutral_solid"
          | "success_solid"
          | "failure_solid";

        if (status === "completed") {
          StatusIcon = CheckCircle;
          statusColor = "text-green-500";
          badgeVariant = "success_solid";
        } else if (status === "failed" || status === "no-answer") {
          StatusIcon = CircleAlert;
          statusColor = "text-red-500";
          badgeVariant = "failure_solid";
        } else if (status === "in-progress") {
          StatusIcon = PhoneCall;
          statusColor = "text-amber-500";
        }

        return (
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${statusColor}`} />
            <Badge variant={badgeVariant}>
              {status === "in-progress"
                ? "In Progress"
                : status === "no-answer"
                  ? "No Answer"
                  : status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          </div>
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
            {formatDistance(date, new Date(), { addSuffix: true })}
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
    {
      accessorKey: "analysis",
      header: "Campaign Data",
      cell: ({ row }) => {
        const call = row.original;
        const analysis = call.analysis || {};
        const campaign = call.campaign;

        // If no campaign or analysis data, show empty state
        if (!campaign || !Object.keys(analysis).length) {
          return <span className="text-muted-foreground">No data</span>;
        }

        // Get campaign fields if available
        const campaignFields =
          campaign.config?.analysis?.campaign?.fields || [];

        // Filter out standard fields that we don't want to show
        const excludedKeys = [
          "patient_reached",
          "left_voicemail",
          "duration",
          "transcript",
        ];
        const analysisEntries = Object.entries(analysis).filter(
          ([key]) => !excludedKeys.includes(key),
        );

        if (analysisEntries.length === 0) {
          return <span className="text-muted-foreground">No data</span>;
        }

        // Get a preview of the first few fields
        const previewEntries = analysisEntries.slice(0, 2);
        const hasMore = analysisEntries.length > 2;

        return (
          <Popover>
            <PopoverTrigger asChild>
              <div className="flex cursor-pointer items-center gap-2">
                <div>
                  {previewEntries.map(([key, value]) => {
                    // Find the field definition to get the label
                    const fieldDef = campaignFields.find((f) => f.key === key);
                    const label = fieldDef?.label || key;

                    // Format the value based on type
                    let displayValue = value;
                    if (
                      typeof value === "boolean" ||
                      value === "true" ||
                      value === "false"
                    ) {
                      displayValue =
                        value === true || value === "true" ? "Yes" : "No";
                    }

                    return (
                      <div key={key} className="text-sm">
                        <span className="font-medium">{label}:</span>{" "}
                        <span>{String(displayValue)}</span>
                      </div>
                    );
                  })}
                  {hasMore && (
                    <div className="text-xs text-muted-foreground">
                      + {analysisEntries.length - 2} more fields
                    </div>
                  )}
                </div>
                <InfoIcon className="ml-1 h-4 w-4 text-muted-foreground" />
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">Campaign Data</h4>
                  <div className="text-sm text-muted-foreground">
                    Analysis data from this call.
                  </div>
                </div>
                <div className="grid gap-2">
                  {analysisEntries.map(([key, value]) => {
                    // Find the field definition to get the label
                    const fieldDef = campaignFields.find((f) => f.key === key);
                    const label = fieldDef?.label || key;

                    // Format the value based on type
                    let displayValue = value;
                    if (
                      typeof value === "boolean" ||
                      value === "true" ||
                      value === "false"
                    ) {
                      displayValue =
                        value === true || value === "true" ? "Yes" : "No";
                    }

                    return (
                      <div
                        key={key}
                        className="grid grid-cols-3 items-center gap-4"
                      >
                        <span className="text-sm font-medium">{label}</span>
                        <span className="col-span-2 text-sm">
                          {String(displayValue)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        );
      },
    },
    {
      accessorKey: "mainKpi",
      header: "Main KPI",
      cell: ({ row }) => {
        const call = row.original;
        const analysis = call.analysis || {};
        const campaign = call.campaign;

        // If no campaign or analysis data, show empty state
        if (!campaign || !Object.keys(analysis).length) {
          return <span>-</span>;
        }

        // Get campaign fields if available
        const campaignFields =
          campaign.config?.analysis?.campaign?.fields || [];

        // Find the main KPI field
        const mainKpiField = campaignFields.find((field) => field.isMainKPI);

        if (!mainKpiField) {
          return <span>-</span>;
        }

        // Get the value from the analysis data
        const value = analysis[mainKpiField.key];

        if (value === undefined) {
          return <span>-</span>;
        }

        // Format the value based on type
        if (
          typeof value === "boolean" ||
          value === "true" ||
          value === "false"
        ) {
          const isPositive = value === true || value === "true";
          return (
            <Badge variant={isPositive ? "success_solid" : "neutral_solid"}>
              {isPositive ? "Yes" : "No"}
            </Badge>
          );
        }

        return <span>{String(value)}</span>;
      },
    },
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

  // Add a meta column for row ID that we'll use for click handling
  const columnsWithRowClick: ColumnDef<Call>[] = [
    // Add a meta column for row click handling
    {
      id: "clickHandler",
      cell: ({ row }) => {
        return (
          <div
            className="absolute inset-0 cursor-pointer"
            onClick={() => handleCallRowClick(row.original.id)}
            aria-hidden="true"
          />
        );
      },
    },
    ...columns,
  ];

  // Type check and convert the data to the required format
  const callsData = (data?.calls || []) as unknown as Call[];

  return (
    <div className="space-y-4">
      <div className="relative rounded-md border">
        <CallsTableFilters />
        <DataTable
          columns={columnsWithRowClick}
          data={callsData}
          isLoading={isLoading}
          pagination={{
            hasNextPage: data?.hasMore || false,
            onNextPage: () => setPage(page + 1),
          }}
          searchable={true}
          onSearch={setSearchQuery}
        />
      </div>

      {!isLoading && data?.calls.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10">
          <p className="mb-2 text-lg font-medium">No calls found</p>
          <p className="text-muted-foreground">
            Try changing your filters to see more results.
          </p>
        </div>
      )}
    </div>
  );
}
