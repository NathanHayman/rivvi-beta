"use client";

// src/components/app/run/create-run-modal.tsx
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Check,
  Info,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileInput } from "@/components/ui/file-input";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { z } from "zod";

// Form schema for create run
const createRunSchema = z.object({
  name: z.string().min(1, "Name is required"),
  file: z.instanceof(File, { message: "File is required" }).optional(),
  customPrompt: z.string().optional(),
  scheduleForLater: z.boolean().default(false),
  scheduledDate: z.date().optional(),
  scheduledTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format")
    .optional(),
});

type CreateRunFormValues = z.infer<typeof createRunSchema>;

// Define types for the processed data from the API
interface ProcessedRowData {
  id: string;
  isValid: boolean;
  validationErrors?: string[];
  patientData: {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    dob?: string;
    [key: string]: any;
  };
  campaignData: {
    [key: string]: any;
  };
  originalRow: Record<string, any>;
}

interface ProcessedDataResponse {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newPatients: number;
  existingPatients: number;
  matchedColumns: string[];
  unmatchedColumns: string[];
  sampleRows: ProcessedRowData[];
  allRows: ProcessedRowData[];
}

interface CreateRunModalProps {
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRunModal({
  campaignId,
  open,
  onOpenChange,
}: CreateRunModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("details");
  const [processedData, setProcessedData] =
    useState<ProcessedDataResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // tRPC mutations
  const createRunMutation = api.runs.create.useMutation({
    onSuccess: (data) => {
      router.push(`/campaigns/${campaignId}/runs/${data?.id}`);
      onOpenChange(false);
      toast.success("Run created successfully");
      form.reset();
      setProcessedData(null);
    },
    onError: (error) => {
      toast.error(`Error creating run: ${error.message}`);
    },
  });

  const uploadFileMutation = api.runs.uploadFile.useMutation({
    onSuccess: (data) => {
      toast.success(
        `File processed successfully: ${data.rowsAdded} rows added`,
      );
      if (data.invalidRows > 0) {
        toast.warning(`${data.invalidRows} invalid rows were skipped`);
      }
    },
    onError: (error) => {
      toast.error(`Error processing file: ${error.message}`);
    },
  });

  // New mutation for data validation
  const validateDataMutation = api.runs.validateData.useMutation({
    onSuccess: (data) => {
      setProcessedData(data as ProcessedDataResponse);
      setIsProcessing(false);
      setActiveTab("review");
      toast.success(`File analyzed: ${data.validRows} valid rows found`);
    },
    onError: (error) => {
      setIsProcessing(false);
      toast.error(`Error validating data: ${error.message}`);
    },
  });

  // Form setup
  const form = useForm<CreateRunFormValues>({
    resolver: zodResolver(createRunSchema),
    defaultValues: {
      name: "",
      customPrompt: "",
      scheduleForLater: false,
    },
  });

  // Watch form values for conditional logic
  const file = form.watch("file");
  const scheduleForLater = form.watch("scheduleForLater");
  const scheduledDate = form.watch("scheduledDate");

  const isLoading =
    createRunMutation.isPending || uploadFileMutation.isPending || isProcessing;

  // Process the file to see the data before actually uploading
  const processFile = useCallback(async () => {
    if (!file) return;

    try {
      setIsProcessing(true);

      // Read the file content
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;

        // Call the validateData API
        await validateDataMutation.mutateAsync({
          campaignId,
          fileContent: content,
          fileName: file.name,
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setIsProcessing(false);
      console.error("Error processing file:", error);
      toast.error("Failed to process file");
    }
  }, [file, campaignId, validateDataMutation]);

  const handleSubmit = async (values: CreateRunFormValues) => {
    try {
      // Create run with all the necessary data
      const scheduledAt = getScheduledDateTime(values);

      const runData = {
        campaignId,
        name: values.name,
        customPrompt: values.customPrompt,
        ...(scheduledAt ? { scheduledAt } : {}),
      };

      // Create the run
      const run = await createRunMutation.mutateAsync(runData);

      // If we have processed data and a run was created successfully
      if (run && processedData && file) {
        // Upload the processed data
        const reader = new FileReader();
        reader.onload = async (e) => {
          const content = e.target?.result as string;

          await uploadFileMutation.mutateAsync({
            runId: run.id,
            fileContent: content,
            fileName: file.name,
            processedData: processedData.allRows.map((row) => ({
              id: row.id,
              isValid: row.isValid,
              patientData: row.patientData,
              campaignData: row.campaignData,
            })),
          });
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.error("Error in create run flow:", error);
      toast.error("Failed to create run");
    }
  };

  // Helper function to get scheduled date time
  const getScheduledDateTime = (values: CreateRunFormValues) => {
    if (
      values.scheduleForLater &&
      values.scheduledDate &&
      values.scheduledTime
    ) {
      const [hours, minutes] = values.scheduledTime.split(":").map(Number);
      const scheduledDateTime = new Date(values.scheduledDate);
      scheduledDateTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);
      return scheduledDateTime.toISOString();
    }
    return null;
  };

  // Handle next step
  const handleNext = () => {
    if (activeTab === "details") {
      form.trigger(["name", "file"]).then((isValid) => {
        if (isValid && file) {
          processFile();
        }
      });
    } else if (activeTab === "review") {
      setActiveTab("customize");
    } else {
      form.handleSubmit(handleSubmit)();
    }
  };

  // Handle going back
  const handleBack = () => {
    if (activeTab === "review") {
      setActiveTab("details");
    } else if (activeTab === "customize") {
      setActiveTab("review");
    }
  };

  const getNextButtonLabel = () => {
    if (isLoading) {
      if (isProcessing) return "Processing...";
      if (uploadFileMutation.isPending) return "Uploading...";
      return "Creating...";
    }

    switch (activeTab) {
      case "details":
        return "Process Data";
      case "review":
        return "Next";
      case "customize":
        return "Create Run";
      default:
        return "Next";
    }
  };

  // Render the modal content
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[500px] max-w-4xl flex-col overflow-hidden">
        <DialogHeader className="px-6 pb-2 pt-6">
          <DialogTitle>Create New Run</DialogTitle>
          <DialogDescription>
            Set up a new run for your campaign to start engaging with patients.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <div className="flex-1 overflow-y-auto px-6">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="mb-4 grid w-full grid-cols-3">
                <TabsTrigger value="details">Details & Data</TabsTrigger>
                <TabsTrigger value="review" disabled={!processedData}>
                  Review Data
                </TabsTrigger>
                <TabsTrigger value="customize" disabled={!processedData}>
                  Customize & Schedule
                </TabsTrigger>
              </TabsList>

              {/* Details & Data Tab */}
              <TabsContent value="details" className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Run Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., January Follow-ups"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Give your run a descriptive name.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="file"
                  render={({ field: { value, onChange, ...fieldProps } }) => (
                    <FormItem>
                      <FormLabel>Patient Data File</FormLabel>
                      <FormControl>
                        <FileInput
                          accept=".csv,.xlsx,.xls"
                          placeholder="Upload a CSV or Excel file"
                          value={value}
                          onChange={onChange}
                          {...fieldProps}
                        />
                      </FormControl>
                      <FormDescription>
                        Upload a file containing patient data for this run.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Review Data Tab */}
              <TabsContent value="review" className="space-y-4">
                {processedData && (
                  <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {/* Data Summary Card */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">
                            Data Summary
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Total Rows:
                            </span>
                            <span className="font-medium">
                              {processedData.totalRows}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Valid Rows:
                            </span>
                            <span className="font-medium text-green-600">
                              {processedData.validRows}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Invalid Rows:
                            </span>
                            <span className="font-medium text-red-600">
                              {processedData.invalidRows}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              New Patients:
                            </span>
                            <span className="font-medium">
                              {processedData.newPatients}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Existing Patients:
                            </span>
                            <span className="font-medium">
                              {processedData.existingPatients}
                            </span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Validation Status Card */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">
                            Validation Status
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-1.5">
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">
                                Data Quality
                              </span>
                              <span className="text-sm font-medium">
                                {processedData.validRows > 0
                                  ? Math.round(
                                      (processedData.validRows /
                                        processedData.totalRows) *
                                        100,
                                    )
                                  : 0}
                                %
                              </span>
                            </div>
                            <Progress
                              value={
                                processedData.validRows > 0
                                  ? (processedData.validRows /
                                      processedData.totalRows) *
                                    100
                                  : 0
                              }
                              className="h-2"
                            />
                          </div>

                          {processedData.invalidRows > 0 && (
                            <Alert className="mt-2 py-2" variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle className="text-sm font-medium">
                                Validation Issues Found
                              </AlertTitle>
                              <AlertDescription className="text-xs">
                                {processedData.invalidRows} rows have validation
                                issues that need to be addressed.
                              </AlertDescription>
                            </Alert>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Column Mapping */}
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">
                            Column Mapping
                          </CardTitle>
                          {processedData.unmatchedColumns.length > 0 && (
                            <Badge
                              variant="secondary"
                              className="border-amber-200 bg-amber-50 text-amber-500"
                            >
                              {processedData.unmatchedColumns.length} Unmapped
                              Columns
                            </Badge>
                          )}
                        </div>
                        <CardDescription>
                          The following columns were identified in your file
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <h4 className="mb-2 text-sm font-medium">
                            Mapped Columns
                          </h4>
                          <ul className="space-y-1">
                            {processedData.matchedColumns.map(
                              (column, index) => (
                                <li
                                  key={`mapped-${index}`}
                                  className="flex items-center text-sm"
                                >
                                  <Check className="mr-1.5 h-3.5 w-3.5 text-green-500" />
                                  {column}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                        {processedData.unmatchedColumns.length > 0 && (
                          <div>
                            <h4 className="mb-2 text-sm font-medium">
                              Unmapped Columns
                            </h4>
                            <ul className="space-y-1">
                              {processedData.unmatchedColumns.map(
                                (column, index) => (
                                  <li
                                    key={`unmapped-${index}`}
                                    className="flex items-center text-sm"
                                  >
                                    <Info className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
                                    {column}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Sample Data Preview */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">
                          Sample Data Preview
                        </CardTitle>
                        <CardDescription>
                          Showing {Math.min(processedData.sampleRows.length, 5)}{" "}
                          of {processedData.totalRows} rows
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="max-h-[260px] overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[80px]">Status</TableHead>
                              <TableHead>Patient</TableHead>
                              <TableHead>Phone</TableHead>
                              <TableHead>Data Fields</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {processedData.sampleRows.slice(0, 5).map((row) => (
                              <TableRow key={row.id}>
                                <TableCell>
                                  <Badge
                                    variant={
                                      row.isValid
                                        ? "success_solid"
                                        : "failure_solid"
                                    }
                                    className="px-2 py-0.5 text-xs"
                                  >
                                    {row.isValid ? "Valid" : "Invalid"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {row.patientData.firstName}{" "}
                                  {row.patientData.lastName}
                                </TableCell>
                                <TableCell>
                                  {row.patientData.phoneNumber}
                                </TableCell>
                                <TableCell className="max-w-[280px] truncate">
                                  {Object.entries(row.campaignData || {})
                                    .length > 0
                                    ? Object.entries(row.campaignData || {})
                                        .map(
                                          ([key, value]) => `${key}: ${value}`,
                                        )
                                        .join(", ")
                                    : "No campaign data"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>

              {/* Customize & Schedule Tab */}
              <TabsContent value="customize" className="space-y-4">
                <FormField
                  control={form.control}
                  name="customPrompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Prompt (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter any custom instructions for the AI..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Provide additional context or instructions for the AI to
                        use when interacting with patients.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="scheduleForLater"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Schedule for Later
                        </FormLabel>
                        <FormDescription>
                          If you want to run this campaign at a later time.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {scheduleForLater && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="scheduledDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground",
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date <
                                  new Date(new Date().setHours(0, 0, 0, 0))
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
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
                            <Input placeholder="HH:MM" type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="border-t px-6 py-4">
            <div className="flex w-full justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={activeTab === "details" || isLoading}
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={handleNext} disabled={isLoading}>
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {getNextButtonLabel()}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
