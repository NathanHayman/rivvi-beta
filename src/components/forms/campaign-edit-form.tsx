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
});

type CampaignFormValues = z.infer<typeof campaignFormSchema>;

// Define the expected campaign type
type CampaignWithTemplate = TCampaign & {
  template?: { basePrompt?: string; agentId?: string };
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

  useEffect(() => {
    if (getTemplate.data && !templateData) {
      setTemplateData({
        basePrompt: getTemplate.data.template?.basePrompt || "",
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
    },
  });

  // Update form when template data changes
  useEffect(() => {
    if (basePrompt && basePrompt !== "Loading prompt...") {
      form.setValue("basePrompt", basePrompt);
    }
  }, [basePrompt, form]);

  const updateCampaign = api.campaigns.update.useMutation({
    onSuccess: () => {
      toast.success("Campaign updated successfully");
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
        router.push(`/admin/campaigns/${campaign.id}`);
      }
    },
    onError: (error) => {
      toast.error(`Error updating campaign: ${error.message}`);
      setIsSubmitting(false);
    },
  });

  function onSubmit(data: CampaignFormValues) {
    setIsSubmitting(true);

    updateCampaign.mutate({
      id: campaign.id,
      name: data.name,
      isActive: data.isActive,
      basePrompt: data.basePrompt,
    });
  }

  // Show loading state if still fetching template data
  if (getTemplate.isLoading && !campaign.template?.basePrompt) {
    return (
      <div className="p-8 text-center">Loading campaign template data...</div>
    );
  }

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
