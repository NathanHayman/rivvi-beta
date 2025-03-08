"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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
import { TagInput } from "@/components/ui/tag-input";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdminAgents,
  useAdminOrganizations,
  useCreateCampaign,
} from "@/hooks/use-admin";
import {
  convertPostCallToAnalysisFields,
  getAgentComplete,
} from "@/lib/retell/retell-client-safe";
import { Badge } from "../ui/badge";
import { SheetFooter } from "../ui/sheet";

// Define the campaign creation schema
const campaignFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  orgId: z.string().uuid("Organization is required"),
  agentId: z.string().min(1, "Agent ID is required"),
  llmId: z.string().min(1, "Retell AI llm ID is required"),
  direction: z.string().min(1, "Direction is required"),
  basePrompt: z.string().min(1, "Base prompt is required"),
  voicemailMessage: z.string().optional(),
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
  configureWebhooks: z.boolean().default(true),
  webhookUrls: z
    .object({
      inbound: z.string().optional(),
      postCall: z.string().optional(),
    })
    .optional(),
});

type CampaignFormValues = z.infer<typeof campaignFormSchema>;

interface CreateCampaignFormProps {
  requestId?: string;
  onSuccess?: () => void;
}

export function CampaignCreateForm({
  requestId,
  onSuccess,
}: CreateCampaignFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const steps = ["Campaign Details", "Variables", "Analysis", "Prompt"];
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isLoadingAgent, setIsLoadingAgent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isConfiguringWebhooks, setIsConfiguringWebhooks] = useState(false);
  const [webhooksConfigured, setWebhooksConfigured] = useState(false);
  const [isVerifyingAgent, setIsVerifyingAgent] = useState(false);

  // Use the custom hooks for admin data
  const { data: agents } = useAdminAgents();
  const { data: organizations } = useAdminOrganizations();

  // Use the createCampaign mutation
  const { mutateAsync: createCampaign, isPending: isCreating } =
    useCreateCampaign();

  // Setup form with default values
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: "",
      description: "Auto-generated template",
      orgId: "",
      agentId: "",
      llmId: "",
      direction: "outbound",
      basePrompt: "",
      voicemailMessage: "",
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
      configureWebhooks: true,
    },
  });

  // Watch webhook URLs for reactive updates
  const webhookUrls = form.watch("webhookUrls");
  const agentId = form.watch("agentId");
  const orgId = form.watch("orgId");
  const direction = form.watch("direction");

  // Handle agent selection and data loading
  useEffect(() => {
    // Check if agent ID is already set when component mounts
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

  // Fetch agent data when agent ID changes
  useEffect(() => {
    async function fetchAgentData() {
      if (!selectedAgentId) return;

      setIsLoadingAgent(true);
      try {
        // Use the client-safe Retell client to get agent data
        const agentData = await getAgentComplete(selectedAgentId);

        // Set LLM ID in form
        form.setValue("llmId", agentData.combined.llm_id);

        // Set base prompt
        if (
          !form.getValues("basePrompt") ||
          form.getValues("basePrompt") === ""
        ) {
          form.setValue("basePrompt", agentData.combined.general_prompt);
        }

        // Set voicemail message if available
        if (agentData.combined.voicemail_message) {
          form.setValue(
            "voicemailMessage",
            agentData.combined.voicemail_message,
          );
        }

        // Process post-call analysis fields if available
        if (agentData.combined.post_call_analysis_data?.length > 0) {
          const { standardFields, campaignFields } =
            convertPostCallToAnalysisFields(
              agentData.combined.post_call_analysis_data,
            );

          if (standardFields.length > 0) {
            form.setValue("standardAnalysisFields", standardFields);
          }

          if (campaignFields.length > 0) {
            form.setValue("campaignAnalysisFields", campaignFields);
          }
        }

        toast.success("Agent data loaded successfully");
      } catch (error) {
        console.error("Error fetching agent data:", error);
        toast.error(
          `Failed to load agent data: ${error instanceof Error ? error.message : "Unknown error"}`,
        );

        // Set a placeholder LLM ID to allow the form submission
        if (!form.getValues("llmId")) {
          form.setValue("llmId", "placeholder_llm_id");
          toast.warning(
            "Using placeholder LLM ID due to API issues. You can still save the form.",
            { duration: 5000 },
          );
        }
      } finally {
        setIsLoadingAgent(false);
      }
    }

    void fetchAgentData();
  }, [selectedAgentId, form]);

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

  // Handle form submission
  const onSubmit = (values: CampaignFormValues) => {
    // Convert the form values to the API format
    const campaignData = {
      name: values.name,
      description: values.description,
      orgId: values.orgId,
      direction: values.direction,
      config: {
        agentId: values.agentId,
        llmId: values.llmId,
        basePrompt: values.basePrompt,
        voicemailMessage: values.voicemailMessage,
        variables: {
          patient: {
            fields: values.patientFields,
          },
          campaign: {
            fields: values.campaignFields,
          },
        },
        validation: values.patientValidation,
        analysis: {
          standard: {
            fields: values.standardAnalysisFields,
          },
          campaign: {
            fields: values.campaignAnalysisFields,
          },
        },
        webhooks: values.configureWebhooks
          ? {
              inbound: values.webhookUrls?.inbound,
              postCall: values.webhookUrls?.postCall,
            }
          : undefined,
      },
      requestId: values.requestId,
    };

    // Submit the campaign data
    createCampaign(campaignData)
      .then((response) => {
        toast.success("Campaign created successfully");
        if (onSuccess) {
          onSuccess();
        } else {
          router.push(`/admin/campaigns/${response.id}`);
        }
      })
      .catch((error) => {
        toast.error(`Failed to create campaign: ${error.message}`);
      });
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
    if (isValid) {
      setStep((prev) => Math.min(prev + 1, steps.length - 1));
      // Scroll to top when changing steps
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    }
  };

  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 0));
    // Scroll to top when changing steps
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="relative">
        {/* Step indicator */}
        <div className="bg-gray-50 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            {steps.map((stepName, index) => (
              <button
                key={stepName}
                type="button"
                onClick={() => (index < step ? setStep(index) : null)}
                disabled={index > step}
                className={`flex flex-1 flex-col items-center ${
                  index > step
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer"
                }`}
                tabIndex={index > step ? -1 : 0}
              >
                <div
                  className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full ${
                    index === step
                      ? "bg-primary text-white"
                      : index < step
                        ? "bg-primary/20 text-primary"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {index + 1}
                </div>
                <span
                  className={`text-xs ${index === step ? "font-medium text-primary" : "text-gray-500"}`}
                >
                  {stepName}
                </span>
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="h-[calc(80vh-95px)]" ref={scrollRef}>
          <div className="p-6">
            {/* Step 1: Campaign Details */}
            {step === 0 && (
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="campaign-name">
                          Campaign Name
                        </FormLabel>
                        <FormControl>
                          <Input
                            id="campaign-name"
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
                        <FormLabel htmlFor="organization">
                          Organization
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger id="organization">
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
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="agentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="agent">Retell Agent</FormLabel>
                        {agents?.length > 0 ? (
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger id="agent">
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
                            <Input
                              id="agent"
                              placeholder="agent_abc123"
                              {...field}
                            />
                          </FormControl>
                        )}
                        <FormDescription>
                          The Retell AI agent to use for this campaign
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
                        <FormLabel htmlFor="direction">
                          Campaign Direction
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger id="direction">
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
                </div>

                <FormField
                  control={form.control}
                  name="llmId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="llm-id">Retell AI LLM ID</FormLabel>
                      <FormControl>
                        <Input
                          id="llm-id"
                          readOnly
                          disabled={true}
                          placeholder={
                            isLoadingAgent
                              ? "Loading..."
                              : "Select an agent to populate this field"
                          }
                          className={
                            !field.value ? "italic text-muted-foreground" : ""
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        This field is automatically populated based on the
                        selected agent
                        {isLoadingAgent && (
                          <span className="ml-2">⏳ Loading...</span>
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-md border p-4">
                    <div className="flex items-center justify-between">
                      <Checkbox
                        className="size-6"
                        checked={form.watch("configureWebhooks")}
                        onCheckedChange={(checked) =>
                          form.setValue("configureWebhooks", checked === true)
                        }
                      >
                        Configure webhooks for this campaign
                      </Checkbox>
                      <div>
                        <h4 className="font-medium">
                          Configure Agent Webhooks
                        </h4>
                        <p className="text-gray-500 text-sm">
                          Update the Retell agent with appropriate webhook URLs
                          for inbound calls and post-call analysis
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Variables */}
            {step === 1 && (
              <div className="space-y-8">
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">Patient Fields</h3>
                      <p className="text-gray-500 text-sm">
                        Define the patient data fields required for this
                        campaign
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addNewField("patient")}
                      className="flex items-center"
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add Field
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {patientFields.map((field, index) => (
                      <div
                        key={field.id}
                        className="overflow-hidden rounded-lg border bg-white"
                      >
                        <div className="bg-gray-50 flex items-center justify-between border-b p-4">
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
                            className="text-gray-500 hover:text-gray-700 h-8 w-8 p-0"
                            aria-label={`Remove ${form.watch(`patientFields.${index}.label`) || "field"}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid gap-4 p-4 md:grid-cols-2">
                          <div>
                            <FormField
                              control={form.control}
                              name={`patientFields.${index}.key`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel
                                    htmlFor={`patient-field-key-${index}`}
                                  >
                                    Field Key
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      id={`patient-field-key-${index}`}
                                      placeholder="firstName"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormDescription className="text-xs">
                                    Variable name in the system
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div>
                            <FormField
                              control={form.control}
                              name={`patientFields.${index}.label`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel
                                    htmlFor={`patient-field-label-${index}`}
                                  >
                                    Display Label
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      id={`patient-field-label-${index}`}
                                      placeholder="First Name"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormDescription className="text-xs">
                                    Human-readable field name
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div>
                            <FormField
                              control={form.control}
                              name={`patientFields.${index}.transform`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel
                                    htmlFor={`patient-field-transform-${index}`}
                                  >
                                    Transform Type
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger
                                        id={`patient-field-transform-${index}`}
                                      >
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
                                  <FormDescription className="text-xs">
                                    How to transform the input data
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div>
                            <FormField
                              control={form.control}
                              name={`patientFields.${index}.possibleColumns`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel
                                    htmlFor={`patient-field-columns-${index}`}
                                  >
                                    Possible Column Names
                                  </FormLabel>
                                  <FormControl>
                                    <TagInput
                                      // id={`patient-field-columns-${index}`}
                                      initialTags={field.value || []}
                                      onTagsChange={(tags) =>
                                        field.onChange(tags)
                                      }
                                      placeholder="Type and press Enter to add column names"
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
                          </div>

                          <div className="md:col-span-2">
                            <FormField
                              control={form.control}
                              name={`patientFields.${index}.required`}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      id={`patient-field-required-${index}`}
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel
                                      htmlFor={`patient-field-required-${index}`}
                                    >
                                      Required Field
                                    </FormLabel>
                                    <FormDescription className="text-xs">
                                      Is this field required for valid data?
                                    </FormDescription>
                                  </div>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">
                        Campaign-Specific Fields
                      </h3>
                      <p className="text-gray-500 text-sm">
                        Define additional fields specific to this campaign
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addNewField("campaign")}
                      className="flex items-center"
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add Field
                    </Button>
                  </div>

                  {campaignFields.length > 0 ? (
                    <div className="space-y-4">
                      {campaignFields.map((field, index) => (
                        <div
                          key={field.id}
                          className="overflow-hidden rounded-lg border bg-white"
                        >
                          <div className="bg-gray-50 flex items-center justify-between border-b p-4">
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
                              className="text-gray-500 hover:text-gray-700 h-8 w-8 p-0"
                              aria-label={`Remove ${form.watch(`campaignFields.${index}.label`) || "field"}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid gap-4 p-4 md:grid-cols-2">
                            <div>
                              <FormField
                                control={form.control}
                                name={`campaignFields.${index}.key`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel
                                      htmlFor={`campaign-field-key-${index}`}
                                    >
                                      Field Key
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        id={`campaign-field-key-${index}`}
                                        placeholder="appointmentDate"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div>
                              <FormField
                                control={form.control}
                                name={`campaignFields.${index}.label`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel
                                      htmlFor={`campaign-field-label-${index}`}
                                    >
                                      Display Label
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        id={`campaign-field-label-${index}`}
                                        placeholder="Appointment Date"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div>
                              <FormField
                                control={form.control}
                                name={`campaignFields.${index}.transform`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel
                                      htmlFor={`campaign-field-transform-${index}`}
                                    >
                                      Transform Type
                                    </FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
                                    >
                                      <FormControl>
                                        <SelectTrigger
                                          id={`campaign-field-transform-${index}`}
                                        >
                                          <SelectValue placeholder="Select transform" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="text">
                                          Text
                                        </SelectItem>
                                        <SelectItem value="short_date">
                                          Short Date
                                        </SelectItem>
                                        <SelectItem value="long_date">
                                          Long Date
                                        </SelectItem>
                                        <SelectItem value="time">
                                          Time
                                        </SelectItem>
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
                            </div>

                            <div>
                              <FormField
                                control={form.control}
                                name={`campaignFields.${index}.possibleColumns`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel
                                      htmlFor={`campaign-field-columns-${index}`}
                                    >
                                      Possible Column Names
                                    </FormLabel>
                                    <FormControl>
                                      <TagInput
                                        // id={`campaign-field-columns-${index}`}
                                        initialTags={field.value || []}
                                        onTagsChange={(tags) =>
                                          field.onChange(tags)
                                        }
                                        placeholder="Type and press Enter to add column names"
                                      />
                                    </FormControl>
                                    <FormDescription className="text-xs">
                                      Column names that might match this field
                                      in uploaded data
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="md:col-span-2">
                              <FormField
                                control={form.control}
                                name={`campaignFields.${index}.required`}
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        id={`campaign-field-required-${index}`}
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                      <FormLabel
                                        htmlFor={`campaign-field-required-${index}`}
                                      >
                                        Required Field
                                      </FormLabel>
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
                    <div className="border-gray-300 flex h-32 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                      <p className="text-gray-500 text-sm">
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
                </div>
              </div>
            )}

            {/* Step 3: Analysis */}
            {step === 2 && (
              <div className="space-y-8">
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">
                        Standard Analysis Fields
                      </h3>
                      <p className="text-gray-500 text-sm">
                        Define the standard metrics to track for this campaign
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addNewField("standardAnalysis")}
                      className="flex items-center"
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add Field
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {standardAnalysisFields.map((field, index) => (
                      <div
                        key={field.id}
                        className="overflow-hidden rounded-lg border bg-white"
                      >
                        <div className="bg-gray-50 flex items-center justify-between border-b p-4">
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
                            className="text-gray-500 hover:text-gray-700 h-8 w-8 p-0"
                            aria-label={`Remove ${form.watch(`standardAnalysisFields.${index}.label`) || "field"}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid gap-4 p-4 md:grid-cols-2">
                          <div>
                            <FormField
                              control={form.control}
                              name={`standardAnalysisFields.${index}.key`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel
                                    htmlFor={`standard-analysis-key-${index}`}
                                  >
                                    Field Key
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      id={`standard-analysis-key-${index}`}
                                      placeholder="patient_reached"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div>
                            <FormField
                              control={form.control}
                              name={`standardAnalysisFields.${index}.label`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel
                                    htmlFor={`standard-analysis-label-${index}`}
                                  >
                                    Display Label
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      id={`standard-analysis-label-${index}`}
                                      placeholder="Patient Reached"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div>
                            <FormField
                              control={form.control}
                              name={`standardAnalysisFields.${index}.type`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel
                                    htmlFor={`standard-analysis-type-${index}`}
                                  >
                                    Field Type
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger
                                        id={`standard-analysis-type-${index}`}
                                      >
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
                          </div>

                          {form.watch(
                            `standardAnalysisFields.${index}.type`,
                          ) === "enum" && (
                            <div>
                              <FormField
                                control={form.control}
                                name={`standardAnalysisFields.${index}.options`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel
                                      htmlFor={`standard-analysis-options-${index}`}
                                    >
                                      Options
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        id={`standard-analysis-options-${index}`}
                                        placeholder="Option1, Option2, Option3"
                                        value={field.value?.join(", ") || ""}
                                        onChange={(e) => {
                                          const inputValue = e.target.value;
                                          field.onChange(
                                            inputValue
                                              ? inputValue
                                                  .split(",")
                                                  .map((v) => v.trim())
                                                  .filter(Boolean)
                                              : [],
                                          );
                                        }}
                                      />
                                    </FormControl>
                                    <FormDescription className="text-xs">
                                      Possible values for this enum field (comma
                                      separated)
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          )}

                          <div className="md:col-span-2">
                            <FormField
                              control={form.control}
                              name={`standardAnalysisFields.${index}.required`}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      id={`standard-analysis-required-${index}`}
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel
                                      htmlFor={`standard-analysis-required-${index}`}
                                    >
                                      Required Field
                                    </FormLabel>
                                  </div>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">
                        Campaign-Specific Analysis Fields
                      </h3>
                      <p className="text-gray-500 text-sm">
                        Define additional metrics specific to this campaign
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addNewField("campaignAnalysis")}
                      className="flex items-center"
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add Field
                    </Button>
                  </div>

                  {campaignAnalysisFields.length > 0 ? (
                    <div className="space-y-4">
                      {campaignAnalysisFields.map((field, index) => (
                        <div
                          key={field.id}
                          className="overflow-hidden rounded-lg border bg-white"
                        >
                          <div className="bg-gray-50 flex items-center justify-between border-b p-4">
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
                              className="text-gray-500 hover:text-gray-700 h-8 w-8 p-0"
                              aria-label={`Remove ${form.watch(`campaignAnalysisFields.${index}.label`) || "field"}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid gap-4 p-4 md:grid-cols-2">
                            <div>
                              <FormField
                                control={form.control}
                                name={`campaignAnalysisFields.${index}.key`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel
                                      htmlFor={`campaign-analysis-key-${index}`}
                                    >
                                      Field Key
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        id={`campaign-analysis-key-${index}`}
                                        placeholder="appointment_confirmed"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div>
                              <FormField
                                control={form.control}
                                name={`campaignAnalysisFields.${index}.label`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel
                                      htmlFor={`campaign-analysis-label-${index}`}
                                    >
                                      Display Label
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        id={`campaign-analysis-label-${index}`}
                                        placeholder="Appointment Confirmed"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div>
                              <FormField
                                control={form.control}
                                name={`campaignAnalysisFields.${index}.type`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel
                                      htmlFor={`campaign-analysis-type-${index}`}
                                    >
                                      Field Type
                                    </FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
                                    >
                                      <FormControl>
                                        <SelectTrigger
                                          id={`campaign-analysis-type-${index}`}
                                        >
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
                                        <SelectItem value="date">
                                          Date
                                        </SelectItem>
                                        <SelectItem value="enum">
                                          Enum
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            {form.watch(
                              `campaignAnalysisFields.${index}.type`,
                            ) === "enum" && (
                              <div>
                                <FormField
                                  control={form.control}
                                  name={`campaignAnalysisFields.${index}.options`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel
                                        htmlFor={`campaign-analysis-options-${index}`}
                                      >
                                        Options
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          id={`campaign-analysis-options-${index}`}
                                          placeholder="Option1, Option2, Option3"
                                          value={field.value?.join(", ") || ""}
                                          onChange={(e) => {
                                            const inputValue = e.target.value;
                                            field.onChange(
                                              inputValue
                                                ? inputValue
                                                    .split(",")
                                                    .map((v) => v.trim())
                                                    .filter(Boolean)
                                                : [],
                                            );
                                          }}
                                        />
                                      </FormControl>
                                      <FormDescription className="text-xs">
                                        Possible values for this enum field
                                        (comma separated)
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}

                            <div className="flex space-x-4 md:col-span-2">
                              <FormField
                                control={form.control}
                                name={`campaignAnalysisFields.${index}.required`}
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        id={`campaign-analysis-required-${index}`}
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                      <FormLabel
                                        htmlFor={`campaign-analysis-required-${index}`}
                                      >
                                        Required
                                      </FormLabel>
                                    </div>
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name={`campaignAnalysisFields.${index}.isMainKPI`}
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        id={`campaign-analysis-kpi-${index}`}
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                      <FormLabel
                                        htmlFor={`campaign-analysis-kpi-${index}`}
                                      >
                                        Main KPI
                                      </FormLabel>
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
                    <div className="border-gray-300 flex h-32 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                      <p className="text-gray-500 text-sm">
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
                </div>
              </div>
            )}

            {/* Step 4: Prompt */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="overflow-hidden rounded-lg border bg-white">
                  <div className="bg-gray-50 border-b p-4">
                    <h3 className="text-lg font-medium">Campaign Prompt</h3>
                    <p className="text-gray-500 text-sm">
                      Define the base prompt that will be used for this campaign
                    </p>
                  </div>
                  <div className="p-4">
                    <FormField
                      control={form.control}
                      name="basePrompt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel htmlFor="base-prompt">
                            Base Prompt
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              id="base-prompt"
                              placeholder="Please confirm your appointment for {{appointmentDate}} at {{appointmentTime}}."
                              className="min-h-[200px]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            This is the base prompt that will be used for the
                            agent's conversations.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border bg-white">
                  <div className="bg-gray-50 border-b p-4">
                    <h3 className="text-lg font-medium">Voicemail Message</h3>
                    <p className="text-gray-500 text-sm">
                      Define the voicemail message that will be used when calls
                      go to voicemail
                    </p>
                  </div>
                  <div className="p-4">
                    <FormField
                      control={form.control}
                      name="voicemailMessage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel htmlFor="voicemail-message">
                            Voicemail Message
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              id="voicemail-message"
                              placeholder="Hello, this message is for {{firstName}}. We're calling about your upcoming appointment. Please call us back at 555-123-4567."
                              className="min-h-[150px]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            This message will be used when calls go to
                            voicemail.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="flex justify-between">
          {step > 0 ? (
            <Button type="button" variant="outline" onClick={prevStep}>
              Previous
            </Button>
          ) : (
            <div />
          )}
          {step < steps.length - 1 ? (
            <Button type="button" onClick={nextStep}>
              Next
            </Button>
          ) : (
            <Button type="submit" disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Campaign"
              )}
            </Button>
          )}
        </SheetFooter>
      </form>
    </Form>
  );
}
