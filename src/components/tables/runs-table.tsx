"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistance } from "date-fns";
import { Eye, MoreHorizontal, Pause, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface RunsTableProps {
  campaignId: string;
  limit?: number;
}

export function RunsTable({ campaignId, limit = 10 }: RunsTableProps) {
  const router = useRouter();
  const [page, setPage] = useState(0);

  const { data, isLoading, refetch } = api.runs.getAll.useQuery({
    campaignId,
    limit,
    offset: page * limit,
  });

  const startRunMutation = api.runs.start.useMutation({
    onSuccess: () => {
      toast.success("Run started");
      void refetch();
    },
    onError: (error) => {
      toast.error("Error starting run", {
        description: error.message,
      });
    },
  });

  const pauseRunMutation = api.runs.pause.useMutation({
    onSuccess: () => {
      toast.success("Run paused");
      void refetch();
    },
    onError: (error) => {
      toast.error("Error pausing run", {
        description: error.message,
      });
    },
  });

  const handleViewRun = (runId: string) => {
    router.push(`/campaigns/${campaignId}/runs/${runId}`);
  };

  const handleStartRun = (runId: string) => {
    startRunMutation.mutate({ runId });
  };

  const handlePauseRun = (runId: string) => {
    pauseRunMutation.mutate({ runId });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
          >
            Pending
          </Badge>
        );
      case "active":
        return (
          <Badge
            variant="outline"
            className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
          >
            Active
          </Badge>
        );
      case "paused":
        return (
          <Badge
            variant="outline"
            className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
          >
            Paused
          </Badge>
        );
      case "completed":
        return (
          <Badge
            variant="outline"
            className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
          >
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge
            variant="outline"
            className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
          >
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="ml-auto h-8 w-8 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.runs.length === 0) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-md border border-dashed p-8">
        <div className="text-center text-muted-foreground">
          <p>No runs found for this campaign</p>
          <p className="text-sm">Create a new run to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Calls</TableHead>
            <TableHead>Completion</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.runs.map((run) => (
            <TableRow key={run.id}>
              <TableCell className="font-medium">{run.name}</TableCell>
              <TableCell>{getStatusBadge(run.status)}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistance(new Date(run.createdAt), new Date(), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell>
                {run.metadata?.calls?.total || 0} total
                <br />
                <span className="text-xs text-muted-foreground">
                  {run.metadata?.calls?.connected || 0} connected
                </span>
              </TableCell>
              <TableCell>
                {(() => {
                  const total = run.metadata?.calls?.total || 0;
                  const completed = run.metadata?.calls?.completed || 0;
                  const percentage =
                    total > 0 ? Math.round((completed / total) * 100) : 0;
                  return `${percentage}%`;
                })()}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleViewRun(run.id)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    {run.status === "running" ? (
                      <DropdownMenuItem onClick={() => handlePauseRun(run.id)}>
                        <Pause className="mr-2 h-4 w-4" />
                        Pause Run
                      </DropdownMenuItem>
                    ) : run.status === "draft" || run.status === "paused" ? (
                      <DropdownMenuItem onClick={() => handleStartRun(run.id)}>
                        <Play className="mr-2 h-4 w-4" />
                        Start Run
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {data.runs.length > 0 && (
        <div className="flex items-center justify-end space-x-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={data.runs.length < limit}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
