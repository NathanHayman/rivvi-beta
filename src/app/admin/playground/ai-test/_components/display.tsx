import { AgentResponse } from "@/app/api/ai/agent/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

// Main comparison component
const PromptVariationComparison = ({
  variations,
}: {
  variations?: AgentResponse[];
}) => {
  // Initialize with empty array if variations is undefined
  const [selectedVariations, setSelectedVariations] = useState<AgentResponse[]>(
    variations || [],
  );

  useEffect(() => {
    // Update with empty array if variations is undefined
    setSelectedVariations(variations || []);
  }, [variations]);

  // Generate comparison data for charts
  const generateComparisonData = () => {
    // Check if array exists and has elements
    if (!selectedVariations || selectedVariations.length === 0) return [];

    // Validate that the first variation has all required properties
    const firstVariation = selectedVariations[0];
    if (
      !firstVariation ||
      !firstVariation.suggestedRunName ||
      !firstVariation.metadata
    ) {
      return [];
    }

    // Check if we have a second variation and validate it
    const hasSecondVariation =
      selectedVariations.length > 1 &&
      selectedVariations[1] &&
      selectedVariations[1].suggestedRunName &&
      selectedVariations[1].metadata;

    return [
      {
        name: "Prompt Length",
        [firstVariation.suggestedRunName]:
          firstVariation.metadata.promptLength?.after || 0,
        ...(hasSecondVariation
          ? {
              [selectedVariations[1].suggestedRunName]:
                selectedVariations[1].metadata.promptLength?.after || 0,
            }
          : {}),
      },
      {
        name: "Formality",
        [firstVariation.suggestedRunName]:
          firstVariation.metadata.formalityLevel?.after || 0,
        ...(hasSecondVariation
          ? {
              [selectedVariations[1].suggestedRunName]:
                selectedVariations[1].metadata.formalityLevel?.after || 0,
            }
          : {}),
      },
      {
        name: "Complexity",
        [firstVariation.suggestedRunName]:
          firstVariation.metadata.complexityScore?.after || 0,
        ...(hasSecondVariation
          ? {
              [selectedVariations[1].suggestedRunName]:
                selectedVariations[1].metadata.complexityScore?.after || 0,
            }
          : {}),
      },
    ];
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Prompt Variation Comparison</h2>

      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="diffs">Text Diffs</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {selectedVariations &&
              selectedVariations.length > 0 &&
              selectedVariations.map((variation, index) => (
                <Card key={index}>
                  <CardHeader className="pb-2">
                    <CardTitle>
                      {variation.suggestedRunName || "Unnamed Variation"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-3 text-sm">
                      {variation.summary || "No summary available"}
                    </p>
                    <div className="mb-3 flex flex-wrap gap-1">
                      {variation.metadata?.tags?.map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      )) || "No tags"}
                    </div>
                    <div className="text-sm">
                      <div>
                        <strong>Tone:</strong>{" "}
                        {variation.metadata?.toneShift || "Not specified"}
                      </div>
                      <div>
                        <strong>Focus:</strong>{" "}
                        {variation.metadata?.focusArea || "Not specified"}
                      </div>
                      <div>
                        <strong>Expected Impact:</strong>{" "}
                        {variation.comparison?.performancePrediction
                          ?.expectedImpact || "Unknown"}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        {/* Metadata Tab */}
        <TabsContent value="metadata" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {selectedVariations &&
              selectedVariations.length > 0 &&
              selectedVariations.map((variation, index) => (
                <Card key={index}>
                  <CardHeader className="pb-2">
                    <CardTitle>{variation.suggestedRunName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h4 className="mb-1 font-medium">Categories</h4>
                      <div className="flex flex-wrap gap-1">
                        {variation.metadata.categories.map((category, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="bg-blue-100"
                          >
                            {category}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-1 font-medium">Key Changes</h4>
                      <ul className="list-disc pl-5 text-sm">
                        {variation.metadata.keyChanges.map((change, i) => (
                          <li key={i}>{change}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="mb-1 font-medium">Structure Changes</h4>
                      <div className="space-y-1 text-sm">
                        {variation.comparison.structuralChanges.map(
                          (change, i) => (
                            <div key={i}>
                              <strong>{change.section}:</strong>{" "}
                              {change.description}
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        {/* Diffs Tab */}
        <TabsContent value="diffs" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {selectedVariations &&
              selectedVariations.length > 0 &&
              selectedVariations.map((variation, index) => (
                <Card key={index}>
                  <CardHeader className="pb-2">
                    <CardTitle>{variation.suggestedRunName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h4 className="mb-1 font-medium">Prompt Changes</h4>
                      <DiffDisplay diff={variation.diffData.promptDiff} />
                    </div>

                    <div>
                      <h4 className="mb-1 font-medium">Voicemail Changes</h4>
                      <DiffDisplay diff={variation.diffData.voicemailDiff} />
                    </div>

                    <div>
                      <h4 className="mb-1 font-medium">Key Phrases</h4>
                      {variation.comparison.keyPhrases.added.length > 0 && (
                        <div className="mb-1">
                          <strong className="text-green-600">Added:</strong>{" "}
                          {variation.comparison.keyPhrases.added.join(", ")}
                        </div>
                      )}
                      {variation.comparison.keyPhrases.removed.length > 0 && (
                        <div className="mb-1">
                          <strong className="text-red-600">Removed:</strong>{" "}
                          {variation.comparison.keyPhrases.removed.join(", ")}
                        </div>
                      )}
                      {variation.comparison.keyPhrases.modified.length > 0 && (
                        <div>
                          <strong className="text-amber-600">Modified:</strong>
                          <ul className="list-disc pl-5 text-sm">
                            {variation.comparison.keyPhrases.modified.map(
                              (mod, i) => (
                                <li key={i}>
                                  &quot;{mod.before}&quot; → &quot;{mod.after}
                                  &quot;
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle>Comparative Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={generateComparisonData()} layout="vertical">
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip />
                    <Legend />
                    {selectedVariations &&
                      selectedVariations.length > 0 &&
                      selectedVariations.map((variation, index) => (
                        <Bar
                          key={index}
                          dataKey={variation.suggestedRunName}
                          fill={index === 0 ? "#8884d8" : "#82ca9d"}
                        />
                      ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                {selectedVariations &&
                  selectedVariations.length > 0 &&
                  selectedVariations.map((variation, index) => (
                    <div key={index} className="space-y-2">
                      <h4 className="font-medium">
                        {variation.suggestedRunName || "Unnamed Variation"}
                      </h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <div>Prompt Length:</div>
                        <div>
                          {variation.metadata?.promptLength?.before || 0} →{" "}
                          {variation.metadata?.promptLength?.after || 0} (
                          {(variation.metadata?.promptLength?.difference || 0) >
                          0
                            ? "+"
                            : ""}
                          {variation.metadata?.promptLength?.difference || 0})
                        </div>

                        <div>Formality:</div>
                        <div>
                          {variation.metadata?.formalityLevel?.before || 0} →{" "}
                          {variation.metadata?.formalityLevel?.after || 0}
                        </div>

                        <div>Complexity:</div>
                        <div>
                          {variation.metadata?.complexityScore?.before || 0} →{" "}
                          {variation.metadata?.complexityScore?.after || 0}
                        </div>

                        <div>Sentiment:</div>
                        <div>
                          {variation.metadata?.sentimentShift?.before || "N/A"}{" "}
                          → {variation.metadata?.sentimentShift?.after || "N/A"}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Predictions Tab */}
        <TabsContent value="predictions">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {selectedVariations &&
              selectedVariations.length > 0 &&
              selectedVariations.map((variation, index) => (
                <Card key={index}>
                  <CardHeader className="pb-2">
                    <CardTitle>{variation.suggestedRunName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="font-medium">Expected Impact:</span>
                        <Badge
                          className={
                            variation.comparison.performancePrediction
                              .expectedImpact === "positive"
                              ? "bg-green-100 text-green-800"
                              : variation.comparison.performancePrediction
                                    .expectedImpact === "negative"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                          }
                        >
                          {
                            variation.comparison.performancePrediction
                              .expectedImpact
                          }
                        </Badge>
                        <span className="text-sm">
                          (Confidence:{" "}
                          {
                            variation.comparison.performancePrediction
                              .confidenceLevel
                          }
                          /10)
                        </span>
                      </div>
                      <p className="text-sm">
                        {variation.comparison.performancePrediction.rationale}
                      </p>
                    </div>

                    <div>
                      <h4 className="mb-1 font-medium">Inferred Intent</h4>
                      <p className="text-sm">
                        {variation.metadata.changeIntent}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PromptVariationComparison;
