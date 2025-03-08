"use client";

import type React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowUpIcon, Check, ChevronRight, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { TGenerateAgentPrompt } from "@/services/out/ai";
import { format } from "date-fns";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";

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
  onFormSuccess,
}: RunCreateFormProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processedData, setProcessedData] = useState<any>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileContentBase64, setFileContentBase64] = useState<string>("");

  // Step management
  const [currentStep, setCurrentStep] = useState(0);
  const steps = ["Upload & Validate", "Configure Prompt", "Schedule & Name"];

  // AI-related states
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  // Initialize the form with default values
  const form = useForm<RunFormValues>({
    resolver: zodResolver(runFormSchema),
    defaultValues: {
      name: defaultValues?.name || "",
      customPrompt: defaultValues?.customPrompt || "",
      naturalLanguageInput: "", // Initialize empty
      scheduleForLater: defaultValues?.scheduleForLater || false,
      scheduledDate: defaultValues?.scheduledDate || null,
      scheduledTime: defaultValues?.scheduledTime || "",
      aiGenerated: defaultValues?.aiGenerated || false,
      promptVersion: defaultValues?.promptVersion || 1,
      customVoicemailMessage: defaultValues?.customVoicemailMessage || "",
      variationNotes: defaultValues?.variationNotes || "",
    },
    mode: "onChange",
  });

  // Watch form fields for conditional rendering and validation
  const scheduleForLater = form.watch("scheduleForLater");
  const aiGenerated = form.watch("aiGenerated");
  const promptVersion = form.watch("promptVersion");
  const customPrompt = form.watch("customPrompt");
  const customVoicemailMessage = form.watch("customVoicemailMessage");
  const naturalLanguageInput = form.watch("naturalLanguageInput");

  // React Query mutations
  const createRunMutation = useCreateRun(campaignId);
  const uploadFileMutation = useUploadFile();

  // File validation function
  const validateDataMutation = useMutation({
    mutationFn: async (data: { fileContent: string; fileName: string }) => {
      // Call the validateData server action
      return validateData(data);
    },
    onSuccess: (data: any) => {
      setProcessedData(data);
      setIsProcessingFile(false);

      // If we have data, proceed to the next step
      if (data && (data.totalRows > 0 || data.parsedData?.rows?.length > 0)) {
        nextStep();
      }
    },
    onError: (error) => {
      toast.error(
        `Error validating file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setIsProcessingFile(false);
    },
  });

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);

      // Auto-process the file when selected
      processSelectedFile(selectedFile);
    }
  };

  // Process the selected file
  const processSelectedFile = useCallback(
    async (selectedFile: File) => {
      try {
        setIsProcessingFile(true);

        const reader = new FileReader();
        reader.onload = async (e) => {
          const content = e.target?.result as string;
          setFileContentBase64(content);

          // Validate the file data
          await validateDataMutation.mutateAsync({
            fileContent: content,
            fileName: selectedFile.name,
          });
        };

        reader.onerror = () => {
          setIsProcessingFile(false);
          toast.error("Failed to read file");
        };

        reader.readAsDataURL(selectedFile);
      } catch (error) {
        setIsProcessingFile(false);
        console.error("Error processing file:", error);
        toast.error("Failed to process file");
      }
    },
    [validateDataMutation],
  );

  // Handle file removal
  const handleFileRemove = () => {
    setFile(null);
    setProcessedData(null);
    setFileContentBase64("");
  };

  // Function to generate prompt using AI
  const generateAIPrompt = useCallback(
    async (userInput: string) => {
      if (!userInput || isGeneratingPrompt) return;

      setIsGeneratingPrompt(true);

      try {
        // Call the API route
        const response = await fetch("/api/ai/agent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            basePrompt: campaignBasePrompt,
            baseVoicemailMessage: campaignVoicemailMessage,
            naturalLanguageInput: userInput, // Use the user's input
            campaignContext: {
              name: campaignName,
              description: campaignDescription,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to generate content");
        }

        // Parse the response
        const generatedAgent = (await response.json()) as TGenerateAgentPrompt;

        await updatePromptAndVoicemail({
          runId: "",
          userId: "",
          campaignId,
          summary: generatedAgent.summary,
          naturalLanguageInput: userInput,
          suggestedRunName: generatedAgent.suggestedRunName,
          generatedPrompt: generatedAgent.newPrompt,
          generatedVoicemail: generatedAgent.newVoicemailMessage,
        });

        // Update the custom prompt with the generated content
        form.setValue("customPrompt", generatedAgent.newPrompt);
        form.setValue(
          "customVoicemailMessage",
          generatedAgent.newVoicemailMessage,
        );
        form.setValue("aiGenerated", true);
        form.setValue("variationNotes", generatedAgent.summary);

        // If run name isn't manually set yet, suggest the AI-generated name
        if (!form.getValues("name")) {
          form.setValue("name", generatedAgent.suggestedRunName);
        }

        toast.success("Prompt generated successfully!");
      } catch (error) {
        console.error("Error generating AI prompt:", error);
        toast.error(
          "Failed to generate prompt. Please try again or enter manually.",
        );
      } finally {
        setIsGeneratingPrompt(false);
      }
    },
    [
      campaignBasePrompt,
      campaignDescription,
      campaignName,
      campaignVoicemailMessage,
      form,
      isGeneratingPrompt,
    ],
  );

  // Handle form submission
  const onSubmit = async (values: RunFormValues) => {
    if (isSubmitting) return; // Prevent duplicate submissions
    setIsSubmitting(true);
    try {
      setIsProcessingFile(true);

      // Prepare scheduled date/time if applicable
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

      // Create the run using the server action via the hook
      const result = await createRunMutation.mutateAsync({
        name: values.name,
        customPrompt: values.customPrompt || undefined,
        customVoicemailMessage: values.customVoicemailMessage || undefined,
        variationNotes: values.variationNotes || undefined,
        naturalLanguageInput: values.naturalLanguageInput || undefined,
        promptVersion: values.promptVersion || undefined,
        aiGenerated: values.aiGenerated || undefined,
        ...(scheduledAt ? { scheduledAt } : {}),
      });

      if (result?.id && file) {
        // Upload the file using the server action
        await uploadFileMutation.mutateAsync({
          runId: result.id,
          fileContent: fileContentBase64,
          fileName: file.name,
        });
      }

      // Handle success
      handleSuccess(result?.id);
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("Failed to create run");
      setIsSubmitting(false);
      setIsProcessingFile(false);
    }
  };

  // Handle successful run creation
  const handleSuccess = (runId?: string) => {
    setIsProcessingFile(false);
    setIsSubmitting(false);
    if (onSuccess) {
      onSuccess(runId);
    } else if (runId) {
      router.push(`/campaigns/${campaignId}/runs/${runId}`);
    } else {
      router.push(`/campaigns/${campaignId}`);
    }
  };

  // Navigation between steps
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

  // Check if current step can proceed
  const canProceedFromCurrentStep = () => {
    switch (currentStep) {
      case 0: // Upload & Validate
        // Make sure we have processed data with rows
        return (
          !!processedData &&
          (processedData.totalRows > 0 ||
            processedData.parsedData?.rows?.length > 0)
        );

      case 1: // Configure Prompt
        // For AI generation, require either a description or already-generated prompt
        if (aiGenerated) {
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
        // For manual prompt, allow proceeding even with empty prompt (will use campaign default)
        return true;

      case 2: // Schedule & Name
        // Require name; if scheduling, also require date and time
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

  return (
    <div className="mx-auto max-w-[600px] p-4">
      <div className="mb-6">
        {/* Step indicator */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={index} className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium",
                    currentStep === index
                      ? "border-primary bg-primary text-primary-foreground"
                      : currentStep > index
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-gray-200 bg-gray-50 text-gray-500",
                  )}
                >
                  {currentStep > index ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span className="text-gray-500 mt-1 text-xs font-medium">
                  {step}
                </span>
              </div>
            ))}
          </div>
          <div className="relative mt-2">
            <div className="bg-gray-200 absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2"></div>
            <div
              className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-primary transition-all duration-300"
              style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Step 1: Upload & Validate */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <h3 className="mb-2 text-base font-medium">Data File</h3>
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
                      className="border-gray-300 hover:bg-gray-50 flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-3 py-2 text-sm"
                    >
                      <ArrowUpIcon className="text-gray-400 mb-2 h-8 w-8" />
                      <p className="font-medium">Upload Excel or CSV file</p>
                      <p className="text-xs text-muted-foreground">
                        Drag and drop or click to select
                      </p>
                    </label>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-md border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleFileRemove}
                      >
                        <X className="mr-1 h-4 w-4" /> Remove
                      </Button>
                    </div>

                    {isProcessingFile && (
                      <div className="mt-4 flex items-center space-x-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Validating file...</span>
                      </div>
                    )}

                    {processedData && (
                      <div className="mt-4 rounded-md bg-green-50 p-3 text-green-800">
                        <div className="flex">
                          <Check className="h-5 w-5 text-green-500" />
                          <div className="ml-3">
                            <p className="text-sm font-medium">
                              File Validated
                            </p>
                            <p className="mt-1 text-xs">
                              The file has been validated and is ready for
                              upload.{" "}
                              {processedData.totalRows ||
                                processedData.parsedData?.rows?.length}{" "}
                              rows found.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Upload an Excel or CSV file with your patient appointment data
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Configure Prompt */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* AI Prompt Generation Toggle */}
              <FormField
                control={form.control}
                name="aiGenerated"
                render={({ field }) => (
                  <FormItem className="rounded-md border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <FormLabel className="text-base">
                          Use AI Prompt Generation
                        </FormLabel>
                        <FormDescription>
                          Let AI enhance the prompt based on your description
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />

              {/* AI Description Input - Only shown when useAiGeneration is true */}
              {aiGenerated && (
                <FormField
                  control={form.control}
                  name="naturalLanguageInput"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Describe what you want the AI to do</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="E.g., Make the prompt more friendly and add reminders about appointment details"
                          className="min-h-[80px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Describe how you want to customize the prompt
                      </FormDescription>
                      <FormMessage />
                      <Button
                        type="button"
                        className="mt-2"
                        onClick={() => generateAIPrompt(field.value)}
                        disabled={isGeneratingPrompt || !field.value}
                      >
                        {isGeneratingPrompt ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          "Generate Prompt"
                        )}
                      </Button>
                    </FormItem>
                  )}
                />
              )}

              <div className="hidden space-y-2">
                {form.getValues("variationNotes") ? (
                  <div className="rounded-md bg-muted p-4">
                    <h4 className="mb-2 font-medium">Changes Made to Prompt</h4>
                    <p className="text-sm">
                      {form.getValues("variationNotes")}
                    </p>

                    {form.getValues("naturalLanguageInput") && (
                      <div className="mt-3 border-t pt-3">
                        <h5 className="text-sm font-medium">
                          Requested Changes:
                        </h5>
                        <p className="text-sm text-muted-foreground">
                          "{form.getValues("naturalLanguageInput")}"
                        </p>
                      </div>
                    )}

                    {/* Collapsible section for the full prompt */}
                    <Collapsible className="mt-3">
                      <CollapsibleTrigger className="text-xs text-blue-500 hover:underline">
                        Show full prompt
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 max-h-80 overflow-auto rounded-md bg-slate-100 p-3 font-mono text-xs">
                          {form.getValues("customPrompt")}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {form.getValues("customPrompt")
                      ? "Using custom prompt"
                      : "Using default campaign prompt"}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Schedule & Name */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Run Name */}
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
                    <FormDescription>
                      Give your run a descriptive name
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Schedule for Later */}
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

                    {scheduleForLater && (
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        {/* Date Picker */}
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

                        {/* Time Picker */}
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

              {/* Summary of the run */}
              {processedData && (
                <div className="bg-gray-50 rounded-md p-4">
                  <h3 className="mb-2 font-medium">Run Summary</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Rows:</span>
                      <span className="font-medium">
                        {processedData.totalRows || 0}
                      </span>
                    </div>
                    {processedData.invalidRows > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Invalid Rows:
                        </span>
                        <span className="font-medium text-amber-600">
                          {processedData.invalidRows}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Valid Calls:
                      </span>
                      <span className="font-medium text-green-600">
                        {(processedData.totalRows || 0) -
                          (processedData.invalidRows || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between pt-4">
            {currentStep === 0 ? (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={isProcessingFile || isGeneratingPrompt}
              >
                Back
              </Button>
            )}

            {currentStep < steps.length - 1 ? (
              <Button
                type="button"
                onClick={nextStep}
                disabled={
                  !canProceedFromCurrentStep() ||
                  isProcessingFile ||
                  isGeneratingPrompt
                }
              >
                {isProcessingFile || isGeneratingPrompt ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {currentStep === 0 ? "Validating..." : "Processing..."}
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
                  isProcessingFile ||
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
          </div>
        </form>
      </Form>
    </div>
  );
}
