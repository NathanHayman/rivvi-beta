import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormDescription } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, ChevronRight, CircleHelp, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { RunFormValues } from "./form";

// Define types for the streamed data
export type StreamedMetadata = {
  variationId?: string;
  suggestedRunName?: string;
  summary?: string;
  metadata?: {
    categories?: string[];
    tags?: string[];
    keyChanges?: string[];
    toneShift?: string;
    focusArea?: string;
    promptLength?: {
      before?: number;
      after?: number;
      difference?: number;
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
  comparison?: {
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
  newPrompt?: string;
  newVoicemailMessage?: string;
  diffData?: {
    promptDiff?: Array<{
      type?: "unchanged" | "added" | "removed";
      value?: string;
    }>;
    voicemailDiff?: Array<{
      type?: "unchanged" | "added" | "removed";
      value?: string;
    }>;
  };
};

type IterateAgentStepProps = {
  initialPrompt: string;
  initialVoicemail: string;
  form: UseFormReturn<RunFormValues>;
  isGeneratingPrompt: boolean;
  setIsGeneratingPrompt: (isGenerating: boolean) => void;
  isStreamingComplete: boolean;
  setIsStreamingComplete: (isComplete: boolean) => void;
  currentTask: string;
  setCurrentTask: (task: string) => void;
  streamedMetadata: StreamedMetadata;
  setStreamedMetadata: (metadata: StreamedMetadata) => void;
  generateNaturalLanguage: () => void;
  prevStep: () => void;
  nextStep: () => void;
  canProceedFromCurrentStep: () => boolean;
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

interface StreamingGenerationUIProps {
  isGenerating: boolean;
  isComplete: boolean;
  currentTask: string;
  streamedMetadata: StreamedMetadata;
}

// Add a component for displaying the streaming generation UI
const StreamingGenerationUI = ({
  isGenerating,
  isComplete,
  currentTask,
  streamedMetadata,
}: StreamingGenerationUIProps) => {
  // Helper functions for determining what to show
  const isLoaded = (data: any) => data !== undefined && data !== null;

  // Extract data from streamedMetadata for easier access
  const { metadata, summary, comparison, diffData } = streamedMetadata || {};

  // Determine if sections exist
  const hasKeyChanges = metadata?.keyChanges && metadata.keyChanges.length > 0;
  const hasCategories = metadata?.categories && metadata.categories.length > 0;
  const hasTags = metadata?.tags && metadata.tags.length > 0;
  const hasDiffData = diffData?.promptDiff && diffData.promptDiff.length > 0;
  const hasComparison = comparison?.structuralChanges || comparison?.keyPhrases;

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 space-y-4 rounded-md border p-4">
        <div className="flex items-center space-x-2">
          {isGenerating ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : isComplete ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <CircleHelp className="h-5 w-5 text-muted-foreground" />
          )}
          <h3 className="text-md font-medium">
            {isGenerating
              ? currentTask || "Generating..."
              : isComplete
                ? "Prompt generation complete"
                : "Waiting to start generation"}
          </h3>
        </div>

        {/* Streaming content preview */}
        <div className="space-y-3">
          {/* Display streamed summary if available */}
          {summary && (
            <div className="border-l-2 border-primary pl-3 duration-300 animate-in fade-in slide-in-from-left-3">
              <h4 className="text-sm font-medium">Summary</h4>
              <p className="text-sm text-muted-foreground">{summary}</p>
            </div>
          )}

          {/* Display streamed metadata if available */}
          {metadata && Object.values(metadata).some((v) => v) && (
            <div className="border-l-2 border-primary pl-3 duration-300 animate-in fade-in slide-in-from-left-3">
              <h4 className="text-sm font-medium">Metadata</h4>
              <div className="mt-2 space-y-2">
                {/* Categories */}
                {hasCategories && (
                  <div className="flex flex-wrap gap-1 duration-300 animate-in fade-in slide-in-from-bottom-3">
                    {metadata.categories!.map((category, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="bg-blue-100"
                      >
                        {category}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Tags */}
                {hasTags && (
                  <div className="flex flex-wrap gap-1 duration-300 animate-in fade-in slide-in-from-bottom-3">
                    {metadata.tags!.map((tag, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Key Changes */}
                {hasKeyChanges && (
                  <div className="space-y-1 duration-300 animate-in fade-in slide-in-from-bottom-3">
                    <span className="text-xs font-medium">Key Changes:</span>
                    <ul className="list-disc space-y-0.5 pl-5 text-xs">
                      {metadata.keyChanges!.map((change, i) => (
                        <li key={i}>{change}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Tone Shift */}
                {metadata.toneShift && (
                  <div className="text-xs duration-300 animate-in fade-in slide-in-from-bottom-3">
                    <span className="font-medium">Tone Shift:</span>{" "}
                    {metadata.toneShift}
                  </div>
                )}

                {/* Focus Area */}
                {metadata.focusArea && (
                  <div className="text-xs duration-300 animate-in fade-in slide-in-from-bottom-3">
                    <span className="font-medium">Focus Area:</span>{" "}
                    {metadata.focusArea}
                  </div>
                )}

                {/* Prompt Length */}
                {metadata.promptLength && (
                  <div className="text-xs duration-300 animate-in fade-in slide-in-from-bottom-3">
                    <span className="font-medium">Length Change:</span>{" "}
                    {metadata.promptLength.before} →{" "}
                    {metadata.promptLength.after} (
                    {metadata.promptLength.difference! > 0 ? "+" : ""}
                    {metadata.promptLength.difference} chars)
                  </div>
                )}

                {/* Change Intent */}
                {metadata.changeIntent && (
                  <div className="text-xs duration-300 animate-in fade-in slide-in-from-bottom-3">
                    <span className="font-medium">Change Intent:</span>{" "}
                    {metadata.changeIntent}
                  </div>
                )}

                {/* Sentiment Shift */}
                {metadata.sentimentShift && (
                  <div className="text-xs duration-300 animate-in fade-in slide-in-from-bottom-3">
                    <span className="font-medium">Sentiment:</span>{" "}
                    {metadata.sentimentShift.before} →{" "}
                    {metadata.sentimentShift.after}
                  </div>
                )}

                {/* Formality Level */}
                {metadata.formalityLevel && (
                  <div className="text-xs duration-300 animate-in fade-in slide-in-from-bottom-3">
                    <span className="font-medium">Formality (1-10):</span>{" "}
                    {metadata.formalityLevel.before} →{" "}
                    {metadata.formalityLevel.after}
                  </div>
                )}

                {/* Complexity Score */}
                {metadata.complexityScore && (
                  <div className="text-xs duration-300 animate-in fade-in slide-in-from-bottom-3">
                    <span className="font-medium">Complexity (1-10):</span>{" "}
                    {metadata.complexityScore.before} →{" "}
                    {metadata.complexityScore.after}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add diff visualization when complete */}
      {isComplete && hasDiffData && (
        <Card className="duration-300 animate-in fade-in slide-in-from-bottom-3">
          <CardContent className="pt-6">
            <h4 className="mb-2 text-sm font-semibold">
              Changes Visualization
            </h4>
            <DiffDisplay diff={diffData?.promptDiff} />
          </CardContent>
        </Card>
      )}

      {/* Add comparison data when complete */}
      {isComplete && hasComparison && comparison?.keyPhrases && (
        <Card className="duration-300 animate-in fade-in slide-in-from-bottom-3">
          <CardContent className="pt-6">
            <h4 className="mb-2 text-sm font-semibold">Key Phrase Changes</h4>

            {comparison.keyPhrases.added &&
              comparison.keyPhrases.added.length > 0 && (
                <div className="mb-2">
                  <h5 className="text-xs font-medium text-green-600">Added:</h5>
                  <ul className="list-disc space-y-0.5 pl-5 text-xs">
                    {comparison.keyPhrases.added.map((phrase, i) => (
                      <li key={i}>{phrase}</li>
                    ))}
                  </ul>
                </div>
              )}

            {comparison.keyPhrases.removed &&
              comparison.keyPhrases.removed.length > 0 && (
                <div className="mb-2">
                  <h5 className="text-xs font-medium text-red-600">Removed:</h5>
                  <ul className="list-disc space-y-0.5 pl-5 text-xs">
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
                  <ul className="list-disc space-y-0.5 pl-5 text-xs">
                    {comparison.keyPhrases.modified.map((mod, i) => (
                      <li key={i}>
                        "{mod.before}" → "{mod.after}"
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const IterateAgentStep = ({
  form,
  isGeneratingPrompt,
  isStreamingComplete,
  currentTask,
  streamedMetadata,
  generateNaturalLanguage,
  prevStep,
  nextStep,
  canProceedFromCurrentStep,
}: IterateAgentStepProps) => {
  const [hasChangedInput, setHasChangedInput] = useState(false);

  // Update form values when we get a suggested run name
  useEffect(() => {
    if (streamedMetadata?.suggestedRunName && isStreamingComplete) {
      form.setValue("name", streamedMetadata.suggestedRunName);
    }

    // When streaming is complete, store the new prompt and voicemail
    if (isStreamingComplete && streamedMetadata?.newPrompt) {
      form.setValue("customPrompt", streamedMetadata.newPrompt);
    }

    if (isStreamingComplete && streamedMetadata?.newVoicemailMessage) {
      form.setValue(
        "customVoicemailMessage",
        streamedMetadata.newVoicemailMessage,
      );
    }
  }, [streamedMetadata, isStreamingComplete, form]);

  // Track changes to natural language input
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    form.setValue("naturalLanguageInput", e.target.value);
    setHasChangedInput(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-lg font-medium">
          Natural Language Prompt Enhancement
        </h3>
        <p className="text-sm text-muted-foreground">
          Describe how you would like to enhance the base prompt. Be specific
          about tone, focus areas, or any additional context.
        </p>
      </div>

      <FormField
        control={form.control}
        name="naturalLanguageInput"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Enhancement Instructions</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Example: Make the prompt more empathetic and focus on explaining benefits clearly."
                className="min-h-[120px]"
                {...field}
                onChange={handleInputChange}
              />
            </FormControl>
            <FormDescription>
              Your instructions will be used to enhance the base prompt.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="flex items-center space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={prevStep}
          className="w-[120px]"
        >
          Back
        </Button>

        <Button
          type="button"
          variant="default"
          onClick={generateNaturalLanguage}
          disabled={
            isGeneratingPrompt || !form.getValues("naturalLanguageInput")
          }
          className="w-[200px]"
        >
          {isGeneratingPrompt ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : hasChangedInput || !isStreamingComplete ? (
            "Generate Enhancement"
          ) : (
            "Regenerate"
          )}
        </Button>

        <Button
          type="button"
          variant={canProceedFromCurrentStep() ? "default" : "outline"}
          onClick={nextStep}
          disabled={!canProceedFromCurrentStep()}
          className="ml-auto"
        >
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Display streaming UI */}
      {(isGeneratingPrompt || isStreamingComplete) && (
        <StreamingGenerationUI
          isGenerating={isGeneratingPrompt}
          isComplete={isStreamingComplete}
          currentTask={currentTask}
          streamedMetadata={streamedMetadata}
        />
      )}
    </div>
  );
};

export default IterateAgentStep;
