"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { processCampaignRequest } from "@/server/actions/campaigns/request";
import { AccessibleTagInput } from "./utils/accessible-tag-input";

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
  requestId: propRequestId,
  onSuccess,
}: CreateCampaignFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlRequestId = searchParams?.get("requestId");
  const urlOrgId = searchParams?.get("orgId");

  const [step, setStep] = useState(0);
  const steps = ["Campaign Details", "Variables", "Analysis", "Prompt"];
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isLoadingAgent, setIsLoadingAgent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      configureWebhooks: true,
    },
  });

  // Use the query parameter requestId if available
  useEffect(() => {
    if (urlRequestId) {
      form.setValue("requestId", urlRequestId);
    } else if (propRequestId) {
      form.setValue("requestId", propRequestId);
    }

    if (urlOrgId) {
      form.setValue("orgId", urlOrgId);
    }
  }, [urlRequestId, urlOrgId, propRequestId, form]);

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
        // Ensure agent ID is properly formatted
        const formattedAgentId = selectedAgentId.startsWith("agent_")
          ? selectedAgentId
          : `agent_${selectedAgentId}`;

        console.log("Fetching agent data for:", formattedAgentId);

        // Use the client-safe Retell client to get agent data
        const agentData = await getAgentComplete(formattedAgentId);
        const { agent, llm, combined } = agentData;

        // Set LLM ID in form
        form.setValue("llmId", llm.llm_id);

        // Set base prompt
        if (
          !form.getValues("basePrompt") ||
          form.getValues("basePrompt") === ""
        ) {
          form.setValue("basePrompt", llm.general_prompt);
        }

        // Set voicemail message if available
        if (agent.voicemail_message) {
          form.setValue("voicemailMessage", agent.voicemail_message);
        }

        // Process post-call analysis fields if available
        if (combined.post_call_analysis_data?.length > 0) {
          const { standardFields, campaignFields } =
            await convertPostCallToAnalysisFields(
              combined.post_call_analysis_data,
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
    // Ensure agent ID and LLM ID are properly formatted
    if (!values.agentId) {
      toast.error("Agent ID is required");
      return;
    }

    if (!values.llmId) {
      toast.error("LLM ID is required");
      return;
    }

    // Format agent ID and LLM ID with proper prefixes if needed
    const formattedAgentId = values.agentId.startsWith("agent_")
      ? values.agentId
      : `agent_${values.agentId}`;

    const formattedLlmId = values.llmId.startsWith("llm_")
      ? values.llmId
      : `llm_${values.llmId}`;

    // Convert the form values to the API format
    const campaignData = {
      name: values.name,
      description: values.description,
      orgId: values.orgId,
      direction: values.direction,
      agentId: formattedAgentId,
      llmId: formattedLlmId,
      basePrompt: values.basePrompt,
      voicemailMessage: values.voicemailMessage,
      variablesConfig: {
        patient: {
          fields: values.patientFields,
        },
        campaign: {
          fields: values.campaignFields,
        },
      },
      validation: values.patientValidation,
      analysisConfig: {
        standard: {
          fields: values.standardAnalysisFields,
        },
        campaign: {
          fields: values.campaignAnalysisFields,
        },
      },
      configureWebhooks: values.configureWebhooks,
      webhookUrls: values.configureWebhooks
        ? {
            inbound: values.webhookUrls?.inbound,
            postCall: values.webhookUrls?.postCall,
          }
        : undefined,
      requestId: values.requestId,
    };

    // Submit the campaign data
    createCampaign(campaignData)
      .then((response) => {
        if (response.success) {
          toast.success("Campaign created successfully");

          // If we have a requestId, update the request to mark it as completed and link to the campaign
          if (values.requestId) {
            processCampaignRequest({
              requestId: values.requestId,
              status: "completed",
              adminNotes: "Campaign created successfully",
              resultingCampaignId: response.data.id,
            })
              .then(() => {
                console.log("Campaign request updated successfully");
              })
              .catch((error) => {
                console.error("Failed to update campaign request:", error);
              });
          }

          if (onSuccess) {
            onSuccess();
          } else {
            router.push(`/admin/campaigns/${response.data.id}`);
          }
        } else {
          // Type assertion to help TypeScript understand the structure
          const errorResponse = response as {
            success: false;
            error: { message: string };
          };
          toast.error(
            `Failed to create campaign: ${errorResponse.error.message}`,
          );
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
        {/* Improved Step indicator */}
        <div className="mb-8 rounded-lg bg-card">
          <div className="relative">
            <div className="absolute left-0 top-0 h-2 w-full overflow-hidden rounded-t-lg bg-primary/20">
              <div
                className="h-full bg-primary transition-all duration-300 ease-in-out"
                style={{ width: `${((step + 1) / steps.length) * 100}%` }}
              />
            </div>
            <div className="px-8 pb-4 pt-6">
              <div className="flex items-center justify-between">
                {steps.map((stepName, index) => (
                  <div key={stepName} className="flex flex-col items-center">
                    <button
                      type="button"
                      onClick={() => (index <= step ? setStep(index) : null)}
                      disabled={index > step}
                      className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary transition-all duration-200 ${
                        index === step
                          ? "bg-primary text-white shadow-md"
                          : index < step
                            ? "bg-primary/10 text-primary"
                            : "border-muted-foreground/30 bg-muted text-muted-foreground"
                      } ${index <= step ? "cursor-pointer hover:shadow-sm" : "cursor-not-allowed"} `}
                      aria-current={index === step ? "step" : undefined}
                    >
                      {index < step ? (
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </button>
                    <span
                      className={`mt-2 whitespace-nowrap text-sm font-medium ${index === step ? "text-primary" : "text-muted-foreground"} `}
                    >
                      {stepName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card shadow-sm">
          <div className="border-b p-6">
            <h2 className="text-xl font-semibold text-foreground">
              {steps[step]}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === 0 && "Set up the basic details for your new campaign"}
              {step === 1 && "Define the patient and campaign field variables"}
              {step === 2 &&
                "Configure analysis fields for tracking campaign metrics"}
              {step === 3 && "Review and set the prompt for your campaign"}
            </p>
          </div>

          <ScrollArea className="h-[calc(80vh-220px)]" ref={scrollRef}>
            <div className="p-6">
              {/* Step 1: Campaign Details */}
              {step === 0 && (
                <div className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-medium text-foreground">
                              Campaign Name
                            </FormLabel>
                            <FormControl>
                              <Input
                                id="campaign-name"
                                placeholder="Appointment Confirmations"
                                className="bg-background"
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
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-medium text-foreground">
                              Description
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Brief description of the campaign purpose"
                                className="resize-none bg-background"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Optional details about this campaign
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-6">
                      <FormField
                        control={form.control}
                        name="orgId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-medium text-foreground">
                              Organization
                            </FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="bg-background">
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
                        name="direction"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-medium text-foreground">
                              Campaign Direction
                            </FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="bg-background">
                                  <SelectValue placeholder="Select direction" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="outbound">
                                  Outbound
                                </SelectItem>
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

                      <FormField
                        control={form.control}
                        name="agentId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-medium text-foreground">
                              Retell Agent
                            </FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="bg-background">
                                  <SelectValue placeholder="Select an agent" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {agents?.map((agent) => (
                                  <SelectItem
                                    key={agent.agent_id}
                                    value={agent.agent_id}
                                  >
                                    {agent.agent_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              The Retell AI agent to use for this campaign
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {isLoadingAgent && (
                        <div className="flex animate-pulse items-center space-x-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Loading agent data...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="configureWebhooks"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border bg-accent/5 p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="font-medium text-foreground">
                            Configure Agent Webhooks
                          </FormLabel>
                          <FormDescription>
                            Update the Retell agent with appropriate webhook
                            URLs for inbound calls and post-call analysis
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Step 2: Variables */}
              {step === 1 && (
                <div className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium leading-6">
                          Patient Fields
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Define the patient data fields required for this
                          campaign
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => addNewField("patient")}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <Plus className="h-4 w-4" />
                        Add Field
                      </Button>
                    </div>

                    <div className="space-y-6">
                      {patientFields.map((field, index) => (
                        <div
                          key={field.id}
                          className="relative rounded-lg border bg-card p-4"
                        >
                          <div className="grid gap-5 md:grid-cols-2">
                            <FormField
                              control={form.control}
                              name={`patientFields.${index}.key`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="font-medium text-foreground">
                                    Field Key
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="firstName"
                                      className="bg-background"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormDescription>
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
                                  <FormLabel className="font-medium text-foreground">
                                    Display Label
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="First Name"
                                      className="bg-background"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormDescription>
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
                                  <FormLabel className="font-medium text-foreground">
                                    Transform Type
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background">
                                        <SelectValue placeholder="Text" />
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
                                  <FormDescription>
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
                                  <FormLabel className="font-medium text-foreground">
                                    Possible Column Names
                                  </FormLabel>
                                  <FormControl>
                                    <AccessibleTagInput
                                      placeholder="Add column names..."
                                      value={field.value}
                                      onChange={(newTags) =>
                                        form.setValue(
                                          `patientFields.${index}.possibleColumns`,
                                          newTags,
                                        )
                                      }
                                      label={`Possible column names for ${form.watch(`patientFields.${index}.label`) || "field"}`}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Column names that might match this field in
                                    uploaded data
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="mt-4">
                            <FormField
                              control={form.control}
                              name={`patientFields.${index}.required`}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="font-medium text-foreground">
                                      Required Field
                                    </FormLabel>
                                    <FormDescription>
                                      Is this field required for valid data?
                                    </FormDescription>
                                  </div>
                                </FormItem>
                              )}
                            />
                          </div>

                          {patientFields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removePatientField(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium leading-6">
                          Campaign-Specific Fields
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Define additional fields specific to this campaign
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => addNewField("campaign")}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <Plus className="h-4 w-4" />
                        Add Field
                      </Button>
                    </div>

                    {campaignFields.length === 0 ? (
                      <div className="rounded-lg border border-dashed bg-muted/20 py-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          No campaign-specific fields added yet
                        </p>
                        <Button
                          type="button"
                          onClick={() => addNewField("campaign")}
                          variant="ghost"
                          size="sm"
                          className="mt-2"
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          Add Your First Field
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Same structure as patientFields but for campaignFields */}
                        {/* Similar rendering logic for campaign fields */}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Analysis */}
              {step === 2 && (
                <div className="space-y-8">
                  {/* Similar rendering logic as in Step 2 but for analysis fields */}
                  {/* Standard Analysis Fields section */}
                  {/* Campaign Analysis Fields section */}
                </div>
              )}

              {/* Step 4: Prompt */}
              {step === 3 && (
                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="basePrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-foreground">
                          Base Prompt
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter the base prompt for the AI agent..."
                            className="min-h-[300px] bg-background font-mono text-sm leading-relaxed"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          This is the base prompt that will be used for the AI
                          agent. You can use variables like {"{firstName}"} in
                          the prompt.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="voicemailMessage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-medium text-foreground">
                          Voicemail Message
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Message to leave if voicemail is detected..."
                            className="min-h-[150px] bg-background"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Optional message to leave if the call goes to
                          voicemail
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between border-t bg-muted/10 p-6">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={step === 0}
              className="gap-1"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Previous
            </Button>

            {step === steps.length - 1 ? (
              <Button type="submit" disabled={isCreating} className="gap-1">
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Campaign
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </>
                )}
              </Button>
            ) : (
              <Button type="button" onClick={nextStep} className="gap-1">
                Next
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}
