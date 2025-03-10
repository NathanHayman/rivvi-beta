"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  Calendar,
  CheckCircle,
  ChevronRight,
  HelpCircle,
  PauseCircle,
  Phone,
  PlayCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getRuns } from "@/server/actions/runs/fetch";
import { pauseRun, startRun } from "@/server/actions/runs/start";
import { formatDistance } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Import types
import { CampaignAnalytics } from "@/services/analytics/types";

export type RunsTableProps = {
  campaignId: string;
  campaignName?: string;
  limit?: number;
  runs?: any[];
  analytics?: CampaignAnalytics;
};

export function RunsTable({
  campaignId,
  campaignName = "Campaign",
  limit = 10,
  runs: initialRuns,
  analytics,
}: RunsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [runs, setRuns] = useState<any[]>(initialRuns || []);
  const [isLoading, setIsLoading] = useState(!initialRuns);
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "createdAt",
      desc: true,
    },
  ]);

  // Handles for run control actions
  const handleStartRun = async (runId: string) => {
    try {
      await startRun({ runId });
      toast.success("Run started successfully");
      // Update the run status locally
      setRuns((prev) =>
        prev.map((run) =>
          run.id === runId ? { ...run, status: "running" } : run,
        ),
      );
    } catch (error) {
      toast.error("Failed to start run");
      console.error(error);
    }
  };

  const handlePauseRun = async (runId: string) => {
    try {
      await pauseRun({ runId });
      toast.success("Run paused successfully");
      // Update the run status locally
      setRuns((prev) =>
        prev.map((run) =>
          run.id === runId ? { ...run, status: "paused" } : run,
        ),
      );
    } catch (error) {
      toast.error("Failed to pause run");
      console.error(error);
    }
  };

  // If no initial runs were provided, fetch them
  useEffect(() => {
    if (!initialRuns) {
      const fetchRuns = async () => {
        try {
          const result = await getRuns({ campaignId, limit });
          setRuns(result?.runs || []);
        } catch (error) {
          console.error("Error fetching runs:", error);
        } finally {
          setIsLoading(false);
        }
      };

      fetchRuns();
    }
  }, [campaignId, initialRuns, limit]);

  // Table columns definition with memoization
  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <div className="font-medium">{row.getValue("name")}</div>
            <div className="text-xs text-muted-foreground">
              {formatDistance(new Date(row.original.createdAt), new Date(), {
                addSuffix: true,
              })}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.getValue("status") as string;

          const statusMap: Record<
            string,
            { label: string; variant: string; icon: React.ReactNode }
          > = {
            draft: {
              label: "Draft",
              variant: "outline",
              icon: <HelpCircle className="h-3.5 w-3.5" />,
            },
            ready: {
              label: "Ready",
              variant: "outline",
              icon: <CheckCircle className="h-3.5 w-3.5" />,
            },
            scheduled: {
              label: "Scheduled",
              variant: "outline",
              icon: <Calendar className="h-3.5 w-3.5" />,
            },
            running: {
              label: "Running",
              variant: "default",
              icon: <PlayCircle className="h-3.5 w-3.5" />,
            },
            paused: {
              label: "Paused",
              variant: "secondary",
              icon: <PauseCircle className="h-3.5 w-3.5" />,
            },
            completed: {
              label: "Completed",
              variant: "success_solid",
              icon: <CheckCircle className="h-3.5 w-3.5" />,
            },
            failed: {
              label: "Failed",
              variant: "destructive",
              icon: <XCircle className="h-3.5 w-3.5" />,
            },
          };

          const statusInfo = statusMap[status] || statusMap.draft;

          return (
            <Badge
              variant={statusInfo.variant as any}
              className="flex w-28 items-center justify-center gap-1.5"
            >
              {statusInfo.icon}
              {statusInfo.label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "calls",
        header: "Calls",
        cell: ({ row }) => {
          // Get analytics for this run
          const runId = row.original.id;
          const runMetrics = analytics?.runMetrics?.find((r) => r.id === runId);

          // Get call stats from either analytics or run metadata
          const completed =
            runMetrics?.completedCalls ||
            row.original.metadata?.calls?.completed ||
            0;
          const total =
            runMetrics?.totalCalls || row.original.metadata?.calls?.total || 0;

          return (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>
                {completed} of {total}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "actions",
        header: "",
        cell: ({ row }) => {
          const status = row.getValue("status") as string;
          const canStart = ["ready", "paused", "scheduled", "draft"].includes(
            status,
          );
          const canPause = status === "running";

          return (
            <div className="flex justify-end gap-2">
              {canStart && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartRun(row.original.id);
                  }}
                >
                  <PlayCircle className="h-4 w-4" />
                  <span className="sr-only">Start</span>
                </Button>
              )}
              {canPause && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePauseRun(row.original.id);
                  }}
                >
                  <PauseCircle className="h-4 w-4" />
                  <span className="sr-only">Pause</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  router.push(
                    `/campaigns/${campaignId}/runs/${row.original.id}`,
                  )
                }
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">View</span>
              </Button>
            </div>
          );
        },
      },
    ],
    [campaignId, router, analytics],
  );

  const table = useReactTable({
    data: runs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.refresh()}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn("mr-1.5 h-4 w-4", isLoading && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4">
          <CardTitle>All Runs</CardTitle>
          <CardDescription>
            View all runs for this campaign, latest first
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <>
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center space-x-4 border-b border-border p-4"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="ml-auto h-8 w-20" />
                </div>
              ))}
            </>
          ) : runs.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center">
              <p className="mb-2 text-sm text-muted-foreground">
                No runs created yet
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push(`/campaigns/${campaignId}/create-run`)
                }
              >
                <Calendar className="mr-1.5 h-4 w-4" />
                Create Run
              </Button>
            </div>
          ) : (
            <div className="border-0">
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
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/campaigns/${campaignId}/runs/${row.original.id}`,
                        )
                      }
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex items-center justify-between p-4">
          <div className="text-sm text-muted-foreground">
            {runs.length} runs total
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
        </CardFooter>
      </Card>
    </div>
  );
}
