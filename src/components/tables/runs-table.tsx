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
import { getRuns } from "@/server/actions/runs/fetch";
import { pauseRun } from "@/server/actions/runs/index";
import { startRun } from "@/server/actions/runs/start";
import { formatDistance } from "date-fns";
import { Eye, MoreHorizontal, Pause, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface RunsTableProps {
  campaignId: string;
  limit?: number;
}

export function RunsTable({ campaignId, limit = 10 }: RunsTableProps) {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [data, setData] = useState<any>({
    runs: [],
    totalCount: 0,
    hasMore: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingRun, setIsStartingRun] = useState(false);
  const [isPausingRun, setIsPausingRun] = useState(false);

  const fetchRuns = async () => {
    setIsLoading(true);
    try {
      const result = await getRuns({
        campaignId,
        limit,
        offset: page * limit,
      });
      setData(result);
    } catch (error) {
      toast.error("Failed to fetch runs");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [campaignId, limit, page]);

  const handleViewRun = (runId: string) => {
    router.push(`/campaigns/${campaignId}/runs/${runId}`);
  };

  const handleStartRun = async (runId: string) => {
    setIsStartingRun(true);
    try {
      await startRun({ runId });
      toast.success("Run started");
      fetchRuns();
    } catch (error) {
      toast.error("Error starting run");
      console.error(error);
    } finally {
      setIsStartingRun(false);
    }
  };

  const handlePauseRun = async (runId: string) => {
    setIsPausingRun(true);
    try {
      await pauseRun({ runId });
      toast.success("Run paused");
      fetchRuns();
    } catch (error) {
      toast.error("Error pausing run");
      console.error(error);
    } finally {
      setIsPausingRun(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-gray-100">
            Pending
          </Badge>
        );
      case "in-progress":
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800">
            In Progress
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800">
            Completed
          </Badge>
        );
      case "paused":
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
            Paused
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800">
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-100">
            {status}
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Calls</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-[250px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[100px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[100px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[100px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[50px]" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Calls</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.runs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No runs found.
                </TableCell>
              </TableRow>
            ) : (
              data.runs.map((run: any) => (
                <TableRow key={run.id}>
                  <TableCell className="font-medium">{run.name}</TableCell>
                  <TableCell>{getStatusBadge(run.status)}</TableCell>
                  <TableCell>
                    {formatDistance(new Date(run.createdAt), new Date(), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    {run.metadata?.calls ? (
                      <span>
                        {run.metadata.calls.completed}/
                        {run.metadata.calls.total}
                      </span>
                    ) : (
                      "N/A"
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewRun(run.id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        {run.status === "pending" || run.status === "paused" ? (
                          <DropdownMenuItem
                            onClick={() => handleStartRun(run.id)}
                            disabled={isStartingRun}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            Start
                          </DropdownMenuItem>
                        ) : null}
                        {run.status === "in-progress" ? (
                          <DropdownMenuItem
                            onClick={() => handlePauseRun(run.id)}
                            disabled={isPausingRun}
                          >
                            <Pause className="mr-2 h-4 w-4" />
                            Pause
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
