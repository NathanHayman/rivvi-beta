"use client";

// src/components/app/run/create-run-modal.tsx
import {
  AlertCircle,
  Calendar,
  Check,
  Info,
  Loader2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { AppScrollArea } from "@/components/layout/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
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

// Define the processed data types
interface ProcessedRow {
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

interface ProcessedData {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newPatients: number;
  existingPatients: number;
  matchedColumns: string[];
  unmatchedColumns: string[];
  sampleRows: ProcessedRow[];
  allRows: ProcessedRow[];
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
  const [processedData, setProcessedData] = useState<ProcessedData | null>(
    null,
  );
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
      setProcessedData({
        totalRows: data.totalRows,
        validRows: data.validRows,
        invalidRows: data.invalidRows,
        newPatients: data.newPatients,
        existingPatients: data.existingPatients,
        matchedColumns: data.matchedColumns,
        unmatchedColumns: data.unmatchedColumns,
        sampleRows: data.sampleRows as ProcessedRow[],
        allRows: data.allRows as ProcessedRow[],
      });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create New Run</DialogTitle>
          <DialogDescription>
            Configure a new run for this campaign. You'll need to provide a name
            and upload a data file.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full p-4 lg:p-6"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details & Data</TabsTrigger>
            <TabsTrigger value="review" disabled={!processedData}>
              Review Data
            </TabsTrigger>
            <TabsTrigger value="customize" disabled={!processedData}>
              Customize & Schedule
            </TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
            >
              <TabsContent value="details" className="space-y-4">
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

                <FormField
                  control={form.control}
                  name="file"
                  render={({ field: { value, onChange, ...fieldProps } }) => (
                    <FormItem>
                      <FormLabel>Data File</FormLabel>
                      <FormControl>
                        <FileInput
                          {...fieldProps}
                          accept=".xlsx,.xls,.csv"
                          value={value}
                          onChange={onChange}
                          placeholder="Upload Excel or CSV file"
                          icon={<Upload className="h-4 w-4" />}
                        />
                      </FormControl>
                      <FormDescription>
                        Upload an Excel or CSV file with your data
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="review" className="space-y-6">
                {processedData && (
                  <AppScrollArea className="h-[500px]">
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">
                            Data Summary
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Total Rows:
                              </span>
                              <span className="font-medium">
                                {processedData.totalRows}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Valid Rows:
                              </span>
                              <span className="font-medium text-green-600">
                                {processedData.validRows}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Invalid Rows:
                              </span>
                              <span className="font-medium text-red-600">
                                {processedData.invalidRows}
                              </span>
                            </div>
                            <div className="h-2"></div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                New Patients:
                              </span>
                              <span className="font-medium">
                                {processedData.newPatients}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Existing Patients:
                              </span>
                              <span className="font-medium">
                                {processedData.existingPatients}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">
                            Validation Status
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="mb-2">
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Data Quality
                              </span>
                              <span className="text-sm font-medium">
                                {Math.round(
                                  (processedData.validRows /
                                    processedData.totalRows) *
                                    100,
                                )}
                                %
                              </span>
                            </div>
                            <Progress
                              value={
                                (processedData.validRows /
                                  processedData.totalRows) *
                                100
                              }
                              className="h-2"
                            />
                          </div>

                          {processedData.invalidRows > 0 ? (
                            <div className="mt-4 rounded-md bg-amber-50 p-3 text-amber-800">
                              <div className="flex">
                                <AlertCircle className="h-5 w-5 text-amber-500" />
                                <div className="ml-3">
                                  <p className="text-sm font-medium">
                                    Validation Issues Found
                                  </p>
                                  <p className="mt-1 text-xs">
                                    {processedData.invalidRows} rows have
                                    validation issues that need to be addressed.
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 rounded-md bg-green-50 p-3 text-green-800">
                              <div className="flex">
                                <Check className="h-5 w-5 text-green-500" />
                                <div className="ml-3">
                                  <p className="text-sm font-medium">
                                    All Data Valid
                                  </p>
                                  <p className="mt-1 text-xs">
                                    All rows passed validation and are ready for
                                    processing.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between text-lg">
                          <span>Column Mapping</span>
                          {processedData.unmatchedColumns.length > 0 && (
                            <Badge
                              variant="outline"
                              className="border-amber-200 bg-amber-50 text-amber-500"
                            >
                              {processedData.unmatchedColumns.length} Unmapped
                              Columns
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          The following columns were identified in your file
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <h4 className="mb-2 text-sm font-medium">
                              Mapped Columns
                            </h4>
                            <div className="space-y-1">
                              {processedData.matchedColumns.map((column) => (
                                <div key={column} className="flex items-center">
                                  <Check className="mr-2 h-3 w-3 text-green-500" />
                                  <span className="text-sm">{column}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {processedData.unmatchedColumns.length > 0 && (
                            <div>
                              <h4 className="mb-2 text-sm font-medium">
                                Unmapped Columns
                              </h4>
                              <div className="space-y-1">
                                {processedData.unmatchedColumns.map(
                                  (column) => (
                                    <div
                                      key={column}
                                      className="flex items-center"
                                    >
                                      <Info className="mr-2 h-3 w-3 text-amber-500" />
                                      <span className="text-sm">{column}</span>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">
                          Sample Data Preview
                        </CardTitle>
                        <CardDescription>
                          Showing {Math.min(5, processedData.sampleRows.length)}{" "}
                          of {processedData.totalRows} rows
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="max-h-64 overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[100px]">
                                  Status
                                </TableHead>
                                <TableHead>Patient</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Data Fields</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {processedData.sampleRows
                                .slice(0, 5)
                                .map((row) => (
                                  <TableRow key={row.id}>
                                    <TableCell>
                                      {row.isValid ? (
                                        <Badge
                                          variant="outline"
                                          className="border-green-200 bg-green-50 text-green-700"
                                        >
                                          Valid
                                        </Badge>
                                      ) : (
                                        <Badge
                                          variant="outline"
                                          className="border-red-200 bg-red-50 text-red-700"
                                        >
                                          Invalid
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {row.patientData.firstName}{" "}
                                      {row.patientData.lastName}
                                    </TableCell>
                                    <TableCell>
                                      {row.patientData.phoneNumber}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap gap-1">
                                        {Object.entries(row.campaignData)
                                          .slice(0, 3)
                                          .map(([key, value]) => (
                                            <Badge
                                              key={key}
                                              variant="secondary"
                                              className="text-xs"
                                            >
                                              {key}:{" "}
                                              {value
                                                ?.toString()
                                                .substring(0, 15)}
                                              {value?.toString().length > 15
                                                ? "..."
                                                : ""}
                                            </Badge>
                                          ))}
                                        {Object.keys(row.campaignData).length >
                                          3 && (
                                          <Badge
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            +
                                            {Object.keys(row.campaignData)
                                              .length - 3}{" "}
                                            more
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>

                    {processedData.invalidRows > 0 && (
                      <Card className="border-red-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg text-red-700">
                            Validation Errors
                          </CardTitle>
                          <CardDescription>
                            The following issues were found in your data
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {processedData.sampleRows
                              .filter((row) => !row.isValid)
                              .slice(0, 3)
                              .map((row, idx) => (
                                <div
                                  key={idx}
                                  className="rounded-md border border-red-200 bg-red-50 p-3"
                                >
                                  <div className="font-medium text-red-800">
                                    Row for{" "}
                                    {row.patientData.firstName || "Unknown"}{" "}
                                    {row.patientData.lastName || "Patient"}
                                  </div>
                                  <ul className="mt-1 list-disc pl-4 text-sm text-red-700">
                                    {row.validationErrors?.map((error, i) => (
                                      <li key={i}>{error}</li>
                                    ))}
                                  </ul>
                                </div>
                              ))}

                            {processedData.invalidRows > 3 && (
                              <div className="text-center text-sm text-muted-foreground">
                                And {processedData.invalidRows - 3} more rows
                                with errors
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </AppScrollArea>
                )}
              </TabsContent>

              <TabsContent value="customize" className="space-y-4">
                <FormField
                  control={form.control}
                  name="customPrompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Prompt (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add any custom instructions for the AI agent..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Customize how the AI agent communicates for this run
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="scheduleForLater"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Schedule for Later</FormLabel>
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
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground",
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <Calendar className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <CalendarComponent
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
                            <Input
                              type="time"
                              placeholder="Select time"
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
              </TabsContent>
            </form>
          </Form>
        </Tabs>

        <DialogFooter>
          {activeTab !== "details" && (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={isLoading}
            >
              Back
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleNext} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {getNextButtonLabel()}
              </>
            ) : (
              getNextButtonLabel()
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
