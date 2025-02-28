"use client";

// src/components/campaigns/create-run-modal.tsx
import { Calendar, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
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
import { Switch } from "@/components/ui/switch";
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

  // tRPC mutations
  const createRunMutation = api.run.create.useMutation({
    onSuccess: (data) => {
      router.push(`/campaigns/${campaignId}/runs/${data?.id}`);
      onOpenChange(false);
      toast.success("Run created successfully");
      form.reset();
    },
    onError: (error) => {
      toast.error(`Error creating run: ${error.message}`);
    },
  });

  const uploadFileMutation = api.run.uploadFile.useMutation({
    onSuccess: (data) => {
      toast.success(
        `File processed successfully: ${data.rowsAdded} rows added`,
      );
      if (data.invalidRows > 0) {
        toast.warning(`${data.invalidRows} invalid rows were skipped`);
      }
      setActiveTab("customize");
    },
    onError: (error) => {
      toast.error(`Error processing file: ${error.message}`);
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

  const isLoading = createRunMutation.isPending || uploadFileMutation.isPending;

  const handleSubmit = async (values: CreateRunFormValues) => {
    try {
      if (activeTab === "details" && values.file) {
        // Create run first
        const run = await createRunMutation.mutateAsync({
          campaignId,
          name: values.name,
        });

        // Then upload file
        if (run && values.file) {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const content = e.target?.result as string;

            await uploadFileMutation.mutateAsync({
              runId: run.id,
              fileContent: content,
              fileName: values.file!.name,
            });
          };
          reader.readAsDataURL(values.file);
        }
      } else if (activeTab === "customize") {
        // Update schedule if needed
        if (
          values.scheduleForLater &&
          values.scheduledDate &&
          values.scheduledTime
        ) {
          const [hours, minutes] = values.scheduledTime.split(":").map(Number);
          const scheduledDateTime = new Date(values.scheduledDate);
          scheduledDateTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);

          await createRunMutation.mutateAsync({
            campaignId,
            name: values.name,
            scheduledAt: scheduledDateTime.toISOString(),
          });
        } else {
          // Create without schedule
          await createRunMutation.mutateAsync({
            campaignId,
            name: values.name,
          });
        }
      }
    } catch (error) {
      console.error("Error in create run flow:", error);
    }
  };

  // Handle next step
  const handleNext = () => {
    if (activeTab === "details") {
      form.trigger(["name", "file"]).then((isValid) => {
        if (isValid) {
          setActiveTab("customize");
        }
      });
    } else {
      form.handleSubmit(handleSubmit)();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Create New Run</DialogTitle>
          <DialogDescription>
            Configure a new run for this campaign. You'll need to provide a name
            and upload a data file.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Details & Data</TabsTrigger>
            <TabsTrigger
              value="customize"
              disabled={!form.formState.isValid || !file}
            >
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
                {uploadFileMutation.isPending ? "Uploading..." : "Creating..."}
              </>
            ) : activeTab === "details" ? (
              "Next"
            ) : (
              "Create Run"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
