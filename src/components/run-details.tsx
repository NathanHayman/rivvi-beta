"use client";

// src/components/runs/run-details.tsx
import { format, formatDistance } from "date-fns";
import {
  BarChart3,
  Calendar,
  CheckCircle,
  Download,
  Hourglass,
  ListChecks,
  Loader2,
  PauseCircle,
  Phone,
  PlayCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRunEvents } from "@/hooks/use-pusher";
import { api } from "@/trpc/react";
import { RunRowsTable } from "./run-rows-table";

// Define the type for the run to properly type our props
type RunDetailsProps = {
  run: {
    id: string;
    name: string;
    status: string;
    customPrompt?: string | null;
    scheduledAt?: Date | null;
    metadata?: {
      rows?: {
        total?: number;
        invalid?: number;
      };
      calls?: {
        total?: number;
        completed?: number;
        failed?: number;
        calling?: number;
        pending?: number;
        skipped?: number;
        voicemail?: number;
        connected?: number;
        converted?: number;
      };
      run?: {
        error?: string;
        startTime?: string;
        endTime?: string;
        lastPausedAt?: string;
        scheduledTime?: string;
        duration?: number;
      };
    };
    createdAt: Date;
    updatedAt: Date;
  };
  campaign: {
    id: string;
    name: string;
    type: string;
  };
};

export function RunDetails({ run, campaign }: RunDetailsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  // Optimistic state updates
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);

  // Get the actual status (optimistic or real)
  const status = optimisticStatus || run.status;

  // tRPC mutations
  const startRunMutation = api.run.start.useMutation({
    onSuccess: () => {
      toast.success("Run started successfully");
      router.refresh();
    },
    onError: (error) => {
      toast.error(`Error starting run: ${error.message}`);
      setOptimisticStatus(null);
    },
  });

  const pauseRunMutation = api.run.pause.useMutation({
    onSuccess: () => {
      toast.success("Run paused successfully");
      router.refresh();
    },
    onError: (error) => {
      toast.error(`Error pausing run: ${error.message}`);
      setOptimisticStatus(null);
    },
  });

  // Real-time updates with Pusher
  useRunEvents(run.id, {
    onCallStarted: () => {
      router.refresh();
    },
    onCallCompleted: () => {
      router.refresh();
    },
    onMetricsUpdated: () => {
      router.refresh();
    },
  });

  // Calculate stats
  const totalRows = run.metadata?.rows?.total || 0;
  const invalidRows = run.metadata?.rows?.invalid || 0;
  const validRows = totalRows - invalidRows;

  const totalCalls = run.metadata?.calls?.total || 0;
  const completedCalls = run.metadata?.calls?.completed || 0;
  const failedCalls = run.metadata?.calls?.failed || 0;
  const callingCalls = run.metadata?.calls?.calling || 0;
  const pendingCalls = run.metadata?.calls?.pending || 0;
  const voicemailCalls = run.metadata?.calls?.voicemail || 0;
  const connectedCalls = run.metadata?.calls?.connected || 0;
  const convertedCalls = run.metadata?.calls?.converted || 0;

  const callProgress =
    totalCalls > 0
      ? Math.round(((completedCalls + failedCalls) / totalCalls) * 100)
      : 0;

  const conversionRate =
    completedCalls > 0
      ? Math.round((connectedCalls / completedCalls) * 100)
      : 0;

  // Determine if run is actionable (can be started or paused)
  const canStart =
    status === "ready" || status === "paused" || status === "scheduled";
  const canPause = status === "running";

  // Handle start run
  const handleStartRun = async () => {
    setOptimisticStatus("running");
    await startRunMutation.mutateAsync({ runId: run.id });
  };

  // Handle pause run
  const handlePauseRun = async () => {
    setOptimisticStatus("paused");
    await pauseRunMutation.mutateAsync({ runId: run.id });
  };

  // Loading state
  const isLoading = startRunMutation.isPending || pauseRunMutation.isPending;

  // Get the appropriate status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "ready":
        return "secondary";
      case "running":
        return "default";
      case "paused":
        return "warning";
      case "completed":
        return "success";
      case "failed":
        return "destructive";
      case "scheduled":
        return "outline";
      default:
        return "secondary";
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ready":
        return <ListChecks className="h-4 w-4" />;
      case "running":
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case "paused":
        return <PauseCircle className="h-4 w-4" />;
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      case "failed":
        return <XCircle className="h-4 w-4" />;
      case "scheduled":
        return <Calendar className="h-4 w-4" />;
      default:
        return <Hourglass className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{run.name}</h1>
          <p className="text-sm text-muted-foreground">
            Created{" "}
            {formatDistance(new Date(run.createdAt), new Date(), {
              addSuffix: true,
            })}
            {run.metadata?.run?.startTime && (
              <>
                {" "}
                • Started{" "}
                {formatDistance(
                  new Date(run.metadata.run.startTime),
                  new Date(),
                  { addSuffix: true },
                )}
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant={getStatusBadgeVariant(status) as any}
            className="flex items-center gap-1.5"
          >
            {getStatusIcon(status)}
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>

          {canStart && (
            <Button
              variant="default"
              size="sm"
              onClick={handleStartRun}
              disabled={isLoading}
            >
              {isLoading && startRunMutation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="mr-1.5 h-4 w-4" />
              )}
              Start Run
            </Button>
          )}

          {canPause && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePauseRun}
              disabled={isLoading}
            >
              {isLoading && pauseRunMutation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <PauseCircle className="mr-1.5 h-4 w-4" />
              )}
              Pause Run
            </Button>
          )}

          <Button variant="outline" size="sm">
            <Download className="mr-1.5 h-4 w-4" />
            Export Data
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          {run.customPrompt && <TabsTrigger value="prompt">Prompt</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Rows
                </CardTitle>
                <ListChecks className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalRows}</div>
                {invalidRows > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {invalidRows} invalid rows skipped
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Call Progress
                </CardTitle>
                <Phone className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {completedCalls + failedCalls}/{totalCalls}
                </div>
                <div className="mt-2">
                  <Progress value={callProgress} className="h-2" />
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{callProgress}% complete</span>
                  {callingCalls > 0 && <span>{callingCalls} in progress</span>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Conversion Rate
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{conversionRate}%</div>
                <p className="text-xs text-muted-foreground">
                  {convertedCalls} successful conversions
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Call Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Connected
                  </p>
                  <p className="text-xl font-bold">{connectedCalls}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Voicemail
                  </p>
                  <p className="text-xl font-bold">{voicemailCalls}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Failed
                  </p>
                  <p className="text-xl font-bold">{failedCalls}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Pending
                  </p>
                  <p className="text-xl font-bold">
                    {pendingCalls + callingCalls}
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm">Campaign</p>
                  <p className="text-sm font-medium">{campaign.name}</p>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm">Campaign Type</p>
                  <Badge variant="outline">{campaign.type}</Badge>
                </div>

                {run.scheduledAt && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm">Scheduled Time</p>
                    <p className="text-sm font-medium">
                      {format(new Date(run.scheduledAt), "PPp")}
                    </p>
                  </div>
                )}

                {run.metadata?.run?.duration !== undefined && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm">Run Duration</p>
                    <p className="text-sm font-medium">
                      {Math.floor(run.metadata.run.duration / 60)} min{" "}
                      {run.metadata.run.duration % 60} sec
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data">
          <Card>
            <CardContent className="pt-6">
              <RunRowsTable runId={run.id} />
            </CardContent>
          </Card>
        </TabsContent>

        {run.customPrompt && (
          <TabsContent value="prompt">
            <Card>
              <CardHeader>
                <CardTitle>Custom Prompt</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md bg-muted p-4">
                  <pre className="whitespace-pre-wrap text-sm">
                    {run.customPrompt}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
