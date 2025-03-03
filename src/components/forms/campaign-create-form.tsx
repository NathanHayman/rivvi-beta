"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import { TagInput } from "../ui/tag-input";

// Define the campaign creation schema
const campaignFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  orgId: z.string().uuid("Organization is required"),
  agentId: z.string().min(1, "Agent ID is required"),
  llmId: z.string().min(1, "Retell AI llm ID is required"),
  direction: z.string().min(1, "Direction is required"),
  basePrompt: z.string().min(1, "Base prompt is required"),
  patientFields: z.array(
    z.object({
      key: z.string().min(1, "Key is required"),
      label: z.string().min(1, "Label is required"),
      possibleColumns: z.array(z.string()),
      transform: z
        .enum(["text", "short_date", "long_date", "time", "phone", "provider"])
        .optional(),
      required: z.boolean().default(true),
      description: z.string().optional(),
    }),
  ),
  patientValidation: z.object({
    requireValidPhone: z.boolean().default(true),
    requireValidDOB: z.boolean().default(true),
    requireName: z.boolean().default(true),
  }),
  campaignFields: z.array(
    z.object({
      key: z.string().min(1, "Key is required"),
      label: z.string().min(1, "Label is required"),
      possibleColumns: z.array(z.string()),
      transform: z
        .enum(["text", "short_date", "long_date", "time", "phone", "provider"])
        .optional(),
      required: z.boolean().default(false),
      description: z.string().optional(),
    }),
  ),
  standardAnalysisFields: z.array(
    z.object({
      key: z.string().min(1, "Key is required"),
      label: z.string().min(1, "Label is required"),
      type: z.enum(["boolean", "string", "date", "enum"]),
      options: z.array(z.string()).optional(),
      required: z.boolean().default(true),
      description: z.string().optional(),
    }),
  ),
  campaignAnalysisFields: z.array(
    z.object({
      key: z.string().min(1, "Key is required"),
      label: z.string().min(1, "Label is required"),
      type: z.enum(["boolean", "string", "date", "enum"]),
      options: z.array(z.string()).optional(),
      required: z.boolean().default(false),
      description: z.string().optional(),
      isMainKPI: z.boolean().default(false),
    }),
  ),
  requestId: z.string().uuid().optional(),
});

type CampaignFormValues = z.infer<typeof campaignFormSchema>;

interface CreateCampaignFormProps {
  agents: { agent_id: string; name: string; llm_id?: string | null }[];
  requestId?: string;
  onSuccess?: () => void;
}

/**
 * Hook to fetch LLM data for a selected agent
 */
function useAgentLlm(agentId: string | null | undefined) {
  const {
    data: llmData,
    isLoading,
    error,
  } = api.admin.getLlmFromAgent.useQuery(
    { agentId: agentId || "" },
    {
      enabled: !!agentId,
      refetchOnWindowFocus: false,
      retry: 1, // Only retry once to prevent excessive API calls on hard failures
    },
  );

  // Log errors but don't show toasts to avoid spamming the user
  useEffect(() => {
    if (error) {
      console.error("Error fetching LLM data:", error);
    }
  }, [error]);

  return { llmData, isLoading, error };
}

export function CreateCampaignForm({
  requestId,
  onSuccess,
}: CreateCampaignFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const steps = ["Campaign Details", "Variables", "Analysis", "Prompt"];
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const { data: organizations } =
    api.admin.getOrganizationsIdsAndNames.useQuery();

  const { data: agents } = api.admin.getAgents.useQuery();

  // Setup form with default values
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: "",
      orgId: "",
      agentId: "",
      llmId: "",
      direction: "outbound",
      basePrompt: "",
      patientFields: [
        {
          key: "firstName",
          label: "First Name",
          possibleColumns: ["Patient First Name", "first_name", "First Name"],
          transform: "text",
          required: true,
        },
        {
          key: "lastName",
          label: "Last Name",
          possibleColumns: ["Patient Last Name", "last_name", "Last Name"],
          transform: "text",
          required: true,
        },
        {
          key: "dob",
          label: "Date of Birth",
          possibleColumns: [
            "Patient DOB",
            "DOB",
            "Birth Date",
            "Date of Birth",
          ],
          transform: "short_date",
          required: true,
        },
        {
          key: "phone",
          label: "Phone Number",
          possibleColumns: [
            "Cell Phone",
            "Mobile Phone",
            "Phone",
            "Primary Phone",
          ],
          transform: "phone",
          required: true,
        },
        {
          key: "emrId",
          label: "EMR ID",
          possibleColumns: ["EMR ID", "Patient ID", "MRN"],
          transform: "text",
          required: false,
        },
      ],
      patientValidation: {
        requireValidPhone: true,
        requireValidDOB: true,
        requireName: true,
      },
      campaignFields: [],
      standardAnalysisFields: [
        {
          key: "patient_reached",
          label: "Patient Reached",
          type: "boolean",
          required: true,
        },
        {
          key: "left_voicemail",
          label: "Left Voicemail",
          type: "boolean",
          required: true,
        },
      ],
      campaignAnalysisFields: [],
      requestId,
    },
  });

  // Get LLM data for the selected agent
  const { llmData, isLoading, error } = useAgentLlm(selectedAgentId);

  // Update LLM ID when llm data changes
  useEffect(() => {
    if (llmData?.llm_id) {
      form.setValue("llmId", llmData.llm_id);
    }
  }, [llmData, form]);

  // Check if agent ID is already set when component mounts
  useEffect(() => {
    const currentAgentId = form.getValues("agentId");
    if (currentAgentId) {
      setSelectedAgentId(currentAgentId);
    }

    // Set up form watcher for agentId changes
    const subscription = form.watch((value, { name }) => {
      if (name === "agentId" && value.agentId) {
        setSelectedAgentId(value.agentId);
      }
    });

    // Cleanup the subscription on unmount
    return () => subscription.unsubscribe();
  }, [form]);

  // Field arrays for dynamic fields
  const {
    fields: patientFields,
    append: appendPatientField,
    remove: removePatientField,
  } = useFieldArray({ control: form.control, name: "patientFields" });

  const {
    fields: campaignFields,
    append: appendCampaignField,
    remove: removeCampaignField,
  } = useFieldArray({ control: form.control, name: "campaignFields" });

  const {
    fields: standardAnalysisFields,
    append: appendStandardAnalysisField,
    remove: removeStandardAnalysisField,
  } = useFieldArray({ control: form.control, name: "standardAnalysisFields" });

  const {
    fields: campaignAnalysisFields,
    append: appendCampaignAnalysisField,
    remove: removeCampaignAnalysisField,
  } = useFieldArray({ control: form.control, name: "campaignAnalysisFields" });

  // Create campaign mutation
  const createCampaignMutation = api.admin.createCampaign.useMutation({
    onSuccess: (data) => {
      toast.success("Campaign created successfully");
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/admin/orgs/${data?.orgId}/campaigns/${data?.id}`);
      }
    },
    onError: (error) => {
      // Check for specific database schema errors
      if (
        error.message.includes("llm_id") &&
        error.message.includes("does not exist")
      ) {
        toast.error(
          "Database schema issue: LLM ID column is missing. Please contact your administrator.",
        );
      } else {
        toast.error(`Error creating campaign: ${error.message}`);
      }
    },
  });

  // Handle form submission
  const onSubmit = (values: CampaignFormValues) => {
    try {
      // Transform the form values into the expected API format
      const config = {
        basePrompt: values.basePrompt,
        variables: {
          patient: {
            fields: values.patientFields,
            validation: values.patientValidation,
          },
          campaign: {
            fields: values.campaignFields,
          },
        },
        analysis: {
          standard: {
            fields: values.standardAnalysisFields,
          },
          campaign: {
            fields: values.campaignAnalysisFields,
          },
        },
      };

      // Create payload, potentially removing llmId if we know it causes schema issues
      let payload = {
        name: values.name,
        orgId: values.orgId,
        agentId: values.agentId,
        llmId: values.llmId,
        direction: values.direction,
        config,
        requestId: values.requestId,
      };

      // If we're in development and want to test without the llmId column
      // This is commented out but can be uncommented for testing
      /*
      if (process.env.NODE_ENV !== 'production') {
        const { llmId, ...payloadWithoutLlmId } = payload;
        payload = payloadWithoutLlmId;
      }
      */

      createCampaignMutation.mutate(payload);
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("An unexpected error occurred. Please try again.");
    }
  };

  // Handle navigating between steps
  const nextStep = async () => {
    let fieldsToValidate: Array<keyof CampaignFormValues> = [];

    switch (step) {
      case 0:
        fieldsToValidate = ["name", "orgId", "agentId", "direction", "llmId"];
        break;
      case 1:
        fieldsToValidate = ["patientFields", "campaignFields"];
        break;
      case 2:
        fieldsToValidate = ["standardAnalysisFields", "campaignAnalysisFields"];
        break;
    }

    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) setStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  // Helper to add a new field
  const addNewField = (
    type: "patient" | "campaign" | "standardAnalysis" | "campaignAnalysis",
  ) => {
    const baseField = {
      key: "",
      label: "",
      required: false,
    };

    switch (type) {
      case "patient":
        appendPatientField({
          ...baseField,
          possibleColumns: [],
          transform: "text",
        });
        break;
      case "campaign":
        appendCampaignField({
          ...baseField,
          possibleColumns: [],
          transform: "text",
        });
        break;
      case "standardAnalysis":
        appendStandardAnalysisField({
          ...baseField,
          type: "boolean",
        });
        break;
      case "campaignAnalysis":
        appendCampaignAnalysisField({
          ...baseField,
          type: "boolean",
          isMainKPI: false,
        });
        break;
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="mb-8">
          {/* Progress indicator */}
          <div className="mt-8">
            <div className="flex items-center justify-between">
              {steps.map((stepName, index) => (
                <div key={stepName} className="flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                      index === step
                        ? "border-primary bg-primary text-primary-foreground"
                        : index < step
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    {index < step ? "✓" : index + 1}
                  </div>
                  <span
                    className={`mt-2 text-sm ${
                      index === step
                        ? "font-medium text-primary"
                        : index < step
                          ? "text-primary"
                          : "text-muted-foreground"
                    }`}
                  >
                    {stepName}
                  </span>
                </div>
              ))}
            </div>
            <div className="relative mt-2">
              <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-muted"></div>
              <div
                className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-primary transition-all duration-300"
                style={{ width: `${(step / (steps.length - 1)) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-360px)] pr-4">
          {/* Step 1: Campaign Details */}
          {step === 0 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Information</CardTitle>
                  <CardDescription>
                    Enter the basic information for your campaign
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Appointment Confirmations"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          A descriptive name for this campaign
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="orgId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an organization" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {organizations?.map((org) => (
                              <SelectItem key={org.id} value={org.id}>
                                {org.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          The organization this campaign belongs to
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="agentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Retell Agent ID</FormLabel>
                        {agents?.length > 0 ? (
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              // Set the selected agent ID to trigger the hook
                              setSelectedAgentId(value);
                            }}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select an agent" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {agents.map((agent) => (
                                <SelectItem
                                  key={agent.agent_id}
                                  value={agent.agent_id}
                                >
                                  {agent.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <FormControl>
                            <Input placeholder="agent_abc123" {...field} />
                          </FormControl>
                        )}
                        <FormDescription>
                          The Retell AI agent ID to use for this campaign
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="llmId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Retell AI LLM ID</FormLabel>
                        <FormControl>
                          <Input
                            readOnly
                            disabled={true}
                            placeholder="Select an agent to populate this field"
                            className={
                              !field.value ? "italic text-muted-foreground" : ""
                            }
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          This field is automatically populated based on the
                          selected agent
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
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a direction" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="outbound">Outbound</SelectItem>
                            <SelectItem value="inbound">Inbound</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          The direction of the campaign determines default
                          fields and behavior
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Variables */}
          {step === 1 && (
            <div className="space-y-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle>Patient Fields</CardTitle>
                    <CardDescription>
                      Define the patient data fields required for this campaign
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addNewField("patient")}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Field
                  </Button>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    {patientFields.map((field, index) => (
                      <div
                        key={field.id}
                        className="rounded-lg border border-border bg-card p-4 shadow-sm"
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">
                              {form.watch(`patientFields.${index}.label`) ||
                                "New Field"}
                            </h4>
                            {form.watch(`patientFields.${index}.required`) && (
                              <Badge variant="outline" className="text-xs">
                                Required
                              </Badge>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePatientField(index)}
                            disabled={index < 4} // Prevent removing first 4 default fields
                            className="h-8 w-8 p-0 text-muted-foreground"
                          >
                            <span className="sr-only">Remove</span>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name={`patientFields.${index}.key`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Field Key</FormLabel>
                                <FormControl>
                                  <Input placeholder="firstName" {...field} />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  Variable name in the system
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`patientFields.${index}.label`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Display Label</FormLabel>
                                <FormControl>
                                  <Input placeholder="First Name" {...field} />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  Human-readable field name
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`patientFields.${index}.transform`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Transform Type</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select transform" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="text">Text</SelectItem>
                                    <SelectItem value="short_date">
                                      Short Date
                                    </SelectItem>
                                    <SelectItem value="long_date">
                                      Long Date
                                    </SelectItem>
                                    <SelectItem value="time">Time</SelectItem>
                                    <SelectItem value="phone">Phone</SelectItem>
                                    <SelectItem value="provider">
                                      Provider
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormDescription className="text-xs">
                                  How to transform the input data
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`patientFields.${index}.possibleColumns`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Possible Column Names</FormLabel>
                                <FormControl>
                                  <TagInput
                                    initialTags={field.value}
                                    onTagsChange={(tags) =>
                                      field.onChange(tags)
                                    }
                                    placeholder="Type column names and press Enter..."
                                  />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  Column names that might match this field in
                                  uploaded data
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`patientFields.${index}.required`}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-6">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>Required Field</FormLabel>
                                  <FormDescription className="text-xs">
                                    Is this field required for valid data?
                                  </FormDescription>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle>Campaign-Specific Fields</CardTitle>
                    <CardDescription>
                      Define additional fields specific to this campaign
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addNewField("campaign")}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Field
                  </Button>
                </CardHeader>
                <CardContent className="pt-6">
                  {campaignFields.length > 0 ? (
                    <div className="space-y-6">
                      {campaignFields.map((field, index) => (
                        <div
                          key={field.id}
                          className="rounded-lg border border-border bg-card p-4 shadow-sm"
                        >
                          <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">
                                {form.watch(`campaignFields.${index}.label`) ||
                                  "New Field"}
                              </h4>
                              {form.watch(
                                `campaignFields.${index}.required`,
                              ) && (
                                <Badge variant="outline" className="text-xs">
                                  Required
                                </Badge>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCampaignField(index)}
                              className="h-8 w-8 p-0 text-muted-foreground"
                            >
                              <span className="sr-only">Remove</span>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                              control={form.control}
                              name={`campaignFields.${index}.key`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Field Key</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="appointmentDate"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`campaignFields.${index}.label`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Display Label</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Appointment Date"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`campaignFields.${index}.transform`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Transform Type</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select transform" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="text">Text</SelectItem>
                                      <SelectItem value="short_date">
                                        Short Date
                                      </SelectItem>
                                      <SelectItem value="long_date">
                                        Long Date
                                      </SelectItem>
                                      <SelectItem value="time">Time</SelectItem>
                                      <SelectItem value="phone">
                                        Phone
                                      </SelectItem>
                                      <SelectItem value="provider">
                                        Provider
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`campaignFields.${index}.possibleColumns`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Possible Column Names</FormLabel>
                                  <FormControl>
                                    <TagInput
                                      initialTags={field.value}
                                      onTagsChange={(tags) =>
                                        field.onChange(tags)
                                      }
                                      placeholder="Type column names and press Enter..."
                                    />
                                  </FormControl>
                                  <FormDescription className="text-xs">
                                    Column names that might match this field in
                                    uploaded data
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`campaignFields.${index}.required`}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-6">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel>Required Field</FormLabel>
                                  </div>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 p-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        No campaign-specific fields defined yet
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => addNewField("campaign")}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Field
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 3: Analysis */}
          {step === 2 && (
            <div className="space-y-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle>Standard Analysis Fields</CardTitle>
                    <CardDescription>
                      Define the standard metrics to track for this campaign
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addNewField("standardAnalysis")}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Field
                  </Button>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    {standardAnalysisFields.map((field, index) => (
                      <div
                        key={field.id}
                        className="rounded-lg border border-border bg-card p-4 shadow-sm"
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">
                              {form.watch(
                                `standardAnalysisFields.${index}.label`,
                              ) || "New Field"}
                            </h4>
                            {form.watch(
                              `standardAnalysisFields.${index}.required`,
                            ) && (
                              <Badge variant="outline" className="text-xs">
                                Required
                              </Badge>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeStandardAnalysisField(index)}
                            className="h-8 w-8 p-0 text-muted-foreground"
                          >
                            <span className="sr-only">Remove</span>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name={`standardAnalysisFields.${index}.key`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Field Key</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="patient_reached"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`standardAnalysisFields.${index}.label`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Display Label</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Patient Reached"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`standardAnalysisFields.${index}.type`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Field Type</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="boolean">
                                      Boolean
                                    </SelectItem>
                                    <SelectItem value="string">
                                      String
                                    </SelectItem>
                                    <SelectItem value="date">Date</SelectItem>
                                    <SelectItem value="enum">Enum</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {form.watch(
                            `standardAnalysisFields.${index}.type`,
                          ) === "enum" && (
                            <FormField
                              control={form.control}
                              name={`standardAnalysisFields.${index}.options`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Options</FormLabel>
                                  <FormControl>
                                    <TagInput
                                      initialTags={field.value || []}
                                      onTagsChange={(tags) =>
                                        field.onChange(tags)
                                      }
                                      placeholder="Type options and press Enter..."
                                    />
                                  </FormControl>
                                  <FormDescription className="text-xs">
                                    Possible values for this enum field
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          <FormField
                            control={form.control}
                            name={`standardAnalysisFields.${index}.required`}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-6">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>Required Field</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle>Campaign-Specific Analysis Fields</CardTitle>
                    <CardDescription>
                      Define additional metrics specific to this campaign
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addNewField("campaignAnalysis")}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Field
                  </Button>
                </CardHeader>
                <CardContent className="pt-6">
                  {campaignAnalysisFields.length > 0 ? (
                    <div className="space-y-6">
                      {campaignAnalysisFields.map((field, index) => (
                        <div
                          key={field.id}
                          className="rounded-lg border border-border bg-card p-4 shadow-sm"
                        >
                          <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">
                                {form.watch(
                                  `campaignAnalysisFields.${index}.label`,
                                ) || "New Field"}
                              </h4>
                              {form.watch(
                                `campaignAnalysisFields.${index}.required`,
                              ) && (
                                <Badge variant="outline" className="text-xs">
                                  Required
                                </Badge>
                              )}
                              {form.watch(
                                `campaignAnalysisFields.${index}.isMainKPI`,
                              ) && (
                                <Badge className="bg-primary/20 text-xs text-primary">
                                  Main KPI
                                </Badge>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCampaignAnalysisField(index)}
                              className="h-8 w-8 p-0 text-muted-foreground"
                            >
                              <span className="sr-only">Remove</span>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                              control={form.control}
                              name={`campaignAnalysisFields.${index}.key`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Field Key</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="appointment_confirmed"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`campaignAnalysisFields.${index}.label`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Display Label</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Appointment Confirmed"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`campaignAnalysisFields.${index}.type`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Field Type</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="boolean">
                                        Boolean
                                      </SelectItem>
                                      <SelectItem value="string">
                                        String
                                      </SelectItem>
                                      <SelectItem value="date">Date</SelectItem>
                                      <SelectItem value="enum">Enum</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {form.watch(
                              `campaignAnalysisFields.${index}.type`,
                            ) === "enum" && (
                              <FormField
                                control={form.control}
                                name={`campaignAnalysisFields.${index}.options`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Options</FormLabel>
                                    <FormControl>
                                      <TagInput
                                        initialTags={field.value || []}
                                        onTagsChange={(tags) =>
                                          field.onChange(tags)
                                        }
                                        placeholder="Type options and press Enter..."
                                      />
                                    </FormControl>
                                    <FormDescription className="text-xs">
                                      Possible values for this enum field
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}

                            <div className="flex space-x-4">
                              <FormField
                                control={form.control}
                                name={`campaignAnalysisFields.${index}.required`}
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-6">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                      <FormLabel>Required</FormLabel>
                                    </div>
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name={`campaignAnalysisFields.${index}.isMainKPI`}
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-6">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                      <FormLabel>Main KPI</FormLabel>
                                    </div>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 p-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        No campaign-specific analysis fields defined yet
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => addNewField("campaignAnalysis")}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Field
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 4: Prompt */}
          {step === 3 && (
            <div className="space-y-6">
              <Card className="">
                <CardHeader>
                  <CardTitle>Campaign Prompt</CardTitle>
                  <CardDescription>
                    Define the base prompt that will be used for this campaign
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="basePrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base Prompt</FormLabel>
                        <FormControl>
                          <Textarea
                            readOnly
                            disabled={true}
                            placeholder="Please confirm your appointment for {{appointmentDate}} at {{appointmentTime}}."
                            className="min-h-[200px]"
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <FormDescription className="flex flex-row items-center justify-between gap-2">
                          Click the "Fetch Prompt" button below to fetch the
                          current prompt for this agent.
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const agentId = form.getValues("agentId");
                                if (!agentId) {
                                  toast.error("Please select an agent first");
                                  return;
                                }

                                // Set the selected agent ID and wait for data
                                setSelectedAgentId(agentId);
                                toast.loading("Fetching prompt...", {
                                  id: "fetchPrompt",
                                });

                                // Give time for the data to load
                                setTimeout(() => {
                                  // Dismiss the loading toast
                                  toast.dismiss("fetchPrompt");

                                  if (llmData?.general_prompt) {
                                    form.setValue(
                                      "basePrompt",
                                      llmData.general_prompt,
                                    );
                                    toast.success(
                                      "Agent prompt fetched successfully",
                                    );
                                  } else if (error) {
                                    // Handle specific error cases
                                    if (
                                      error.message.includes(
                                        "getDefaultAgent is not a function",
                                      )
                                    ) {
                                      toast.error(
                                        "There appears to be an issue with the Retell SDK. Please contact your administrator.",
                                      );
                                    } else {
                                      toast.error(
                                        `Failed to fetch prompt: ${error.message}`,
                                      );
                                    }

                                    // Allow the user to continue without a valid LLM ID
                                    if (!form.getValues("llmId")) {
                                      form.setValue(
                                        "llmId",
                                        "placeholder_llm_id",
                                      );
                                      toast.warning(
                                        "Using placeholder LLM ID due to API issues. You can still save the form.",
                                        { duration: 5000 },
                                      );
                                    }
                                  } else {
                                    // Handle case where we couldn't get the prompt but don't have a clear error
                                    toast.error(
                                      "Unable to fetch prompt. The agent may not have a prompt configured.",
                                    );
                                  }
                                }, 1000);
                              } catch (error) {
                                toast.dismiss("fetchPrompt");
                                console.error("Error fetching prompt:", error);
                                toast.error("Failed to fetch agent prompt");
                              }
                            }}
                          >
                            Fetch Prompt
                          </Button>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center justify-between pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={prevStep}
            disabled={step === 0}
          >
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {step < steps.length - 1 ? (
              <Button type="button" onClick={nextStep}>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={createCampaignMutation.isPending}
                className="bg-primary"
              >
                {createCampaignMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Campaign"
                )}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}
