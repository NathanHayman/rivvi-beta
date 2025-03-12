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
import { updatePromptAndVoicemail } from "@/lib/retell/retell-actions";
import { cn } from "@/lib/utils";
import { validateData } from "@/server/actions/runs";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { format } from "date-fns";

// Components
import { useMutation } from "@tanstack/react-query";
import StreamingGenerationUI from "./streaming-generation-ui";
import UploadFileStep from "./upload-file-step";

// Run form schema - unchanged
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
    onFinish: (finalObject) => {
      console.log("AI SDK finished, final object:", finalObject);
    },
    onError: (error) => {
      console.error("AI SDK error:", error);
      toast.error("There was an error generating the AI response");
    },
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

  const createRunMutation = useCreateRun(campaignId);
  const uploadFileMutation = useUploadFile();

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

  // Enhanced effect for tracking generation status and progress
  useEffect(() => {
    if (isAIGenerating && !isGeneratingPrompt) {
      setIsGeneratingPrompt(true);
      setIsStreamingComplete(false);

      // Start timing
      if (!generationStartTime) {
        setGenerationStartTime(Date.now());
      }

      // Determine current stage and appropriate message
      let currentStage = "Initializing AI";
      let progress = 5;

      try {
        // Check data properties in sequence to determine current stage
        if (aiResponse?.diffData?.promptDiff) {
          console.log(
            "DIFF DATA DETECTED:",
            JSON.stringify(aiResponse.diffData, null, 2),
          );
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

        // Apply time-based progress increment for smoother experience
        const elapsed = Date.now() - (generationStartTime || Date.now());
        const timeBasedMinimumProgress = Math.min(90, (elapsed / 30000) * 100);
        progress = Math.max(progress, timeBasedMinimumProgress);

        console.log(
          "Current AI response state:",
          JSON.stringify(aiResponse, null, 2),
        );
      } catch (error) {
        console.error("Error processing AI response:", error);
        currentStage = "Processing AI response";
      }

      setCurrentTask(currentStage);
      setPreviousProgress(progress);
    } else if (!isAIGenerating && isGeneratingPrompt && aiResponse) {
      // Reset progress timers and set to complete
      setGenerationStartTime(null);
      setIsGeneratingPrompt(false);
      setIsStreamingComplete(true);
      setCurrentTask("Prompt generation complete");
      setPreviousProgress(100);

      try {
        // Process the AI response to ensure it has the correct format
        const processedResponse = sanitizeDataForSubmission(aiResponse);

        // Log the processed response for debugging
        console.log(
          "Processed AI response:",
          JSON.stringify(processedResponse, null, 2),
        );

        // Check specifically for diff data
        if (processedResponse?.diffData) {
          console.log(
            "Final DIFF DATA:",
            JSON.stringify(processedResponse.diffData, null, 2),
          );
        } else {
          console.warn("No diff data found in processed response");
        }

        // Set form values from AI response
        if (processedResponse?.suggestedRunName) {
          form.setValue("name", processedResponse.suggestedRunName);
        }

        if (processedResponse?.newPrompt) {
          form.setValue("customPrompt", processedResponse.newPrompt);
          form.setValue("aiGenerated", true);
        }

        if (processedResponse?.newVoicemailMessage) {
          form.setValue(
            "customVoicemailMessage",
            processedResponse.newVoicemailMessage,
          );
        }
      } catch (error) {
        console.error("Error setting form values from AI response:", error);
        toast.error(
          "There was an issue processing the AI response, but you can still proceed.",
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAIGenerating,
    aiResponse,
    generationStartTime,
    form,
    isGeneratingPrompt,
    isStreamingComplete,
  ]);

  // Sanitize AI response data to ensure it matches schema format
  const sanitizeDataForSubmission = (data: any): any => {
    if (!data) return null;

    try {
      console.log("Sanitizing data:", JSON.stringify(data, null, 2));
      const result = { ...data };

      // Create empty diffData structure if it doesn't exist
      if (!result.diffData) {
        console.log("Creating empty diffData structure");
        result.diffData = {
          promptDiff: [],
          voicemailDiff: [],
        };
      }

      // Fix promptDiff to ensure it matches schema
      if (result.diffData) {
        // Process promptDiff
        if (result.diffData.promptDiff) {
          console.log(
            "Processing promptDiff:",
            JSON.stringify(result.diffData.promptDiff, null, 2),
          );

          // Ensure promptDiff is an array
          if (!Array.isArray(result.diffData.promptDiff)) {
            console.warn(
              "promptDiff is not an array, converting to empty array",
            );
            result.diffData.promptDiff = [];
          } else {
            // Map each item to ensure proper format
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
        } else {
          console.log("promptDiff not found, initializing as empty array");
          result.diffData.promptDiff = [];
        }

        // Process voicemailDiff
        if (result.diffData.voicemailDiff) {
          console.log(
            "Processing voicemailDiff:",
            JSON.stringify(result.diffData.voicemailDiff, null, 2),
          );

          // Ensure voicemailDiff is an array
          if (!Array.isArray(result.diffData.voicemailDiff)) {
            console.warn(
              "voicemailDiff is not an array, converting to empty array",
            );
            result.diffData.voicemailDiff = [];
          } else {
            // Map each item to ensure proper format
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
        } else {
          console.log("voicemailDiff not found, initializing as empty array");
          result.diffData.voicemailDiff = [];
        }
      }

      // Ensure newPrompt is set in form values for Retell update
      if (result.newPrompt && typeof result.newPrompt === "string") {
        form.setValue("customPrompt", result.newPrompt);
        form.setValue("aiGenerated", true);
      }

      // Ensure newVoicemailMessage is set in form values for Retell update
      if (
        result.newVoicemailMessage &&
        typeof result.newVoicemailMessage === "string"
      ) {
        form.setValue("customVoicemailMessage", result.newVoicemailMessage);
      }

      // Format metadata correctly for submission
      if (result.metadata) {
        // Ensure all expected metadata fields exist
        result.metadata = {
          categories: result.metadata.categories || [],
          tags: result.metadata.tags || [],
          keyChanges: result.metadata.keyChanges || [],
          toneShift: result.metadata.toneShift || "",
          focusArea: result.metadata.focusArea || "",
          promptLength: result.metadata.promptLength || {
            before: 0,
            after: 0,
            difference: 0,
          },
          changeIntent: result.metadata.changeIntent || "",
          sentimentShift: result.metadata.sentimentShift || {
            before: "",
            after: "",
          },
          formalityLevel: result.metadata.formalityLevel || {
            before: 5,
            after: 5,
          },
          complexityScore: result.metadata.complexityScore || {
            before: 5,
            after: 5,
          },
        };
      }

      console.log("Sanitized result:", JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error("Error in sanitizeDataForSubmission:", error);
      return data; // Return original data if sanitization fails
    }
  };

  const generateNaturalLanguage = async () => {
    // Reset progress when starting a new generation
    setPreviousProgress(0);
    setCurrentTask("Initializing AI");

    // Clear any previous response data
    setIsExpanded(true);

    try {
      console.log("Starting AI generation with inputs:", {
        basePrompt: campaignBasePrompt,
        baseVoicemailMessage: campaignVoicemailMessage,
        naturalLanguageInput: form.getValues("naturalLanguageInput"),
        campaignContext: {
          name: campaignName,
          description: campaignDescription,
        },
      });

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
    } catch (error) {
      console.error("Error generating natural language:", error);
      toast.error("Failed to generate AI response. Please try again.");
      setIsGeneratingPrompt(false);
    }
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
      // File processing logic stays the same
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
    // Form submission logic stays the same
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

      // First, create the run
      const createRunResult = await createRunMutation.mutateAsync(
        runPayload as any,
      );

      // Then, if this is an AI-generated variation, update Retell and record the variation
      if (values.aiGenerated && sanitizedAiResponse) {
        try {
          console.log("Preparing to update Retell with AI-generated content:", {
            newPrompt: sanitizedAiResponse.newPrompt ? "Present" : "Missing",
            newVoicemailMessage: sanitizedAiResponse.newVoicemailMessage
              ? "Present"
              : "Missing",
            suggestedRunName: sanitizedAiResponse.suggestedRunName,
            hasMetadata: sanitizedAiResponse.metadata ? true : false,
            naturalLanguageInput: values.naturalLanguageInput
              ? "Present"
              : "Missing",
          });

          // Call updatePromptAndVoicemail to update Retell and create variation record
          const updateResult = await updatePromptAndVoicemail({
            campaignId,
            runId: createRunResult.id,
            naturalLanguageInput: values.naturalLanguageInput,
            // Use the AI-generated content directly from sanitizedAiResponse
            generatedPrompt:
              sanitizedAiResponse.newPrompt ||
              values.customPrompt ||
              campaignBasePrompt,
            generatedVoicemail:
              sanitizedAiResponse.newVoicemailMessage ||
              values.customVoicemailMessage ||
              campaignVoicemailMessage,
            suggestedRunName:
              sanitizedAiResponse.suggestedRunName || values.name,
            summary:
              sanitizedAiResponse.summary || "AI-generated prompt variation",
            metadata: sanitizedAiResponse.metadata,
          });

          console.log(
            "Successfully updated Retell and recorded agent variation:",
            updateResult,
          );
          toast.success("Successfully updated AI variation in Retell");
        } catch (updateError) {
          console.error("Error updating Retell:", updateError);
          toast.error(
            "Created run but failed to update Retell. Contact support for assistance.",
          );
        }
      }

      // Handle the file upload if provided
      if (file && createRunResult) {
        try {
          // Prepare the file content and processed data structure
          const fileData = {
            runId: createRunResult.id,
            fileName: file.name,
            fileContent: JSON.stringify(processedFile.parsedData?.rows || []),
            processedData: {
              headers: processedFile.parsedData?.headers || [],
              rows:
                processedFile.parsedData?.rows?.map((row) => {
                  if (row.variables && typeof row.variables === "object") {
                    return {
                      patientId: row.patientId || null,
                      patientHash: row.patientHash || null,
                      variables: row.variables,
                    };
                  }

                  // Extract patientId and patientHash, keep the rest as variables
                  const { patientId, patientHash, ...variables } = row;
                  return {
                    patientId: patientId || null,
                    patientHash: patientHash || null,
                    variables,
                  };
                }) || [],
            },
          };

          console.log("Uploading file with data:", {
            fileName: fileData.fileName,
            rowCount: fileData.processedData.rows.length,
            hasHeaders: fileData.processedData.headers.length > 0,
          });

          const fileUploadResult =
            await uploadFileMutation.mutateAsync(fileData);
          console.log("File upload result:", fileUploadResult);
        } catch (fileError) {
          console.error("Error uploading file:", fileError);
          toast.error("Error uploading file. Please try again.");
        }
      }

      // Show success message
      toast.success(`Run "${values.name}" created successfully`);

      // Handle success (e.g., redirect, callback)
      handleSuccess(createRunResult?.id);
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("Failed to create run. Please try again.");
    } finally {
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
                  "col-span-3 max-h-[650px] space-y-4 rounded-md border-2 border-primary/20 bg-accent/50 p-4 pt-4 shadow-lg transition-all duration-500 ease-in-out",
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
                  streamedData={sanitizeDataForSubmission(aiResponse) || {}}
                  progress={previousProgress}
                />
                {/* Add debug info in development mode */}
                {/* {process.env.NODE_ENV === "development" && (
                  <details className="mt-4 rounded-md border p-2 text-xs">
                    <summary className="cursor-pointer font-mono">
                      Raw Response Data (Debug)
                    </summary>
                    <pre className="mt-2 max-h-[200px] overflow-auto p-2 text-[10px]">
                      {JSON.stringify(aiResponse, null, 2)}
                    </pre>
                  </details>
                )} */}
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
            e.preventDefault(); // Prevent default form submission
            form.handleSubmit(onSubmit)(e);
          }}
          className="w-full"
        >
          <div className="transition-all duration-300 ease-in-out">
            {renderCurrentStep()}
          </div>

          <div className="mt-8 flex justify-between border-t pt-4">
            {currentStep === 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={(e) => {
                  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                  e.stopPropagation();
                  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                  onCancel && onCancel();
                }}
              >
                Cancel
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  prevStep();
                }}
                disabled={isGeneratingPrompt}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}

            {currentStep < steps.length - 1 ? (
              <Button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  nextStep();
                }}
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
                onClick={(e) => {
                  e.stopPropagation();
                }}
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
