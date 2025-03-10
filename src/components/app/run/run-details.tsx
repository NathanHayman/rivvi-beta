"use client";

// src/components/runs/run-details.tsx
import { format, formatDistance } from "date-fns";
import { debounce } from "lodash";
import {
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
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRun } from "@/hooks/runs/use-runs";
import { useOrganizationEvents } from "@/hooks/use-pusher";
import { useRunEvents } from "@/hooks/use-run-events";
import { TCampaign, TRun } from "@/types/db";
import { RunRowsTable } from "../../tables/run-rows-table";

type RunDetailsProps = {
  run: TRun;
  campaign: TCampaign;
  initialAnalytics?: any;
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
  metadata?: VariationMetadataType;
  comparison?: ComparisonType;
  summary?: string;
  diffData?: DiffDataType;
};

// Define a type for the metadata structure
type VariationMetadataType = {
  categories?: string[];
  tags?: string[];
  keyChanges?: string[];
  toneShift?: string;
  focusArea?: string;
  promptLength?: {
    before: number;
    after: number;
    difference: number;
  };
  changeIntent?: string;
  sentimentShift?: {
    before?: string;
    after?: string;
  };
  formalityLevel?: {
    before?: number;
    after?: number;
  };
  complexityScore?: {
    before?: number;
    after?: number;
  };
};

// Define types for comparison data
type ComparisonType = {
  structuralChanges?: Array<{
    section?: string;
    changeType?: "added" | "removed" | "modified" | "unchanged";
    description?: string;
  }>;
  keyPhrases?: {
    added?: string[];
    removed?: string[];
    modified?: Array<{
      before?: string;
      after?: string;
    }>;
  };
  performancePrediction?: {
    expectedImpact?: "positive" | "neutral" | "negative" | "uncertain";
    confidenceLevel?: number;
    rationale?: string;
  };
};

// Define types for diff data
type DiffDataType = {
  promptDiff?: Array<{
    type?: "unchanged" | "added" | "removed";
    value?: string;
  }>;
  voicemailDiff?: Array<{
    type?: "unchanged" | "added" | "removed";
    value?: string;
  }>;
};

// Component to display the diff
const DiffDisplay = ({
  diff,
}: {
  diff?: Array<{ type?: "unchanged" | "added" | "removed"; value?: string }>;
}) => {
  if (!diff || !Array.isArray(diff)) {
    return <div className="text-gray-500 italic">No diff data available</div>;
  }

  return (
    <div className="whitespace-pre-wrap font-mono text-sm">
      {diff.map((segment, index) => {
        let className = "inline";
        if (segment.type === "added")
          className = "bg-green-100 text-green-800 inline";
        if (segment.type === "removed")
          className = "bg-red-100 text-red-800 line-through inline";

        return (
          <span key={index} className={className}>
            {segment.value || ""}{" "}
          </span>
        );
      })}
    </div>
  );
};

// Component to display structured metadata
function VariationMetadata({
  metadata,
  comparison,
  summary,
  diffData,
}: {
  metadata?: VariationMetadataType;
  comparison?: ComparisonType;
  summary?: string;
  diffData?: DiffDataType;
}) {
  if (!metadata && !comparison && !summary && !diffData) return null;

  return (
    <div className="space-y-6">
      {/* Summary Section */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Main Metadata Section */}
      {metadata && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Categories */}
            {metadata.categories && metadata.categories.length > 0 && (
              <div>
                <h4 className="mb-1 text-sm font-semibold">Categories</h4>
                <div className="flex flex-wrap gap-2">
                  {metadata.categories.map((category, i) => (
                    <Badge key={i} variant="outline" className="bg-blue-50">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {metadata.tags && metadata.tags.length > 0 && (
              <div>
                <h4 className="mb-1 text-sm font-semibold">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {metadata.tags.map((tag, i) => (
                    <Badge key={i} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Key Changes */}
            {metadata.keyChanges && metadata.keyChanges.length > 0 && (
              <div>
                <h4 className="mb-1 text-sm font-semibold">Key Changes</h4>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {metadata.keyChanges.map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Change Intent */}
            {metadata.changeIntent && (
              <div>
                <h4 className="mb-1 text-sm font-semibold">Change Intent</h4>
                <p className="text-sm">{metadata.changeIntent}</p>
              </div>
            )}

            {/* Metrics */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Tone Shift */}
              {metadata.toneShift && (
                <div className="rounded-lg border p-3">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                    Tone Shift
                  </h4>
                  <p className="mt-1 text-sm">{metadata.toneShift}</p>
                </div>
              )}

              {/* Focus Area */}
              {metadata.focusArea && (
                <div className="rounded-lg border p-3">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                    Focus Area
                  </h4>
                  <p className="mt-1 text-sm">{metadata.focusArea}</p>
                </div>
              )}

              {/* Sentiment Shift */}
              {metadata.sentimentShift && (
                <div className="rounded-lg border p-3">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                    Sentiment Change
                  </h4>
                  <p className="mt-1 text-sm">
                    {metadata.sentimentShift.before} →{" "}
                    {metadata.sentimentShift.after}
                  </p>
                </div>
              )}

              {/* Formality Level */}
              {metadata.formalityLevel && (
                <div className="rounded-lg border p-3">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                    Formality Level (1-10)
                  </h4>
                  <p className="mt-1 text-sm">
                    {metadata.formalityLevel.before} →{" "}
                    {metadata.formalityLevel.after}
                  </p>
                </div>
              )}

              {/* Complexity Score */}
              {metadata.complexityScore && (
                <div className="rounded-lg border p-3">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                    Complexity Score (1-10)
                  </h4>
                  <p className="mt-1 text-sm">
                    {metadata.complexityScore.before} →{" "}
                    {metadata.complexityScore.after}
                  </p>
                </div>
              )}

              {/* Prompt Length */}
              {metadata.promptLength && (
                <div className="rounded-lg border p-3">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                    Prompt Length
                  </h4>
                  <p className="mt-1 text-sm">
                    {metadata.promptLength.before} →{" "}
                    {metadata.promptLength.after} chars (
                    {metadata.promptLength.difference > 0 ? "+" : ""}
                    {metadata.promptLength.difference})
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison Data */}
      {comparison && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Changes Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Key Phrases */}
            {comparison.keyPhrases && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Key Phrase Changes</h4>

                {comparison.keyPhrases.added &&
                  comparison.keyPhrases.added.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium text-green-600">
                        Added:
                      </h5>
                      <ul className="list-disc space-y-0.5 pl-5 text-sm">
                        {comparison.keyPhrases.added.map((phrase, i) => (
                          <li key={i}>{phrase}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {comparison.keyPhrases.removed &&
                  comparison.keyPhrases.removed.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium text-red-600">
                        Removed:
                      </h5>
                      <ul className="list-disc space-y-0.5 pl-5 text-sm">
                        {comparison.keyPhrases.removed.map((phrase, i) => (
                          <li key={i}>{phrase}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {comparison.keyPhrases.modified &&
                  comparison.keyPhrases.modified.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium text-amber-600">
                        Modified:
                      </h5>
                      <ul className="list-disc space-y-0.5 pl-5 text-sm">
                        {comparison.keyPhrases.modified.map((mod, i) => (
                          <li key={i}>
                            &quot;{mod.before}&quot; → &quot;{mod.after}&quot;
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            )}

            {/* Structural Changes */}
            {comparison.structuralChanges &&
              comparison.structuralChanges.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold">Structural Changes</h4>
                  <ul className="mt-1 space-y-2">
                    {comparison.structuralChanges.map((change, i) => (
                      <li key={i} className="rounded-lg border p-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{change.section}</span>
                          <Badge
                            variant={
                              change.changeType === "added"
                                ? "secondary"
                                : change.changeType === "removed"
                                  ? "destructive"
                                  : change.changeType === "modified"
                                    ? "outline"
                                    : "default"
                            }
                          >
                            {change.changeType}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {change.description}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Performance Prediction */}
            {comparison.performancePrediction && (
              <div>
                <h4 className="text-sm font-semibold">
                  Performance Prediction
                </h4>
                <div className="mt-1 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Expected Impact</span>
                    <Badge
                      variant={
                        comparison.performancePrediction.expectedImpact ===
                        "positive"
                          ? "secondary"
                          : comparison.performancePrediction.expectedImpact ===
                              "negative"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {comparison.performancePrediction.expectedImpact}
                    </Badge>
                  </div>
                  {comparison.performancePrediction.confidenceLevel && (
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm">Confidence</span>
                      <span className="text-sm font-medium">
                        {comparison.performancePrediction.confidenceLevel}/10
                      </span>
                    </div>
                  )}
                  {comparison.performancePrediction.rationale && (
                    <div className="mt-2">
                      <h5 className="text-xs font-medium">Rationale:</h5>
                      <p className="text-sm text-muted-foreground">
                        {comparison.performancePrediction.rationale}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Diff Visualization */}
      {diffData && (diffData.promptDiff || diffData.voicemailDiff) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Changes Visualization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {diffData.promptDiff && (
              <div>
                <h4 className="mb-1 text-sm font-semibold">Prompt Changes</h4>
                <div className="max-h-60 overflow-y-auto rounded-lg border p-3">
                  <DiffDisplay diff={diffData.promptDiff} />
                </div>
              </div>
            )}

            {diffData.voicemailDiff && (
              <div>
                <h4 className="mb-1 text-sm font-semibold">
                  Voicemail Changes
                </h4>
                <div className="max-h-60 overflow-y-auto rounded-lg border p-3">
                  <DiffDisplay diff={diffData.voicemailDiff} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function RunDetails({
  run: initialRun,
  campaign,
  initialAnalytics,
}: RunDetailsProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [run, setRun] = useState<TRun>(initialRun);
  const [metrics, setMetrics] = useState<RunMetadata | null>(
    initialRun.metadata as RunMetadata | null,
  );
  const { startRun, pauseRun, isStartingRun, isPausingRun, refetch } = useRun(
    initialRun.id,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const runId = initialRun.id;
  const orgId = initialRun.orgId;

  // Add analytics state
  const [analytics, setAnalytics] = useState<any>(initialAnalytics || null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Add counts state to replace useRunRows data
  const [counts, setCounts] = useState<Record<string, number> | null>(
    initialAnalytics
      ? {
          total: initialAnalytics.overview.totalRows || 0,
          completed: initialAnalytics.overview.completedCalls || 0,
          failed: initialAnalytics.overview.failedCalls || 0,
          pending: initialAnalytics.overview.pendingCalls || 0,
          connected: initialAnalytics.callMetrics.patientsReached || 0,
          voicemail: initialAnalytics.callMetrics.voicemailsLeft || 0,
        }
      : null,
  );

  // Function to fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    setIsLoadingAnalytics(true);
    try {
      // Use server action instead of direct import
      const { getRunAnalytics } = await import(
        "@/server/actions/runs/analytics"
      );
      const data = await getRunAnalytics(runId);
      if (data) {
        setAnalytics({
          overview: {
            totalRows: data.overview?.totalRows || 0,
            completedCalls: data.overview?.completedCalls || 0,
            failedCalls: data.overview?.failedCalls || 0,
            pendingCalls: data.overview?.pendingCalls || 0,
          },
          callMetrics: {
            patientsReached: data.callMetrics?.patientsReached || 0,
            voicemailsLeft: data.callMetrics?.voicemailsLeft || 0,
          },
        });
      }
    } catch (error) {
      console.error("Error fetching run analytics:", error);
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [runId]);

  // Add a debounced refresh function to avoid too many refreshes
  const debouncedRefetch = useCallback(() => {
    const refreshData = debounce(() => {
      refetch().finally(() => setIsRefreshing(false));
      // Also fetch updated analytics
      fetchAnalytics();
    }, 1000);

    refreshData();
  }, [refetch, fetchAnalytics, setIsRefreshing]);

  // Fetch analytics on initial load
  useEffect(() => {
    if (!initialAnalytics) {
      fetchAnalytics();
    }
  }, [fetchAnalytics, initialAnalytics]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    debouncedRefetch();
  }, [debouncedRefetch]);

  // Initialize useCallback for start and pause functions
  const handleStartRun = useCallback(async () => {
    const success = await startRun();
    if (success) {
      toast.success("Run started successfully");
      setRun((prev) => ({
        ...prev,
        status: "running",
      }));
    } else {
      toast.error("Failed to start run");
    }
  }, [startRun]);

  const handlePauseRun = useCallback(async () => {
    const success = await pauseRun();
    if (success) {
      toast.success("Run paused successfully");
      setRun((prev) => ({
        ...prev,
        status: "paused",
      }));
    } else {
      toast.error("Failed to pause run");
    }
  }, [pauseRun]);

  // Add Pusher event listeners for real-time updates
  useRunEvents(
    runId,
    {
      onCallStarted: useCallback(
        (data) => {
          console.log("Call started:", data);
          // Use debounced refresh instead of setTimeout
          handleRefresh();
        },
        [handleRefresh],
      ),

      onCallCompleted: useCallback(
        (data) => {
          console.log("Call completed:", data);
          // Update metrics in real-time
          if (metrics) {
            setMetrics((prev) => {
              if (!prev || !prev.calls) return prev;

              const updatedCalls = { ...prev.calls };
              // Decrease pending count
              if (updatedCalls.pending > 0) {
                updatedCalls.pending -= 1;
              }
              // Increase the appropriate status count
              if (data.status === "completed") {
                updatedCalls.completed = (updatedCalls.completed || 0) + 1;
              } else if (data.status === "failed") {
                updatedCalls.failed = (updatedCalls.failed || 0) + 1;
              } else if (data.status === "voicemail") {
                updatedCalls.voicemail = (updatedCalls.voicemail || 0) + 1;
              }

              return { ...prev, calls: updatedCalls };
            });
          }

          // Use debounced refresh
          handleRefresh();
        },
        [handleRefresh, metrics],
      ),

      onCallFailed: useCallback(
        (data) => {
          console.log("Call failed:", data);
          // Update metrics in real-time using functional update
          setMetrics((prev) => {
            if (!prev || !prev.calls) return prev;

            return {
              ...prev,
              calls: {
                ...prev.calls,
                pending: Math.max(0, prev.calls.pending - 1),
                failed: (prev.calls.failed || 0) + 1,
              },
            };
          });

          // Use debounced refresh
          handleRefresh();
        },
        [handleRefresh],
      ),

      onMetricsUpdated: useCallback((data) => {
        console.log("Metrics updated:", data);
        // Update metrics from the event data directly
        setMetrics(data.metrics as unknown as RunMetadata);
      }, []),

      onRunPaused: useCallback((data) => {
        console.log("Run paused:", data);
        // Update run status to paused
        setRun((prev) => ({
          ...prev,
          status: "paused",
          metadata: {
            ...prev.metadata,
            pausedAt: data.pausedAt,
            pauseReason: data.reason,
          },
        }));
      }, []),

      // Use the properly defined event handler
      onRunStatusChanged: useCallback((data) => {
        console.log("Run status changed:", data);
        setRun((prev) => ({
          ...prev,
          status: data.status,
          updatedAt: new Date(data.updatedAt),
        }));
      }, []),
    },
    { enabled: !!runId },
  );

  // Also listen to org-level events
  useOrganizationEvents(
    orgId,
    {
      onRunUpdated: (data) => {
        if (data.runId === runId) {
          console.log("Run updated at org level:", data);
          // Only update if the status or metadata has changed
          setRun((prev) => {
            // Check if data is actually different before updating
            const statusChanged = prev.status !== data.status;
            const metadataChanged =
              data.metadata &&
              JSON.stringify(prev.metadata) !==
                JSON.stringify({ ...prev.metadata, ...data.metadata });

            if (statusChanged || metadataChanged) {
              return {
                ...prev,
                status: data.status as TRun["status"],
                metadata: {
                  ...prev.metadata,
                  ...(data.metadata || {}),
                },
              };
            }
            return prev; // Return unchanged state if nothing has changed
          });
        }
      },
      onCallUpdated: (data) => {
        if (data.runId === runId) {
          console.log("Call updated at org level:", data);
          // Debounce the refresh to prevent too many API calls
          setTimeout(handleRefresh, 1000);
        }
      },
    },
    { enabled: !!orgId },
  );

  // Calculate stats from metadata
  const totalRows = metrics?.rows?.total || 0;
  const invalidRows = metrics?.rows?.invalid || 0;
  const validRows = totalRows - invalidRows;

  // Add a helper function to safely access nested properties
  const getNestedValue = (obj: any, path: string, defaultValue: any = 0) => {
    try {
      const value = path
        .split(".")
        .reduce((prev, curr) => prev && prev[curr], obj);
      return value !== undefined && value !== null ? value : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  };

  // Use the actual row counts from the database if available
  const totalCalls =
    getNestedValue(counts, "total") ||
    getNestedValue(metrics, "calls.total", 0);
  const completedCalls =
    getNestedValue(counts, "completed") ||
    getNestedValue(metrics, "calls.completed", 0);
  const failedCalls =
    getNestedValue(counts, "failed") ||
    getNestedValue(metrics, "calls.failed", 0);
  const callingCalls =
    getNestedValue(counts, "calling") ||
    getNestedValue(metrics, "calls.calling", 0);
  const pendingCalls =
    getNestedValue(counts, "pending") ||
    getNestedValue(metrics, "calls.pending", 0);
  const connectedCalls =
    getNestedValue(counts, "connected") ||
    getNestedValue(metrics, "calls.connected", 0);
  const voicemailCalls =
    getNestedValue(counts, "voicemail") ||
    getNestedValue(metrics, "calls.voicemail", 0);
  const convertedCalls = getNestedValue(metrics, "calls.converted", 0);

  // Update run metadata if counts are available
  useEffect(() => {
    if (counts && JSON.stringify(counts) !== "{}") {
      // Only update if we have actual counts data AND if the values are different
      const currentCallsTotal = metrics?.calls?.total || 0;
      const currentCallsCompleted = metrics?.calls?.completed || 0;
      const currentCallsFailed = metrics?.calls?.failed || 0;
      const currentCallsCalling = metrics?.calls?.calling || 0;
      const currentCallsPending = metrics?.calls?.pending || 0;

      // Check if we need to update by comparing with current values
      if (
        counts.total !== currentCallsTotal ||
        counts.completed !== currentCallsCompleted ||
        counts.failed !== currentCallsFailed ||
        counts.calling !== currentCallsCalling ||
        counts.pending !== currentCallsPending
      ) {
        // Only update if values have changed
        const updatedMetrics = {
          ...metrics,
          calls: {
            ...metrics?.calls,
            total: counts.total,
            completed: counts.completed,
            failed: counts.failed,
            calling: counts.calling,
            pending: counts.pending,
          },
        };

        // Properly update metrics using setState instead of direct mutation
        setMetrics(updatedMetrics);
      }
    }
  }, [counts, metrics]); // Depend on counts and metrics changing

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
    run.status === "ready" ||
    run.status === "paused" ||
    run.status === "scheduled" ||
    run.status === "draft";
  const canPause = run.status === "running";

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
            {metrics?.run?.startTime && (
              <>
                {" "}
                • Started{" "}
                {formatDistance(new Date(metrics.run.startTime), new Date(), {
                  addSuffix: true,
                })}
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant={getStatusBadgeVariant(run.status) as any}
            className="flex items-center gap-1.5"
          >
            {getStatusIcon(run.status)}
            {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
          </Badge>

          {/* Always show buttons for debugging */}
          <Button
            variant="default"
            size="sm"
            onClick={handleStartRun}
            disabled={isLoading || (!canStart && run.status !== "draft")}
          >
            {isLoading && isStartingRun ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="mr-1.5 h-4 w-4" />
            )}
            Start Run
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePauseRun}
            disabled={isLoading || !canPause}
          >
            {isLoading && isPausingRun ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <PauseCircle className="mr-1.5 h-4 w-4" />
            )}
            Pause Run
          </Button>

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
          <TabsTrigger value="variation">Variation</TabsTrigger>
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
                <div className="text-2xl font-bold">{totalCalls}</div>
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
                  {completedCalls + failedCalls} out of {totalCalls}
                </div>
                <Progress value={callProgress} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Conversion Rate
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{conversionRate}%</div>
                <p className="text-xs text-muted-foreground">
                  {connectedCalls} connected calls
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Call Status
                </CardTitle>
                <Phone className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Connected</span>
                  <span className="text-sm font-bold">{connectedCalls}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Voicemail</span>
                  <span className="text-sm font-bold">{voicemailCalls}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Failed</span>
                  <span className="text-sm font-bold">{failedCalls}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Pending</span>
                  <span className="text-sm font-bold">{pendingCalls}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Run Details</CardTitle>
              </CardHeader>
              <CardContent>
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

                  {metrics?.run?.duration !== undefined &&
                    typeof metrics?.run?.duration === "number" && (
                      <div className="flex items-center justify-between">
                        <p className="text-sm">Run Duration</p>
                        <p className="text-sm font-medium">
                          {Math.floor(metrics.run.duration / 60)} min{" "}
                          {Math.floor(metrics.run.duration % 60)} sec
                        </p>
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="data">
          <Card>
            <CardContent className="pt-6">
              <RunRowsTable runId={initialRun.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variation">
          <div>
            {metrics?.metadata || metrics?.comparison ? (
              <VariationMetadata
                metadata={metrics?.metadata}
                comparison={metrics?.comparison}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Variation Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    No variation data available for this run.
                  </div>
                  {run.customPrompt && (
                    <div className="mt-4">
                      <h4 className="mb-2 text-sm font-semibold">
                        Custom Prompt
                      </h4>
                      <div className="rounded-md bg-muted p-4">
                        <pre className="whitespace-pre-wrap text-sm">
                          {run.customPrompt}
                        </pre>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
