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
import { api } from "@/trpc/react";
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
import { SheetFooter } from "../ui/sheet";
import { TagInput } from "../ui/tag-input";

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
    fields: ["name", "description"],
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

  // Calculate progress percentage
  const progress = (currentStepIndex / (formSteps.length - 1)) * 100;

  // Set up the form with default values
  const form = useForm<CampaignRequestFormValues>({
    resolver: zodResolver(campaignRequestSchema),
    defaultValues: {
      name: "",
      description: "",
      mainGoal: "",
      desiredAnalysis: [],
      exampleSheets: [],
    },
    mode: "onChange",
  });

  // Setup the mutation
  const requestCampaign = api.campaigns.requestCampaign.useMutation({
    onSuccess: () => {
      toast.success("Campaign request submitted");
      form.reset();
      setIsComplete(true);
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: any) => {
      toast.error("Failed to submit campaign request.");
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      // This is a placeholder for your actual file upload implementation
      // You would typically upload to S3 or another storage service
      // For now, we'll simulate a successful upload
      const fileType = file.name.split(".").pop() || "";

      // Simulate upload delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const url = `https://example.com/uploads/${file.name}`;

      // Get current example sheets
      const currentSheets = form.getValues("exampleSheets") || [];

      // Add the new file
      form.setValue("exampleSheets", [
        ...currentSheets,
        {
          name: file.name,
          url: url,
          fileType: fileType,
        },
      ]);

      toast.success(`File ${file.name} uploaded successfully`);
    } catch (error) {
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle removing a file
  const handleRemoveFile = (index: number) => {
    const currentSheets = form.getValues("exampleSheets") || [];
    const updatedSheets = currentSheets.filter((_, i) => i !== index);
    form.setValue("exampleSheets", updatedSheets);
  };

  // Handle form submission
  const onSubmit = async (values: CampaignRequestFormValues) => {
    setIsSubmitting(true);
    requestCampaign.mutate(values);
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

    // Validate current step fields
    const isValid = await form.trigger(fields as any);

    if (isValid) {
      if (currentStepIndex === formSteps.length - 1) {
        await form.handleSubmit(onSubmit)();
      } else {
        setCurrentStepIndex((prev) => prev + 1);
      }
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
          Your campaign request has been submitted successfully. The Rivvi team
          will review your request and create the campaign for your
          organization.
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            form.reset();
            setIsComplete(false);
            setCurrentStepIndex(0);
            if (onOpenChange) {
              onOpenChange(false);
            }
          }}
        >
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Progress indicator */}
      <div className="px-6 pt-6">
        <CampaignRequestStepHelper
          progress={progress}
          formSteps={formSteps}
          currentStep={currentStep}
          currentStepIndex={currentStepIndex}
        />
        {/* <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">
            Step {currentStepIndex + 1} of {formSteps.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {currentStep.title}
          </span>
        </div>
        <Progress value={progress} className="h-2" /> */}
      </div>

      <Form {...form}>
        <form
          className="flex flex-1 flex-col"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <ScrollArea className="flex-1 px-6 py-4">
            {/* Step content */}
            <div className="space-y-6 px-2">
              {/* Step 1: Basics */}
              {currentStep.id === "basics" && (
                <>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="">Campaign Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Annual Wellness Visit Reminders"
                            {...field}
                            className="h-10"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Give your campaign a clear, descriptive name
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator className="my-4" />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className=" ">
                          Campaign Description
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the purpose of the campaign, your specific requirements, and any special instructions..."
                            className="min-h-[120px] resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Provide detailed information about your campaign
                          goals, target audience, and specific requirements
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Step 2: Goals */}
              {currentStep.id === "goals" && (
                <>
                  <FormField
                    control={form.control}
                    name="mainGoal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="">Main Goal</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="What is the primary objective of this campaign? What outcomes are you hoping to achieve?"
                            className="min-h-[120px] resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Clearly define what success looks like for this
                          campaign
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator className="my-4" />

                  <FormField
                    control={form.control}
                    name="desiredAnalysis"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="">
                          Desired Analysis/KPIs
                        </FormLabel>
                        <FormControl>
                          <TagInput
                            initialTags={field.value || []}
                            onTagsChange={(tags) => field.onChange(tags)}
                            placeholder="Type KPI and press Enter (e.g., conversion rate, call duration)..."
                            unique={true}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          What metrics or KPIs would you like to track for this
                          campaign?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Step 3: Data */}
              {currentStep.id === "data" && (
                <FormField
                  control={form.control}
                  name="exampleSheets"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="">Example Data Sheets</FormLabel>
                      <div className="space-y-3">
                        {(field.value || []).length > 0 && (
                          <div className="rounded-md border border-border bg-background p-2">
                            <div className="flex flex-col gap-2">
                              {(field.value || []).map((file, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between rounded-md bg-muted/40 p-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <div className="text-sm font-medium">
                                      {file.name}
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {file.fileType}
                                    </Badge>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveFile(index)}
                                    className="h-7 w-7 p-0"
                                  >
                                    <X className="h-4 w-4" />
                                    <span className="sr-only">Remove</span>
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-center rounded-md border border-dashed border-border p-4">
                          <div className="flex flex-col items-center gap-2">
                            {isUploading ? (
                              <>
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                  Uploading file...
                                </p>
                              </>
                            ) : (
                              <>
                                <Upload className="h-6 w-6 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                  Upload example data sheets
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  (CSV, Excel, etc.)
                                </p>
                                <input
                                  type="file"
                                  className="hidden"
                                  id="file-upload"
                                  accept=".csv,.xlsx,.xls"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleFileUpload(file);
                                    }
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="mt-1"
                                  asChild
                                >
                                  <label htmlFor="file-upload">
                                    Select File
                                  </label>
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <FormDescription className="text-xs">
                        Upload example data sheets to help us understand your
                        data structure
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Step 4: Review */}
              {currentStep.id === "review" && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="">Campaign Basics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 p-4 pt-0">
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
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="">Campaign Goals</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 p-4 pt-0">
                      <div>
                        <h4 className="text-sm font-medium">Main Goal</h4>
                        <p className="text-sm text-muted-foreground">
                          {form.getValues("mainGoal")}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">
                          Desired Analysis/KPIs
                        </h4>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {form
                            .getValues("desiredAnalysis")
                            ?.map((kpi, index) => (
                              <Badge
                                key={index}
                                variant="secondary"
                                className="text-xs"
                              >
                                {kpi}
                              </Badge>
                            )) || (
                            <p className="text-sm text-muted-foreground">
                              No KPIs specified
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="">Example Data</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div>
                        <h4 className="text-sm font-medium">Uploaded Files</h4>
                        {form.getValues("exampleSheets")?.length ? (
                          <ul className="mt-2 space-y-1">
                            {form
                              .getValues("exampleSheets")
                              ?.map((file, index) => (
                                <li
                                  key={index}
                                  className="flex items-center gap-2 text-sm text-muted-foreground"
                                >
                                  <FileText className="h-3 w-3" />
                                  {file.name}
                                  <Badge variant="outline" className="text-xs">
                                    {file.fileType}
                                  </Badge>
                                </li>
                              ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No files uploaded
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border bg-accent/40 shadow-none">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="">What happens next?</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                      <p>
                        After submitting, the Rivvi team will review your
                        request and create the campaign for your organization.
                      </p>
                      <p className="mt-2">
                        You will be notified when your campaign is ready to use.
                        Look out for an email from{" "}
                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                          hello@rivvi.ai
                        </code>
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Navigation buttons */}
          <SheetFooter className="flex w-full items-center justify-between border-t p-4">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStepIndex === 0}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              onClick={handleNext}
              disabled={!isCurrentStepValid() || isSubmitting}
            >
              {currentStepIndex === formSteps.length - 1 ? (
                isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )
              ) : (
                <>
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </SheetFooter>
        </form>
      </Form>
    </div>
  );
}

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
    <div className="relative flex w-full flex-col gap-4 overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-col gap-1.5">
        <p className="text-base font-medium">
          {currentStepIndex + 1}) {currentStep.title}
        </p>
        <p className="text-sm text-muted-foreground">
          {currentStep.description}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Progress value={progress} className="h-2 bg-primary/20" />
        <div className="flex items-center justify-end">
          <p className="text-xs text-muted-foreground">
            {currentStepIndex + 1} / {formSteps.length}
          </p>
        </div>
      </div>
    </div>
  );
};
