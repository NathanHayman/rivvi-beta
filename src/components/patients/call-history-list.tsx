"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TCall } from "@/types/db";
import { format } from "date-fns";
import { useState } from "react";

interface CallHistoryListProps {
  patientId: string;
  limit?: number;
}

export function CallHistoryList({ patientId, limit }: CallHistoryListProps) {
  const [page, setPage] = useState(0);
  const pageSize = limit || 10;

  // Fetch call history using tRPC
  const { data, isLoading, isFetching } = api.calls.getPatientCalls.useQuery({
    patientId,
    limit: pageSize,
  });

  // Use client-side pagination since API doesn't support offset
  const allCalls = data || [];
  const calls = allCalls.slice(0, (page + 1) * pageSize);
  const hasMore = allCalls.length > (page + 1) * pageSize;

  if (isLoading) {
    return <CallHistorySkeleton count={pageSize} />;
  }

  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <p className="text-sm text-muted-foreground">No call history found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {calls.map((call: TCall) => (
          <div
            key={call.id}
            className="flex items-start justify-between rounded-lg border p-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    call?.direction === "outbound" ? "default" : "secondary"
                  }
                >
                  {call.direction === "outbound" ? "Outbound" : "Inbound"}
                </Badge>
                <Badge variant="outline">{call.status}</Badge>
                {call.duration && (
                  <span className="text-xs text-muted-foreground">
                    {formatDuration(call.duration)}
                  </span>
                )}
              </div>
              <p className="text-sm">
                {typeof call?.analysis?.summary === "string"
                  ? call.analysis.summary
                  : "No summary available"}
              </p>
              <div className="text-xs text-muted-foreground">
                {format(new Date(call.createdAt), "MMM d, yyyy - h:mm a")}
                {call.agentId && (
                  <span className="ml-2">• Agent: {call.agentId}</span>
                )}
                {call.campaignId && (
                  <span className="ml-2">• Campaign: {call.campaignId}</span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {call.recordingUrl && (
                <Button asChild size="sm" variant="outline">
                  <a
                    href={call.recordingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Listen
                  </a>
                </Button>
              )}
              <Button size="sm" variant="outline" asChild>
                <a href={`/calls?callId=${call.id}`}>Details</a>
              </Button>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={isFetching}
          >
            {isFetching ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );
}

// Helper function to format call duration
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} sec`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes} min`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

// Skeleton loader for call history
function CallHistorySkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex items-start justify-between rounded-lg border p-4"
        >
          <div className="w-full space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="flex items-center space-x-2">
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-9 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
