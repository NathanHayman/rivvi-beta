"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Calendar,
  ChevronRight,
  Info,
  Loader2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Switch as UISwitch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import { addDays, format } from "date-fns";

// Define the form schema for creating a run
const runFormSchema = z.object({
  name: z.string().min(1, "Run name is required"),
  customPrompt: z.string().optional(),
  file: z.instanceof(File).optional(),
  scheduleForLater: z.boolean().default(false),
  scheduledDate: z.date().optional().nullable(),
  scheduledTime: z.string().optional(),
});

type RunFormValues = z.infer<typeof runFormSchema>;

interface RunCreateFormProps {
  campaignId: string;
  onSuccess?: (runId?: string) => void;
  onCancel?: () => void;
  defaultValues?: Partial<RunFormValues>;
}

export function RunCreateForm({
  campaignId,
  onSuccess,
  onCancel,
  defaultValues,
}: RunCreateFormProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [processedData, setProcessedData] = useState<any>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDates, setCalendarDates] = useState<Date[]>([]);

  // Initialize the form with default values
  const form = useForm<RunFormValues>({
    resolver: zodResolver(runFormSchema),
    defaultValues: {
      name: defaultValues?.name || "",
      customPrompt: defaultValues?.customPrompt || "",
      scheduleForLater: defaultValues?.scheduleForLater || false,
      scheduledDate: defaultValues?.scheduledDate || null,
      scheduledTime: defaultValues?.scheduledTime || "",
    },
  });

  // Watch the scheduleForLater field to conditionally show date/time fields
  const scheduleForLater = form.watch("scheduleForLater");
  const scheduledDate = form.watch("scheduledDate");

  // Generate calendar dates (next 31 days) for the date picker
  useEffect(() => {
    const dates: Date[] = [];
    const today = new Date();

    for (let i = 0; i < 31; i++) {
      dates.push(addDays(today, i));
    }

    setCalendarDates(dates);
  }, []);

  // tRPC mutations
  const createRunMutation = api.runs.create.useMutation({
    onSuccess: (data) => {
      if (data?.id && file) {
        uploadFileMutation.mutate({
          runId: data.id,
          fileContent: fileContentBase64,
          fileName: file.name,
        });
      } else {
        handleSuccess(data?.id);
      }
    },
    onError: (error) => {
      toast.error(`Error creating run: ${error.message}`);
      setIsProcessingFile(false);
    },
  });

  const validateDataMutation = api.runs.validateData.useMutation({
    onSuccess: (data) => {
      setProcessedData(data);
      setIsProcessingFile(false);
      toast.success("File validated successfully");
    },
    onError: (error) => {
      toast.error(`Error validating file: ${error.message}`);
      setIsProcessingFile(false);
    },
  });

  const uploadFileMutation = api.runs.uploadFile.useMutation({
    onSuccess: (data) => {
      toast.success(`File uploaded successfully: ${data.rowsAdded} rows added`);
      handleSuccess();
    },
    onError: (error) => {
      toast.error(`Error uploading file: ${error.message}`);
      setIsProcessingFile(false);
    },
  });

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Handle file removal
  const handleFileRemove = () => {
    setFile(null);
    setProcessedData(null);
  };

  // Store file content as base64 for API calls
  const [fileContentBase64, setFileContentBase64] = useState<string>("");

  // Process the selected file
  const processFile = useCallback(async () => {
    if (!file) {
      toast.error("Please select a file to upload");
      return false;
    }

    try {
      setIsProcessingFile(true);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        setFileContentBase64(content);

        // Validate the file data
        await validateDataMutation.mutateAsync({
          campaignId,
          fileContent: content,
          fileName: file.name,
        });
      };

      reader.onerror = () => {
        setIsProcessingFile(false);
        toast.error("Failed to read file");
      };

      reader.readAsDataURL(file);
      return true;
    } catch (error) {
      setIsProcessingFile(false);
      console.error("Error processing file:", error);
      toast.error("Failed to process file");
      return false;
    }
  }, [file, campaignId, validateDataMutation]);

  // Handle form submission
  const onSubmit = async (values: RunFormValues) => {
    try {
      setIsProcessingFile(true);

      // Process file if not already processed
      if (file && !processedData && !fileContentBase64) {
        const processed = await processFile();
        if (!processed) return;
      }

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

      // Create the run
      await createRunMutation.mutateAsync({
        campaignId,
        name: values.name,
        customPrompt: values.customPrompt || undefined,
        ...(scheduledAt ? { scheduledAt } : {}),
      });
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("Failed to create run");
      setIsProcessingFile(false);
    }
  };

  // Handle successful run creation
  const handleSuccess = (runId?: string) => {
    setIsProcessingFile(false);

    if (onSuccess) {
      onSuccess(runId);
    } else if (runId) {
      router.push(`/campaigns/${campaignId}/runs/${runId}`);
    } else {
      router.push(`/campaigns/${campaignId}`);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Create New Run</CardTitle>
            <CardDescription>
              Start a new run to make calls for this campaign.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
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

            {/* File Upload */}
            <div className="space-y-2">
              <FormLabel>Data File</FormLabel>
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
                    className="border-gray-300 hover:bg-gray-50 flex h-32 w-full cursor-pointer items-center justify-center rounded-md border border-dashed px-3 py-2 text-sm"
                  >
                    <div className="flex flex-col items-center">
                      <Upload className="text-gray-400 mb-2 h-8 w-8" />
                      <p className="font-medium">Upload Excel or CSV file</p>
                      <p className="text-xs text-muted-foreground">
                        Drag and drop or click to select
                      </p>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-md border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="rounded-md bg-primary/10 p-2">
                        <Info className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleFileRemove}
                      >
                        Remove
                      </Button>
                      {!processedData && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={processFile}
                          disabled={isProcessingFile}
                        >
                          {isProcessingFile ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Validating
                            </>
                          ) : (
                            "Validate"
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {processedData && (
                    <div className="mt-4 rounded-md bg-green-50 p-3 text-green-800">
                      <div className="flex">
                        <AlertCircle className="h-5 w-5 text-green-500" />
                        <div className="ml-3">
                          <p className="text-sm font-medium">File Validated</p>
                          <p className="mt-1 text-xs">
                            The file has been validated and is ready for upload.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <FormDescription>
                Upload an Excel or CSV file with your patient appointment data
              </FormDescription>
            </div>

            {/* Custom Prompt */}
            <FormField
              control={form.control}
              name="customPrompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign Intent (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the intent of this campaign in natural language (e.g., 'This is an urgent notice about upcoming appointments that need confirmation')"
                      className="min-h-[120px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Your natural language input will be combined with the base
                    prompt to tailor the messaging for this run
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
                      <UISwitch
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
                            <div className="relative">
                              <FormControl>
                                <Input
                                  type="text"
                                  readOnly
                                  value={
                                    field.value
                                      ? format(field.value, "PPP")
                                      : ""
                                  }
                                  placeholder="Pick a date"
                                  className="cursor-pointer"
                                  onClick={() => setShowCalendar(!showCalendar)}
                                />
                              </FormControl>
                              <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />

                              {showCalendar && (
                                <div className="absolute left-0 top-full z-10 mt-1 rounded-md border bg-white p-3 shadow-md">
                                  <div className="mb-2 flex items-center justify-between">
                                    <h4 className="text-sm font-medium">
                                      {format(new Date(), "MMMM yyyy")}
                                    </h4>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => setShowCalendar(false)}
                                    >
                                      <span className="sr-only">Close</span>×
                                    </Button>
                                  </div>

                                  <div className="grid grid-cols-7 gap-1 text-center">
                                    {[
                                      "Su",
                                      "Mo",
                                      "Tu",
                                      "We",
                                      "Th",
                                      "Fr",
                                      "Sa",
                                    ].map((day) => (
                                      <div
                                        key={day}
                                        className="text-xs font-medium"
                                      >
                                        {day}
                                      </div>
                                    ))}

                                    {calendarDates.map((date, i) => (
                                      <Button
                                        key={i}
                                        variant="ghost"
                                        size="sm"
                                        className={`h-7 w-7 p-0 ${
                                          scheduledDate &&
                                          date.getDate() ===
                                            scheduledDate.getDate() &&
                                          date.getMonth() ===
                                            scheduledDate.getMonth() &&
                                          date.getFullYear() ===
                                            scheduledDate.getFullYear()
                                            ? "bg-primary text-primary-foreground"
                                            : ""
                                        }`}
                                        onClick={() => {
                                          field.onChange(date);
                                          setShowCalendar(false);
                                        }}
                                      >
                                        {date.getDate()}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
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
                                disabled={!scheduledDate}
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
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isProcessingFile}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isProcessingFile || (!processedData && !!file)}
            >
              {isProcessingFile && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isProcessingFile ? (
                "Processing..."
              ) : (
                <>
                  Create Run <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
