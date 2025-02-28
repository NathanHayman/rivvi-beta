"use client";

// src/components/admin/create-campaign-form.tsx
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

// Define the campaign creation schema
const campaignFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  orgId: z.string().uuid("Organization is required"),
  agentId: z.string().min(1, "Agent ID is required"),
  type: z.string().min(1, "Type is required"),

  // Config schema
  basePrompt: z.string().min(1, "Base prompt is required"),

  // Patient fields
  patientFields: z.array(
    z.object({
      key: z.string().min(1, "Key is required"),
      label: z.string().min(1, "Label is required"),
      possibleColumns: z.array(z.string()),
      transform: z
        .enum(["text", "date", "time", "phone", "provider"])
        .optional(),
      required: z.boolean().default(true),
      description: z.string().optional(),
    }),
  ),

  // Validation configuration
  patientValidation: z.object({
    requireValidPhone: z.boolean().default(true),
    requireValidDOB: z.boolean().default(true),
    requireName: z.boolean().default(true),
  }),

  // Campaign-specific fields
  campaignFields: z.array(
    z.object({
      key: z.string().min(1, "Key is required"),
      label: z.string().min(1, "Label is required"),
      possibleColumns: z.array(z.string()),
      transform: z
        .enum(["text", "date", "time", "phone", "provider"])
        .optional(),
      required: z.boolean().default(false),
      description: z.string().optional(),
    }),
  ),

  // Standard post-call fields
  standardPostCallFields: z.array(
    z.object({
      key: z.string().min(1, "Key is required"),
      label: z.string().min(1, "Label is required"),
      type: z.enum(["boolean", "string", "date", "enum"]),
      options: z.array(z.string()).optional(),
      required: z.boolean().default(true),
      description: z.string().optional(),
    }),
  ),

  // Campaign-specific post-call fields
  campaignPostCallFields: z.array(
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

  // Optional campaign request ID to link to
  requestId: z.string().uuid().optional(),
});

type CampaignFormValues = z.infer<typeof campaignFormSchema>;

interface CreateCampaignFormProps {
  organizations: Array<{ id: string; name: string }>;
  agents?: Array<{ agent_id: string; name: string }>;
  requestId?: string;
  onSuccess?: () => void;
}

export function CreateCampaignForm({
  organizations,
  agents = [],
  requestId,
  onSuccess,
}: CreateCampaignFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("general");

  // Setup form with default values
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: "",
      orgId: "",
      agentId: "",
      type: "",
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
          transform: "date",
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
      standardPostCallFields: [
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
      campaignPostCallFields: [],
      requestId,
    },
  });

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
    fields: standardPostCallFields,
    append: appendStandardField,
    remove: removeStandardField,
  } = useFieldArray({ control: form.control, name: "standardPostCallFields" });

  const {
    fields: campaignPostCallFields,
    append: appendCampaignPostCallField,
    remove: removeCampaignPostCallField,
  } = useFieldArray({ control: form.control, name: "campaignPostCallFields" });

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
      toast.error(`Error creating campaign: ${error.message}`);
    },
  });

  // Handle form submission
  const onSubmit = (values: CampaignFormValues) => {
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
      postCall: {
        standard: {
          fields: values.standardPostCallFields,
        },
        campaign: {
          fields: values.campaignPostCallFields,
        },
      },
    };

    createCampaignMutation.mutate({
      name: values.name,
      orgId: values.orgId,
      agentId: values.agentId,
      type: values.type,
      config,
      requestId: values.requestId,
    });
  };

  // Handle navigating between tabs
  const navigateToTab = (direction: "next" | "prev") => {
    const tabs = ["general", "variables", "postcall", "prompt"];
    const currentIndex = tabs.indexOf(activeTab);

    if (direction === "next" && currentIndex < tabs.length - 1) {
      // Validate current tab fields before proceeding
      let fieldsToValidate: Array<keyof CampaignFormValues> = [];

      switch (activeTab) {
        case "general":
          fieldsToValidate = ["name", "orgId", "agentId", "type"];
          break;
        case "variables":
          fieldsToValidate = ["patientFields", "campaignFields"];
          break;
        case "postcall":
          fieldsToValidate = [
            "standardPostCallFields",
            "campaignPostCallFields",
          ];
          break;
      }

      form.trigger(fieldsToValidate).then((isValid) => {
        if (isValid) {
          setActiveTab(tabs[currentIndex + 1] as any);
        }
      });
    } else if (direction === "prev" && currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1] as any);
    }
  };

  // Helper to add a new field
  const addNewField = (
    type: "patient" | "campaign" | "standardPostCall" | "campaignPostCall",
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
      case "standardPostCall":
        appendStandardField({
          ...baseField,
          type: "boolean",
        });
        break;
      case "campaignPostCall":
        appendCampaignPostCallField({
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
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="variables">Variables</TabsTrigger>
            <TabsTrigger value="postcall">Post-Call Data</TabsTrigger>
            <TabsTrigger value="prompt">Prompt</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Appointment Confirmations" {...field} />
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
                      {organizations.map((org) => (
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
                  {agents.length > 0 ? (
                    <Select
                      onValueChange={field.onChange}
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
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="appointment_confirmation">
                        Appointment Confirmation
                      </SelectItem>
                      <SelectItem value="annual_wellness">
                        Annual Wellness Visit
                      </SelectItem>
                      <SelectItem value="medication_adherence">
                        Medication Adherence
                      </SelectItem>
                      <SelectItem value="no_show_followup">
                        No-Show Follow-up
                      </SelectItem>
                      <SelectItem value="custom">Custom Campaign</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The type of campaign determines default fields and behavior
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          {/* Variables Tab */}
          <TabsContent value="variables" className="space-y-8">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium">Patient Fields</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addNewField("patient")}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Field
                </Button>
              </div>

              <div className="space-y-4">
                {patientFields.map((field, index) => (
                  <Card key={field.id}>
                    <CardContent className="pt-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`patientFields.${index}.key`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Field Key</FormLabel>
                              <FormControl>
                                <Input placeholder="firstName" {...field} />
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
                              <FormLabel>Display Label</FormLabel>
                              <FormControl>
                                <Input placeholder="First Name" {...field} />
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
                          name={`patientFields.${index}.possibleColumns`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Possible Column Names</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Patient First Name, first_name"
                                  value={field.value.join(", ")}
                                  onChange={(e) => {
                                    // Split by comma and trim each value
                                    const columns = e.target.value
                                      .split(",")
                                      .map((col) => col.trim())
                                      .filter(Boolean);
                                    field.onChange(columns);
                                  }}
                                />
                              </FormControl>
                              <FormDescription>
                                Comma-separated list of possible column names
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
                                  <SelectItem value="date">Date</SelectItem>
                                  <SelectItem value="time">Time</SelectItem>
                                  <SelectItem value="phone">Phone</SelectItem>
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
                          name={`patientFields.${index}.required`}
                          render={({ field }) => (
                            <FormItem className="mt-8 flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Required Field</FormLabel>
                                <FormDescription>
                                  Is this field required for valid data?
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />

                        <div className="flex justify-end md:mt-8">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removePatientField(index)}
                            disabled={index < 4} // Prevent removing first 4 default fields
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium">
                  Campaign-Specific Fields
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addNewField("campaign")}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Field
                </Button>
              </div>

              <div className="space-y-4">
                {campaignFields.map((field, index) => (
                  <Card key={field.id}>
                    <CardContent className="pt-4">
                      <div className="grid gap-4 md:grid-cols-2">
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
                          name={`campaignFields.${index}.possibleColumns`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Possible Column Names</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Appt Date, APPT_DATE"
                                  value={field.value.join(", ")}
                                  onChange={(e) => {
                                    // Split by comma and trim each value
                                    const columns = e.target.value
                                      .split(",")
                                      .map((col) => col.trim())
                                      .filter(Boolean);
                                    field.onChange(columns);
                                  }}
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
                                  <SelectItem value="date">Date</SelectItem>
                                  <SelectItem value="time">Time</SelectItem>
                                  <SelectItem value="phone">Phone</SelectItem>
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
                          name={`campaignFields.${index}.required`}
                          render={({ field }) => (
                            <FormItem className="mt-8 flex flex-row items-start space-x-3 space-y-0">
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

                        <div className="flex justify-end md:mt-8">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeCampaignField(index)}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {campaignFields.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    No campaign-specific fields defined yet. Add fields that are
                    unique to this campaign.
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Post-Call Data Tab */}
          <TabsContent value="postcall" className="space-y-8">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium">
                  Standard Post-Call Fields
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addNewField("standardPostCall")}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Field
                </Button>
              </div>

              <div className="space-y-4">
                {standardPostCallFields.map((field, index) => (
                  <Card key={field.id}>
                    <CardContent className="pt-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`standardPostCallFields.${index}.key`}
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
                          name={`standardPostCallFields.${index}.label`}
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
                          name={`standardPostCallFields.${index}.type`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Field Type</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select field type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="boolean">
                                    Boolean (Yes/No)
                                  </SelectItem>
                                  <SelectItem value="string">Text</SelectItem>
                                  <SelectItem value="date">Date</SelectItem>
                                  <SelectItem value="enum">
                                    Enum (Options)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`standardPostCallFields.${index}.required`}
                          render={({ field }) => (
                            <FormItem className="mt-8 flex flex-row items-start space-x-3 space-y-0">
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

                        <div className="flex justify-end md:mt-8">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeStandardField(index)}
                            disabled={index < 2} // Prevent removing first 2 default fields
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium">
                  Campaign-Specific Post-Call Fields
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addNewField("campaignPostCall")}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Field
                </Button>
              </div>

              <div className="space-y-4">
                {campaignPostCallFields.map((field, index) => (
                  <Card key={field.id}>
                    <CardContent className="pt-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`campaignPostCallFields.${index}.key`}
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
                          name={`campaignPostCallFields.${index}.label`}
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
                          name={`campaignPostCallFields.${index}.type`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Field Type</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select field type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="boolean">
                                    Boolean (Yes/No)
                                  </SelectItem>
                                  <SelectItem value="string">Text</SelectItem>
                                  <SelectItem value="date">Date</SelectItem>
                                  <SelectItem value="enum">
                                    Enum (Options)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`campaignPostCallFields.${index}.isMainKPI`}
                          render={({ field }) => (
                            <FormItem className="mt-8 flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Main KPI</FormLabel>
                                <FormDescription>
                                  Is this the main conversion metric?
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />

                        <div className="flex justify-end md:mt-8">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeCampaignPostCallField(index)}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {campaignPostCallFields.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    No campaign-specific post-call fields defined yet. These
                    fields capture key outcomes specific to this campaign.
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Prompt Tab */}
          <TabsContent value="prompt" className="space-y-4">
            <FormField
              control={form.control}
              name="basePrompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Prompt Template</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={20}
                      placeholder="You are a healthcare assistant calling to confirm a patient's appointment. The patient's name is {{firstName}} {{lastName}}..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {`Define the base prompt that the AI agent will use. Use variables like {{firstName}} for dynamic content.`}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigateToTab("prev")}
            disabled={activeTab === "general"}
          >
            Previous
          </Button>

          {activeTab !== "prompt" ? (
            <Button type="button" onClick={() => navigateToTab("next")}>
              Next
            </Button>
          ) : (
            <Button type="submit" disabled={createCampaignMutation.isPending}>
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
      </form>
    </Form>
  );
}
