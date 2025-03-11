"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpIcon,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  StopCircle,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { agentResponseSchema } from "@/app/api/ai/agent/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// Convert aiResponse data to ensure it matches expected schema format
const sanitizeDataForSubmission = (data: any): any => {
  if (!data) return null;

  const result = { ...data };

  // Fix diffData to ensure it matches schema
  if (result.diffData && result.diffData.promptDiff) {
    // Ensure promptDiff is an array of objects with type and value
    result.diffData.promptDiff = result.diffData.promptDiff.map((item: any) => {
      if (typeof item === "string") {
        // Convert string to object format
        return { type: "unchanged", value: item };
      } else if (typeof item === "object" && item !== null) {
        // Ensure object has correct properties
        return {
          type: item.type || "unchanged",
          value: item.value || "",
        };
      }
      // Default fallback
      return { type: "unchanged", value: "" };
    });
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
  }

  return result;
};

// Define the form schema for creating a run
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

  useEffect(() => {
    if (isGeneratingPrompt && resultsContainerRef.current && aiResponse) {
      // Only scroll if user is already near the bottom or if this is the first content
      const container = resultsContainerRef.current;
      const isUserNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        100;

      if (isUserNearBottom) {
        // Smooth scroll to the bottom of the container when new content is added
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  }, [isGeneratingPrompt, aiResponse]);

  // Effect to sync AI response with state and handle panel expansion
  useEffect(() => {
    if (aiResponse) {
      // When we first start getting data, trigger expansion animation
      if (!isExpanded && isAIGenerating) {
        setAnimateTransition(true);
        setTimeout(() => {
          setIsExpanded(true);
          setTimeout(() => {
            setAnimateTransition(false);
          }, 500);
        }, 100);
      }
    }
  }, [aiResponse, isAIGenerating, isExpanded]);

  // Artificial progress stages to make streaming feedback more granular
  const generationStages = [
    { name: "Initializing AI", progress: 1, requiresData: false },
    { name: "Analyzing your request", progress: 3, requiresData: false },
    {
      name: "Creating categories",
      progress: 5,
      requiresData: aiResponse?.metadata?.categories?.length > 0,
    },
    {
      name: "Generating tags",
      progress: 8,
      requiresData: aiResponse?.metadata?.tags?.length > 0,
    },
    {
      name: "Determining tone changes",
      progress: 12,
      requiresData: aiResponse?.metadata?.toneShift,
    },
    {
      name: "Identifying focus areas",
      progress: 15,
      requiresData: aiResponse?.metadata?.focusArea,
    },
    {
      name: "Creating run name",
      progress: 18,
      requiresData: aiResponse?.suggestedRunName,
    },
    {
      name: "Generating summary",
      progress: 22,
      requiresData: aiResponse?.summary,
    },
    {
      name: "Determining change intent",
      progress: 26,
      requiresData: aiResponse?.metadata?.changeIntent,
    },
    {
      name: "Measuring formality changes",
      progress: 32,
      requiresData: aiResponse?.metadata?.formalityLevel,
    },
    {
      name: "Calculating complexity scores",
      progress: 38,
      requiresData: aiResponse?.metadata?.complexityScore,
    },
    {
      name: "Analyzing sentiment changes",
      progress: 44,
      requiresData: aiResponse?.metadata?.sentimentShift,
    },
    {
      name: "Enhancing prompt text",
      progress: 52,
      requiresData: aiResponse?.newPrompt,
    },
    {
      name: "Refining voicemail message",
      progress: 60,
      requiresData: aiResponse?.newVoicemailMessage,
    },
    {
      name: "Analyzing structural changes",
      progress: 68,
      requiresData: aiResponse?.comparison?.structuralChanges,
    },
    {
      name: "Identifying key phrase changes",
      progress: 76,
      requiresData: aiResponse?.comparison?.keyPhrases,
    },
    {
      name: "Analyzing performance impact",
      progress: 84,
      requiresData: aiResponse?.comparison?.performancePrediction,
    },
    {
      name: "Creating visualization of changes",
      progress: 92,
      requiresData: aiResponse?.diffData?.promptDiff,
    },
    { name: "Finalizing enhancements", progress: 96, requiresData: false },
    { name: "Prompt generation complete", progress: 100, requiresData: false },
  ];

  // Enhanced time-based progress fallback
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(
    null,
  );
  const [progressIncrement, setProgressIncrement] = useState(0);

  // Effect to track AI generation status with more detailed messages
  useEffect(() => {
    if (isAIGenerating) {
      setIsGeneratingPrompt(true);
      setIsStreamingComplete(false);

      // Start timing the process if needed
      if (!generationStartTime) {
        setGenerationStartTime(Date.now());

        // Start progress increment timer for smoother visual feedback
        const timer = setInterval(() => {
          setProgressIncrement((prev) => {
            // Increment by small amounts until we reach 95%
            if (prev < 90) {
              return prev + 0.2;
            }
            return prev;
          });
        }, 100);

        return () => clearInterval(timer);
      }

      // Determine the current stage based on the data we have
      let stageIndex = 0;
      let currentProgress = 0;

      // Go through each stage to find where we are
      for (let i = 0; i < generationStages.length - 1; i++) {
        const stage = generationStages[i];
        const nextStage = generationStages[i + 1];

        // Check if this stage is completed based on requiresData
        let isStageCompleted = false;

        if (!stage.requiresData) {
          isStageCompleted = true;
        } else if (stage.requiresData === true) {
          // This is a placeholder that's always considered incomplete
          isStageCompleted = false;
        } else {
          // Check specific data requirements
          if (
            stage.name === "Creating categories" &&
            aiResponse?.metadata?.categories?.length > 0
          )
            isStageCompleted = true;
          else if (
            stage.name === "Generating tags" &&
            aiResponse?.metadata?.tags?.length > 0
          )
            isStageCompleted = true;
          else if (
            stage.name === "Determining tone changes" &&
            aiResponse?.metadata?.toneShift
          )
            isStageCompleted = true;
          else if (
            stage.name === "Identifying focus areas" &&
            aiResponse?.metadata?.focusArea
          )
            isStageCompleted = true;
          else if (
            stage.name === "Creating run name" &&
            aiResponse?.suggestedRunName
          )
            isStageCompleted = true;
          else if (stage.name === "Generating summary" && aiResponse?.summary)
            isStageCompleted = true;
          else if (
            stage.name === "Determining change intent" &&
            aiResponse?.metadata?.changeIntent
          )
            isStageCompleted = true;
          else if (
            stage.name === "Measuring formality changes" &&
            aiResponse?.metadata?.formalityLevel
          )
            isStageCompleted = true;
          else if (
            stage.name === "Calculating complexity scores" &&
            aiResponse?.metadata?.complexityScore
          )
            isStageCompleted = true;
          else if (
            stage.name === "Analyzing sentiment changes" &&
            aiResponse?.metadata?.sentimentShift
          )
            isStageCompleted = true;
          else if (
            stage.name === "Enhancing prompt text" &&
            aiResponse?.newPrompt
          )
            isStageCompleted = true;
          else if (
            stage.name === "Refining voicemail message" &&
            aiResponse?.newVoicemailMessage
          )
            isStageCompleted = true;
          else if (
            stage.name === "Analyzing structural changes" &&
            aiResponse?.comparison?.structuralChanges
          )
            isStageCompleted = true;
          else if (
            stage.name === "Identifying key phrase changes" &&
            aiResponse?.comparison?.keyPhrases
          )
            isStageCompleted = true;
          else if (
            stage.name === "Analyzing performance impact" &&
            aiResponse?.comparison?.performancePrediction
          )
            isStageCompleted = true;
          else if (
            stage.name === "Creating visualization of changes" &&
            aiResponse?.diffData?.promptDiff
          )
            isStageCompleted = true;
        }

        // If we completed this stage, move to the next one
        if (isStageCompleted) {
          stageIndex = i + 1;
          currentProgress = nextStage.progress;
        } else {
          // Calculate progress within the current stage
          const stageDuration = nextStage.progress - stage.progress;
          const elapsed = Date.now() - generationStartTime;
          const stageElapsed = elapsed % 10000; // Cycle through progress every 10 seconds
          const stageProgress = (stageElapsed / 10000) * stageDuration;

          currentProgress = stage.progress + stageProgress;
          break;
        }
      }

      // Calculate time-based progress as fallback
      const elapsed = Date.now() - generationStartTime;
      const timeBasedProgress = Math.min(
        90,
        Math.max(progressIncrement, (elapsed / 30000) * 100),
      );

      // Use the higher of the progress calculations
      const finalProgress = Math.max(currentProgress, timeBasedProgress);

      // Get the current stage name
      setCurrentTask(generationStages[stageIndex].name);

      // Only update if progress increased to avoid jumpy animations
      if (finalProgress > previousProgress) {
        setPreviousProgress(finalProgress);
      }
    } else if (aiResponse) {
      // Reset progress timers
      setGenerationStartTime(null);
      setProgressIncrement(0);

      // Set to complete
      setIsGeneratingPrompt(false);
      setIsStreamingComplete(true);
      setCurrentTask("Prompt generation complete");
      setPreviousProgress(100);

      // Set suggested name if available
      if (aiResponse?.suggestedRunName) {
        form.setValue("name", aiResponse.suggestedRunName);
      }

      // Set the new prompt and voicemail message
      if (aiResponse?.newPrompt) {
        form.setValue("customPrompt", aiResponse.newPrompt);
      }

      if (aiResponse?.newVoicemailMessage) {
        form.setValue("customVoicemailMessage", aiResponse.newVoicemailMessage);
      }
    }
  }, [
    isAIGenerating,
    aiResponse,
    generationStartTime,
    progressIncrement,
    form,
  ]);

  const createRunMutation = useCreateRun(campaignId);
  const uploadFileMutation = useUploadFile();

  const generateNaturalLanguage = async () => {
    // Reset progress when starting a new generation
    setPreviousProgress(0);

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
    if (currentStep !== 2) {
      nextStep();
      return;
    }

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

  // File upload step
  const renderUploadStep = () => {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="mb-3 text-base font-medium">Upload Data File</h3>
          <p className="text-sm text-muted-foreground">
            Upload an Excel or CSV file with your patient appointment data
          </p>
        </div>

        {!file ? (
          <div className="relative">
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="border-gray-300 hover:bg-gray-50 flex h-44 w-full cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-3 py-2 text-sm transition-colors"
            >
              <ArrowUpIcon className="mb-2 h-10 w-10 text-primary/50" />
              <p className="font-medium">Upload Excel or CSV file</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Drag and drop or click to select
              </p>
            </label>
          </div>
        ) : (
          <div className="space-y-4 rounded-md border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFileRemove}
              >
                <X className="mr-1 h-4 w-4" /> Remove
              </Button>
            </div>

            {isValidating && (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Validating file...</span>
              </div>
            )}

            {processedFile && processedFile.stats && (
              <div className="rounded-md bg-green-50 p-3 text-green-800">
                <div className="flex">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div className="ml-3">
                    <p className="text-sm font-medium">File Validated</p>
                    <p className="mt-1 text-xs">
                      The file has been validated and is ready for upload.{" "}
                      {processedFile.stats.totalRows ||
                        processedFile.parsedData?.rows?.length}{" "}
                      rows found.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Data preview */}
            {processedFile && processedFile.parsedData?.rows?.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-sm font-medium">Data Preview</h4>
                <div className="overflow-hidden rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/50">
                      <tr>
                        <th className="w-[100px] px-2 py-1.5 text-left font-medium text-muted-foreground">
                          Patient ID
                        </th>
                        <th className="max-w-[140px] px-2 py-1.5 text-left font-medium text-muted-foreground">
                          Patient Hash
                        </th>
                        <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                          Variables
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedFile.parsedData.rows
                        .slice(0, 1)
                        .map((row, i) => (
                          <tr key={i} className="bg-white">
                            <td className="border-t px-2 py-1.5 align-top">
                              {row.patientId || "—"}
                            </td>
                            <td
                              className="max-w-[140px] truncate border-t px-2 py-1.5 align-top"
                              title={row.patientHash}
                            >
                              {row.patientHash || "—"}
                            </td>
                            <td className="border-t px-2 py-1.5 align-top">
                              {row.variables &&
                              typeof row.variables === "object" ? (
                                <div className="flex flex-col gap-1">
                                  {Object.entries(row.variables)
                                    .slice(0, 5)
                                    .map(([key, value]) => (
                                      <div
                                        key={key}
                                        className="flex items-start gap-1"
                                      >
                                        <span className="min-w-[80px] truncate text-xs font-medium">
                                          {key}:
                                        </span>
                                        <span className="break-words text-xs">
                                          {String(value)}
                                        </span>
                                      </div>
                                    ))}
                                  {Object.keys(row.variables).length > 5 && (
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      +{Object.keys(row.variables).length - 5}{" "}
                                      more fields
                                    </div>
                                  )}
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {processedFile.parsedData.rows.length > 1 && (
                  <div className="mt-1 text-right text-xs text-muted-foreground">
                    Showing 1 of {processedFile.parsedData.rows.length} records
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // AI generation step
  const renderPromptStep = () => {
    return (
      <div
        className={cn(
          "transition-all duration-500",
          isExpanded ? "grid grid-cols-1 gap-6 md:grid-cols-5" : "",
          animateTransition ? "opacity-50" : "opacity-100",
        )}
      >
        <div className="space-y-5 md:col-span-2">
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
                    className="h-[120px] resize-none"
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
              "max-h-[600px] space-y-4 overflow-auto rounded-md border bg-accent/80 p-4 px-0 pt-0 transition-all duration-500 md:col-span-3",
              animateTransition
                ? "translate-x-4 opacity-0"
                : "translate-x-0 opacity-100",
            )}
            ref={resultsContainerRef}
          >
            <div className="sticky top-0 z-10 -mb-4 rounded-t-md bg-secondary/50 p-4 backdrop-blur-md">
              <h3 className="text-lg font-medium">AI Generation Results</h3>
              {/* Generation status indicator */}
              <div className="mt-2 flex items-center space-x-2">
                {isGeneratingPrompt ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : isStreamingComplete ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                )}
                <span className="text-sm font-medium">
                  {currentTask ||
                    (isStreamingComplete
                      ? "Generation complete"
                      : "Waiting to start")}
                </span>
              </div>

              {/* Progress bar with enhanced visualization */}
              {(isGeneratingPrompt || isStreamingComplete) && (
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted-foreground/10">
                  <div
                    className="h-2.5 rounded-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${previousProgress}%` }}
                  >
                    {isGeneratingPrompt && (
                      <div className="absolute inset-0 h-full w-full">
                        <div className="animate-pulse-gradient h-full w-[200%] bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Generation checkpoints for better visual feedback */}
              {(isGeneratingPrompt || isStreamingComplete) && (
                <div className="mt-2 grid grid-cols-4 gap-1 text-xs">
                  <div
                    className={cn(
                      "flex items-center",
                      previousProgress >= 25
                        ? "text-green-600"
                        : "text-gray-400",
                    )}
                  >
                    <div
                      className={cn(
                        "mr-1 h-1.5 w-1.5 rounded-full",
                        previousProgress >= 25 ? "bg-green-500" : "bg-gray-300",
                      )}
                    ></div>
                    Categories
                  </div>
                  <div
                    className={cn(
                      "flex items-center",
                      previousProgress >= 50
                        ? "text-green-600"
                        : "text-muted-foreground",
                    )}
                  >
                    <div
                      className={cn(
                        "mr-1 h-1.5 w-1.5 rounded-full",
                        previousProgress >= 50 ? "bg-green-500" : "bg-gray-300",
                      )}
                    ></div>
                    Enhance prompt
                  </div>
                  <div
                    className={cn(
                      "flex items-center",
                      previousProgress >= 75
                        ? "text-green-600"
                        : "text-muted-foreground",
                    )}
                  >
                    <div
                      className={cn(
                        "mr-1 h-1.5 w-1.5 rounded-full",
                        previousProgress >= 75
                          ? "bg-green-500"
                          : "bg-muted-foreground/10",
                      )}
                    ></div>
                    Analyze changes
                  </div>
                  <div
                    className={cn(
                      "flex items-center",
                      previousProgress >= 100
                        ? "text-green-600"
                        : "text-muted-foreground",
                    )}
                  >
                    <div
                      className={cn(
                        "mr-1 h-1.5 w-1.5 rounded-full",
                        previousProgress >= 100
                          ? "bg-green-500"
                          : "bg-muted-foreground/10",
                      )}
                    ></div>
                    Complete
                  </div>
                </div>
              )}
            </div>

            {/* Generated content */}
            <div className="space-y-4 p-4">
              {/* Categories and Tags - Show loading state if not available */}
              <div className="duration-300 animate-in fade-in slide-in-from-bottom">
                <h4 className="mb-2 text-sm font-medium">Categories & Tags</h4>
                {aiResponse?.metadata?.categories &&
                aiResponse.metadata.categories.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {aiResponse.metadata.categories.map((category, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="bg-blue-100"
                      >
                        {category}
                      </Badge>
                    ))}
                  </div>
                ) : isGeneratingPrompt && previousProgress >= 5 ? (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-6 animate-pulse rounded-full bg-blue-50 px-2 text-xs text-transparent"
                      >
                        Loading...
                      </div>
                    ))}
                  </div>
                ) : null}

                {aiResponse?.metadata?.tags &&
                aiResponse.metadata.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {aiResponse.metadata.tags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : isGeneratingPrompt && previousProgress >= 8 ? (
                  <div className="flex flex-wrap gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-5 animate-pulse rounded-full bg-muted-foreground/10 px-2 text-xs text-transparent"
                      >
                        Loading...
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Summary */}
              <Card className="border-l-4 border-l-primary duration-300 animate-in fade-in slide-in-from-left">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Summary</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {aiResponse?.summary ? (
                    <p className="text-sm">{aiResponse.summary}</p>
                  ) : isGeneratingPrompt && previousProgress >= 20 ? (
                    <div className="space-y-2">
                      <div className="h-4 w-full animate-pulse rounded bg-muted-foreground/20"></div>
                      <div className="h-4 w-5/6 animate-pulse rounded bg-muted-foreground/20"></div>
                      <div className="h-4 w-4/6 animate-pulse rounded bg-muted-foreground/20"></div>
                    </div>
                  ) : isGeneratingPrompt ? (
                    <p className="text-sm italic text-muted-foreground">
                      Generating summary...
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              {/* Key Changes */}
              <Card className="duration-300 animate-in fade-in slide-in-from-bottom">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Key Changes
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {aiResponse?.metadata?.keyChanges &&
                  aiResponse.metadata.keyChanges.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {aiResponse.metadata.keyChanges.map((change, i) => (
                        <li key={i}>{change}</li>
                      ))}
                    </ul>
                  ) : isGeneratingPrompt && previousProgress >= 30 ? (
                    <ul className="list-disc space-y-2 pl-5">
                      {[1, 2, 3].map((i) => (
                        <li key={i} className="animate-pulse">
                          <div className="h-4 w-full animate-pulse rounded bg-muted-foreground/20"></div>
                        </li>
                      ))}
                    </ul>
                  ) : isGeneratingPrompt ? (
                    <p className="text-sm italic text-muted-foreground">
                      Identifying key changes...
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              {/* Metrics & Analysis */}
              <Card className="duration-300 animate-in fade-in slide-in-from-bottom">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Prompt Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {/* Length */}
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Length:</span>
                    {aiResponse?.metadata?.promptLength ? (
                      <span>
                        {aiResponse.metadata.promptLength.before} →{" "}
                        {aiResponse.metadata.promptLength.after} (
                        {aiResponse.metadata.promptLength.difference > 0
                          ? "+"
                          : ""}
                        {aiResponse.metadata.promptLength.difference} chars)
                      </span>
                    ) : isGeneratingPrompt && previousProgress >= 40 ? (
                      <span className="animate-pulse rounded bg-muted-foreground/20 text-transparent">
                        Loading metrics...
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Pending</span>
                    )}
                  </div>

                  {/* Formality */}
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Formality (1-10):</span>
                    {aiResponse?.metadata?.formalityLevel ? (
                      <span>
                        {aiResponse.metadata.formalityLevel.before} →{" "}
                        {aiResponse.metadata.formalityLevel.after}
                      </span>
                    ) : isGeneratingPrompt && previousProgress >= 40 ? (
                      <span className="animate-pulse rounded bg-muted-foreground/20 text-transparent">
                        Loading metrics...
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Pending</span>
                    )}
                  </div>

                  {/* Complexity */}
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Complexity (1-10):</span>
                    {aiResponse?.metadata?.complexityScore ? (
                      <span>
                        {aiResponse.metadata.complexityScore.before} →{" "}
                        {aiResponse.metadata.complexityScore.after}
                      </span>
                    ) : isGeneratingPrompt && previousProgress >= 40 ? (
                      <span className="animate-pulse rounded bg-muted-foreground/20 text-transparent">
                        Loading metrics...
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Pending</span>
                    )}
                  </div>

                  {/* Sentiment */}
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Sentiment:</span>
                    {aiResponse?.metadata?.sentimentShift ? (
                      <span>
                        {aiResponse.metadata.sentimentShift.before} →{" "}
                        {aiResponse.metadata.sentimentShift.after}
                      </span>
                    ) : isGeneratingPrompt && previousProgress >= 44 ? (
                      <span className="animate-pulse rounded bg-muted-foreground/20 text-transparent">
                        Loading metrics...
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Pending</span>
                    )}
                  </div>

                  {/* Tone */}
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Tone:</span>
                    {aiResponse?.metadata?.toneShift ? (
                      <span>{aiResponse.metadata.toneShift}</span>
                    ) : isGeneratingPrompt && previousProgress >= 12 ? (
                      <span className="bg-gray-200 animate-pulse rounded text-transparent">
                        Loading metrics...
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Pending</span>
                    )}
                  </div>

                  {/* Focus Area */}
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Focus Area:</span>
                    {aiResponse?.metadata?.focusArea ? (
                      <span>{aiResponse.metadata.focusArea}</span>
                    ) : isGeneratingPrompt && previousProgress >= 15 ? (
                      <span className="animate-pulse rounded bg-muted-foreground/20 text-transparent">
                        Loading metrics...
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Pending</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Performance Prediction */}
              <Card className="duration-300 animate-in fade-in slide-in-from-bottom">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Performance Prediction
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {aiResponse?.comparison?.performancePrediction ? (
                    <>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-medium">
                          Expected Impact:
                        </span>
                        <Badge
                          className={
                            aiResponse.comparison.performancePrediction
                              .expectedImpact === "positive"
                              ? "bg-green-100 text-green-800"
                              : aiResponse.comparison.performancePrediction
                                    .expectedImpact === "negative"
                                ? "bg-red-100 text-red-800"
                                : "bg-muted-foreground/10 text-muted-foreground"
                          }
                        >
                          {
                            aiResponse.comparison.performancePrediction
                              .expectedImpact
                          }
                        </Badge>
                        {aiResponse.comparison.performancePrediction
                          .confidenceLevel && (
                          <span className="text-xs">
                            (Confidence:{" "}
                            {
                              aiResponse.comparison.performancePrediction
                                .confidenceLevel
                            }
                            /10)
                          </span>
                        )}
                      </div>
                      {aiResponse.comparison.performancePrediction
                        .rationale && (
                        <p className="text-sm">
                          {
                            aiResponse.comparison.performancePrediction
                              .rationale
                          }
                        </p>
                      )}
                    </>
                  ) : isGeneratingPrompt && previousProgress >= 80 ? (
                    <>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-sm font-medium">
                          Expected Impact:
                        </span>
                        <div className="h-5 w-20 animate-pulse rounded bg-muted-foreground/20 text-transparent">
                          loading
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 w-full animate-pulse rounded bg-muted-foreground/20"></div>
                        <div className="h-4 w-5/6 animate-pulse rounded bg-muted-foreground/20"></div>
                      </div>
                    </>
                  ) : isGeneratingPrompt && previousProgress >= 50 ? (
                    <p className="text-sm italic text-muted-foreground">
                      Analyzing expected impact...
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              {/* Text Changes Visualization */}
              <Card className="duration-300 animate-in fade-in slide-in-from-bottom">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Text Changes
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {aiResponse?.diffData?.promptDiff ? (
                    <div className="max-h-40 overflow-auto rounded-md bg-muted/30 p-2">
                      <DiffDisplay diff={aiResponse.diffData.promptDiff} />
                    </div>
                  ) : isGeneratingPrompt && previousProgress >= 90 ? (
                    <div className="max-h-40 overflow-hidden rounded-md bg-muted/30 p-2">
                      <div className="animate-pulse space-y-2">
                        <div className="h-4 w-full animate-pulse rounded bg-muted-foreground/20"></div>
                        <div className="h-4 w-5/6 animate-pulse rounded bg-muted-foreground/20"></div>
                        <div className="h-4 w-3/6 rounded bg-green-100"></div>
                        <div className="h-4 w-4/6 animate-pulse rounded bg-muted-foreground/20"></div>
                        <div className="h-4 w-2/6 animate-pulse rounded bg-muted-foreground/20"></div>
                        <div className="h-4 w-5/6 animate-pulse rounded bg-muted-foreground/20"></div>
                      </div>
                    </div>
                  ) : isGeneratingPrompt && previousProgress >= 60 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Generating text diff visualization...
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Key Phrases */}
              <Card className="duration-300 animate-in fade-in slide-in-from-bottom">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Key Phrases
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {/* Added phrases */}
                  <div>
                    <span className="text-xs font-medium text-green-600">
                      Added:
                    </span>
                    {aiResponse?.comparison?.keyPhrases?.added &&
                    aiResponse.comparison.keyPhrases.added.length > 0 ? (
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                        {aiResponse.comparison.keyPhrases.added.map(
                          (phrase, i) => (
                            <li key={i}>{phrase}</li>
                          ),
                        )}
                      </ul>
                    ) : isGeneratingPrompt && previousProgress >= 76 ? (
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {[1, 2].map((i) => (
                          <li key={i} className="animate-pulse">
                            <div className="h-3 w-3/4 rounded bg-green-100"></div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 pl-5 text-xs text-muted-foreground">
                        None
                      </p>
                    )}
                  </div>

                  {/* Removed phrases */}
                  <div>
                    <span className="text-xs font-medium text-red-600">
                      Removed:
                    </span>
                    {aiResponse?.comparison?.keyPhrases?.removed &&
                    aiResponse.comparison.keyPhrases.removed.length > 0 ? (
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                        {aiResponse.comparison.keyPhrases.removed.map(
                          (phrase, i) => (
                            <li key={i}>{phrase}</li>
                          ),
                        )}
                      </ul>
                    ) : isGeneratingPrompt && previousProgress >= 76 ? (
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {[1, 2].map((i) => (
                          <li key={i} className="animate-pulse">
                            <div className="h-3 w-1/2 rounded bg-red-100"></div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 pl-5 text-xs text-muted-foreground">
                        None
                      </p>
                    )}
                  </div>

                  {/* Modified phrases */}
                  <div>
                    <span className="text-xs font-medium text-amber-600">
                      Modified:
                    </span>
                    {aiResponse?.comparison?.keyPhrases?.modified &&
                    aiResponse.comparison.keyPhrases.modified.length > 0 ? (
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                        {aiResponse.comparison.keyPhrases.modified.map(
                          (mod, i) => (
                            <li key={i}>
                              "{mod.before}" → "{mod.after}"
                            </li>
                          ),
                        )}
                      </ul>
                    ) : isGeneratingPrompt && previousProgress >= 76 ? (
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {[1, 2].map((i) => (
                          <li key={i} className="animate-pulse">
                            <div className="h-3 w-5/6 rounded bg-amber-100"></div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 pl-5 text-xs text-muted-foreground">
                        None
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Scheduling step
  const renderSchedulingStep = () => {
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

        {processedFile && (
          <Card className="bg-muted/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Run Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  Total Rows:
                </span>
                <span className="text-sm font-medium">
                  {processedFile.stats?.totalRows ||
                    processedFile.parsedData?.rows?.length ||
                    0}
                </span>
              </div>
              {processedFile.stats?.invalidRows > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Invalid Rows:
                  </span>
                  <span className="text-sm font-medium text-amber-600">
                    {processedFile.stats?.invalidRows}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  Valid Calls:
                </span>
                <span className="text-sm font-medium text-green-600">
                  {(processedFile.stats?.totalRows ||
                    processedFile.parsedData?.rows?.length ||
                    0) - (processedFile.stats?.invalidRows || 0)}
                </span>
              </div>
              {aiResponse && (
                <div className="mt-2 border-t pt-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      AI Enhancement:
                    </span>
                    <span className="text-sm font-medium text-primary">
                      {aiResponse.comparison?.performancePrediction
                        ?.expectedImpact === "positive"
                        ? "Positive Impact"
                        : aiResponse.comparison?.performancePrediction
                              ?.expectedImpact === "negative"
                          ? "Negative Impact"
                          : "Applied"}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // Render the current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderUploadStep();
      case 1:
        return renderPromptStep();
      case 2:
        return renderSchedulingStep();
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
                  "flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
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
                  "mt-2 text-xs font-medium transition-colors",
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
              "absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary transition-all duration-500",
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
        "mx-auto w-full transition-all duration-500",
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
          <div className="transition-all duration-500">
            {renderStepContent()}
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
              >
                {isGeneratingPrompt ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
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
                  <>
                    Create Run
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
