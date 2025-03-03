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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

// Define the form schema using zod
const campaignRequestSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name cannot exceed 100 characters"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(1000, "Description cannot exceed 1000 characters"),
});

// Type for the form values
type CampaignRequestFormValues = z.infer<typeof campaignRequestSchema>;

// Props for the component
interface CampaignRequestFormProps {
  onSuccess?: () => void;
  onOpenChange?: (open: boolean) => void;
}

export function CampaignRequestForm({
  onSuccess,
  onOpenChange,
}: CampaignRequestFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set up the form with default values
  const form = useForm<CampaignRequestFormValues>({
    resolver: zodResolver(campaignRequestSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Setup the mutation
  const requestCampaign = api.campaigns.requestCampaign.useMutation({
    onSuccess: () => {
      toast.success("Campaign request submitted");
      form.reset();
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: any) => {
      toast.error("Failed to submit campaign request.");
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  // Handle form submission
  const onSubmit = async (values: CampaignRequestFormValues) => {
    setIsSubmitting(true);
    requestCampaign.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-1">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Campaign Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Annual Wellness Visit Reminders"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Give your campaign a clear, descriptive name
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
              <FormLabel>Campaign Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the purpose of the campaign, your specific requirements, and any special instructions..."
                  className="min-h-[120px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Provide detailed information about your campaign goals, target
                audience, and specific requirements
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex w-full justify-end">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </Button>
        </div>
      </form>
      <div className="mt-8 flex h-full flex-col justify-between px-1">
        <Card className="rounded-lg border bg-accent/60 shadow-none">
          <CardHeader className="p-4">
            <CardTitle className="font-heading text-sm font-medium">
              What happens next?
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            <p className="">
              After submitting, the Rivvi team will review your request and
              create the campaign for your organization.
            </p>
            <p className="mt-2">
              You will be notified when your campaign is ready to use. Look out
              for an email in your inbox from <code>hello@rivvi.ai</code>
            </p>
          </CardContent>
        </Card>
      </div>
    </Form>
  );
}
