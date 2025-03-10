"use client";

// src/components/dashboard/upcoming-runs-card.tsx
import { formatDistanceToNow } from "date-fns";
import { ArrowUpRight, Calendar, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pauseRun, startRun } from "@/server/actions/runs/start";

interface Run {
  id: string;
  name: string;
  status: string;
  scheduledAt?: Date | null;
  campaignId: string;
  campaign?: {
    name: string;
  };
  createdAt: Date;
}

interface UpcomingRunsCardProps {
  runs: Run[];
}

export function UpcomingRunsCard({ runs }: UpcomingRunsCardProps) {
  const [actioningRunId, setActioningRunId] = useState<string | null>(null);

  const handleStartRun = async (runId: string) => {
    setActioningRunId(runId);
    try {
      await startRun({ runId });
    } finally {
      setActioningRunId(null);
    }
  };

  const handlePauseRun = async (runId: string) => {
    setActioningRunId(runId);
    try {
      await pauseRun({ runId });
    } finally {
      setActioningRunId(null);
    }
  };

  return (
    <Card className="col-span-1">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">Upcoming Runs</CardTitle>
        <Link href="/runs">
          <Button variant="ghost" size="sm" className="gap-1">
            View All
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="px-2">
        {runs.length > 0 ? (
          <div className="space-y-2">
            {runs.map((run) => {
              const isActioning = actioningRunId === run.id;
              const isScheduled = !!run.scheduledAt;
              const isRunning = run.status === "running";
              const isPaused = run.status === "paused";
              const canStart =
                run.status === "ready" ||
                run.status === "scheduled" ||
                run.status === "paused";
              const canPause = run.status === "running";

              return (
                <div key={run.id} className="rounded-md border p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <Link href={`/campaigns/${run.campaignId}/runs/${run.id}`}>
                      <div className="font-medium hover:underline">
                        {run.name}
                      </div>
                    </Link>
                    <Badge
                      variant={
                        run.status === "running"
                          ? "success_solid"
                          : run.status === "completed"
                            ? "success_solid"
                            : run.status === "failed"
                              ? "failure_solid"
                              : run.status === "paused"
                                ? "neutral_solid"
                                : run.status === "scheduled"
                                  ? "neutral_outline"
                                  : "neutral_solid"
                      }
                    >
                      {run.status}
                    </Badge>
                  </div>

                  <div className="mb-2 text-xs text-muted-foreground">
                    {run.campaign?.name && (
                      <span className="mr-2">{run.campaign.name}</span>
                    )}
                    {isScheduled ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Scheduled for{" "}
                        {formatDistanceToNow(new Date(run.scheduledAt!), {
                          addSuffix: true,
                        })}
                      </span>
                    ) : (
                      <span>
                        Created{" "}
                        {formatDistanceToNow(new Date(run.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    {canStart && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isActioning}
                        onClick={() => handleStartRun(run.id)}
                        className="h-7 gap-1 rounded-full px-2 text-xs"
                      >
                        <Play className="h-3.5 w-3.5" />
                        {isScheduled ? "Run Now" : "Start"}
                      </Button>
                    )}

                    {canPause && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isActioning}
                        onClick={() => handlePauseRun(run.id)}
                        className="h-7 gap-1 rounded-full px-2 text-xs"
                      >
                        <Pause className="h-3.5 w-3.5" />
                        Pause
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No upcoming runs
          </div>
        )}
      </CardContent>
    </Card>
  );
}
