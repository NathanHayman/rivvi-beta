"use client";

import { StreamedMetadata } from "@/components/forms/create-run-form/iterate-agent-step";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, X } from "lucide-react";
import * as React from "react";
import { useEffect, useState } from "react";

export interface CreateRunWizardProps {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  currentStep?: number;
  onStepChange?: (step: number) => void;
  steps?: string[];
  isGeneratingAI?: boolean;
  isAIStreamingComplete?: boolean;
  streamedMetadata?: StreamedMetadata;
  currentAITask?: string;
  onPrevStep?: () => void;
  onNextStep?: () => void;
  onSubmit?: () => void;
  canProceedFromCurrentStep?: () => boolean;
}

/**
 * CreateRunWizard component - A specialized multi-step wizard dialog optimized for displaying AI-generated content
 * with expanded view during streaming of AI content and proper step management
 */
export function CreateRunWizard({
  children,
  open,
  onOpenChange,
  title,
  description,
  currentStep = 0,
  onStepChange,
  steps = ["Upload & Validate", "Configure Prompt", "Schedule & Name"],
  isGeneratingAI = false,
  isAIStreamingComplete = false,
  streamedMetadata,
  currentAITask = "Processing...",
  onPrevStep,
  onNextStep,
  onSubmit,
  canProceedFromCurrentStep = () => true,
}: CreateRunWizardProps) {
  // Local state for handling the expanded view
  const [isExpanded, setIsExpanded] = useState(false);

  // Effect to handle expansion when AI is generating content in step 2
  useEffect(() => {
    if (currentStep === 1 && (isGeneratingAI || isAIStreamingComplete)) {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  }, [currentStep, isGeneratingAI, isAIStreamingComplete]);

  // Determine if we're showing the streaming panel
  const showStreamingPanel =
    currentStep === 1 && (isGeneratingAI || isAIStreamingComplete);

  // Handle step navigation
  const handlePrevStep = () => {
    if (onPrevStep) {
      onPrevStep();
    } else if (onStepChange && currentStep > 0) {
      onStepChange(currentStep - 1);
    }
  };

  const handleNextStep = () => {
    if (onNextStep) {
      onNextStep();
    } else if (onStepChange && currentStep < steps.length - 1) {
      onStepChange(currentStep + 1);
    }
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit();
    }
  };

  // Determine if we can proceed to the next step
  const canProceed = () => {
    if (typeof canProceedFromCurrentStep === "function") {
      return canProceedFromCurrentStep();
    }
    return true;
  };

  // Custom rendering for step indicators
  const renderStepIndicators = () => {
    return (
      <div className="mb-6 flex w-full items-center justify-center">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center">
            {/* Step circle */}
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                index === currentStep
                  ? "border-primary bg-primary text-primary-foreground"
                  : index < currentStep
                    ? "border-primary/20 bg-primary/20 text-primary"
                    : "border-border bg-background text-muted-foreground",
              )}
            >
              {index < currentStep ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>

            {/* Step name */}
            <span
              className={cn(
                "ml-2 hidden text-sm sm:block",
                index === currentStep
                  ? "font-medium text-primary"
                  : "text-muted-foreground",
              )}
            >
              {step}
            </span>

            {/* Connector line (not for the last step) */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-0.5 w-8 sm:w-16",
                  index < currentStep ? "bg-primary/60" : "bg-border",
                )}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "overflow-hidden p-0 transition-all duration-300 ease-in-out",
          isExpanded ? "w-[90vw] max-w-screen-xl" : "w-full max-w-[650px]",
          "h-[80vh] max-h-[90vh]",
        )}
      >
        {/* Header section */}
        <DialogHeader className="sticky top-0 z-10 border-b bg-background p-6">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold">
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription className="mt-1">
                  {description}
                </DialogDescription>
              )}
            </div>
            <DialogClose className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
              <X className="h-4 w-4" />
            </DialogClose>
          </div>

          {/* Step indicators */}
          {renderStepIndicators()}
        </DialogHeader>

        {/* Content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main content panel */}
          <div
            className={cn(
              "flex-1 overflow-y-auto transition-all duration-300",
              showStreamingPanel ? "border-r" : "",
            )}
          >
            <div className="p-6">{children}</div>
          </div>

          {/* Streaming panel that appears during AI generation */}
          {showStreamingPanel && (
            <div className="w-1/2 max-w-[50%] overflow-y-auto bg-muted/10 p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">AI Analysis</h3>
                  {isGeneratingAI && (
                    <div className="flex items-center space-x-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">{currentAITask}</span>
                    </div>
                  )}
                  {isAIStreamingComplete && (
                    <div className="flex items-center space-x-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm">Complete</span>
                    </div>
                  )}
                </div>

                {/* AI Response Content */}
                <div className="space-y-4">
                  {/* Summary */}
                  {streamedMetadata?.summary && (
                    <div className="rounded-lg border bg-background p-4">
                      <h4 className="mb-2 text-sm font-medium">Summary</h4>
                      <p className="text-sm">{streamedMetadata.summary}</p>
                    </div>
                  )}

                  {/* Categories & Tags */}
                  {(streamedMetadata?.metadata?.categories?.length ||
                    streamedMetadata?.metadata?.tags?.length) && (
                    <div className="rounded-lg border bg-background p-4">
                      <h4 className="mb-2 text-sm font-medium">
                        Classification
                      </h4>
                      {streamedMetadata?.metadata?.categories?.length > 0 && (
                        <div className="mb-2">
                          <span className="text-xs font-medium">
                            Categories:
                          </span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {streamedMetadata.metadata.categories.map(
                              (category, i) => (
                                <span
                                  key={i}
                                  className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                                >
                                  {category}
                                </span>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                      {streamedMetadata?.metadata?.tags?.length > 0 && (
                        <div>
                          <span className="text-xs font-medium">Tags:</span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {streamedMetadata.metadata.tags.map((tag, i) => (
                              <span
                                key={i}
                                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Detailed Analysis */}
                  {streamedMetadata?.comparison && (
                    <div className="rounded-lg border bg-background p-4">
                      <h4 className="mb-2 text-sm font-medium">Analysis</h4>

                      {/* Key Phrases */}
                      {streamedMetadata.comparison.keyPhrases && (
                        <div className="mb-3">
                          <span className="text-xs font-medium">
                            Key Phrases Changes:
                          </span>
                          {streamedMetadata.comparison.keyPhrases.added
                            ?.length > 0 && (
                            <div className="ml-2 mt-1">
                              <span className="text-xs text-green-600">
                                Added:
                              </span>
                              <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-xs">
                                {streamedMetadata.comparison.keyPhrases.added.map(
                                  (phrase, i) => (
                                    <li key={i}>{phrase}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}
                          {streamedMetadata.comparison.keyPhrases.removed
                            ?.length > 0 && (
                            <div className="ml-2 mt-1">
                              <span className="text-xs text-red-600">
                                Removed:
                              </span>
                              <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-xs">
                                {streamedMetadata.comparison.keyPhrases.removed.map(
                                  (phrase, i) => (
                                    <li key={i}>{phrase}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Structural Changes */}
                      {streamedMetadata.comparison.structuralChanges?.length >
                        0 && (
                        <div className="mb-3">
                          <span className="text-xs font-medium">
                            Structure Changes:
                          </span>
                          <div className="ml-2 mt-1 space-y-1">
                            {streamedMetadata.comparison.structuralChanges.map(
                              (change, i) => (
                                <div key={i} className="flex text-xs">
                                  <span
                                    className={cn(
                                      "w-16 flex-shrink-0",
                                      change.changeType === "added"
                                        ? "text-green-600"
                                        : change.changeType === "removed"
                                          ? "text-red-600"
                                          : change.changeType === "modified"
                                            ? "text-amber-600"
                                            : "text-muted-foreground",
                                    )}
                                  >
                                    {change.changeType}:
                                  </span>
                                  <span>
                                    {change.section} - {change.description}
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      )}

                      {/* Performance Prediction */}
                      {streamedMetadata.comparison.performancePrediction && (
                        <div>
                          <span className="text-xs font-medium">
                            Performance Prediction:
                          </span>
                          <div className="ml-2 mt-1 text-xs">
                            <div className="flex items-center gap-2">
                              <span>Impact:</span>
                              <span
                                className={cn(
                                  "rounded-full px-1.5 py-0.5 text-xs",
                                  streamedMetadata.comparison
                                    .performancePrediction.expectedImpact ===
                                    "positive"
                                    ? "bg-green-100 text-green-800"
                                    : streamedMetadata.comparison
                                          .performancePrediction
                                          .expectedImpact === "negative"
                                      ? "bg-red-100 text-red-800"
                                      : streamedMetadata.comparison
                                            .performancePrediction
                                            .expectedImpact === "neutral"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-yellow-100 text-yellow-800",
                                )}
                              >
                                {
                                  streamedMetadata.comparison
                                    .performancePrediction.expectedImpact
                                }
                              </span>
                              <span>
                                Confidence:{" "}
                                {
                                  streamedMetadata.comparison
                                    .performancePrediction.confidenceLevel
                                }
                                %
                              </span>
                            </div>
                            {streamedMetadata.comparison.performancePrediction
                              .rationale && (
                              <p className="mt-1 text-muted-foreground">
                                {
                                  streamedMetadata.comparison
                                    .performancePrediction.rationale
                                }
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Diff Display */}
                  {streamedMetadata?.diffData?.promptDiff?.length > 0 && (
                    <div className="rounded-lg border bg-background p-4">
                      <h4 className="mb-2 text-sm font-medium">
                        Prompt Changes
                      </h4>
                      <div className="max-h-[300px] overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-2 font-mono text-xs">
                        {streamedMetadata.diffData.promptDiff.map(
                          (segment, index) => {
                            let className = "";
                            if (segment.type === "added")
                              className = "bg-green-100 text-green-800";
                            if (segment.type === "removed")
                              className =
                                "bg-red-100 text-red-800 line-through";

                            return (
                              <span key={index} className={className}>
                                {segment.value || ""}
                              </span>
                            );
                          },
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer with navigation */}
        <DialogFooter className="sticky bottom-0 z-10 border-t bg-background p-6">
          <div className="flex w-full items-center justify-between">
            <div>
              {currentStep > 0 && (
                <Button
                  onClick={handlePrevStep}
                  variant="outline"
                  className="gap-1"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              )}
            </div>
            <div>
              {currentStep < steps.length - 1 ? (
                <Button
                  onClick={handleNextStep}
                  disabled={!canProceed()}
                  className="gap-1"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={!canProceed()}>
                  Create Run
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
