"use client";

// src/components/runs/run-rows-table.tsx
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  CheckIcon,
  CircleIcon,
  Loader2,
  MoreHorizontal,
  Phone,
  PhoneIcon,
  RefreshCw,
  SkipForwardIcon,
  User,
  XCircle,
  XIcon,
} from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRunEvents } from "@/hooks/use-pusher";
import { api } from "@/trpc/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type RowStatus = "pending" | "calling" | "completed" | "failed" | "skipped";

interface Row {
  id: string;
  createdAt: Date;
  updatedAt: Date | null;
  orgId: string;
  status: RowStatus;
  runId: string;
  patientId: string | null;
  variables: Record<string, unknown>;
  postCallData: Record<string, unknown> | null;
  error: string | null;
  retellCallId: string | null;
  sortIndex: number;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    primaryPhone: string;
  } | null;
}

interface RunRowsTableProps {
  runId: string;
}

export function RunRowsTable({ runId }: RunRowsTableProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<RowStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // Get rows data
  const { data, isLoading, isError, refetch } = api.runs.getRows.useQuery(
    {
      runId,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      filter:
        filter === "all"
          ? undefined
          : filter === "skipped"
            ? "pending"
            : filter,
    },
    {
      refetchInterval: 15000, // Refetch every 15 seconds
    },
  );

  // Real-time updates with Pusher
  useRunEvents(runId, {
    onCallStarted: () => void refetch(),
    onCallCompleted: () => void refetch(),
  });

  // Define columns
  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: "patient",
      header: "Patient",
      cell: ({ row }) => {
        const patient = row.original.patient;
        const name = patient
          ? `${patient.firstName} ${patient.lastName}`
          : "Unknown";

        const initials = patient
          ? `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`
          : "?";

        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{name}</div>
              <div className="text-xs text-muted-foreground">
                {String(row?.original?.variables?.phone || "No phone")}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        let label = "Unknown";
        let variant:
          | "default"
          | "destructive"
          | "outline"
          | "secondary"
          | "success_outline"
          | "success_solid" = "default";
        let icon = <CircleIcon className="h-2 w-2" />;

        if (status === "pending") {
          label = "Pending";
          variant = "outline";
          icon = <CircleIcon className="h-2 w-2" />;
        } else if (status === "calling") {
          label = "Calling";
          variant = "secondary";
          icon = <PhoneIcon className="h-2 w-2" />;
        } else if (status === "completed") {
          label = "Completed";
          variant = "success_solid";
          icon = <CheckIcon className="h-2 w-2" />;
        } else if (status === "failed") {
          label = "Failed";
          variant = "destructive";
          icon = <XIcon className="h-2 w-2" />;
        } else if (status === "skipped") {
          label = "Skipped";
          variant = "outline";
          icon = <SkipForwardIcon className="h-2 w-2" />;
        }

        return (
          <Badge variant={variant} className="flex w-fit items-center">
            {icon}
            {label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "scheduledAt",
      header: "Scheduled",
      cell: ({ row }) => {
        const date = row.original.variables?.scheduledDate;
        const time = row.original.variables?.scheduledTime;

        return (
          <div>
            <div className="font-medium">
              {date ? String(date) : "Not scheduled"}
            </div>
            {time != null && time !== "" && (
              <div className="text-xs text-muted-foreground">
                {String(time)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "outcome",
      header: "Call Outcome",
      cell: ({ row }) => {
        const postCallData = row.original.postCallData;
        const status = row.getValue("status") as RowStatus;

        if (status === "pending" || status === "calling") {
          return <span className="text-muted-foreground">Waiting...</span>;
        }

        if (status === "failed") {
          return (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-red-500">
                  <XCircle className="mr-1 h-3.5 w-3.5" />
                  Error
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="grid gap-2">
                  <h4 className="font-medium">Error Details</h4>
                  <p className="text-sm text-muted-foreground">
                    {row.original.error || "Unknown error"}
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          );
        }

        if (!postCallData) {
          return <span className="text-muted-foreground">No data</span>;
        }

        // Try to find the main KPI in post call data
        let outcome = "Unknown";

        // Common post-call fields to check
        const fieldsToCheck = [
          "appointment_confirmed",
          "appointmentConfirmed",
          "patient_reached",
          "patientReached",
        ];

        for (const field of fieldsToCheck) {
          if (field in postCallData) {
            const value = postCallData[field];
            outcome =
              typeof value === "boolean"
                ? value
                  ? "Yes"
                  : "No"
                : String(value);
            break;
          }
        }

        return <span className="font-medium">{outcome}</span>;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        return (
          <div className="flex items-center justify-end gap-2">
            {row.original.patientId && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/patients/${row.original.patientId}`}>
                  <User className="h-4 w-4" />
                  <span className="sr-only">View Patient</span>
                </Link>
              </Button>
            )}

            {row.original.retellCallId && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/calls?callId=${row.original.retellCallId}`}>
                  <Phone className="h-4 w-4" />
                  <span className="sr-only">View Call</span>
                </Link>
              </Button>
            )}

            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">More</span>
            </Button>
          </div>
        );
      },
    },
  ];

  // Create table
  const table = useReactTable({
    data: data?.rows || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    state: {
      pagination,
    },
    manualPagination: true,
    pageCount: data?.pagination?.totalPages || 0,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs"
        />

        <Select
          value={filter}
          onValueChange={(value) => setFilter(value as RowStatus | "all")}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="calling">Calling</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-1.5">Refresh</span>
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
                  <div className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading rows...
                  </div>
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
                  No rows found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {data?.counts ? (
            <>
              Showing {table.getRowModel().rows.length} of{" "}
              {data.pagination.totalCount} rows • {data.counts.pending} pending,{" "}
              {data.counts.calling} calling, {data.counts.completed} completed,{" "}
              {data.counts.failed} failed
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
