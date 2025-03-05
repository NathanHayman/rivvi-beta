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
import { Textarea } from "@/components/ui/textarea";
import { env } from "@/env";
import { updateCampaignWithWebhooks } from "@/lib/retell/retell-actions";
import { updateAgentWebhooks } from "@/lib/retell/retell-client-safe";
import { api } from "@/trpc/react";
import type { TCampaign } from "@/types/db";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
});

type CampaignFormValues = z.infer<typeof campaignFormSchema>;

// Define the expected campaign type
type CampaignWithTemplate = TCampaign & {
  template?: {
    basePrompt?: string;
    agentId?: string;
    inboundWebhookUrl?: string;
    postCallWebhookUrl?: string;
    // Allow any other properties
    [key: string]: any;
  };
};

export function CampaignEditForm({
  campaign,
  onSuccess,
}: {
  campaign: CampaignWithTemplate;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [templateData, setTemplateData] = useState<{
    basePrompt: string;
    agentId?: string;
    inboundWebhookUrl?: string;
    postCallWebhookUrl?: string;
  } | null>(null);

  // Fetch template data if not provided
  const getTemplate = api.campaigns.getById.useQuery(
    { id: campaign.id },
    {
      enabled: !campaign.template?.basePrompt,
      refetchOnWindowFocus: false,
    },
  );

  // Determine basePrompt based on available data
  const basePrompt =
    campaign.template?.basePrompt ||
    templateData?.basePrompt ||
    "Loading prompt...";

  // Determine webhook URLs based on available data
  const rawTemplate = campaign.template as Record<string, any>;

  const inboundWebhookUrl =
    campaign.template?.inboundWebhookUrl ||
    rawTemplate?.inbound_webhook_url ||
    rawTemplate?.inbound_dynamic_variables_webhook_url ||
    templateData?.inboundWebhookUrl ||
    (campaign.template?.agentId
      ? `${env.NEXT_PUBLIC_APP_URL}/api/retell/agent/${campaign.template.agentId}/webhooks`
      : "");

  const postCallWebhookUrl =
    campaign.template?.postCallWebhookUrl ||
    rawTemplate?.post_call_webhook_url ||
    rawTemplate?.webhook_url ||
    templateData?.postCallWebhookUrl ||
    (campaign.template?.agentId
      ? `${env.NEXT_PUBLIC_APP_URL}/api/retell/agent/${campaign.template.agentId}/webhooks`
      : "");

  // Get agent ID from template
  const agentId = campaign.template?.agentId || templateData?.agentId;

  // Debug log for agent ID and webhook URLs
  console.log("Campaign data:", {
    campaignId: campaign.id,
    templateAgentId: campaign.template?.agentId,
    templateDataAgentId: templateData?.agentId,
    finalAgentId: agentId,
    // Add webhook URL debugging
    templateInboundWebhookUrl: campaign.template?.inboundWebhookUrl,
    templatePostCallWebhookUrl: campaign.template?.postCallWebhookUrl,
    templateDataInboundWebhookUrl: templateData?.inboundWebhookUrl,
    templateDataPostCallWebhookUrl: templateData?.postCallWebhookUrl,
    finalInboundWebhookUrl: inboundWebhookUrl,
    finalPostCallWebhookUrl: postCallWebhookUrl,
    // Raw template data for inspection
    rawTemplateData: getTemplate.data?.template,
  });

  useEffect(() => {
    if (getTemplate.data && !templateData) {
      // Log the raw template data to see what fields are available
      console.log("Raw template data from API:", getTemplate.data.template);

      const template = getTemplate.data.template;
      const rawTemplate = template as Record<string, any>;

      setTemplateData({
        basePrompt: template?.basePrompt || "",
        agentId: template?.agentId || "",
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
  }, [getTemplate.data, templateData]);

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: campaign.name,
      direction: campaign.direction,
      isActive: campaign.isActive ?? true,
      basePrompt: basePrompt,
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
    },
  });

  // Update form when template data changes
  useEffect(() => {
    if (basePrompt && basePrompt !== "Loading prompt...") {
      form.setValue("basePrompt", basePrompt);
    }
    if (inboundWebhookUrl) {
      form.setValue("inboundWebhookUrl", inboundWebhookUrl);
    }
    if (postCallWebhookUrl) {
      form.setValue("postCallWebhookUrl", postCallWebhookUrl);
    }
  }, [basePrompt, inboundWebhookUrl, postCallWebhookUrl, form]);

  const updateCampaign = api.campaigns.update.useMutation({
    onSuccess: () => {
      toast.success("Campaign updated successfully");
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    },
    onError: (error) => {
      toast.error(`Error updating campaign: ${error.message}`);
      setIsSubmitting(false);
    },
  });

  async function onSubmit(data: CampaignFormValues) {
    setIsSubmitting(true);

    try {
      // Update webhook URLs if they've changed
      const webhooksChanged =
        data.inboundWebhookUrl !== inboundWebhookUrl ||
        data.postCallWebhookUrl !== postCallWebhookUrl;

      if (webhooksChanged) {
        // First, update the webhook URLs in our database
        await updateCampaignWithWebhooks(campaign.id, {
          inboundUrl: data.inboundWebhookUrl || undefined,
          postCallUrl: data.postCallWebhookUrl || undefined,
        });

        // Then, if we have an agent ID, update the webhook URLs in Retell
        if (agentId) {
          // Get the organization ID from the campaign
          const orgId = campaign.orgId;

          // Determine which webhooks to update
          const setInbound = data.inboundWebhookUrl !== inboundWebhookUrl;
          const setPostCall = data.postCallWebhookUrl !== postCallWebhookUrl;

          // Update the webhooks in Retell
          await updateAgentWebhooks(agentId, orgId, campaign.id, {
            setInbound,
            setPostCall,
          });

          console.log("Updated webhook URLs in Retell");
        } else {
          console.warn(
            "No agent ID available for campaign ID:",
            campaign.id,
            "skipping Retell webhook update",
          );
        }
      }

      // Update other campaign data
      updateCampaign.mutate({
        id: campaign.id,
        name: data.name,
        isActive: data.isActive,
        basePrompt: data.basePrompt,
      });
    } catch (error) {
      console.error("Error updating campaign:", error);
      toast.error("Failed to update webhook URLs");
      setIsSubmitting(false);
    }
  }

  // Show loading state if still fetching template data
  if (getTemplate.isLoading && !campaign.template?.basePrompt) {
    return (
      <div className="p-8 text-center">Loading campaign template data...</div>
    );
  }

  // Get current direction value for conditional rendering
  const currentDirection = form.watch("direction");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                A descriptive name for the campaign.
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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select campaign direction" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="outbound">Outbound</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                The direction of the campaign determines the workflow and data
                requirements.
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
                <FormLabel className="text-base">Active Status</FormLabel>
                <FormDescription>
                  Enable or disable this campaign.
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
          name="basePrompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Base Prompt</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter base prompt for the agent"
                  className="min-h-[200px]"
                  {...field}
                  disabled={
                    getTemplate.isLoading && !campaign.template?.basePrompt
                  }
                />
              </FormControl>
              <FormDescription>
                The base prompt instructions for the AI agent that will be used
                for this campaign.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Conditionally render inbound webhook URL field based on direction */}
        {currentDirection === "inbound" && (
          <FormField
            control={form.control}
            name="inboundWebhookUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Inbound Webhook URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://your-webhook-url.com/inbound"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  The webhook URL that will be called when an inbound call is
                  received.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Post-call webhook URL field (always visible) */}
        <FormField
          control={form.control}
          name="postCallWebhookUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Post-Call Webhook URL</FormLabel>
              <FormControl>
                <Input
                  placeholder="https://your-webhook-url.com/post-call"
                  value={`${env.NEXT_PUBLIC_APP_URL}/api/retell/agent/${agentId}/webhooks`}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                The webhook URL that will be called after a call is completed.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => (onSuccess ? onSuccess() : router.back())}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Update Campaign"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
