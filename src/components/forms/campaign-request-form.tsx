"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// Define the form schema using zod
const campaignRequestSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name cannot exceed 100 characters"),
  type: z.string().min(1, "Campaign type is required"),
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
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set up the form with default values
  const form = useForm<CampaignRequestFormValues>({
    resolver: zodResolver(campaignRequestSchema),
    defaultValues: {
      name: "",
      type: "",
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
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Request a New Campaign</CardTitle>
        <CardDescription>
          Request a new AI voice campaign for your organization. Our team will
          review your request and create the campaign for you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                        <SelectValue placeholder="Select a campaign type" />
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
                      <SelectItem value="inbound">Inbound Support</SelectItem>
                      <SelectItem value="custom">Custom Campaign</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the type of campaign you want to create
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
                    Provide detailed information about your campaign goals,
                    target audience, and specific requirements
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-4">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col items-start border-t bg-muted/50 px-6 py-4 text-sm text-muted-foreground">
        <p>
          After submitting, the Rivvi team will review your request and create
          the campaign for your organization.
        </p>
        <p className="mt-2">
          You will be notified when your campaign is ready to use.
        </p>
      </CardFooter>
    </Card>
  );
}
