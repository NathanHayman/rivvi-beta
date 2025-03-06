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
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRun } from "@/hooks/use-runs";
import { TCampaign, TRun } from "@/types/db";
import { RunRowsTable } from "../../tables/run-rows-table";

type RunDetailsProps = {
  run: TRun;
  campaign: TCampaign;
};

type RunMetadata = {
  run?: {
    startTime?: string;
    duration?: number;
  };
  rows?: {
    total: number;
    invalid: number;
  };
  calls?: {
    total: number;
    completed: number;
    failed: number;
    calling: number;
    pending: number;
    voicemail: number;
    connected: number;
    converted: number;
  };
};

export function RunDetails({ run: initialRun, campaign }: RunDetailsProps) {
  const [activeTab, setActiveTab] = useState("overview");

  // Use the useRun hook for real-time updates and actions
  const {
    run: updatedRun,
    startRun,
    pauseRun,
    isStartingRun,
    isPausingRun,
  } = useRun(initialRun.id);

  // Use the most up-to-date run data, falling back to the initial data if needed
  const run = updatedRun || initialRun;

  // Type-safe metadata
  const metadata = run.metadata as RunMetadata;

  // Optimistic state updates
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);

  // Get the actual status (optimistic or real)
  const status = optimisticStatus || run.status;

  // Calculate stats
  const totalRows = metadata?.rows?.total || 0;
  const invalidRows = metadata?.rows?.invalid || 0;
  const validRows = totalRows - invalidRows;

  const totalCalls = metadata?.calls?.total || 0;
  const completedCalls = metadata?.calls?.completed || 0;
  const failedCalls = metadata?.calls?.failed || 0;
  const callingCalls = metadata?.calls?.calling || 0;
  const pendingCalls = metadata?.calls?.pending || 0;
  const voicemailCalls = metadata?.calls?.voicemail || 0;
  const connectedCalls = metadata?.calls?.connected || 0;
  const convertedCalls = metadata?.calls?.converted || 0;

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
    const success = await startRun();
    if (!success) {
      setOptimisticStatus(null);
    }
  };

  // Handle pause run
  const handlePauseRun = async () => {
    setOptimisticStatus("paused");
    const success = await pauseRun();
    if (!success) {
      setOptimisticStatus(null);
    }
  };

  // Loading state
  const isLoading = isStartingRun || isPausingRun;

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
            {metadata?.run?.startTime && (
              <>
                {" "}
                • Started{" "}
                {formatDistance(new Date(metadata.run.startTime), new Date(), {
                  addSuffix: true,
                })}
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
              {isLoading && isStartingRun ? (
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
              {isLoading && isPausingRun ? (
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
                  <p className="text-sm">Campaign Direction</p>
                  <Badge variant="outline">{campaign.direction}</Badge>
                </div>

                {run.scheduledAt && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm">Scheduled Time</p>
                    <p className="text-sm font-medium">
                      {format(new Date(run.scheduledAt), "PPp")}
                    </p>
                  </div>
                )}

                {metadata?.run?.duration !== undefined && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm">Run Duration</p>
                    <p className="text-sm font-medium">
                      {Math.floor(metadata.run.duration / 60)} min{" "}
                      {metadata.run.duration % 60} sec
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
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Run Configuration</h3>

              {run?.variationNotes ? (
                <div className="rounded-md bg-muted p-4">
                  <h4 className="mb-2 font-medium">Changes Made to Prompt</h4>
                  <p className="text-sm">{run.variationNotes}</p>

                  {run.naturalLanguageInput && (
                    <div className="mt-3 border-t pt-3">
                      <h5 className="text-sm font-medium">
                        Requested Changes:
                      </h5>
                      <p className="text-sm text-muted-foreground">
                        "{run.naturalLanguageInput}"
                      </p>
                    </div>
                  )}

                  {/* Collapsible section for the full prompt */}
                  <Collapsible className="mt-3">
                    <CollapsibleTrigger className="text-xs text-blue-500 hover:underline">
                      Show full prompt
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 max-h-80 overflow-auto rounded-md bg-slate-100 p-3 font-mono text-xs">
                        {run.customPrompt}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  {run.customPrompt
                    ? "Using custom prompt"
                    : "Using default campaign prompt"}
                </div>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
