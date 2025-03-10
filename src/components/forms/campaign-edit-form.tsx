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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { env } from "@/env";
import { updateCampaignWithWebhooks } from "@/lib/retell/retell-actions";
import { updateAgentWebhooks } from "@/lib/retell/retell-client-safe";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { SheetBody, SheetFooter } from "../ui/sheet";
// Import server actions
import { useUpdateCampaign } from "@/hooks/campaigns/use-campaigns";
import { getCampaignById } from "@/server/actions/campaigns";
import { ZCampaignWithTemplate } from "@/types/zod";
import { AccessibleTagInput } from "./utils/accessible-tag-input";

// Form schema
const campaignFormSchema = z.object({
  name: z.string().min(3, {
    message: "Campaign name must be at least 3 characters.",
  }),
  direction: z.string({
    required_error: "Please select a campaign direction.",
  }),
  isActive: z.boolean().default(true),
  basePrompt: z.string().min(10, {
    message: "Base prompt must be at least 10 characters.",
  }),
  inboundWebhookUrl: z.string().url().optional().or(z.literal("")),
  postCallWebhookUrl: z.string().url().optional().or(z.literal("")),
  voicemailMessage: z.string().optional().or(z.literal("")),
  variablesConfig: z
    .object({
      patient: z
        .object({
          fields: z
            .array(
              z.object({
                key: z.string(),
                label: z.string(),
                possibleColumns: z.array(z.string()),
                transform: z.string(),
                required: z.boolean().default(false),
                description: z.string().optional().or(z.literal("")),
              }),
            )
            .default([]),
          validation: z
            .object({
              requireValidPhone: z.boolean().default(false),
              requireValidDOB: z.boolean().default(false),
              requireName: z.boolean().default(false),
            })
            .default({}),
        })
        .default({}),
      campaign: z
        .object({
          fields: z
            .array(
              z.object({
                key: z.string(),
                label: z.string(),
                possibleColumns: z.array(z.string()),
                transform: z.string(),
                required: z.boolean().default(false),
                description: z.string().optional().or(z.literal("")),
              }),
            )
            .default([]),
        })
        .default({}),
    })
    .default({}),
  analysisConfig: z
    .object({
      standard: z
        .object({
          fields: z
            .array(
              z.object({
                key: z.string(),
                label: z.string(),
                type: z.string(),
                options: z.array(z.string()).default([]),
                required: z.boolean().default(false),
                description: z.string().optional().or(z.literal("")),
              }),
            )
            .default([]),
        })
        .default({}),
      campaign: z
        .object({
          fields: z
            .array(
              z.object({
                key: z.string(),
                label: z.string(),
                type: z.string(),
                options: z.array(z.string()).default([]),
                required: z.boolean().default(false),
                description: z.string().optional().or(z.literal("")),
                isMainKPI: z.boolean().default(false),
              }),
            )
            .default([]),
        })
        .default({}),
    })
    .default({}),
});

type CampaignFormValues = z.infer<typeof campaignFormSchema>;

export function CampaignEditForm({
  campaign,
  onSuccess,
}: {
  campaign: ZCampaignWithTemplate;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("basic-info");
  const [templateData, setTemplateData] = useState<{
    basePrompt: string;
    agentId?: string;
    inboundWebhookUrl?: string;
    postCallWebhookUrl?: string;
    voicemailMessage?: string;
  } | null>(null);

  // Determine basePrompt based on available data
  const basePrompt =
    campaign.template?.basePrompt ||
    templateData?.basePrompt ||
    "Loading prompt...";

  // Determine voicemail message based on available data
  const voicemailMessage =
    campaign.template?.voicemailMessage || templateData?.voicemailMessage || "";

  // Determine webhook URLs based on available data
  const rawTemplate = campaign.template as Record<string, any>;

  const inboundWebhookUrl =
    campaign.template?.inboundWebhookUrl ||
    rawTemplate?.inbound_webhook_url ||
    rawTemplate?.inbound_dynamic_variables_webhook_url ||
    templateData?.inboundWebhookUrl ||
    (campaign.template?.agentId
      ? `${env.NEXT_PUBLIC_APP_URL}/api/retell/agent/${campaign.template?.agentId}/webhooks`
      : "");

  const postCallWebhookUrl =
    campaign.template?.postCallWebhookUrl ||
    rawTemplate?.post_call_webhook_url ||
    rawTemplate?.webhook_url ||
    templateData?.postCallWebhookUrl ||
    (campaign.template?.agentId
      ? `${env.NEXT_PUBLIC_APP_URL}/api/retell/agent/${campaign.template?.agentId}/webhooks`
      : "");

  // Get agent ID from template
  const agentId = campaign.template?.agentId || templateData?.agentId;

  const { mutateAsync: updateCampaign, isPending: isUpdatingCampaign } =
    useUpdateCampaign();

  // Fetch template data if not provided
  useEffect(() => {
    async function fetchCampaignData() {
      if (!campaign.template?.basePrompt) {
        try {
          setIsLoading(true);
          const campaignData = await getCampaignById(campaign.campaign?.id);

          if (campaignData) {
            // Log the raw template data to see what fields are available
            console.log("Raw template data from API:", campaignData.template);

            const template = campaignData.template;
            const rawTemplate = template as Record<string, any>;

            setTemplateData({
              basePrompt: template?.basePrompt || "",
              agentId: template?.agentId || "",
              voicemailMessage: template?.voicemailMessage || "",
              inboundWebhookUrl:
                template?.inboundWebhookUrl ||
                rawTemplate?.inbound_webhook_url ||
                rawTemplate?.inbound_dynamic_variables_webhook_url ||
                "",
              postCallWebhookUrl:
                template?.postCallWebhookUrl ||
                rawTemplate?.post_call_webhook_url ||
                rawTemplate?.webhook_url ||
                "",
            });
          }
        } catch (error) {
          console.error("Error fetching campaign data:", error);
          toast.error("Failed to load campaign data");
        } finally {
          setIsLoading(false);
        }
      }
    }

    fetchCampaignData();
  }, [campaign.campaign?.id, campaign.template?.basePrompt]);

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: campaign.campaign?.name || "",
      direction: campaign.campaign?.direction || "outbound",
      isActive: campaign.campaign?.isActive ?? true,
      basePrompt: basePrompt,
      voicemailMessage: voicemailMessage,
      inboundWebhookUrl:
        inboundWebhookUrl ||
        (agentId
          ? `${env.NEXT_PUBLIC_APP_URL}/api/retell/agent/${agentId}/webhooks`
          : ""),
      postCallWebhookUrl:
        postCallWebhookUrl ||
        (agentId
          ? `${env.NEXT_PUBLIC_APP_URL}/api/retell/agent/${agentId}/webhooks`
          : ""),
      variablesConfig: campaign.template?.variablesConfig || {
        patient: { fields: [], validation: {} },
        campaign: { fields: [] },
      },
      analysisConfig: campaign.template?.analysisConfig || {
        standard: { fields: [] },
        campaign: { fields: [] },
      },
    },
  });

  // Update form when template data changes
  useEffect(() => {
    if (basePrompt && basePrompt !== "Loading prompt...") {
      form.setValue("basePrompt", basePrompt);
    }
    if (voicemailMessage) {
      form.setValue("voicemailMessage", voicemailMessage);
    }
    if (inboundWebhookUrl) {
      form.setValue("inboundWebhookUrl", inboundWebhookUrl);
    }
    if (postCallWebhookUrl) {
      form.setValue("postCallWebhookUrl", postCallWebhookUrl);
    }
  }, [
    basePrompt,
    voicemailMessage,
    inboundWebhookUrl,
    postCallWebhookUrl,
    form,
  ]);

  async function onSubmit(data: CampaignFormValues) {
    setIsSubmitting(true);

    try {
      // Update webhook URLs if they've changed
      const webhooksChanged =
        data.inboundWebhookUrl !== inboundWebhookUrl ||
        data.postCallWebhookUrl !== postCallWebhookUrl;

      if (webhooksChanged) {
        // First, update the webhook URLs in our database
        await updateCampaignWithWebhooks(campaign.campaign?.id, {
          inboundUrl: data.inboundWebhookUrl || undefined,
          postCallUrl: data.postCallWebhookUrl || undefined,
        });

        // Then, if we have an agent ID, update the webhook URLs in Retell
        if (agentId) {
          // Get the organization ID from the campaign
          const orgId = campaign.campaign?.orgId;

          // Determine which webhooks to update
          const setInbound = data.inboundWebhookUrl !== inboundWebhookUrl;
          const setPostCall = data.postCallWebhookUrl !== postCallWebhookUrl;

          // Update the webhooks in Retell
          await updateAgentWebhooks(agentId, orgId, campaign.campaign?.id, {
            setInbound,
            setPostCall,
          });

          console.log("Updated webhook URLs in Retell");
        } else {
          console.warn(
            "No agent ID available for campaign ID:",
            campaign.campaign?.id,
            "skipping Retell webhook update",
          );
        }
      }

      // Update the campaign in our database
      await updateCampaignWithWebhooks(campaign.campaign?.id, {
        inboundUrl: data.inboundWebhookUrl || undefined,
        postCallUrl: data.postCallWebhookUrl || undefined,
      });

      // Update other campaign data using a separate API call or server action
      // await fetch(`/api/campaigns/${campaign.campaign?.id}`, {
      //   method: "PATCH",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({
      //     name: data.name,
      //     direction: data.direction,
      //     isActive: data.isActive,
      //     basePrompt: data.basePrompt,
      //     voicemailMessage: data.voicemailMessage,
      //     variablesConfig: data.variablesConfig,
      //     analysisConfig: data.analysisConfig,
      //   }),
      // });
      await updateCampaign({
        id: campaign.campaign?.id,
        name: data.name,
        description: "",
        direction: data.direction as "inbound" | "outbound",
        isActive: data.isActive,
        basePrompt: data.basePrompt,
        voicemailMessage: data.voicemailMessage,
        variablesConfig: data.variablesConfig as any,
        analysisConfig: data.analysisConfig as any,
      });

      toast.success("Campaign updated successfully");
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error(
        `Error updating campaign: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs defaultValue="basic-info" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="basic-info">Basic Info</TabsTrigger>
            <TabsTrigger value="prompt-voicemail">
              Prompt & Voicemail
            </TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="variables-config">Variables</TabsTrigger>
            <TabsTrigger value="analysis-config">Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="basic-info">
            <SheetBody className="p-6">
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campaign Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter campaign name" {...field} />
                      </FormControl>
                      <FormDescription>
                        A descriptive name for your campaign
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
                            <SelectValue placeholder="Select direction" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="outbound">Outbound</SelectItem>
                          <SelectItem value="inbound">Inbound</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Whether this campaign handles outbound or inbound calls
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Active Status
                        </FormLabel>
                        <FormDescription>
                          Enable or disable this campaign
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
              </div>
            </SheetBody>
          </TabsContent>

          <TabsContent value="prompt-voicemail">
            <SheetBody className="p-6">
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="basePrompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Prompt</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter the base prompt for the AI agent"
                          className="min-h-[200px] font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The base prompt that defines the AI agent&apos;s
                        behavior
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
                      <FormLabel>Voicemail Message</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter the voicemail message"
                          className="min-h-[100px] font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The message that will be played if the call goes to
                        voicemail
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </SheetBody>
          </TabsContent>

          <TabsContent value="webhooks">
            <SheetBody className="p-6">
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="inboundWebhookUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inbound Webhook URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://example.com/webhook/inbound"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Webhook URL for inbound dynamic variables
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="postCallWebhookUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Post-Call Webhook URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://example.com/webhook/post-call"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Webhook URL for post-call processing
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </SheetBody>
          </TabsContent>

          <TabsContent value="variables-config">
            <SheetBody className="p-6">
              <div className="space-y-6">
                <div className="mb-6">
                  <h3 className="text-lg font-medium">Patient Variables</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Configure variables used for patient information in this
                    campaign.
                  </p>

                  <FormField
                    control={form.control}
                    name="variablesConfig.patient.validation.requireValidPhone"
                    render={({ field }) => (
                      <FormItem className="mb-4 flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Require Valid Phone
                          </FormLabel>
                          <FormDescription>
                            Ensure patient records have a valid phone number
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

                  <FormField
                    control={form.control}
                    name="variablesConfig.patient.validation.requireValidDOB"
                    render={({ field }) => (
                      <FormItem className="mb-4 flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Require Valid DOB
                          </FormLabel>
                          <FormDescription>
                            Ensure patient records have a valid date of birth
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

                  <FormField
                    control={form.control}
                    name="variablesConfig.patient.validation.requireName"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Require Name
                          </FormLabel>
                          <FormDescription>
                            Ensure patient records have a name
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
                </div>

                {/* Dynamic Patient Fields */}
                <div className="mb-6">
                  <h3 className="mb-2 text-lg font-medium">Patient Fields</h3>
                  <div className="space-y-4">
                    {form
                      .watch("variablesConfig.patient.fields")
                      .map((field, index) => (
                        <div key={index} className="rounded-md border p-4">
                          <div className="mb-4 grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`variablesConfig.patient.fields.${index}.key`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Field Key</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`variablesConfig.patient.fields.${index}.label`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Display Label</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="mb-4 grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`variablesConfig.patient.fields.${index}.transform`}
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
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`variablesConfig.patient.fields.${index}.required`}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                  <FormLabel>Required</FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name={`variablesConfig.patient.fields.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          {/* Add UI for possibleColumns */}
                          <FormField
                            control={form.control}
                            name={`variablesConfig.patient.fields.${index}.possibleColumns`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Possible Columns</FormLabel>
                                <FormControl>
                                  <AccessibleTagInput
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder="Add a column name..."
                                    label="Possible columns for mapping"
                                  />
                                </FormControl>
                                <FormDescription>
                                  Enter possible column names from import files
                                  that map to this field
                                </FormDescription>
                              </FormItem>
                            )}
                          />

                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="mt-4"
                            onClick={() => {
                              const fields = [
                                ...form.getValues(
                                  "variablesConfig.patient.fields",
                                ),
                              ];
                              fields.splice(index, 1);
                              form.setValue(
                                "variablesConfig.patient.fields",
                                fields,
                              );
                            }}
                          >
                            Remove Field
                          </Button>
                        </div>
                      ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      const fields = [
                        ...form.getValues("variablesConfig.patient.fields"),
                      ];
                      fields.push({
                        key: "",
                        label: "",
                        possibleColumns: [],
                        transform: "text",
                        required: false,
                        description: "",
                      });
                      form.setValue("variablesConfig.patient.fields", fields);
                    }}
                  >
                    Add Patient Field
                  </Button>
                </div>

                {/* Campaign Fields */}
                <div className="mb-6">
                  <h3 className="mb-2 text-lg font-medium">Campaign Fields</h3>
                  <div className="space-y-4">
                    {form
                      .watch("variablesConfig.campaign.fields")
                      .map((field, index) => (
                        <div key={index} className="rounded-md border p-4">
                          <div className="mb-4 grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`variablesConfig.campaign.fields.${index}.key`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Field Key</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`variablesConfig.campaign.fields.${index}.label`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Display Label</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="mb-4 grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`variablesConfig.campaign.fields.${index}.transform`}
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
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`variablesConfig.campaign.fields.${index}.required`}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                  <FormLabel>Required</FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name={`variablesConfig.campaign.fields.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          {/* Add UI for possibleColumns */}
                          <FormField
                            control={form.control}
                            name={`variablesConfig.campaign.fields.${index}.possibleColumns`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Possible Columns</FormLabel>
                                <FormControl>
                                  <AccessibleTagInput
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder="Add a column name..."
                                    label="Possible columns for mapping"
                                  />
                                </FormControl>
                                <FormDescription>
                                  Enter possible column names from import files
                                  that map to this field
                                </FormDescription>
                              </FormItem>
                            )}
                          />

                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="mt-4"
                            onClick={() => {
                              const fields = [
                                ...form.getValues(
                                  "variablesConfig.campaign.fields",
                                ),
                              ];
                              fields.splice(index, 1);
                              form.setValue(
                                "variablesConfig.campaign.fields",
                                fields,
                              );
                            }}
                          >
                            Remove Field
                          </Button>
                        </div>
                      ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      const fields = [
                        ...form.getValues("variablesConfig.campaign.fields"),
                      ];
                      fields.push({
                        key: "",
                        label: "",
                        possibleColumns: [],
                        transform: "text",
                        required: false,
                        description: "",
                      });
                      form.setValue("variablesConfig.campaign.fields", fields);
                    }}
                  >
                    Add Campaign Field
                  </Button>
                </div>
              </div>
            </SheetBody>
          </TabsContent>

          <TabsContent value="analysis-config">
            <SheetBody className="p-6">
              <div className="space-y-6">
                {/* Standard Analysis Fields */}
                <div className="mb-6">
                  <h3 className="mb-2 text-lg font-medium">
                    Standard Analysis Fields
                  </h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Configure standard fields for post-call analysis.
                  </p>
                  <div className="space-y-4">
                    {form
                      .watch("analysisConfig.standard.fields")
                      .map((field, index) => (
                        <div key={index} className="rounded-md border p-4">
                          <div className="mb-4 grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`analysisConfig.standard.fields.${index}.key`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Field Key</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`analysisConfig.standard.fields.${index}.label`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Display Label</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="mb-4 grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`analysisConfig.standard.fields.${index}.type`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Field Type</FormLabel>
                                  <Select
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      // If changing to a non-enum type, clear options
                                      if (value !== "enum") {
                                        form.setValue(
                                          `analysisConfig.standard.fields.${index}.options`,
                                          [],
                                        );
                                      }
                                    }}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select field type" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="string">
                                        Text
                                      </SelectItem>
                                      <SelectItem value="boolean">
                                        Boolean
                                      </SelectItem>
                                      <SelectItem value="date">Date</SelectItem>
                                      <SelectItem value="enum">
                                        Enum (Options)
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`analysisConfig.standard.fields.${index}.required`}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                  <FormLabel>Required</FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>

                          {form.watch(
                            `analysisConfig.standard.fields.${index}.type`,
                          ) === "enum" && (
                            <FormField
                              control={form.control}
                              name={`analysisConfig.standard.fields.${index}.options`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Options</FormLabel>
                                  <FormControl>
                                    <AccessibleTagInput
                                      value={field.value}
                                      onChange={field.onChange}
                                      placeholder="Add an option..."
                                      label="Enum options"
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Enter the possible values for this enum
                                    field
                                  </FormDescription>
                                </FormItem>
                              )}
                            />
                          )}

                          <FormField
                            control={form.control}
                            name={`analysisConfig.standard.fields.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="mt-4"
                            onClick={() => {
                              const fields = [
                                ...form.getValues(
                                  "analysisConfig.standard.fields",
                                ),
                              ];
                              fields.splice(index, 1);
                              form.setValue(
                                "analysisConfig.standard.fields",
                                fields,
                              );
                            }}
                          >
                            Remove Field
                          </Button>
                        </div>
                      ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      const fields = [
                        ...form.getValues("analysisConfig.standard.fields"),
                      ];
                      fields.push({
                        key: "",
                        label: "",
                        type: "string",
                        options: [],
                        required: false,
                        description: "",
                      });
                      form.setValue("analysisConfig.standard.fields", fields);
                    }}
                  >
                    Add Standard Field
                  </Button>
                </div>

                {/* Campaign Analysis Fields */}
                <div className="mb-6">
                  <h3 className="mb-2 text-lg font-medium">
                    Campaign-Specific Analysis Fields
                  </h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Configure campaign-specific fields for post-call analysis.
                  </p>
                  <div className="space-y-4">
                    {form
                      .watch("analysisConfig.campaign.fields")
                      .map((field, index) => (
                        <div key={index} className="rounded-md border p-4">
                          <div className="mb-4 grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`analysisConfig.campaign.fields.${index}.key`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Field Key</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`analysisConfig.campaign.fields.${index}.label`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Display Label</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="mb-4 grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`analysisConfig.campaign.fields.${index}.type`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Field Type</FormLabel>
                                  <Select
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      // If changing to a non-enum type, clear options
                                      if (value !== "enum") {
                                        form.setValue(
                                          `analysisConfig.campaign.fields.${index}.options`,
                                          [],
                                        );
                                      }
                                    }}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select field type" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="string">
                                        Text
                                      </SelectItem>
                                      <SelectItem value="boolean">
                                        Boolean
                                      </SelectItem>
                                      <SelectItem value="date">Date</SelectItem>
                                      <SelectItem value="enum">
                                        Enum (Options)
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`analysisConfig.campaign.fields.${index}.required`}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                  <FormLabel>Required</FormLabel>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>

                          {form.watch(
                            `analysisConfig.campaign.fields.${index}.type`,
                          ) === "enum" && (
                            <FormField
                              control={form.control}
                              name={`analysisConfig.campaign.fields.${index}.options`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Options</FormLabel>
                                  <FormControl>
                                    <AccessibleTagInput
                                      value={field.value}
                                      onChange={field.onChange}
                                      placeholder="Add an option..."
                                      label="Enum options"
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Enter the possible values for this enum
                                    field
                                  </FormDescription>
                                </FormItem>
                              )}
                            />
                          )}

                          <FormField
                            control={form.control}
                            name={`analysisConfig.campaign.fields.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`analysisConfig.campaign.fields.${index}.isMainKPI`}
                            render={({ field }) => (
                              <FormItem className="mt-4 flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel>Main KPI</FormLabel>
                                  <FormDescription>
                                    Mark this field as a main KPI for dashboards
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

                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="mt-4"
                            onClick={() => {
                              const fields = [
                                ...form.getValues(
                                  "analysisConfig.campaign.fields",
                                ),
                              ];
                              fields.splice(index, 1);
                              form.setValue(
                                "analysisConfig.campaign.fields",
                                fields,
                              );
                            }}
                          >
                            Remove Field
                          </Button>
                        </div>
                      ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      const fields = [
                        ...form.getValues("analysisConfig.campaign.fields"),
                      ];
                      fields.push({
                        key: "",
                        label: "",
                        type: "string",
                        options: [],
                        required: false,
                        description: "",
                        isMainKPI: false,
                      });
                      form.setValue("analysisConfig.campaign.fields", fields);
                    }}
                  >
                    Add Campaign-Specific Field
                  </Button>
                </div>
              </div>
            </SheetBody>
          </TabsContent>
        </Tabs>

        <SheetFooter className="px-6 pb-6">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                Updating...
              </>
            ) : (
              "Update Campaign"
            )}
          </Button>
        </SheetFooter>
      </form>
    </Form>
  );
}
