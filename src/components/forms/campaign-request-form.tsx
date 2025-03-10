"use client";

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
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { TagInput } from "../ui/tag-input";
// Import server action
import { useRequestCampaign } from "@/hooks/campaigns/use-campaign-requests";

// Define the form schema using zod
const campaignRequestSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name cannot exceed 100 characters"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(1000, "Description cannot exceed 1000 characters"),
  direction: z.enum(["inbound", "outbound"]).default("outbound"),
  mainGoal: z
    .string()
    .min(10, "Main goal must be at least 10 characters")
    .max(1000, "Main goal cannot exceed 1000 characters"),
  desiredAnalysis: z.array(z.string()).optional(),
  exampleSheets: z
    .array(
      z.object({
        name: z.string(),
        url: z.string(),
        fileType: z.string(),
      }),
    )
    .optional(),
});

// Type for the form values
type CampaignRequestFormValues = z.infer<typeof campaignRequestSchema>;

// Props for the component
interface CampaignRequestFormProps {
  onSuccess?: () => void;
  onOpenChange?: (open: boolean) => void;
}

// Define the steps
type FormStep = {
  id: string;
  title: string;
  description: string;
  fields: (keyof CampaignRequestFormValues)[];
};

const formSteps: FormStep[] = [
  {
    id: "basics",
    title: "Campaign Basics",
    description: "Let's start with the basic information about your campaign",
    fields: ["name", "description", "direction"],
  },
  {
    id: "goals",
    title: "Campaign Goals",
    description: "Define what you want to achieve with this campaign",
    fields: ["mainGoal", "desiredAnalysis"],
  },
  {
    id: "data",
    title: "Example Data",
    description: "Upload example data to help us understand your requirements",
    fields: ["exampleSheets"],
  },
  {
    id: "review",
    title: "Review & Submit",
    description: "Review your campaign request before submitting",
    fields: [],
  },
];

export function CampaignRequestForm({
  onSuccess,
  onOpenChange,
}: CampaignRequestFormProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const { mutateAsync: submitCampaignRequest } = useRequestCampaign();

  // Calculate progress percentage
  const progress = (currentStepIndex / (formSteps.length - 1)) * 100;

  // Set up the form with default values
  const form = useForm<CampaignRequestFormValues>({
    resolver: zodResolver(campaignRequestSchema),
    defaultValues: {
      name: "",
      description: "",
      direction: "outbound",
      mainGoal: "",
      desiredAnalysis: [],
      exampleSheets: [],
    },
    mode: "onChange",
  });

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    console.log("Starting file upload for:", file.name);

    try {
      // Get file extension
      const fileType = file.name.split(".").pop() || "";

      console.log("Creating object URL for file");
      // Create a simple object URL for the file
      // This keeps the file in memory without needing external storage
      const url = URL.createObjectURL(file);
      console.log("Object URL created:", url);

      // Get current example sheets
      const currentSheets = form.getValues("exampleSheets") || [];

      console.log("Adding file to form state");
      // Add the new file
      form.setValue("exampleSheets", [
        ...currentSheets,
        {
          name: file.name,
          url: url, // This is a browser-generated URL that points to the file in memory
          fileType: fileType,
        },
      ]);

      // Force form state update
      form.trigger("exampleSheets");

      toast.success(`File ${file.name} added successfully`);
      console.log("File added successfully");
    } catch (error) {
      toast.error("Failed to add file");
      console.error("File upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle removing a file
  const handleRemoveFile = (index: number) => {
    const currentSheets = form.getValues("exampleSheets") || [];

    // Release the object URL to free memory
    try {
      const fileToRemove = currentSheets[index];
      if (fileToRemove?.url.startsWith("blob:")) {
        URL.revokeObjectURL(fileToRemove.url);
      }
    } catch (error) {
      console.error("Error releasing object URL:", error);
    }

    const updatedSheets = currentSheets.filter((_, i) => i !== index);
    form.setValue("exampleSheets", updatedSheets);
  };

  // Handle form submission
  const onSubmit = async (values: CampaignRequestFormValues) => {
    try {
      setIsSubmitting(true);

      // Submit the campaign request with all form values
      await submitCampaignRequest(values);

      toast.success("Campaign request submitted");
      form.reset();
      setIsComplete(true);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Submission error:", error);
      toast.error(
        `Failed to submit campaign request: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get current step
  const currentStep = formSteps[currentStepIndex];

  // Check if current step is valid
  const isCurrentStepValid = () => {
    if (currentStep.id === "review") return true;

    return currentStep.fields.every((field) => {
      const fieldState = form.getFieldState(field);

      // If the field has an error, it's not valid
      if (fieldState.error) return false;

      // For required fields, check if they have a value
      if (field === "name" || field === "description" || field === "mainGoal") {
        const value = form.getValues(field);
        return value && value.length > 0;
      }

      return true;
    });
  };

  // Handle next step
  const handleNext = async () => {
    const fields = currentStep.fields;

    // If this is the last step (review), just submit the form
    if (currentStepIndex === formSteps.length - 1) {
      const values = form.getValues();
      await onSubmit(values);
      return;
    }

    // Validate current step fields
    const isValid = await form.trigger(fields as any);

    if (isValid) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  // Handle previous step
  const handlePrevious = () => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  };

  // Render the completion screen
  if (isComplete) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4 p-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Request Submitted!</h2>
        <p className="text-center text-muted-foreground">
          Your campaign request has been submitted successfully. Our team will
          review it and get back to you soon.
        </p>
        <Button onClick={() => onOpenChange?.(false)}>Close</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Progress indicator */}
      <div className="px-6 pt-6">
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step helper */}
      <CampaignRequestStepHelper
        progress={progress}
        formSteps={formSteps}
        currentStep={currentStep}
        currentStepIndex={currentStepIndex}
      />

      <Form {...form}>
        <form className="flex h-full flex-col">
          <ScrollArea className="flex-1 px-6">
            <div className="space-y-6 py-6">
              {/* Step 1: Campaign Basics */}
              {currentStepIndex === 0 && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter a descriptive name for your campaign"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Choose a clear name that describes the purpose of this
                          campaign
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe what this campaign is about and its context"
                            className="min-h-32"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Provide details about the campaign's context, target
                          audience, and general purpose
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="direction"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign Direction</FormLabel>
                        <FormControl>
                          <div className="flex space-x-4">
                            <Button
                              type="button"
                              variant={
                                field.value === "outbound"
                                  ? "default"
                                  : "outline"
                              }
                              className="flex-1"
                              onClick={() => field.onChange("outbound")}
                            >
                              Outbound
                            </Button>
                            <Button
                              type="button"
                              variant={
                                field.value === "inbound"
                                  ? "default"
                                  : "outline"
                              }
                              className="flex-1"
                              onClick={() => field.onChange("inbound")}
                            >
                              Inbound
                            </Button>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Select whether this is an outbound campaign (system
                          calls patients) or inbound campaign (patients call the
                          system)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Step 2: Campaign Goals */}
              {currentStepIndex === 1 && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="mainGoal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Main Goal</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="What is the primary goal of this campaign?"
                            className="min-h-32"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Clearly state what you want to achieve with this
                          campaign (e.g., appointment scheduling, medication
                          adherence reminders, etc.)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="desiredAnalysis"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Desired Analysis</FormLabel>
                        <FormControl>
                          <TagInput
                            placeholder="Add analysis metrics and press Enter"
                            onTagsChange={(newTags) => field.onChange(newTags)}
                          />
                        </FormControl>
                        <FormDescription>
                          What metrics or insights would you like to analyze
                          from this campaign? (e.g., response rate, appointment
                          conversion)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Step 3: Example Data */}
              {currentStepIndex === 2 && (
                <div className="space-y-4">
                  <div className="rounded-md border border-dashed p-6">
                    <div className="flex flex-col items-center justify-center space-y-2 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <Upload className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-medium">
                        Upload Example Data
                      </h3>
                      <p className="max-w-md text-sm text-muted-foreground">
                        Upload example Excel or CSV files that represent the
                        data you'll use for this campaign. This helps us
                        understand your data structure.
                      </p>
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <div className="mt-2 flex items-center space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isUploading}
                          >
                            {isUploading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-4 w-4" />
                                Select File
                              </>
                            )}
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            {isUploading
                              ? "Processing..."
                              : "Supported formats: .xlsx, .xls, .csv"}
                          </span>
                        </div>
                        <input
                          id="file-upload"
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileUpload(file);
                              // Reset input so the same file can be selected again if needed
                              e.target.value = "";
                            }
                          }}
                          disabled={isUploading}
                          aria-label="Upload example data file"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Display uploaded files */}
                  {form.getValues("exampleSheets")?.length ? (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Uploaded Files</h4>
                      <div className="space-y-2">
                        {form
                          .getValues("exampleSheets")
                          ?.map((sheet, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between rounded-md border p-3"
                            >
                              <div className="flex items-center space-x-3">
                                <FileText className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">
                                    {sheet.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {sheet.fileType.toUpperCase()} File
                                  </p>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveFile(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Step 4: Review */}
              {currentStepIndex === 3 && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Campaign Basics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <h4 className="text-sm font-medium">Name</h4>
                        <p className="text-sm text-muted-foreground">
                          {form.getValues("name")}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">Description</h4>
                        <p className="text-sm text-muted-foreground">
                          {form.getValues("description")}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">Direction</h4>
                        <p className="text-sm text-muted-foreground">
                          {form.getValues("direction") === "outbound"
                            ? "Outbound (system calls patients)"
                            : "Inbound (patients call the system)"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Campaign Goals</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <h4 className="text-sm font-medium">Main Goal</h4>
                        <p className="text-sm text-muted-foreground">
                          {form.getValues("mainGoal")}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">
                          Desired Analysis
                        </h4>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {form.getValues("desiredAnalysis")?.length ? (
                            form.getValues("desiredAnalysis")?.map((tag, i) => (
                              <Badge key={i} variant="secondary">
                                {tag}
                              </Badge>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No analysis metrics specified
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Example Data</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {form.getValues("exampleSheets")?.length ? (
                        <div className="space-y-2">
                          {form
                            .getValues("exampleSheets")
                            ?.map((sheet, index) => (
                              <div
                                key={index}
                                className="flex items-center space-x-3"
                              >
                                <FileText className="h-5 w-5 text-muted-foreground" />
                                <p className="text-sm">{sheet.name}</p>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No example files uploaded
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t p-6">
            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStepIndex === 0 || isSubmitting}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                disabled={!isCurrentStepValid() || isSubmitting}
              >
                {isSubmitting && currentStepIndex === formSteps.length - 1 ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {currentStepIndex === formSteps.length - 1
                  ? "Submit Request"
                  : "Next"}
                {currentStepIndex !== formSteps.length - 1 && (
                  <ChevronRight className="ml-2 h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

// Helper component for the step indicator
const CampaignRequestStepHelper = ({
  progress,
  formSteps,
  currentStep,
  currentStepIndex,
}: {
  progress: number;
  formSteps: FormStep[];
  currentStep: FormStep;
  currentStepIndex: number;
}) => {
  return (
    <div className="px-6 pt-4">
      <h2 className="text-xl font-semibold">{currentStep.title}</h2>
      <p className="text-sm text-muted-foreground">{currentStep.description}</p>

      <div className="mt-4 flex items-center space-x-1">
        {formSteps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            {index > 0 && <Separator className="w-4" />}
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                index <= currentStepIndex
                  ? "bg-primary text-primary-foreground"
                  : "border border-input bg-background"
              }`}
            >
              {index + 1}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
