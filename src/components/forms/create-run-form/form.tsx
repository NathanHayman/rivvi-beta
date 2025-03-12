"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CheckCircle,
  ChevronLeft,
  Loader2,
  Sparkles,
  StopCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { agentResponseSchema } from "@/app/api/ai/agent/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useUploadFile } from "@/hooks/runs/use-files";
import { useCreateRun } from "@/hooks/runs/use-runs";
import { cn } from "@/lib/utils";
import { validateData } from "@/server/actions/runs";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { format } from "date-fns";

// Components
import { useMutation } from "@tanstack/react-query";
import StreamingGenerationUI from "./streaming-generation-ui";
import UploadFileStep from "./upload-file-step";

// Run form schema
const runFormSchema = z.object({
  name: z.string().min(1, "Run name is required"),
  file: z.instanceof(File).optional(),
  variationNotes: z.string().optional(),
  promptVersion: z.number().optional(),
  customPrompt: z.string().optional(),
  customVoicemailMessage: z.string().optional(),
  naturalLanguageInput: z.string().optional(),
  scheduleForLater: z.boolean().default(false),
  scheduledDate: z.date().optional().nullable(),
  scheduledTime: z.string().optional(),
  aiGenerated: z.boolean().default(false),
});

export type RunFormValues = z.infer<typeof runFormSchema>;

export interface RunCreateFormProps {
  campaignId: string;
  onSuccess?: (runId?: string) => void;
  onCancel?: () => void;
  defaultValues?: Partial<RunFormValues>;
  campaignBasePrompt?: string;
  campaignVoicemailMessage?: string;
  campaignName?: string;
  campaignDescription?: string;
  campaignConfig?: any;
  onFormSuccess?: () => void;
}

export function RunCreateForm({
  campaignId,
  onSuccess,
  onCancel,
  defaultValues,
  campaignBasePrompt = "",
  campaignVoicemailMessage = "",
  campaignName = "",
  campaignDescription = "",
  campaignConfig,
  onFormSuccess,
}: RunCreateFormProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [processedFile, setProcessedFile] = useState<{
    parsedData?: {
      rows?: any[];
      headers?: string[];
    };
    stats?: {
      totalRows: number;
      validRows: number;
      invalidRows: number;
    };
  }>({});
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isStreamingComplete, setIsStreamingComplete] =
    useState<boolean>(false);
  const [currentTask, setCurrentTask] = useState<string>("");

  // For modal expansion when AI is streaming
  const [isExpanded, setIsExpanded] = useState(false);
  const [previousProgress, setPreviousProgress] = useState(0);
  const [animateTransition, setAnimateTransition] = useState(false);
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(
    null,
  );

  // Refs to track important streaming events for smart scrolling
  const previousSummaryRef = useRef<string | null>(null);
  const previousDiffRef = useRef<boolean>(false);
  const previousPredictionRef = useRef<boolean>(false);

  // Create a ref for the results container to enable auto-scrolling
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  const steps = ["Upload & Validate", "Configure Prompt", "Schedule & Name"];

  // Use the AI SDK's useObject hook
  const {
    object: aiResponse,
    submit: generateAIResponse,
    isLoading: isAIGenerating,
    error: aiError,
    stop: stopAIGeneration,
  } = useObject({
    api: "/api/ai/agent",
    schema: agentResponseSchema,
  });

  const form = useForm<RunFormValues>({
    resolver: zodResolver(runFormSchema),
    mode: "onChange",
    defaultValues: {
      ...defaultValues,
      customPrompt: campaignBasePrompt,
      customVoicemailMessage: campaignVoicemailMessage,
      name: "",
      scheduleForLater: false,
      scheduledDate: null,
      scheduledTime: "",
      aiGenerated: false,
    },
  });

  // Improved auto-scrolling logic with smart scrolling to important content
  useEffect(() => {
    if (isGeneratingPrompt && resultsContainerRef.current && aiResponse) {
      const container = resultsContainerRef.current;

      // Handle specific important updates that we want to show the user
      if (aiResponse?.summary && !previousSummaryRef.current) {
        // If summary just appeared, scroll to top to show it
        container.scrollTo({
          top: 0,
          behavior: "smooth",
        });
        previousSummaryRef.current = aiResponse.summary;
      } else if (aiResponse?.diffData?.promptDiff && !previousDiffRef.current) {
        // If diff visualization just appeared, scroll to show it
        const diffElement = container.querySelector('[data-section="diff"]');
        if (diffElement) {
          diffElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        previousDiffRef.current = true;
      } else if (
        aiResponse?.comparison?.performancePrediction &&
        !previousPredictionRef.current
      ) {
        // If prediction just appeared, scroll to show it
        const predictionElement = container.querySelector(
          '[data-section="prediction"]',
        );
        if (predictionElement) {
          predictionElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
        previousPredictionRef.current = true;
      } else {
        // For other updates, default to following the bottom
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  }, [isGeneratingPrompt, aiResponse]);

  // Effect to animate modal expansion when streaming starts
  useEffect(() => {
    if (aiResponse && !isExpanded && isAIGenerating) {
      setAnimateTransition(true);
      setTimeout(() => {
        setIsExpanded(true);
        setTimeout(() => {
          setAnimateTransition(false);
        }, 500);
      }, 100);
    }
  }, [aiResponse, isAIGenerating, isExpanded]);

  // Improved effect to track AI generation status with more detailed messages
  useEffect(() => {
    // Only update states if they're not already matching the isAIGenerating value
    // This prevents the infinite loop caused by updating the same state multiple times
    if (isAIGenerating && !isGeneratingPrompt) {
      setIsGeneratingPrompt(true);
      setIsStreamingComplete(false);

      // Start timing if needed
      if (!generationStartTime) {
        setGenerationStartTime(Date.now());
        // Timer setup...
      }

      // Simplified stage detection - check what data we have right now
      let currentStage = "Initializing AI";
      let progress = 5;

      // Check data properties in sequence to determine current stage
      if (aiResponse?.diffData?.promptDiff) {
        currentStage = "Creating visualization of changes";
        progress = 95;
      } else if (aiResponse?.comparison?.performancePrediction) {
        currentStage = "Analyzing performance impact";
        progress = 85;
      } else if (aiResponse?.comparison?.keyPhrases) {
        currentStage = "Identifying key phrase changes";
        progress = 75;
      } else if (aiResponse?.comparison?.structuralChanges) {
        currentStage = "Analyzing structural changes";
        progress = 65;
      } else if (aiResponse?.newVoicemailMessage) {
        currentStage = "Refining voicemail message";
        progress = 60;
      } else if (aiResponse?.newPrompt) {
        currentStage = "Enhancing prompt text";
        progress = 50;
      } else if (aiResponse?.metadata?.sentimentShift) {
        currentStage = "Analyzing sentiment changes";
        progress = 45;
      } else if (aiResponse?.metadata?.complexityScore) {
        currentStage = "Calculating complexity scores";
        progress = 40;
      } else if (aiResponse?.metadata?.formalityLevel) {
        currentStage = "Measuring formality changes";
        progress = 35;
      } else if (aiResponse?.summary) {
        currentStage = "Generating summary";
        progress = 30;
      } else if (aiResponse?.metadata?.focusArea) {
        currentStage = "Identifying focus areas";
        progress = 25;
      } else if (aiResponse?.metadata?.toneShift) {
        currentStage = "Determining tone changes";
        progress = 20;
      } else if (aiResponse?.metadata?.tags?.length) {
        currentStage = "Generating tags";
        progress = 15;
      } else if (aiResponse?.metadata?.categories?.length) {
        currentStage = "Creating categories";
        progress = 10;
      } else {
        currentStage = "Analyzing your request";
        progress = 5;
      }

      // Apply time-based progress increment
      const elapsed = Date.now() - (generationStartTime || Date.now());
      const timeBasedMinimumProgress = Math.min(90, (elapsed / 30000) * 100);
      progress = Math.max(progress, timeBasedMinimumProgress);

      setCurrentTask(currentStage);
      setPreviousProgress(progress);
    } else if (!isAIGenerating && isGeneratingPrompt && aiResponse) {
      // Only update states if they're not already correct
      // Reset progress timers and set to complete
      setGenerationStartTime(null);
      setIsGeneratingPrompt(false);
      setIsStreamingComplete(true);
      setCurrentTask("Prompt generation complete");
      setPreviousProgress(100);

      // Set form values from AI response
      if (aiResponse?.suggestedRunName) {
        form.setValue("name", aiResponse.suggestedRunName);
      }

      if (aiResponse?.newPrompt) {
        form.setValue("customPrompt", aiResponse.newPrompt);
        form.setValue("aiGenerated", true);
      }

      if (aiResponse?.newVoicemailMessage) {
        form.setValue("customVoicemailMessage", aiResponse.newVoicemailMessage);
      }
    }
  }, [
    isAIGenerating,
    aiResponse,
    generationStartTime,
    form,
    isGeneratingPrompt,
    isStreamingComplete,
  ]);

  const createRunMutation = useCreateRun(campaignId);
  const uploadFileMutation = useUploadFile();

  // Sanitize AI response data to ensure it matches schema format
  const sanitizeDataForSubmission = (data: any): any => {
    if (!data) return null;

    const result = { ...data };

    // Fix diffData to ensure it matches schema
    if (result.diffData && result.diffData.promptDiff) {
      result.diffData.promptDiff = result.diffData.promptDiff.map(
        (item: any) => {
          if (typeof item === "string") {
            return { type: "unchanged", value: item };
          } else if (typeof item === "object" && item !== null) {
            return {
              type: item.type || "unchanged",
              value: item.value || "",
            };
          }
          return { type: "unchanged", value: "" };
        },
      );
    }

    // Similar check for voicemailDiff
    if (result.diffData && result.diffData.voicemailDiff) {
      result.diffData.voicemailDiff = result.diffData.voicemailDiff.map(
        (item: any) => {
          if (typeof item === "string") {
            return { type: "unchanged", value: item };
          } else if (typeof item === "object" && item !== null) {
            return {
              type: item.type || "unchanged",
              value: item.value || "",
            };
          }
          return { type: "unchanged", value: "" };
        },
      );
    }

    // Fix comparison.keyPhrases.modified to ensure it's an array of objects
    if (
      result.comparison &&
      result.comparison.keyPhrases &&
      result.comparison.keyPhrases.modified
    ) {
      // Check if modified is actually an array before calling map
      if (Array.isArray(result.comparison.keyPhrases.modified)) {
        result.comparison.keyPhrases.modified =
          result.comparison.keyPhrases.modified.map((item: any) => {
            if (typeof item === "string") {
              return { after: item };
            } else if (typeof item === "object" && item !== null) {
              return {
                before: item.before || "",
                after: item.after || "",
              };
            }
            return { before: "", after: "" };
          });
      } else {
        // If it's not an array, convert it to an empty array to prevent errors
        result.comparison.keyPhrases.modified = [];
      }
    }

    return result;
  };

  const generateNaturalLanguage = async () => {
    // Reset progress when starting a new generation
    setPreviousProgress(0);
    setCurrentTask("Initializing AI");

    // Use the AI SDK hook for generation
    generateAIResponse({
      basePrompt: campaignBasePrompt,
      baseVoicemailMessage: campaignVoicemailMessage,
      naturalLanguageInput: form.getValues("naturalLanguageInput"),
      campaignContext: {
        name: campaignName,
        description: campaignDescription,
      },
    });
  };

  const validateDataMutation = useMutation({
    mutationFn: async (data: {
      fileContent: string;
      fileName: string;
      variablesConfig: any;
    }) => {
      return validateData(data);
    },
    onSuccess: (data: any) => {
      // Ensure the data is in the correct format
      const responseData = data.data || data;

      const formattedData = {
        ...responseData,
        parsedData: responseData.parsedData
          ? {
              rows: Array.isArray(responseData.parsedData.rows)
                ? responseData.parsedData.rows.map((row) => ({
                    ...row,
                  }))
                : [],
              headers: responseData.parsedData.headers || [],
            }
          : undefined,
        stats: responseData.stats || {
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
        },
        matchedColumns: responseData.matchedColumns || [],
        columnMappings: responseData.columnMappings || {},
      };

      // Store the processed data
      setProcessedFile(formattedData);
      setIsValidating(false);

      // Check if we have valid data
      const hasProcessableData =
        formattedData.stats?.validRows > 0 ||
        (formattedData.parsedData?.rows?.length || 0) > 0;

      if (hasProcessableData) {
        const validCount =
          formattedData.stats?.validRows ||
          formattedData.parsedData?.rows?.length ||
          0;
        toast.success(
          `File validated successfully: ${validCount} ${validCount === 1 ? "row" : "rows"} found`,
        );
        nextStep();
      } else {
        toast.error(
          "No valid rows found in the file. Please check your file format.",
        );
      }
    },
    onError: (error) => {
      toast.error(
        `Error validating file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setIsValidating(false);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);

      processSelectedFile(selectedFile);
    }
  };

  const processSelectedFile = useCallback(
    async (selectedFile: File) => {
      try {
        setIsValidating(true);

        // Validate file size and type
        if (selectedFile.size > 10 * 1024 * 1024) {
          toast.error("File is too large. Maximum size is 10MB.");
          setIsValidating(false);
          return;
        }

        const validTypes = [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
        ];
        if (
          !validTypes.includes(selectedFile.type) &&
          !selectedFile.name.endsWith(".xlsx") &&
          !selectedFile.name.endsWith(".xls") &&
          !selectedFile.name.endsWith(".csv")
        ) {
          toast.error("Invalid file type. Please upload an Excel or CSV file.");
          setIsValidating(false);
          return;
        }

        // Ensure we have valid campaign config
        if (!campaignConfig || !campaignConfig.patient) {
          toast.error(
            "Missing campaign configuration. Please contact support.",
          );
          console.error("Missing campaign configuration:", campaignConfig);
          setIsValidating(false);
          return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const content = e.target?.result as string;
            if (!content) {
              throw new Error("Could not read file content");
            }

            // Create a safe copy of the campaign config
            const safeConfig = campaignConfig
              ? {
                  patient: {
                    fields: (campaignConfig.patient?.fields || []).map(
                      (field) => {
                        const safeField = { ...field };
                        if (
                          !Object.prototype.hasOwnProperty.call(
                            safeField,
                            "referencedTable",
                          )
                        ) {
                          (safeField as any).referencedTable = undefined;
                        }
                        return safeField;
                      },
                    ),
                    validation: campaignConfig.patient?.validation || {
                      requireValidPhone: false,
                      requireValidDOB: false,
                      requireName: false,
                    },
                  },
                  campaign: {
                    fields: (campaignConfig.campaign?.fields || []).map(
                      (field) => {
                        const safeField = { ...field };
                        if (
                          !Object.prototype.hasOwnProperty.call(
                            safeField,
                            "referencedTable",
                          )
                        ) {
                          (safeField as any).referencedTable = undefined;
                        }
                        return safeField;
                      },
                    ),
                  },
                }
              : { patient: { fields: [] }, campaign: { fields: [] } };

            await validateDataMutation.mutateAsync({
              fileContent: content,
              fileName: selectedFile.name,
              variablesConfig: safeConfig,
            });
          } catch (error) {
            console.error("Error processing file:", error);
            toast.error(
              "Failed to process file. Please try again or contact support.",
            );
            setIsValidating(false);
          }
        };

        reader.onerror = (error) => {
          console.error("Reader error:", error);
          setIsValidating(false);
          toast.error("Failed to read file. Please try again.");
        };

        reader.readAsDataURL(selectedFile);
      } catch (error) {
        console.error("Error in processSelectedFile:", error);
        toast.error("An error occurred while processing the file");
        setIsValidating(false);
      }
    },
    [campaignConfig, validateDataMutation],
  );

  const handleFileRemove = () => {
    setFile(null);
    setProcessedFile({});
  };

  const onSubmit = async (values: RunFormValues) => {
    // Only proceed to the next step if we're not on the final step
    if (currentStep < steps.length - 1) {
      nextStep();
      return;
    }

    // Only attempt to create the run when submitting on the last step
    try {
      setIsSubmitting(true);

      // Process scheduling
      let scheduledAt = null;
      if (
        values.scheduleForLater &&
        values.scheduledDate &&
        values.scheduledTime
      ) {
        const [hours, minutes] = values.scheduledTime.split(":").map(Number);
        const date = new Date(values.scheduledDate);
        date.setHours(hours || 0, minutes || 0, 0, 0);
        scheduledAt = date.toISOString();
      }

      // Create the run
      const sanitizedAiResponse = sanitizeDataForSubmission(aiResponse);

      const runPayload = {
        campaignId,
        name: values.name,
        customPrompt: values.customPrompt || campaignBasePrompt,
        customVoicemailMessage:
          values.customVoicemailMessage || campaignVoicemailMessage,
        aiGenerated: values.aiGenerated,
        variationNotes: values.variationNotes,
        scheduledAt,
        metadata: sanitizedAiResponse?.metadata,
        comparison: sanitizedAiResponse?.comparison,
        diffData: sanitizedAiResponse?.diffData,
        summary: sanitizedAiResponse?.summary,
        naturalLanguageInput: values.naturalLanguageInput,
      };

      const createRunResult = await createRunMutation.mutateAsync(
        runPayload as any,
      );

      // If we have a file, upload it for the run
      if (createRunResult?.id && file) {
        try {
          // Read the file as a base64 string
          const fileContent = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                resolve(event.target.result as string);
              } else {
                reject(new Error("Failed to read file"));
              }
            };
            reader.onerror = () => reject(new Error("File reading error"));
            reader.readAsDataURL(file);
          });

          const uploadData = {
            runId: createRunResult.id,
            fileContent,
            fileName: file.name,
            processedData: processedFile?.parsedData
              ? {
                  headers: processedFile.parsedData.headers || [],
                  rows: Array.isArray(processedFile.parsedData.rows)
                    ? processedFile.parsedData.rows.map((row) => {
                        if (
                          row.variables &&
                          typeof row.variables === "object"
                        ) {
                          return {
                            patientId: row.patientId || null,
                            patientHash: row.patientHash || null,
                            variables: row.variables,
                          };
                        }

                        const { patientId, patientHash, ...variables } = row;
                        return {
                          patientId: patientId || null,
                          patientHash: patientHash || null,
                          variables,
                        };
                      })
                    : [],
                }
              : undefined,
          };

          // Upload the file with processed data
          await uploadFileMutation.mutateAsync(uploadData);
        } catch (error) {
          console.error("Error uploading file:", error);
          toast.error("File upload failed, but run was created successfully");
        }
      }

      if (onFormSuccess) {
        onFormSuccess();
      }

      handleSuccess(createRunResult?.id);
    } catch (error) {
      console.error("Error creating run:", error);
      toast.error("Failed to create run");
      setIsSubmitting(false);
    }
  };

  const handleSuccess = (runId?: string) => {
    setIsValidating(false);
    setIsSubmitting(false);
    if (onSuccess) {
      onSuccess(runId);
    } else if (runId) {
      router.push(`/campaigns/${campaignId}/runs/${runId}`);
    } else {
      router.push(`/campaigns/${campaignId}`);
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);

      // Reset expansion when moving to a new step
      if (currentStep !== 1) {
        setIsExpanded(false);
        setIsStreamingComplete(false);
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);

      // Reset expansion when moving back from the AI step
      if (currentStep === 1) {
        setIsExpanded(false);
      }
    }
  };

  const canProceedFromCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return (
          !!processedFile &&
          (processedFile.stats?.totalRows > 0 ||
            processedFile.parsedData?.rows?.length > 0)
        );

      case 1:
        // Allow proceeding if we have a custom prompt or AI generation completed
        return isStreamingComplete || !!form.getValues("customPrompt");

      case 2:
        const hasName = !!form.getValues("name");
        const isScheduled = form.getValues("scheduleForLater");

        if (isScheduled) {
          const hasDate = !!form.getValues("scheduledDate");
          const hasTime = !!form.getValues("scheduledTime");
          return hasName && hasDate && hasTime;
        }

        return hasName;

      default:
        return false;
    }
  };

  // Render the current step content
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <UploadFileStep
            file={file}
            handleFileChange={handleFileChange}
            handleFileRemove={handleFileRemove}
            isValidating={isValidating}
            processedFile={processedFile}
          />
        );
      case 1:
        return (
          <div
            className={cn(
              "transition-all duration-500 ease-in-out",
              isExpanded ? "grid grid-cols-1 gap-6 md:grid-cols-5" : "",
              animateTransition ? "opacity-50" : "opacity-100",
            )}
          >
            <div className="col-span-2 space-y-5">
              <div>
                <h3 className="mb-3 text-base font-medium">
                  Enhance Prompt with AI
                </h3>
                <p className="text-sm text-muted-foreground">
                  Describe how you would like to enhance the base prompt. Be
                  specific about tone, focus areas, or any additional context.
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
                        className="h-[150px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Your instructions will be used to enhance the base prompt.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="button"
                variant="default"
                onClick={generateNaturalLanguage}
                disabled={
                  isGeneratingPrompt || !form.getValues("naturalLanguageInput")
                }
                className="w-full"
              >
                {isGeneratingPrompt ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : isStreamingComplete ? (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Regenerate
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Enhancement
                  </>
                )}
              </Button>

              {/* Show a stop button when generating */}
              {isGeneratingPrompt && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={stopAIGeneration}
                  className="mt-2 w-full"
                >
                  <StopCircle className="mr-2 h-4 w-4" />
                  Stop Generation
                </Button>
              )}
            </div>

            {/* AI Generation Results Panel - Only visible when expanded */}
            {(isExpanded || isStreamingComplete) && (
              <div
                className={cn(
                  "col-span-3 max-h-[600px] space-y-4 overflow-auto rounded-md border-2 border-primary/20 bg-accent/10 p-4 pt-0 shadow-lg transition-all duration-500 ease-in-out",
                  animateTransition
                    ? "translate-x-4 opacity-0"
                    : "translate-x-0 opacity-100",
                )}
                ref={resultsContainerRef}
              >
                <StreamingGenerationUI
                  isGenerating={isGeneratingPrompt}
                  isComplete={isStreamingComplete}
                  currentTask={currentTask}
                  streamedData={aiResponse || {}}
                  progress={previousProgress}
                />
              </div>
            )}
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-base font-medium">
                Schedule & Name Your Run
              </h3>
              <p className="text-sm text-muted-foreground">
                Give your run a descriptive name and decide when to start it
              </p>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Run Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Weekly Appointment Confirmations"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scheduleForLater"
              render={({ field }) => (
                <FormItem className="rounded-md border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <FormLabel className="text-base">
                        Schedule for Later
                      </FormLabel>
                      <FormDescription>
                        Run will start at the scheduled time
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </div>

                  {field.value && (
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="scheduledDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                min={format(new Date(), "yyyy-MM-dd")}
                                {...field}
                                value={
                                  field.value
                                    ? format(field.value, "yyyy-MM-dd")
                                    : ""
                                }
                                onChange={(e) => {
                                  const date = e.target.value
                                    ? new Date(e.target.value)
                                    : null;
                                  field.onChange(date);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="scheduledTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Time</FormLabel>
                            <FormControl>
                              <Input
                                type="time"
                                {...field}
                                value={field.value === null ? "" : field.value}
                                disabled={!form.getValues("scheduledDate")}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </FormItem>
              )}
            />
          </div>
        );
      default:
        return null;
    }
  };

  // Improved stepper component
  const renderStepper = () => {
    return (
      <div className="mb-8 w-full">
        <div className="flex w-full items-center justify-between">
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors duration-300",
                  {
                    "border-primary bg-primary text-primary-foreground":
                      currentStep === index,
                    "border-green-500 bg-green-500 text-white":
                      currentStep > index,
                    "border-gray-200 bg-gray-50 text-gray-500":
                      currentStep < index,
                  },
                )}
              >
                {currentStep > index ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  "mt-2 text-xs font-medium transition-colors duration-300",
                  currentStep === index
                    ? "text-primary"
                    : currentStep > index
                      ? "text-green-600"
                      : "text-gray-500",
                )}
              >
                {step}
              </span>
            </div>
          ))}
        </div>
        <div className="relative mt-4">
          <div className="bg-gray-200 absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 rounded-full"></div>
          <div
            className={cn(
              "absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary transition-all duration-500 ease-in-out",
              currentStep === 0
                ? "w-0"
                : currentStep === 1
                  ? "w-1/2"
                  : "w-full",
            )}
          ></div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "mx-auto w-full transition-all duration-500 ease-in-out",
        isExpanded ? "max-w-6xl" : "max-w-2xl",
      )}
    >
      {renderStepper()}

      <Form {...form}>
        <form
          onSubmit={(e) => {
            form.handleSubmit(onSubmit)(e);
          }}
          className="w-full"
        >
          <div className="transition-all duration-300 ease-in-out">
            {renderCurrentStep()}
          </div>

          <div className="mt-8 flex justify-between border-t pt-4">
            {currentStep === 0 ? (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={isGeneratingPrompt}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}

            {currentStep < steps.length - 1 ? (
              <Button
                type="button"
                onClick={nextStep}
                disabled={!canProceedFromCurrentStep() || isGeneratingPrompt}
                className="group"
              >
                {isGeneratingPrompt ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  !canProceedFromCurrentStep() ||
                  isGeneratingPrompt
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Run"
                )}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
