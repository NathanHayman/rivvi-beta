"use client";

import type React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Component to display the diff
const DiffDisplay = ({
  diff,
}: {
  diff?: Array<{ type?: "unchanged" | "added" | "removed"; value?: string }>;
}) => {
  if (!diff || !Array.isArray(diff)) {
    return (
      <div className="italic text-muted-foreground">No diff data available</div>
    );
  }

  return (
    <div className="whitespace-pre-wrap font-mono text-sm">
      {diff.map((segment, index) => {
        let className = "inline";
        if (segment.type === "added")
          className =
            "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300 inline";
        if (segment.type === "removed")
          className =
            "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300 line-through inline";

        return (
          <span key={index} className={className}>
            {segment.value || ""}{" "}
          </span>
        );
      })}
    </div>
  );
};

interface StreamingGenerationUIProps {
  isGenerating: boolean;
  isComplete: boolean;
  currentTask: string;
  streamedData: any;
  progress: number;
}

const StreamingGenerationUI = ({
  isGenerating,
  isComplete,
  currentTask,
  streamedData,
  progress,
}: StreamingGenerationUIProps) => {
  // Helper functions for determining what to show
  const isLoaded = (data: any) => data !== undefined && data !== null;
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollPosition = useRef(0);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    summary: true,
    categories: true,
    keyChanges: true,
    metrics: true,
    prediction: true,
    structural: true,
    diff: true,
    keyPhrases: true,
  });

  // Extract data for easier access
  const metadata = streamedData?.metadata || {};
  const comparison = streamedData?.comparison || {};
  const diffData = streamedData?.diffData || {};

  // Determine if specific sections exist
  const hasCategories = metadata?.categories?.length > 0;
  const hasTags = metadata?.tags?.length > 0;
  const hasKeyChanges = metadata?.keyChanges?.length > 0;
  const hasMetrics =
    isLoaded(metadata?.promptLength) ||
    isLoaded(metadata?.sentimentShift) ||
    isLoaded(metadata?.formalityLevel) ||
    isLoaded(metadata?.complexityScore);
  const hasPrediction = isLoaded(comparison?.performancePrediction);
  const hasDiff =
    isLoaded(diffData?.promptDiff) && diffData.promptDiff?.length > 0;
  const hasKeyPhrases = isLoaded(comparison?.keyPhrases);
  const hasStructural =
    isLoaded(comparison?.structuralChanges) &&
    comparison.structuralChanges.length > 0;

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Handle scroll events to detect manual scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollContainerRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } =
        scrollContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;

      // If user scrolled up, disable auto-scroll
      if (scrollTop < lastScrollPosition.current && autoScroll) {
        setAutoScroll(false);
      }

      // If user scrolled to bottom, enable auto-scroll
      if (isAtBottom && !autoScroll) {
        setAutoScroll(true);
      }

      lastScrollPosition.current = scrollTop;
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll, {
        passive: true,
      });
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", handleScroll);
      }
    };
  }, [autoScroll]);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current && isGenerating) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [streamedData, isGenerating, autoScroll]);

  // Function to render loading or content
  const renderSection = (
    condition: boolean,
    content: React.ReactNode,
    loadingHeight = "h-4",
    sectionKey: string,
  ) => {
    if (condition) {
      return (
        <Card className="overflow-hidden border shadow-sm transition-all duration-200">
          <div
            className="flex cursor-pointer items-center justify-between border-b bg-muted/30 px-4 py-3"
            onClick={() => toggleSection(sectionKey)}
          >
            <h3 className="text-sm font-medium">
              {sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)}
            </h3>
            {expandedSections[sectionKey] ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div
            className={cn(
              "transition-all duration-200 ease-in-out",
              expandedSections[sectionKey]
                ? "max-h-[500px] opacity-100"
                : "max-h-0 overflow-hidden opacity-0",
            )}
          >
            <CardContent className="p-4">{content}</CardContent>
          </div>
        </Card>
      );
    }
    return isGenerating ? (
      <div className="space-y-2">
        <Skeleton className={`w-full ${loadingHeight}`} />
        <Skeleton className={`w-3/4 ${loadingHeight}`} />
      </div>
    ) : null;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Generation Status Header - Fixed at top */}
      <div className="sticky top-0 z-10 rounded-md border bg-background/95 p-3 shadow-sm backdrop-blur-sm">
        <div className="flex items-center space-x-2">
          {isGenerating ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : isComplete ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <Info className="h-5 w-5 text-muted-foreground" />
          )}
          <h3 className="text-base font-medium">
            {isGenerating
              ? currentTask
              : isComplete
                ? "Generation complete"
                : "Waiting to start"}
          </h3>
        </div>

        {/* Progress bar with animation */}
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full bg-primary transition-all duration-300 ease-out",
              isGenerating && "relative overflow-hidden",
            )}
            style={{ width: `${progress}%` }}
          >
            {isGenerating && (
              <div className="absolute inset-0 h-full w-full">
                <div className="animate-pulse-gradient h-full w-[200%] bg-gradient-to-r from-primary/0 via-primary-foreground/30 to-primary/0"></div>
              </div>
            )}
          </div>
        </div>

        {/* Progress checkpoints */}
        <div className="mt-2 grid grid-cols-4 gap-1 text-xs">
          <div
            className={cn(
              "flex items-center",
              progress >= 25 ? "text-green-600" : "text-muted-foreground",
            )}
          >
            <div
              className={cn(
                "mr-1 h-1.5 w-1.5 rounded-full",
                progress >= 25 ? "bg-green-500" : "bg-muted-foreground/30",
              )}
            ></div>
            Categories
          </div>
          <div
            className={cn(
              "flex items-center",
              progress >= 50 ? "text-green-600" : "text-muted-foreground",
            )}
          >
            <div
              className={cn(
                "mr-1 h-1.5 w-1.5 rounded-full",
                progress >= 50 ? "bg-green-500" : "bg-muted-foreground/30",
              )}
            ></div>
            Enhance prompt
          </div>
          <div
            className={cn(
              "flex items-center",
              progress >= 75 ? "text-green-600" : "text-muted-foreground",
            )}
          >
            <div
              className={cn(
                "mr-1 h-1.5 w-1.5 rounded-full",
                progress >= 75 ? "bg-green-500" : "bg-muted-foreground/30",
              )}
            ></div>
            Analyze changes
          </div>
          <div
            className={cn(
              "flex items-center",
              progress >= 100 ? "text-green-600" : "text-muted-foreground",
            )}
          >
            <div
              className={cn(
                "mr-1 h-1.5 w-1.5 rounded-full",
                progress >= 100 ? "bg-green-500" : "bg-muted-foreground/30",
              )}
            ></div>
            Complete
          </div>
        </div>
      </div>

      {/* Auto-scroll toggle */}
      <div className="sticky top-[100px] z-10 mt-2 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1 rounded-full border bg-background/80 px-3 text-xs backdrop-blur-sm",
            autoScroll
              ? "border-primary/50 text-primary"
              : "text-muted-foreground",
          )}
          onClick={() => setAutoScroll(!autoScroll)}
        >
          {autoScroll ? (
            <>
              <CheckCircle className="h-3 w-3" /> Auto-scroll on
            </>
          ) : (
            <>
              <Info className="h-3 w-3" /> Auto-scroll off
            </>
          )}
        </Button>
      </div>

      {/* Scrollable content area */}
      <div
        ref={scrollContainerRef}
        className="mt-2 flex-1 space-y-3 overflow-y-auto pb-4 pr-1"
      >
        {/* Summary Section - Always at top */}
        {isLoaded(streamedData?.summary) && (
          <div className="rounded-lg border-2 border-primary bg-primary/5 p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-medium text-primary">
              Summary of Changes
            </h3>
            <p className="text-sm">{streamedData?.summary}</p>
          </div>
        )}

        {/* Categories & Tags */}
        {renderSection(
          hasCategories || hasTags,
          <div className="space-y-4">
            {hasCategories && (
              <div>
                <span className="mb-2 block text-xs font-medium">
                  Categories:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {Array.isArray(metadata?.categories) &&
                    metadata.categories.map((category: string, i: number) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="bg-blue-100 dark:bg-blue-900/30"
                      >
                        {category}
                      </Badge>
                    ))}
                </div>
              </div>
            )}

            {hasTags && (
              <div>
                <span className="mb-2 block text-xs font-medium">Tags:</span>
                <div className="flex flex-wrap gap-1.5">
                  {Array.isArray(metadata?.tags) &&
                    metadata.tags.map((tag: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </div>,
          "h-20",
          "categories",
        )}

        {/* Key Changes */}
        {renderSection(
          hasKeyChanges,
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            {Array.isArray(metadata?.keyChanges) &&
              metadata.keyChanges.map((change: string, i: number) => (
                <li key={i}>{change}</li>
              ))}
          </ul>,
          "h-24",
          "keyChanges",
        )}

        {/* Metrics */}
        {renderSection(
          hasMetrics,
          <div className="space-y-2 text-sm">
            {isLoaded(metadata.promptLength) && (
              <div className="flex items-center justify-between">
                <span className="font-medium">Length Change:</span>
                <span>
                  {metadata?.promptLength?.before} →{" "}
                  {metadata?.promptLength?.after} (
                  {metadata?.promptLength?.difference > 0 ? "+" : ""}
                  {metadata?.promptLength?.difference} chars)
                </span>
              </div>
            )}

            {isLoaded(metadata.sentimentShift) && (
              <div className="flex items-center justify-between">
                <span className="font-medium">Sentiment:</span>
                <span>
                  {metadata?.sentimentShift?.before} →{" "}
                  {metadata?.sentimentShift?.after}
                </span>
              </div>
            )}

            {isLoaded(metadata.formalityLevel) && (
              <div className="flex items-center justify-between">
                <span className="font-medium">Formality (1-10):</span>
                <span>
                  {metadata?.formalityLevel?.before} →{" "}
                  {metadata?.formalityLevel?.after}
                </span>
              </div>
            )}

            {isLoaded(metadata.complexityScore) && (
              <div className="flex items-center justify-between">
                <span className="font-medium">Complexity (1-10):</span>
                <span>
                  {metadata?.complexityScore?.before} →{" "}
                  {metadata?.complexityScore?.after}
                </span>
              </div>
            )}

            {isLoaded(metadata.toneShift) && (
              <div className="flex items-center justify-between">
                <span className="font-medium">Tone:</span>
                <span>{metadata.toneShift}</span>
              </div>
            )}

            {isLoaded(metadata.focusArea) && (
              <div className="flex items-center justify-between">
                <span className="font-medium">Focus Area:</span>
                <span>{metadata.focusArea}</span>
              </div>
            )}
          </div>,
          "h-24",
          "metrics",
        )}

        {/* Prediction */}
        {renderSection(
          hasPrediction,
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Expected Impact:</span>
              <Badge
                className={cn({
                  "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300":
                    comparison?.performancePrediction?.expectedImpact ===
                    "positive",
                  "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300":
                    comparison?.performancePrediction?.expectedImpact ===
                    "negative",
                  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300":
                    comparison?.performancePrediction?.expectedImpact ===
                      "neutral" ||
                    comparison?.performancePrediction?.expectedImpact ===
                      "uncertain",
                })}
              >
                {comparison?.performancePrediction?.expectedImpact || "unknown"}
              </Badge>
              <span className="text-xs">
                (Confidence:{" "}
                {comparison?.performancePrediction?.confidenceLevel || "?"}
                /10)
              </span>
            </div>
            {comparison?.performancePrediction?.rationale && (
              <p className="text-sm">
                {comparison?.performancePrediction?.rationale}
              </p>
            )}
          </div>,
          "h-20",
          "prediction",
        )}

        {/* Structural Changes */}
        {renderSection(
          hasStructural,
          <div className="space-y-2 text-sm">
            {Array.isArray(comparison?.structuralChanges) &&
              comparison.structuralChanges.map((change: any, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <Badge
                    variant="outline"
                    className={cn({
                      "border-green-200 text-green-600":
                        change.changeType === "added",
                      "border-red-200 text-red-600":
                        change.changeType === "removed",
                      "border-amber-200 text-amber-600":
                        change.changeType === "modified",
                      "text-gray-600 border-gray-200":
                        !change.changeType ||
                        (change.changeType !== "added" &&
                          change.changeType !== "removed" &&
                          change.changeType !== "modified"),
                    })}
                  >
                    {change.changeType || "neutral"}
                  </Badge>
                  <div>
                    <span className="font-medium">{change.section}:</span>{" "}
                    {change.description}
                  </div>
                </div>
              ))}
          </div>,
          "h-20",
          "structural",
        )}

        {/* Diff Visualization */}
        {renderSection(
          hasDiff,
          <div>
            <div className="max-h-60 overflow-auto rounded-md bg-muted/20 p-2">
              <DiffDisplay diff={diffData?.promptDiff} />
            </div>

            {isLoaded(diffData?.voicemailDiff) &&
              diffData.voicemailDiff.length > 0 && (
                <div className="mt-3">
                  <h4 className="mb-1 text-xs font-semibold">Voicemail:</h4>
                  <div className="max-h-40 overflow-auto rounded-md bg-muted/20 p-2">
                    <DiffDisplay diff={diffData?.voicemailDiff} />
                  </div>
                </div>
              )}
          </div>,
          "h-24",
          "diff",
        )}

        {/* Key Phrases */}
        {renderSection(
          hasKeyPhrases,
          <div className="space-y-3">
            {comparison?.keyPhrases?.added &&
              Array.isArray(comparison.keyPhrases.added) &&
              comparison.keyPhrases.added.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-green-600">
                    Added:
                  </span>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                    {comparison.keyPhrases.added.map(
                      (phrase: string, i: number) => (
                        <li key={i}>{phrase}</li>
                      ),
                    )}
                  </ul>
                </div>
              )}

            {comparison?.keyPhrases?.removed &&
              Array.isArray(comparison.keyPhrases.removed) &&
              comparison.keyPhrases.removed.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-red-600">
                    Removed:
                  </span>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                    {comparison.keyPhrases.removed.map(
                      (phrase: string, i: number) => (
                        <li key={i}>{phrase}</li>
                      ),
                    )}
                  </ul>
                </div>
              )}

            {comparison?.keyPhrases?.modified &&
              Array.isArray(comparison.keyPhrases.modified) &&
              comparison.keyPhrases.modified.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-amber-600">
                    Modified:
                  </span>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                    {comparison.keyPhrases.modified.map(
                      (mod: any, i: number) => (
                        <li key={i}>
                          &quot;{mod.before}&quot; → &quot;{mod.after}&quot;
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}
          </div>,
          "h-20",
          "keyPhrases",
        )}

        {/* Show loading placeholders during generation */}
        {isGenerating && progress < 25 && !streamedData?.summary && (
          <div className="animate-pulse space-y-4">
            <div className="h-24 rounded-md bg-muted"></div>
            <div className="space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted"></div>
              <div className="h-4 w-1/2 rounded bg-muted"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StreamingGenerationUI;
