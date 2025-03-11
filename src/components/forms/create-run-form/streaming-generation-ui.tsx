import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle, Info, Loader2 } from "lucide-react";

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

  // Calculate animation delays for progressive reveal
  const getAnimationDelay = (index: number) => `${index * 0.1}s`;

  return (
    <div className="space-y-4 py-4">
      {/* Generation Status Header */}
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

      {/* Generated Content with Progressive Animations */}
      <div className="space-y-5 pb-4">
        {/* Summary Section - Prominently Featured */}
        {streamedData?.summary && (
          <Card
            className="overflow-hidden border-2 border-primary duration-500 animate-in fade-in-50 slide-in-from-left"
            style={{ animationDelay: getAnimationDelay(0) }}
            data-section="summary"
          >
            <CardHeader className="bg-primary/10 pb-2">
              <CardTitle className="text-base">Summary of Changes</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <p className="text-sm">{streamedData.summary}</p>
            </CardContent>
          </Card>
        )}

        {/* Show summary loading placeholder */}
        {isGenerating && !streamedData?.summary && progress >= 20 && (
          <Card className="animate-pulse border-2 border-primary/50">
            <CardHeader className="bg-primary/5 pb-2">
              <div className="h-5 w-40 rounded bg-primary/20"></div>
            </CardHeader>
            <CardContent className="space-y-2 pt-3">
              <div className="h-4 w-full rounded bg-muted"></div>
              <div className="h-4 w-5/6 rounded bg-muted"></div>
              <div className="h-4 w-4/6 rounded bg-muted"></div>
            </CardContent>
          </Card>
        )}

        {/* Categories & Tags */}
        {(hasCategories || hasTags) && (
          <Card
            className="overflow-hidden duration-500 animate-in fade-in-50 slide-in-from-bottom-5"
            style={{ animationDelay: getAnimationDelay(1) }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Classification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {hasCategories && (
                <div>
                  <span className="mb-1 block text-xs font-medium">
                    Categories:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {metadata.categories.map((category: string, i: number) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="bg-blue-100 duration-300 animate-in fade-in slide-in-from-bottom-3 dark:bg-blue-900/30"
                        style={{
                          animationDelay: `${getAnimationDelay(i + 1)}`,
                        }}
                      >
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {hasTags && (
                <div>
                  <span className="mb-1 block text-xs font-medium">Tags:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {metadata.tags.map((tag: string, i: number) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-xs duration-300 animate-in fade-in slide-in-from-bottom-3"
                        style={{
                          animationDelay: `${getAnimationDelay(i + 1)}`,
                        }}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Key Changes */}
        {hasKeyChanges && (
          <Card
            className="duration-500 animate-in fade-in-50 slide-in-from-bottom-5"
            style={{ animationDelay: getAnimationDelay(2) }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Key Changes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1.5 pl-5 text-sm">
                {metadata.keyChanges.map((change: string, i: number) => (
                  <li
                    key={i}
                    className="duration-300 animate-in fade-in slide-in-from-right-3"
                    style={{ animationDelay: `${getAnimationDelay(i)}` }}
                  >
                    {change}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Metrics */}
        {hasMetrics && (
          <Card
            className="duration-500 animate-in fade-in-50 slide-in-from-bottom-5"
            style={{ animationDelay: getAnimationDelay(3) }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {isLoaded(metadata.promptLength) && (
                <div className="flex items-center justify-between duration-300 animate-in fade-in-50 slide-in-from-left-3">
                  <span className="font-medium">Length Change:</span>
                  <span>
                    {metadata.promptLength.before} →{" "}
                    {metadata.promptLength.after} (
                    {metadata.promptLength.difference > 0 ? "+" : ""}
                    {metadata.promptLength.difference} chars)
                  </span>
                </div>
              )}

              {isLoaded(metadata.sentimentShift) && (
                <div
                  className="flex items-center justify-between duration-300 animate-in fade-in-50 slide-in-from-left-3"
                  style={{ animationDelay: "0.1s" }}
                >
                  <span className="font-medium">Sentiment:</span>
                  <span>
                    {metadata.sentimentShift.before} →{" "}
                    {metadata.sentimentShift.after}
                  </span>
                </div>
              )}

              {isLoaded(metadata.formalityLevel) && (
                <div
                  className="flex items-center justify-between duration-300 animate-in fade-in-50 slide-in-from-left-3"
                  style={{ animationDelay: "0.2s" }}
                >
                  <span className="font-medium">Formality (1-10):</span>
                  <span>
                    {metadata.formalityLevel.before} →{" "}
                    {metadata.formalityLevel.after}
                  </span>
                </div>
              )}

              {isLoaded(metadata.complexityScore) && (
                <div
                  className="flex items-center justify-between duration-300 animate-in fade-in-50 slide-in-from-left-3"
                  style={{ animationDelay: "0.3s" }}
                >
                  <span className="font-medium">Complexity (1-10):</span>
                  <span>
                    {metadata.complexityScore.before} →{" "}
                    {metadata.complexityScore.after}
                  </span>
                </div>
              )}

              {isLoaded(metadata.toneShift) && (
                <div
                  className="flex items-center justify-between duration-300 animate-in fade-in-50 slide-in-from-left-3"
                  style={{ animationDelay: "0.4s" }}
                >
                  <span className="font-medium">Tone:</span>
                  <span>{metadata.toneShift}</span>
                </div>
              )}

              {isLoaded(metadata.focusArea) && (
                <div
                  className="flex items-center justify-between duration-300 animate-in fade-in-50 slide-in-from-left-3"
                  style={{ animationDelay: "0.5s" }}
                >
                  <span className="font-medium">Focus Area:</span>
                  <span>{metadata.focusArea}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Prediction */}
        {hasPrediction && (
          <Card
            className="duration-500 animate-in fade-in-50 slide-in-from-bottom-5"
            style={{ animationDelay: getAnimationDelay(4) }}
            data-section="prediction"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Performance Prediction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Expected Impact:</span>
                <Badge
                  className={cn({
                    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300":
                      comparison.performancePrediction.expectedImpact ===
                      "positive",
                    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300":
                      comparison.performancePrediction.expectedImpact ===
                      "negative",
                    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300":
                      comparison.performancePrediction.expectedImpact ===
                        "neutral" ||
                      comparison.performancePrediction.expectedImpact ===
                        "uncertain",
                  })}
                >
                  {comparison.performancePrediction.expectedImpact}
                </Badge>
                <span className="text-xs">
                  (Confidence:{" "}
                  {comparison.performancePrediction.confidenceLevel}/10)
                </span>
              </div>
              {comparison.performancePrediction.rationale && (
                <p className="text-sm duration-300 animate-in fade-in slide-in-from-bottom-3">
                  {comparison.performancePrediction.rationale}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Diff Visualization */}
        {hasDiff && (
          <Card
            className="duration-500 animate-in fade-in-50 slide-in-from-bottom-5"
            style={{ animationDelay: getAnimationDelay(5) }}
            data-section="diff"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Text Changes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-40 overflow-auto rounded-md bg-muted/20 p-2">
                <DiffDisplay diff={diffData?.promptDiff} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Phrases */}
        {hasKeyPhrases && comparison.keyPhrases && (
          <Card
            className="duration-500 animate-in fade-in-50 slide-in-from-bottom-5"
            style={{ animationDelay: getAnimationDelay(6) }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Key Phrases</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {comparison.keyPhrases.added &&
                comparison.keyPhrases.added.length > 0 && (
                  <div className="duration-300 animate-in fade-in slide-in-from-right-3">
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

              {comparison.keyPhrases.removed &&
                comparison.keyPhrases.removed.length > 0 && (
                  <div
                    className="duration-300 animate-in fade-in slide-in-from-right-3"
                    style={{ animationDelay: "0.1s" }}
                  >
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

              {comparison.keyPhrases.modified &&
                comparison.keyPhrases.modified.length > 0 && (
                  <div
                    className="duration-300 animate-in fade-in slide-in-from-right-3"
                    style={{ animationDelay: "0.2s" }}
                  >
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
            </CardContent>
          </Card>
        )}

        {/* Show loading placeholders during generation */}
        {isGenerating && progress < 100 && !streamedData?.summary && (
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
