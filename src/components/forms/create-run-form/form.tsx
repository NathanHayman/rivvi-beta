"use client";

import type React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
import { ModalFooter } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { useUploadFile } from "@/hooks/runs/use-files";
import { useCreateRun } from "@/hooks/runs/use-runs";
import { cn } from "@/lib/utils";
import { validateData } from "@/server/actions/runs";
import { ZCampaignTemplate } from "@/types/zod";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { format } from "date-fns";
import IterateAgentStep, { StreamedMetadata } from "./iterate-agent-step";
import UploadFileStep from "./upload-file-step";

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
  campaignConfig?: ZCampaignTemplate["variablesConfig"];
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
  const [streamedMetadata, setStreamedMetadata] = useState<StreamedMetadata>(
    {},
  );
  const [isStreamingComplete, setIsStreamingComplete] =
    useState<boolean>(false);
  const [currentTask, setCurrentTask] = useState<string>("");
  const [isExpanded, setIsExpanded] = useState(false);

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

  // Effect to sync AI response with our state
  useEffect(() => {
    if (aiResponse) {
      setStreamedMetadata(aiResponse);
    }
  }, [aiResponse]);

  // Effect to track AI generation status with more detailed messages
  useEffect(() => {
    if (isAIGenerating) {
      setIsGeneratingPrompt(true);
      setIsStreamingComplete(false);

      // Update current task based on what data we've received in a more detailed way
      if (aiResponse?.diffData?.promptDiff) {
        setCurrentTask("Creating visualization of changes...");
      } else if (aiResponse?.comparison?.performancePrediction) {
        setCurrentTask("Analyzing performance impact...");
      } else if (aiResponse?.comparison?.keyPhrases) {
        setCurrentTask("Identifying key phrase changes...");
      } else if (aiResponse?.comparison?.structuralChanges) {
        setCurrentTask("Analyzing structural changes...");
      } else if (aiResponse?.metadata?.sentimentShift) {
        setCurrentTask("Analyzing sentiment changes...");
      } else if (aiResponse?.metadata?.complexityScore) {
        setCurrentTask("Calculating complexity scores...");
      } else if (aiResponse?.metadata?.formalityLevel) {
        setCurrentTask("Measuring formality changes...");
      } else if (aiResponse?.metadata?.changeIntent) {
        setCurrentTask("Determining change intent...");
      } else if (aiResponse?.metadata?.categories?.length) {
        setCurrentTask("Processing prompt categories...");
      } else if (aiResponse?.metadata?.tags?.length) {
        setCurrentTask("Generating tags...");
      } else if (aiResponse?.suggestedRunName) {
        setCurrentTask("Creating run name...");
      } else if (aiResponse?.summary) {
        setCurrentTask("Generating summary...");
      } else if (aiResponse?.newPrompt) {
        setCurrentTask("Enhancing prompt...");
      } else {
        setCurrentTask("Analyzing your request...");
      }
    } else if (aiResponse) {
      setIsGeneratingPrompt(false);
      setIsStreamingComplete(true);
      setCurrentTask("Prompt generation complete");
    }
  }, [isAIGenerating, aiResponse]);

  // Add transition effect when moving to/from the AI generation step
  useEffect(() => {
    if (currentStep === 1) {
      // Small delay before expanding to allow for smooth transition
      const timer = setTimeout(() => {
        setIsExpanded(true);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setIsExpanded(false);
    }
  }, [currentStep]);

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

  const generateNaturalLanguage = async () => {
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
      variablesConfig: ZCampaignTemplate["variablesConfig"];
    }) => {
      return validateData(data);
    },
    onSuccess: (data: any) => {
      console.log("File validation successful - raw response:", data);

      // Ensure the data is in the correct format and log it for debugging
      // Handle both data and data.data structures (server might nest response)
      const responseData = data.data || data;

      const formattedData = {
        ...responseData,
        parsedData: responseData.parsedData
          ? {
              rows: Array.isArray(responseData.parsedData.rows)
                ? responseData.parsedData.rows.map((row) => ({
                    // Each row from validation needs to be in the expected format for uploadFile
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
        // Ensure these properties are properly extracted from response
        matchedColumns: responseData.matchedColumns || [],
        columnMappings: responseData.columnMappings || {},
      };

      // Detailed logging to help diagnose issues
      console.log("Structured processed file data:", {
        totalRows: formattedData.stats?.totalRows || 0,
        validCount: formattedData.stats?.validRows || 0,
        invalidCount: formattedData.stats?.invalidRows || 0,
        hasRows: !!formattedData.parsedData?.rows,
        rowCount: formattedData.parsedData?.rows?.length || 0,
        matchedColumnsCount: (formattedData.matchedColumns || []).length,
        firstRowSample: formattedData.parsedData?.rows?.[0]
          ? JSON.stringify(formattedData.parsedData.rows[0]).substring(0, 100) +
            "..."
          : "No rows",
        parsedDataComplete: formattedData.parsedData
          ? JSON.stringify(formattedData.parsedData).substring(0, 200) + "..."
          : "No parsedData",
        statsComplete: formattedData.stats
          ? JSON.stringify(formattedData.stats)
          : "No stats",
        fullData: JSON.stringify(data).substring(0, 500) + "...",
        errorsReported: responseData.errors || [],
      });

      // Store the processed data for use during the actual upload
      setProcessedFile(formattedData);
      setIsValidating(false);

      // More robust check for valid rows - check stats, parsedData.rows, and consider data.success
      const statsHasValidRows = formattedData.stats?.validRows > 0;
      const parsedDataHasRows = formattedData.parsedData?.rows?.length > 0;
      const dataHasTotalRows = formattedData.stats?.totalRows > 0;
      const isSuccessResponse =
        data.success !== false && responseData.success !== false;

      // Check if we have matched columns - this is critical for the process to work
      const matchedColumns = formattedData.matchedColumns || [];
      const hasMatchedColumns =
        Array.isArray(matchedColumns) && matchedColumns.length > 0;

      console.log("Row validation checks:", {
        statsHasValidRows,
        parsedDataHasRows,
        dataHasTotalRows,
        isSuccessResponse,
        hasMatchedColumns,
        matchedColumns: matchedColumns?.length || 0,
      });

      // Proceed if ANY of these conditions is true:
      // 1. We have valid rows in stats
      // 2. We have rows in the parsedData
      // 3. We have total rows in stats AND a success response
      // 4. We have matched columns and a success response
      const hasProcessableData =
        statsHasValidRows ||
        parsedDataHasRows ||
        (dataHasTotalRows && isSuccessResponse) ||
        (hasMatchedColumns && isSuccessResponse);

      if (hasProcessableData) {
        const validCount =
          formattedData.stats?.validRows ||
          formattedData.parsedData?.rows?.length ||
          formattedData.stats?.totalRows ||
          0;
        toast.success(
          `File validated successfully: ${validCount} ${validCount === 1 ? "row" : "rows"} found`,
        );
        nextStep();
      } else {
        // More descriptive error message based on the actual issue
        let errorMsg =
          "No valid rows found in the file. Please check your file format.";

        if (!hasMatchedColumns && formattedData.stats?.totalRows > 0) {
          errorMsg =
            "Your file has data but no matching columns were found. Please ensure your column headers match the expected format.";
        } else if (formattedData.stats?.totalRows === 0) {
          errorMsg =
            "No rows found in the file. Please check that your file contains data.";
        } else if (formattedData.stats?.invalidRows > 0) {
          errorMsg = `All ${formattedData.stats.invalidRows} rows were invalid. Please check the file format.`;
        }

        // Include any reported errors
        if (data.errors?.length > 0) {
          errorMsg += ` Server reported: ${data.errors[0]}`;
        }

        toast.error(errorMsg);
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
          // 10MB limit
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

            // Convert to a consistent structure if needed - ensure it matches the expected type
            const safeConfig = campaignConfig
              ? {
                  patient: {
                    fields: (campaignConfig.patient?.fields || []).map(
                      (field) => {
                        // Create a safe copy of the field without assuming properties
                        const safeField = { ...field };

                        // Explicitly set undefined for referencedTable if not present
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
                        // Create a safe copy of the field without assuming properties
                        const safeField = { ...field };

                        // Explicitly set undefined for referencedTable if not present
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

            // Log the sanitized config to aid debugging column matching
            console.log(
              "Sanitized processConfig:",
              JSON.stringify(safeConfig, null, 2),
            );

            // For consistent logging, we'll create this structure for the logs
            const patientFields = safeConfig.patient?.fields || [];
            const campaignFields = safeConfig.campaign?.fields || [];

            // Log the possible columns for matching
            const allPossibleColumns = [
              ...patientFields.flatMap((f: any) => f.possibleColumns || []),
              ...campaignFields.flatMap((f: any) => f.possibleColumns || []),
            ].map((col) => col.toLowerCase());

            console.log(
              "All possible columns from config:",
              allPossibleColumns,
            );

            // Log allowed field keys for clarity
            console.log("Allowed field keys:", [
              ...patientFields.map((f: any) => f.key),
              ...campaignFields.map((f: any) => f.key),
            ]);

            await validateDataMutation.mutateAsync({
              fileContent: content,
              fileName: selectedFile.name,
              variablesConfig: safeConfig,
            });
          } catch (error) {
            console.error("Error processing file:", error);
            if (
              error instanceof Error &&
              error.message.includes("referencedTable")
            ) {
              toast.error(
                "File upload failed due to configuration error. Please contact support.",
              );
            } else {
              toast.error(
                "Failed to process file. Please try again or contact support.",
              );
            }
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
      const runPayload = {
        campaignId,
        name: values.name,
        customPrompt: values.customPrompt || campaignBasePrompt,
        customVoicemailMessage:
          values.customVoicemailMessage || campaignVoicemailMessage,
        aiGenerated: values.aiGenerated,
        variationNotes: values.variationNotes,
        scheduledAt,
        metadata: streamedMetadata?.metadata,
        comparison: streamedMetadata?.comparison,
        diffData: streamedMetadata?.diffData,
        summary: streamedMetadata?.summary,
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

          // Ensure the processed data includes the proper structure and transformations
          interface ProcessedDataType {
            headers?: string[];
            rows?: any[];
          }

          const uploadData: {
            runId: string;
            fileContent: string;
            fileName: string;
            processedData?: ProcessedDataType;
          } = {
            runId: createRunResult.id,
            fileContent,
            fileName: file.name,
            processedData: processedFile?.parsedData
              ? {
                  headers: processedFile.parsedData.headers || [],
                  rows: Array.isArray(processedFile.parsedData.rows)
                    ? processedFile.parsedData.rows.map((row) => {
                        // Ensure variables structure is maintained during upload
                        const rowData = { ...row };

                        // If row already has a variables property, use it directly
                        if (
                          rowData.variables &&
                          typeof rowData.variables === "object"
                        ) {
                          return {
                            patientId: rowData.patientId || null,
                            patientHash: rowData.patientHash || null,
                            variables: rowData.variables,
                          };
                        }

                        // Otherwise, extract all properties except patientId as variables
                        const { patientId, patientHash, ...variables } =
                          rowData;
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

          console.log("Uploading file with processed data:", {
            runId: uploadData.runId,
            fileName: uploadData.fileName,
            hasProcessedData: !!uploadData.processedData,
            rowCount: uploadData.processedData?.rows?.length || 0,
          });

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
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
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
        if (form.getValues("aiGenerated")) {
          const naturalLanguageInput = form.getValues("naturalLanguageInput");
          const customPrompt = form.getValues("customPrompt");
          const customVoicemailMessage = form.getValues(
            "customVoicemailMessage",
          );
          const promptVersion = form.getValues("promptVersion");
          const aiGenerated = form.getValues("aiGenerated");
          const variationNotes = form.getValues("variationNotes");
          return (
            !!naturalLanguageInput ||
            !!customPrompt ||
            !!customVoicemailMessage ||
            !!promptVersion ||
            !!aiGenerated ||
            !!variationNotes
          );
        }
        return true;

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

  // Render the content for the current step
  const renderStepContent = () => {
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
            className={`w-full transition-all duration-300 ${isExpanded ? "md:grid md:grid-cols-2 md:gap-6" : ""}`}
          >
            <div className="flex flex-col">
              <IterateAgentStep
                form={form}
                setIsGeneratingPrompt={setIsGeneratingPrompt}
                setIsStreamingComplete={setIsStreamingComplete}
                setCurrentTask={setCurrentTask}
                setStreamedMetadata={setStreamedMetadata}
                initialPrompt={campaignBasePrompt}
                initialVoicemail={campaignVoicemailMessage}
                generateNaturalLanguage={generateNaturalLanguage}
                prevStep={prevStep}
                nextStep={nextStep}
                canProceedFromCurrentStep={canProceedFromCurrentStep}
                isGeneratingPrompt={isGeneratingPrompt}
                isStreamingComplete={isStreamingComplete}
                currentTask={currentTask}
                streamedMetadata={streamedMetadata}
              />
            </div>

            {isExpanded && (isGeneratingPrompt || isStreamingComplete) && (
              <div className="bg-gray-50 mt-6 max-h-[400px] overflow-auto rounded-md border p-4 duration-500 animate-in slide-in-from-right-10 md:mt-0">
                <h3 className="text-md mb-3 font-medium">
                  AI Generation Results
                </h3>
                <div className="space-y-4">
                  {isGeneratingPrompt && (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <p className="text-sm">
                        {currentTask || "Generating..."}
                      </p>
                    </div>
                  )}

                  {streamedMetadata?.summary && (
                    <div className="border-l-2 border-primary pl-3 duration-300 animate-in fade-in slide-in-from-bottom-5">
                      <h4 className="text-sm font-medium">Summary</h4>
                      <p className="text-sm text-muted-foreground">
                        {streamedMetadata.summary}
                      </p>
                    </div>
                  )}

                  {streamedMetadata?.newPrompt && (
                    <div className="border-l-2 border-primary pl-3 duration-300 animate-in fade-in slide-in-from-bottom-5">
                      <h4 className="text-sm font-medium">Enhanced Prompt</h4>
                      <div className="mt-2 whitespace-pre-wrap rounded-md bg-white p-3 text-sm">
                        {streamedMetadata.newPrompt}
                      </div>
                    </div>
                  )}

                  {streamedMetadata?.metadata?.keyChanges &&
                    streamedMetadata.metadata.keyChanges.length > 0 && (
                      <div className="border-l-2 border-primary pl-3 duration-300 animate-in fade-in slide-in-from-bottom-5">
                        <h4 className="text-sm font-medium">Key Changes</h4>
                        <ul className="mt-1 list-disc pl-5 text-sm">
                          {streamedMetadata.metadata.keyChanges.map(
                            (change, i) => (
                              <li key={i}>{change}</li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-base font-medium">Run Name</h3>
              <p className="text-sm text-muted-foreground">
                Give your run a descriptive name for easier identification
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
              <div className="bg-gray-50 rounded-md border p-4">
                <h3 className="mb-2 text-sm font-medium">Run Summary</h3>
                <div className="space-y-2">
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
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="mx-auto w-full">
      <div className="mb-6 w-full">
        <div className="w-full">
          <div className="flex w-full items-center justify-between">
            {steps.map((step, index) => (
              <div key={index} className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border text-sm font-medium",
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
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span className="text-gray-500 mt-2 text-xs font-medium">
                  {step}
                </span>
              </div>
            ))}
          </div>
          <div className="relative mt-3">
            <div className="bg-gray-200 absolute left-0 top-1/2 h-1 w-full -translate-y-1/2"></div>
            <div
              className="absolute left-0 top-1/2 h-1 -translate-y-1/2 bg-primary transition-all duration-300"
              style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={(e) => {
            form.handleSubmit(onSubmit)(e);
          }}
          className={`mb-24 w-full transition-all duration-300 ${isExpanded ? "pb-6" : "pb-4"}`}
        >
          <div
            className={`transition-all duration-300 ${currentStep === 1 && isGeneratingPrompt ? "pb-6" : "pb-2"}`}
          >
            {renderStepContent()}
          </div>

          <ModalFooter className="absolute bottom-0 left-0 right-0 mt-2 flex justify-between border-t pt-4">
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
                    Next <ChevronRight className="ml-2 h-4 w-4" />
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
                    Create Run <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </ModalFooter>
        </form>
      </Form>
    </div>
  );
}
