import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

// This is a streaming-friendly component that displays data as it arrives
const StreamingPromptVariation = ({ streamedData, isGenerating }) => {
  // Helper functions for determining what to show
  const isLoaded = (data) => data !== undefined && data !== null;
  const hasKeyChanges =
    isLoaded(streamedData?.metadata?.keyChanges) &&
    streamedData.metadata.keyChanges.length > 0;
  const hasCategories =
    isLoaded(streamedData?.metadata?.categories) &&
    streamedData.metadata.categories.length > 0;
  const hasTags =
    isLoaded(streamedData?.metadata?.tags) &&
    streamedData.metadata.tags.length > 0;

  // Determine if basic information is available
  const hasBasicInfo =
    isLoaded(streamedData?.suggestedRunName) && isLoaded(streamedData?.summary);

  // Determine if advanced metrics are available
  const hasSentiment = isLoaded(streamedData?.metadata?.sentimentShift);
  const hasFormality = isLoaded(streamedData?.metadata?.formalityLevel);
  const hasComplexity = isLoaded(streamedData?.metadata?.complexityScore);

  // Determine if structural and key phrase data is available
  const hasStructural =
    isLoaded(streamedData?.comparison?.structuralChanges) &&
    streamedData.comparison.structuralChanges.length > 0;
  const hasKeyPhrases = isLoaded(streamedData?.comparison?.keyPhrases);

  // Determine if performance prediction is available
  const hasPrediction = isLoaded(
    streamedData?.comparison?.performancePrediction,
  );

  // Get current task for the status indicator
  const getCurrentTask = () => {
    if (!streamedData) return "Preparing...";
    if (!hasBasicInfo) return "Generating basic information...";
    if (!hasKeyChanges) return "Analyzing key changes...";
    if (!hasCategories || !hasTags) return "Categorizing changes...";
    if (!hasSentiment || !hasFormality || !hasComplexity)
      return "Calculating metrics...";
    if (!hasStructural || !hasKeyPhrases) return "Breaking down changes...";
    if (!hasPrediction) return "Making predictions...";
    if (!isLoaded(streamedData?.diffData))
      return "Creating diff visualization...";
    return "Finalizing results...";
  };

  // Function to render loading or content
  const renderSection = (condition, content, loadingHeight = "h-4") => {
    if (condition) {
      return content;
    }
    return isGenerating ? (
      <div className="space-y-2">
        <Skeleton className={`w-full ${loadingHeight}`} />
        <Skeleton className={`w-3/4 ${loadingHeight}`} />
      </div>
    ) : null;
  };

  // Function to render the diff if available
  const renderDiff = () => {
    if (!isLoaded(streamedData?.diffData)) return null;

    return (
      <Card className="mt-4">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Text Changes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 py-2">
          {isLoaded(streamedData?.diffData?.promptDiff) && (
            <div>
              <h4 className="mb-1 text-xs font-semibold">Prompt:</h4>
              <div className="border-gray-200 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-md border p-2 font-mono text-xs">
                {streamedData.diffData.promptDiff.map((segment, index) => {
                  let className = "inline";
                  if (segment.type === "added")
                    className = "bg-green-100 text-green-800 inline";
                  if (segment.type === "removed")
                    className = "bg-red-100 text-red-800 line-through inline";

                  return (
                    <span key={index} className={className}>
                      {segment.value}{" "}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {isLoaded(streamedData?.diffData?.voicemailDiff) && (
            <div>
              <h4 className="mb-1 text-xs font-semibold">Voicemail:</h4>
              <div className="border-gray-200 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-md border p-2 font-mono text-xs">
                {streamedData.diffData.voicemailDiff.map((segment, index) => {
                  let className = "inline";
                  if (segment.type === "added")
                    className = "bg-green-100 text-green-800 inline";
                  if (segment.type === "removed")
                    className = "bg-red-100 text-red-800 line-through inline";

                  return (
                    <span key={index} className={className}>
                      {segment.value}{" "}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Generation Status */}
      <div className="bg-gray-50 space-y-3 rounded-md border p-4">
        <div className="flex items-center space-x-2">
          {isGenerating ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : streamedData ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          )}
          <h3 className="text-md font-medium">
            {isGenerating
              ? getCurrentTask()
              : streamedData
                ? "Generation complete"
                : "Waiting to start generation"}
          </h3>
        </div>

        {/* Progress indicators */}
        {isGenerating && streamedData && (
          <div className="text-gray-500 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center">
              <div
                className={`mr-2 h-2 w-2 rounded-full ${hasBasicInfo ? "bg-green-500" : "bg-gray-300"}`}
              ></div>
              Basic Info
            </div>
            <div className="flex items-center">
              <div
                className={`mr-2 h-2 w-2 rounded-full ${hasCategories && hasTags ? "bg-green-500" : "bg-gray-300"}`}
              ></div>
              Categories & Tags
            </div>
            <div className="flex items-center">
              <div
                className={`mr-2 h-2 w-2 rounded-full ${hasKeyChanges ? "bg-green-500" : "bg-gray-300"}`}
              ></div>
              Key Changes
            </div>
            <div className="flex items-center">
              <div
                className={`mr-2 h-2 w-2 rounded-full ${hasStructural && hasKeyPhrases ? "bg-green-500" : "bg-gray-300"}`}
              ></div>
              Detailed Analysis
            </div>
            <div className="flex items-center">
              <div
                className={`mr-2 h-2 w-2 rounded-full ${hasSentiment && hasFormality ? "bg-green-500" : "bg-gray-300"}`}
              ></div>
              Metrics
            </div>
            <div className="flex items-center">
              <div
                className={`mr-2 h-2 w-2 rounded-full ${hasPrediction ? "bg-green-500" : "bg-gray-300"}`}
              ></div>
              Predictions
            </div>
          </div>
        )}
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Variation Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 py-2">
          {renderSection(
            isLoaded(streamedData?.suggestedRunName),
            <div>
              <span className="text-xs font-semibold">Name:</span>
              <h3 className="text-base font-medium">
                {streamedData?.suggestedRunName}
              </h3>
            </div>,
            "h-6",
          )}

          {renderSection(
            isLoaded(streamedData?.summary),
            <div>
              <span className="text-xs font-semibold">Summary:</span>
              <p className="text-sm">{streamedData?.summary}</p>
            </div>,
          )}

          {renderSection(
            isLoaded(streamedData?.metadata?.focusArea),
            <div>
              <span className="text-xs font-semibold">Focus Area:</span>
              <p className="text-sm">{streamedData?.metadata?.focusArea}</p>
            </div>,
          )}

          {renderSection(
            isLoaded(streamedData?.metadata?.toneShift),
            <div>
              <span className="text-xs font-semibold">Tone Shift:</span>
              <p className="text-sm">{streamedData?.metadata?.toneShift}</p>
            </div>,
          )}
        </CardContent>
      </Card>

      {/* Categories and Tags */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Classification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 py-2">
          {renderSection(
            hasCategories,
            <div>
              <span className="mb-1 block text-xs font-semibold">
                Categories:
              </span>
              <div className="flex flex-wrap gap-1">
                {streamedData?.metadata?.categories?.map((category, i) => (
                  <Badge key={i} variant="secondary" className="bg-blue-100">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>,
            "h-8",
          )}

          {renderSection(
            hasTags,
            <div>
              <span className="mb-1 block text-xs font-semibold">Tags:</span>
              <div className="flex flex-wrap gap-1">
                {streamedData?.metadata?.tags?.map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>,
            "h-8",
          )}
        </CardContent>
      </Card>

      {/* Key Changes */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Key Changes</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          {renderSection(
            hasKeyChanges,
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {streamedData?.metadata?.keyChanges?.map((change, i) => (
                <li key={i}>{change}</li>
              ))}
            </ul>,
            "h-16",
          )}
        </CardContent>
      </Card>

      {/* Metrics */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 py-2 text-sm">
          {renderSection(
            isLoaded(streamedData?.metadata?.promptLength),
            <div className="flex justify-between">
              <span className="font-medium">Length Change:</span>
              <span>
                {streamedData?.metadata?.promptLength?.before} →{" "}
                {streamedData?.metadata?.promptLength?.after} (
                {streamedData?.metadata?.promptLength?.difference > 0
                  ? "+"
                  : ""}
                {streamedData?.metadata?.promptLength?.difference} chars)
              </span>
            </div>,
          )}

          {renderSection(
            hasSentiment,
            <div className="flex justify-between">
              <span className="font-medium">Sentiment:</span>
              <span>
                {streamedData?.metadata?.sentimentShift?.before} →{" "}
                {streamedData?.metadata?.sentimentShift?.after}
              </span>
            </div>,
          )}

          {renderSection(
            hasFormality,
            <div className="flex justify-between">
              <span className="font-medium">Formality (1-10):</span>
              <span>
                {streamedData?.metadata?.formalityLevel?.before} →{" "}
                {streamedData?.metadata?.formalityLevel?.after}
              </span>
            </div>,
          )}

          {renderSection(
            hasComplexity,
            <div className="flex justify-between">
              <span className="font-medium">Complexity (1-10):</span>
              <span>
                {streamedData?.metadata?.complexityScore?.before} →{" "}
                {streamedData?.metadata?.complexityScore?.after}
              </span>
            </div>,
          )}
        </CardContent>
      </Card>

      {/* Performance Prediction */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Performance Prediction</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          {renderSection(
            hasPrediction,
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Expected Impact:</span>
                <Badge
                  className={
                    streamedData?.comparison?.performancePrediction
                      ?.expectedImpact === "positive"
                      ? "bg-green-100 text-green-800"
                      : streamedData?.comparison?.performancePrediction
                            ?.expectedImpact === "negative"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                  }
                >
                  {
                    streamedData?.comparison?.performancePrediction
                      ?.expectedImpact
                  }
                </Badge>
                <span className="text-xs">
                  (Confidence:{" "}
                  {
                    streamedData?.comparison?.performancePrediction
                      ?.confidenceLevel
                  }
                  /10)
                </span>
              </div>
              <p className="text-sm">
                {streamedData?.comparison?.performancePrediction?.rationale}
              </p>
            </div>,
            "h-16",
          )}
        </CardContent>
      </Card>

      {/* Structural Changes */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Structural Analysis</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          {renderSection(
            hasStructural,
            <div className="space-y-2 text-sm">
              {streamedData?.comparison?.structuralChanges?.map((change, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Badge
                    variant="outline"
                    className={
                      change.changeType === "added"
                        ? "border-green-200 text-green-600"
                        : change.changeType === "removed"
                          ? "border-red-200 text-red-600"
                          : change.changeType === "modified"
                            ? "border-amber-200 text-amber-600"
                            : "text-gray-600 border-gray-200"
                    }
                  >
                    {change.changeType}
                  </Badge>
                  <div>
                    <span className="font-medium">{change.section}:</span>{" "}
                    {change.description}
                  </div>
                </div>
              ))}
            </div>,
            "h-16",
          )}
        </CardContent>
      </Card>

      {/* Key Phrases */}
      {hasKeyPhrases && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Key Phrases</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 py-2 text-sm">
            {streamedData?.comparison?.keyPhrases?.added?.length > 0 && (
              <div>
                <span className="font-medium text-green-600">Added:</span>
                <ul className="list-disc pl-5">
                  {streamedData?.comparison?.keyPhrases?.added?.map(
                    (phrase, i) => <li key={i}>{phrase}</li>,
                  )}
                </ul>
              </div>
            )}

            {streamedData?.comparison?.keyPhrases?.removed?.length > 0 && (
              <div>
                <span className="font-medium text-red-600">Removed:</span>
                <ul className="list-disc pl-5">
                  {streamedData?.comparison?.keyPhrases?.removed?.map(
                    (phrase, i) => <li key={i}>{phrase}</li>,
                  )}
                </ul>
              </div>
            )}

            {streamedData?.comparison?.keyPhrases?.modified?.length > 0 && (
              <div>
                <span className="font-medium text-amber-600">Modified:</span>
                <ul className="list-disc pl-5">
                  {streamedData?.comparison?.keyPhrases?.modified?.map(
                    (mod, i) => (
                      <li key={i}>
                        "{mod.before}" → "{mod.after}"
                      </li>
                    ),
                  )}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Diff Visualization */}
      {renderDiff()}
    </div>
  );
};

export default StreamingPromptVariation;
