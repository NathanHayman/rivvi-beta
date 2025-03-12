"use client";

import { debounce } from "lodash";
import {
  Calendar,
  CheckCircle,
  Clock,
  Download,
  Hourglass,
  ListChecks,
  Loader2,
  MoveDownLeft,
  MoveUpRight,
  PauseCircle,
  PauseIcon,
  Phone,
  PhoneIncoming,
  PhoneOff,
  PlayIcon,
  RefreshCcwIcon,
  RefreshCw,
  Sparkles,
  VoicemailIcon,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRun } from "@/hooks/runs/use-runs";
import { useOrganizationEvents } from "@/hooks/use-pusher";
import { useRunEvents } from "@/hooks/use-run-events";
import { formatDateDistance } from "@/lib/utils/date-utils";
import { TCampaign, TRun } from "@/types/db";
import { RunRowsTable } from "./run-rows-table";

type RunDetailsProps = {
  run: TRun;
  campaign: TCampaign;
  initialAnalytics?: any;
};

type RunMetadata = {
  run?: {
    startTime?: string;
    endTime?: string;
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

// New StatCard component for better visualization
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    positive: boolean;
  };
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
}) => {
  return (
    <Card className={`flex flex-col justify-between ${className}`}>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <CardDescription className="text-2xl font-bold tracking-tight">
            {value}
          </CardDescription>
        </div>
        <div className="rounded-md border bg-background p-2">{icon}</div>
      </CardHeader>
      <CardContent className="pt-0">
        {trend && (
          <div className="flex items-center gap-2">
            {trend.positive ? (
              <MoveUpRight className="text-success h-4 w-4" />
            ) : (
              <MoveDownLeft className="h-4 w-4 text-destructive" />
            )}
            <span
              className={`text-sm ${trend.positive ? "text-success" : "text-destructive"}`}
            >
              {trend.value}
            </span>
          </div>
        )}
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
};

// New ProgressCard component
interface ProgressCardProps {
  title: string;
  value: number;
  target: number;
  subtitle?: string;
  className?: string;
}

const ProgressCard: React.FC<ProgressCardProps> = ({
  title,
  value,
  target,
  subtitle,
  className,
}) => {
  const percentage = target > 0 ? Math.round((value / target) * 100) : 0;

  return (
    <Card className={`flex flex-col justify-between ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <Badge variant="outline">{percentage}%</Badge>
        </div>
        <CardDescription className="text-2xl font-bold tracking-tight">
          {value} / {target}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Progress value={percentage} className="h-2" />
        {subtitle && (
          <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
};

// New CallStatusSection component
interface CallStatusProps {
  completed: number;
  failed: number;
  voicemails: number;
  callbacks: number;
}

const CallStatusSection: React.FC<CallStatusProps> = ({
  completed,
  failed,
  voicemails,
  callbacks,
}) => {
  const total = completed + failed + voicemails;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">
          Call Status Breakdown
        </CardTitle>
        <CardDescription>Overview of all call outcomes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="flex flex-col items-center rounded-md border p-3">
            <div className="mb-2 rounded-full bg-primary/10 p-2">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <span className="text-2xl font-bold">{completed}</span>
            <span className="text-sm text-muted-foreground">Completed</span>
          </div>
          <div className="flex flex-col items-center rounded-md border p-3">
            <div className="mb-2 rounded-full bg-destructive/10 p-2">
              <PhoneOff className="h-5 w-5 text-destructive" />
            </div>
            <span className="text-2xl font-bold">{failed}</span>
            <span className="text-sm text-muted-foreground">Failed</span>
          </div>

          {/* Make voicemail section obvious */}
          <div className="flex flex-col items-center rounded-md border p-3">
            <div className="mb-2 rounded-full bg-amber-500/10 p-2">
              <VoicemailIcon className="h-5 w-5 text-amber-500" />
            </div>
            <span className="text-2xl font-bold">{voicemails}</span>
            <span className="text-sm text-muted-foreground">Voicemails</span>
          </div>

          <div className="flex flex-col items-center rounded-md border p-3">
            <div className="mb-2 rounded-full bg-blue-500/10 p-2">
              <PhoneIncoming className="h-5 w-5 text-blue-500" />
            </div>
            <span className="text-2xl font-bold">{callbacks}</span>
            <span className="text-sm text-muted-foreground">Callbacks</span>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex justify-between">
            <span className="text-sm font-medium">Call Completion Rate</span>
            <span className="text-sm font-medium">{completionRate}%</span>
          </div>
          <Progress value={completionRate} className="h-2" />

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-primary"></div>
              <span className="text-xs text-muted-foreground">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-destructive"></div>
              <span className="text-xs text-muted-foreground">Failed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-amber-500"></div>
              <span className="text-xs text-muted-foreground">Voicemails</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Create a new RunHeader component
interface RunHeaderProps {
  run: TRun;
  campaign: TCampaign;
  onStart: () => void;
  onPause: () => void;
  isStarting: boolean;
  isPausing: boolean;
  canStart: boolean;
  canPause: boolean;
  isCompleted: boolean;
  isFailed: boolean;
}

const RunHeader: React.FC<RunHeaderProps> = ({
  run,
  campaign,
  onStart,
  onPause,
  isStarting,
  isPausing,
  canStart,
  canPause,
  isCompleted,
  isFailed,
}) => {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{run.name}</h1>
        <p className="text-sm text-muted-foreground">
          Created {formatDateDistance(run.createdAt)}
          {run.updatedAt && run.updatedAt !== run.createdAt && (
            <> • Updated {formatDateDistance(run.updatedAt)}</>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canStart && (
          <Button
            variant="default"
            size="sm"
            onClick={onStart}
            disabled={isStarting || isPausing}
            className="gap-1"
          >
            {isStarting ? (
              <>
                <RefreshCcwIcon className="h-3.5 w-3.5 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <PlayIcon className="h-3.5 w-3.5" />
                Start Run
              </>
            )}
          </Button>
        )}

        {canPause && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPause}
            disabled={isStarting || isPausing}
            className="gap-1"
          >
            {isPausing ? (
              <>
                <RefreshCcwIcon className="h-3.5 w-3.5 animate-spin" />
                Pausing...
              </>
            ) : (
              <>
                <PauseIcon className="h-3.5 w-3.5" />
                Pause Run
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export function RunDetails({
  run: initialRun,
  campaign,
  initialAnalytics,
}: RunDetailsProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [run, setRun] = useState<TRun>(initialRun);
  const [metrics, setMetrics] = useState<RunMetadata | null>(() => {
    // Initialize metrics with any existing variation data from the run metadata
    const runMetadata = initialRun.metadata as any;
    const existingMetrics = initialRun.metadata as RunMetadata | null;

    // Check if we need to extract variation data from run metadata
    if (runMetadata?.promptVariation || runMetadata?.voicemailVariation) {
      return {
        ...existingMetrics,
        metadata: (runMetadata.metadata as VariationMetadataType) || {
          categories: runMetadata.categories || [],
          tags: runMetadata.tags || [],
          keyChanges: runMetadata.keyChanges || [],
          toneShift: runMetadata.toneShift || "",
          focusArea: runMetadata.focusArea || "",
          changeIntent: runMetadata.changeIntent || "",
          sentimentShift: runMetadata.sentimentShift || {
            before: "",
            after: "",
          },
          promptLength: runMetadata.promptLength || {
            before: 0,
            after: 0,
            difference: 0,
          },
        },
        comparison: (runMetadata.comparison as ComparisonType) || {
          structuralChanges: runMetadata.structuralChanges || [],
          keyPhrases: runMetadata.keyPhrases || {
            added: [],
            removed: [],
            modified: [],
          },
          performancePrediction: runMetadata.performancePrediction || {
            expectedImpact: "neutral",
            confidenceLevel: 0,
            rationale: "",
          },
        },
        summary: runMetadata.summary || "",
        diffData: {
          promptDiff: runMetadata.promptDiff || [],
          voicemailDiff: runMetadata.voicemailDiff || [],
        },
      };
    }

    return existingMetrics;
  });
  const { startRun, pauseRun, isStartingRun, isPausingRun, refetch } = useRun(
    initialRun.id,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const runId = initialRun.id;
  const orgId = initialRun.orgId;

  // Add analytics state
  const [analytics, setAnalytics] = useState<any>(initialAnalytics || null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  // Add state for inbound callbacks
  const [inboundCallbacks, setInboundCallbacks] = useState<number>(
    initialAnalytics?.callMetrics?.inboundReturns || 0,
  );

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
          inboundCallbacks: initialAnalytics.callMetrics.inboundReturns || 0,
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
        const inboundCallbacksValue = data.callMetrics?.inboundReturns || 0;

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
            inboundReturns: inboundCallbacksValue,
          },
        });

        // Set inbound callbacks directly
        setInboundCallbacks(inboundCallbacksValue);

        // Update counts state with inbound callbacks
        setCounts((prev) =>
          prev
            ? {
                ...prev,
                inboundCallbacks: inboundCallbacksValue,
              }
            : null,
        );

        // Update metrics with any variation data from analytics
        if ((data as any).variationData) {
          setMetrics((prevMetrics) => ({
            ...prevMetrics,
            metadata:
              (data as any).variationData.metadata || prevMetrics?.metadata,
            comparison:
              (data as any).variationData.comparison || prevMetrics?.comparison,
            summary:
              (data as any).variationData.summary || prevMetrics?.summary,
            diffData:
              (data as any).variationData.diffData || prevMetrics?.diffData,
          }));
        }
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

      // Update the onCallCompleted handler in useRunEvents to properly count voicemails
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

              // Check if this is a voicemail call
              const isVoicemail =
                data.status === "voicemail" ||
                data.metadata?.wasVoicemail ||
                (data.analysis &&
                  (data.analysis.voicemail_detected === true ||
                    data.analysis.left_voicemail === true ||
                    data.analysis.in_voicemail === true));

              // Increase the appropriate status count based on status and voicemail check
              if (isVoicemail) {
                // Make sure we're tracking voicemails
                updatedCalls.voicemail = (updatedCalls.voicemail || 0) + 1;
                console.log(
                  "Detected and counted voicemail in call completion event",
                );
              } else if (data.status === "completed") {
                updatedCalls.completed = (updatedCalls.completed || 0) + 1;
              } else if (data.status === "failed") {
                updatedCalls.failed = (updatedCalls.failed || 0) + 1;
              }

              return { ...prev, calls: updatedCalls };
            });
          }

          // Use debounced refresh
          handleRefresh();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [handleRefresh],
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // Improved voicemail counting
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts]); // Remove metrics from dependency array to prevent infinite loops

  const callProgress =
    totalCalls > 0
      ? Math.round(((completedCalls + failedCalls) / totalCalls) * 100)
      : 0;

  const conversionRate =
    completedCalls > 0
      ? Math.round((connectedCalls / completedCalls) * 100)
      : 0;

  // Calculate whether controls should be enabled
  const canStart = run.status === "draft" || run.status === "paused";
  const canPause = run.status === "running" || run.status === "scheduled";
  const isCompleted = run.status === "completed";
  const isFailed = run.status === "failed";
  const isLoading = isRefreshing || isStartingRun || isPausingRun;

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

  // Helper function to format duration in a human-readable format
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;

    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  };

  // Add an export function
  const handleExportRun = useCallback(() => {
    console.log("Exporting run data...");
    // Implement export functionality here
    // You can add a proper implementation later
  }, []);

  // Update useEffect for variation data
  useEffect(() => {
    // Process and set variation data if available but not yet loaded into metrics
    const runMetadata = run.metadata as any;
    if (
      (runMetadata?.promptVariation || runMetadata?.voicemailVariation) &&
      !metrics?.metadata &&
      !metrics?.comparison &&
      !metrics?.diffData
    ) {
      setMetrics((prevMetrics) => ({
        ...prevMetrics,
        metadata: (runMetadata.metadata as VariationMetadataType) || {
          categories: runMetadata.categories || [],
          tags: runMetadata.tags || [],
          keyChanges: runMetadata.keyChanges || [],
          toneShift: runMetadata.toneShift || "",
          focusArea: runMetadata.focusArea || "",
          changeIntent: runMetadata.changeIntent || "",
          sentimentShift: runMetadata.sentimentShift || {
            before: "",
            after: "",
          },
          promptLength: runMetadata.promptLength || {
            before: 0,
            after: 0,
            difference: 0,
          },
        },
        comparison: (runMetadata.comparison as ComparisonType) || {
          structuralChanges: runMetadata.structuralChanges || [],
          keyPhrases: runMetadata.keyPhrases || {
            added: [],
            removed: [],
            modified: [],
          },
          performancePrediction: runMetadata.performancePrediction || {
            expectedImpact: "neutral",
            confidenceLevel: 0,
            rationale: "",
          },
        },
        summary: runMetadata.summary || "",
        diffData: {
          promptDiff: runMetadata.promptDiff || [],
          voicemailDiff: runMetadata.voicemailDiff || [],
        },
      }));

      // Check if URL has variation tab parameter
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("tab") === "variation") {
        setActiveTab("variation");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]); // Remove metrics from dependency array to prevent infinite loops

  // Use the new UI in the render section
  return (
    <div className="space-y-4">
      <RunHeader
        run={run}
        campaign={campaign}
        onStart={handleStartRun}
        onPause={handlePauseRun}
        isStarting={isStartingRun}
        isPausing={isPausingRun}
        canStart={canStart}
        canPause={canPause}
        isCompleted={isCompleted}
        isFailed={isFailed}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`${getStatusBadgeVariant(
              run.status,
            )} flex items-center gap-1`}
          >
            {getStatusIcon(run.status)}
            {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
          </Badge>

          {metrics?.run?.startTime && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {metrics.run.duration
                ? formatDuration(metrics.run.duration)
                : "Running..."}
            </Badge>
          )}

          {(run.metadata as any)?.promptKey && (
            <Badge
              variant="outline"
              className="flex items-center gap-1 bg-blue-50 text-blue-600 hover:bg-blue-100"
            >
              <Sparkles className="h-3 w-3" />
              {(run.metadata as any).promptKey}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-1"
          >
            <RefreshCcwIcon
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportRun}
            className="gap-1"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      <Tabs
        defaultValue="overview"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList
          className={`grid w-full ${metrics?.metadata || metrics?.comparison || metrics?.summary || metrics?.diffData ? "grid-cols-3" : "grid-cols-2"}`}
        >
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          {(metrics?.metadata ||
            metrics?.comparison ||
            metrics?.summary ||
            metrics?.diffData) && (
            <TabsTrigger value="variation">Variation</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          {/* Statistics Summary */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Rows"
              value={totalCalls}
              icon={<ListChecks className="h-4 w-4 text-primary" />}
              subtitle={
                invalidRows > 0
                  ? `${invalidRows} invalid rows skipped`
                  : undefined
              }
            />
            <StatCard
              title="Conversion Rate"
              value={`${conversionRate}%`}
              icon={<CheckCircle className="h-4 w-4 text-primary" />}
              subtitle={`${connectedCalls} patients reached`}
            />
            <StatCard
              title="Call Progress"
              value={`${completedCalls + failedCalls} / ${totalCalls}`}
              icon={<Phone className="h-4 w-4 text-primary" />}
              subtitle={`${callProgress}% completion rate`}
            />
            <StatCard
              title="Inbound Callbacks"
              value={inboundCallbacks}
              icon={<PhoneIncoming className="h-4 w-4 text-blue-500" />}
            />
          </div>

          {/* Call Status Section */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <CallStatusSection
                completed={completedCalls}
                failed={failedCalls}
                voicemails={voicemailCalls}
                callbacks={inboundCallbacks}
              />
            </div>
            <div className="space-y-4">
              <ProgressCard
                title="Call Progress"
                value={completedCalls + failedCalls}
                target={totalCalls}
                subtitle={`${totalCalls - (completedCalls + failedCalls)} calls remaining`}
              />
              <ProgressCard
                title="Conversion Goal"
                value={connectedCalls}
                target={Math.ceil(completedCalls * 0.5)} // Example goal: 50% conversion
                subtitle="Patients successfully reached"
              />
            </div>
          </div>

          {/* Run Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Run Details</CardTitle>
              <CardDescription>
                Essential information about this run
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                <div>
                  <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                    Run ID
                  </h3>
                  <p className="font-mono text-sm">{run.id}</p>
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                    Created
                  </h3>
                  <p className="text-sm">{formatDateDistance(run.createdAt)}</p>
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                    Last Updated
                  </h3>
                  <p className="text-sm">{formatDateDistance(run.updatedAt)}</p>
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                    Status
                  </h3>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(run.status)}
                    <span className="text-sm">
                      {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                    Campaign
                  </h3>
                  <p className="text-sm">{campaign.name}</p>
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                    Organization
                  </h3>
                  <p className="text-sm">{run.orgId}</p>
                </div>
                {(run.metadata as any)?.pauseReason && (
                  <div className="col-span-full">
                    <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                      Pause Reason
                    </h3>
                    <p className="text-sm">
                      {(run.metadata as any).pauseReason}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="mt-4">
          <RunRowsTable runId={runId} />
        </TabsContent>

        <TabsContent value="variation" className="mt-4">
          {metrics?.metadata ||
          metrics?.comparison ||
          metrics?.summary ||
          metrics?.diffData ? (
            <div className="space-y-6">
              {/* Variation metadata component */}
              <VariationMetadata
                metadata={metrics?.metadata}
                comparison={metrics?.comparison}
                summary={metrics?.summary}
                diffData={metrics?.diffData}
              />

              {/* Updated Prompt and Voicemail Cards */}
              <div className="grid gap-6 md:grid-cols-2">
                {metrics?.diffData?.promptDiff &&
                  metrics.diffData.promptDiff.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Prompt Changes
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <DiffDisplay diff={metrics.diffData.promptDiff} />
                      </CardContent>
                    </Card>
                  )}

                {metrics?.diffData?.voicemailDiff &&
                  metrics.diffData.voicemailDiff.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Voicemail Changes
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <DiffDisplay diff={metrics.diffData.voicemailDiff} />
                      </CardContent>
                    </Card>
                  )}
              </div>
            </div>
          ) : isRefreshing || isLoadingAnalytics ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
              <h3 className="mb-2 text-lg font-medium">
                Loading Variation Data
              </h3>
              <p className="text-sm text-muted-foreground">
                We&apos;re processing the agent variation information...
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="mb-4 text-4xl">📝</div>
              <h3 className="mb-2 text-lg font-medium">
                No Variation Data Available
              </h3>
              <p className="text-sm text-muted-foreground">
                This run doesn&apos;t have any prompt or voicemail variations to
                display.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
