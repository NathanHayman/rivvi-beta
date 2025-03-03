"use client";

import type React from "react";

import {
  AlertCircle,
  Calendar,
  Check,
  Info,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import { addDays, format } from "date-fns";

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
  const [activeStep, setActiveStep] = useState<
    "details" | "review" | "customize"
  >("details");
  const [runName, setRunName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [scheduleForLater, setScheduleForLater] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [scheduledTime, setScheduledTime] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState<any>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  // tRPC mutations
  const createRunMutation = api.runs.create.useMutation({
    onSuccess: (data) => {
      router.push(`/campaigns/${campaignId}/runs/${data?.id}`);
      onOpenChange(false);
      toast.success("Run created successfully");
      resetForm();
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
    },
    onError: (error) => {
      toast.error(`Error processing file: ${error.message}`);
    },
  });

  const validateDataMutation = api.runs.validateData.useMutation({
    onSuccess: (data) => {
      setProcessedData(data);
      setIsProcessing(false);
      setActiveStep("review");
    },
    onError: (error) => {
      setIsProcessing(false);
      toast.error(`Error validating data: ${error.message}`);
    },
  });

  const resetForm = () => {
    setRunName("");
    setFile(null);
    setCustomPrompt("");
    setScheduleForLater(false);
    setScheduledDate(null);
    setScheduledTime("");
    setProcessedData(null);
    setActiveStep("details");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleFileRemove = () => {
    setFile(null);
  };

  const processFile = useCallback(async () => {
    if (!file) {
      toast.error("Please select a file to upload");
      return;
    }

    if (!runName.trim()) {
      toast.error("Please enter a run name");
      return;
    }

    try {
      setIsProcessing(true);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        await validateDataMutation.mutateAsync({
          campaignId,
          fileContent: content,
          fileName: file.name,
        });
      };
      reader.onerror = () => {
        setIsProcessing(false);
        toast.error("Failed to read file");
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setIsProcessing(false);
      console.error("Error processing file:", error);
      toast.error("Failed to process file");
    }
  }, [file, runName, campaignId, validateDataMutation]);

  const handleCreateRun = async () => {
    try {
      let scheduledAt = null;
      if (scheduleForLater && scheduledDate && scheduledTime) {
        const [hours, minutes] = scheduledTime.split(":").map(Number);
        const date = new Date(scheduledDate);
        date.setHours(hours || 0, minutes || 0, 0, 0);
        scheduledAt = date.toISOString();
      }

      const runData = {
        campaignId,
        name: runName,
        customPrompt,
        ...(scheduledAt ? { scheduledAt } : {}),
      };

      const run = await createRunMutation.mutateAsync(runData);

      if (run && processedData && file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const content = e.target?.result as string;
          await uploadFileMutation.mutateAsync({
            runId: run.id,
            fileContent: content,
            fileName: file.name,
            processedData: processedData.allRows,
          });
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.error("Error in create run flow:", error);
      toast.error("Failed to create run");
    }
  };

  const handleNext = () => {
    if (activeStep === "details") {
      processFile();
    } else if (activeStep === "review") {
      setActiveStep("customize");
    } else {
      handleCreateRun();
    }
  };

  const handleBack = () => {
    if (activeStep === "review") {
      setActiveStep("details");
    } else if (activeStep === "customize") {
      setActiveStep("review");
    }
  };

  const isLoading =
    createRunMutation.isPending || uploadFileMutation.isPending || isProcessing;

  const renderStepIndicator = () => {
    return (
      <div className="mb-6 grid grid-cols-3 gap-2">
        <div
          className={`rounded-md border p-2 text-center text-sm ${
            activeStep === "details"
              ? "border-primary bg-primary/10 font-medium"
              : "border-gray-200"
          }`}
        >
          Details & Data
        </div>
        <div
          className={`rounded-md border p-2 text-center text-sm ${
            activeStep === "review"
              ? "border-primary bg-primary/10 font-medium"
              : "border-gray-200"
          } ${!processedData ? "opacity-50" : ""}`}
        >
          Review Data
        </div>
        <div
          className={`rounded-md border p-2 text-center text-sm ${
            activeStep === "customize"
              ? "border-primary bg-primary/10 font-medium"
              : "border-gray-200"
          } ${!processedData ? "opacity-50" : ""}`}
        >
          Customize & Schedule
        </div>
      </div>
    );
  };

  const renderDetailsStep = () => {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="run-name" className="text-sm font-medium">
            Run Name
          </label>
          <Input
            id="run-name"
            value={runName}
            onChange={(e) => setRunName(e.target.value)}
            placeholder="Weekly Appointment Confirmations"
          />
          <p className="text-xs text-muted-foreground">
            Give your run a descriptive name
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Data File</label>
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
                className="border-gray-300 hover:bg-gray-50 flex h-10 w-full cursor-pointer items-center justify-center rounded-md border border-dashed px-3 py-2 text-sm"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Excel or CSV file
              </label>
            </div>
          ) : (
            <div className="bg-gray-50 flex items-center justify-between rounded-md border p-2">
              <div className="flex items-center">
                <div className="ml-2">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFileRemove}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Upload an Excel or CSV file with your patient appointment data
          </p>
        </div>
      </div>
    );
  };

  const renderReviewStep = () => {
    if (!processedData) return null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-md border p-4">
            <h3 className="mb-2 text-sm font-medium">Data Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Rows:</span>
                <span>{processedData.totalRows}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valid Rows:</span>
                <span className="text-green-600">
                  {processedData.validRows}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invalid Rows:</span>
                <span className="text-red-600">
                  {processedData.invalidRows}
                </span>
              </div>
              <div className="bg-gray-100 my-1 h-px"></div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">New Patients:</span>
                <span>{processedData.newPatients}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Existing Patients:
                </span>
                <span>{processedData.existingPatients}</span>
              </div>
            </div>
          </div>

          <div className="rounded-md border p-4">
            <h3 className="mb-2 text-sm font-medium">Validation Status</h3>
            <div className="mb-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Data Quality
                </span>
                <span className="text-sm font-medium">
                  {Math.round(
                    (processedData.validRows /
                      Math.max(processedData.totalRows, 1)) *
                      100,
                  )}
                  %
                </span>
              </div>
              <div className="bg-gray-100 h-2 w-full overflow-hidden rounded-full">
                <div
                  className="h-full bg-green-500"
                  style={{
                    width: `${(processedData.validRows / Math.max(processedData.totalRows, 1)) * 100}%`,
                  }}
                ></div>
              </div>
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
                      {processedData.invalidRows} rows have validation issues
                      that need to be addressed.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-md bg-green-50 p-3 text-green-800">
                <div className="flex">
                  <Check className="h-5 w-5 text-green-500" />
                  <div className="ml-3">
                    <p className="text-sm font-medium">All Data Valid</p>
                    <p className="mt-1 text-xs">
                      All rows passed validation and are ready for processing.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-md border p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium">Column Mapping</h3>
            {processedData.unmatchedColumns?.length > 0 && (
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-amber-500"
              >
                {processedData.unmatchedColumns.length} Unmapped Columns
              </Badge>
            )}
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            The following columns were identified in your file
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="mb-2 text-xs font-medium">Mapped Columns</h4>
              <div className="space-y-1">
                {processedData.matchedColumns?.map((column: string) => (
                  <div key={column} className="flex items-center">
                    <Check className="mr-2 h-3 w-3 text-green-500" />
                    <span className="text-sm">{column}</span>
                  </div>
                ))}
              </div>
            </div>

            {processedData.unmatchedColumns?.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-medium">Unmapped Columns</h4>
                <div className="space-y-1">
                  {processedData.unmatchedColumns.map((column: string) => (
                    <div key={column} className="flex items-center">
                      <Info className="mr-2 h-3 w-3 text-amber-500" />
                      <span className="text-sm">{column}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-md border p-4">
          <h3 className="mb-2 text-sm font-medium">Sample Data Preview</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Showing {Math.min(5, processedData.sampleRows?.length || 0)} of{" "}
            {processedData.totalRows} rows
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                    Patient
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                    Phone
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                    Data Fields
                  </th>
                </tr>
              </thead>
              <tbody>
                {processedData.sampleRows?.slice(0, 5).map((row: any) => (
                  <tr key={row.id} className="border-b">
                    <td className="px-2 py-2">
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
                    </td>
                    <td className="px-2 py-2 text-sm">
                      {row.patientData.firstName} {row.patientData.lastName}
                    </td>
                    <td className="px-2 py-2 text-sm">
                      {row.patientData.phoneNumber}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(row.campaignData || {})
                          .slice(0, 3)
                          .map(([key, value]) => (
                            <Badge
                              key={key}
                              variant="secondary"
                              className="text-xs"
                            >
                              {key}: {String(value).substring(0, 15)}
                              {String(value).length > 15 ? "..." : ""}
                            </Badge>
                          ))}
                        {Object.keys(row.campaignData || {}).length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{Object.keys(row.campaignData).length - 3} more
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {processedData.invalidRows > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4">
            <h3 className="mb-2 text-sm font-medium text-red-700">
              Validation Errors
            </h3>
            <p className="mb-4 text-xs text-red-600">
              The following issues were found in your data
            </p>

            <div className="space-y-3">
              {processedData.sampleRows
                ?.filter((row: any) => !row.isValid)
                .slice(0, 3)
                .map((row: any, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-md border border-red-200 bg-white p-3"
                  >
                    <div className="font-medium text-red-800">
                      Row for {row.patientData.firstName || "Unknown"}{" "}
                      {row.patientData.lastName || "Patient"}
                    </div>
                    <ul className="mt-1 list-disc pl-5 text-sm text-red-700">
                      {row.validationErrors?.map((error: string, i: number) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </div>
                ))}

              {processedData.invalidRows > 3 && (
                <div className="text-center text-sm text-muted-foreground">
                  And {processedData.invalidRows - 3} more rows with errors
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCustomizeStep = () => {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="custom-prompt" className="text-sm font-medium">
            Campaign Intent (Optional)
          </label>
          <Textarea
            id="custom-prompt"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Describe the intent of this campaign in natural language (e.g., 'This is an urgent notice about upcoming appointments that need confirmation')"
            className="min-h-[120px] resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Your natural language input will be combined with the base prompt to
            tailor the messaging for this run
          </p>
        </div>

        <div className="rounded-md border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Schedule for Later</h3>
              <p className="text-xs text-muted-foreground">
                Run will start at the scheduled time
              </p>
            </div>
            <Switch
              checked={scheduleForLater}
              onCheckedChange={setScheduleForLater}
            />
          </div>

          {scheduleForLater && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <div className="relative">
                  <Input
                    type="text"
                    readOnly
                    value={scheduledDate ? format(scheduledDate, "PPP") : ""}
                    placeholder="Pick a date"
                    className="cursor-pointer"
                    onClick={() => setShowCalendar(!showCalendar)}
                  />
                  <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />

                  {showCalendar && (
                    <div className="absolute left-0 top-full z-10 mt-1 rounded-md border bg-white p-3 shadow-md">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-medium">
                          {format(new Date(), "MMMM yyyy")}
                        </h4>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setShowCalendar(false)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-1 text-center">
                        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(
                          (day) => (
                            <div key={day} className="text-xs font-medium">
                              {day}
                            </div>
                          ),
                        )}

                        {Array.from({ length: 31 }, (_, i) => {
                          const date = addDays(new Date(), i);
                          return (
                            <Button
                              key={i}
                              variant="ghost"
                              size="sm"
                              className={`h-7 w-7 p-0 ${
                                scheduledDate &&
                                date.getDate() === scheduledDate.getDate() &&
                                date.getMonth() === scheduledDate.getMonth() &&
                                date.getFullYear() ===
                                  scheduledDate.getFullYear()
                                  ? "bg-primary text-primary-foreground"
                                  : ""
                              }`}
                              onClick={() => {
                                setScheduledDate(date);
                                setShowCalendar(false);
                              }}
                            >
                              {date.getDate()}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Time</label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  disabled={!scheduledDate}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderActiveStep = () => {
    switch (activeStep) {
      case "details":
        return renderDetailsStep();
      case "review":
        return renderReviewStep();
      case "customize":
        return renderCustomizeStep();
      default:
        return null;
    }
  };

  return (
    <Modal
      showModal={open}
      setShowModal={onOpenChange}
      className="h-fit max-h-[90vh] max-w-3xl overflow-y-auto"
    >
      <ModalHeader>
        <ModalTitle>Create New Run</ModalTitle>
        <p className="text-sm text-muted-foreground">
          Configure a new run for this campaign. You'll need to provide a name
          and upload a data file.
        </p>
      </ModalHeader>

      <ModalBody>
        {renderStepIndicator()}
        {renderActiveStep()}
      </ModalBody>

      <ModalFooter className="flex justify-between">
        {activeStep !== "details" ? (
          <Button variant="outline" onClick={handleBack} disabled={isLoading}>
            Back
          </Button>
        ) : (
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
        )}

        <Button onClick={handleNext} disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {activeStep === "details" &&
            (isLoading ? "Processing..." : "Process Data")}
          {activeStep === "review" && "Next"}
          {activeStep === "customize" &&
            (isLoading ? "Creating..." : "Create Run")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
