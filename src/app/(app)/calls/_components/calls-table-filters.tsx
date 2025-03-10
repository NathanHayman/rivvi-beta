"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCampaigns } from "@/hooks/campaigns/use-campaigns";
import { zodResolver } from "@hookform/resolvers/zod";
import { FilterIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

// Define the filter schema
const filterSchema = z.object({
  status: z
    .enum([
      "all",
      "pending",
      "in-progress",
      "completed",
      "failed",
      "voicemail",
      "no-answer",
    ])
    .optional()
    .default("all"),
  direction: z.enum(["all", "inbound", "outbound"]).optional().default("all"),
  campaignId: z.string().optional().default(""),
});

type FilterValues = z.infer<typeof filterSchema>;

export function CallsTableFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Fetch campaigns for the dropdown
  const { data: campaignsData, isLoading: isLoadingCampaigns } = useCampaigns();
  const [campaigns, setCampaigns] = useState<
    Array<{ id: string; name: string }>
  >([]);

  // Update campaigns when data is loaded
  useEffect(() => {
    if (campaignsData) {
      // Extract campaigns from the data
      setCampaigns(
        (campaignsData || []).map((campaign: any) => ({
          id: campaign.id,
          name: campaign.name,
        })),
      );
    }
  }, [campaignsData]);

  // Initialize form with values from URL params
  const form = useForm<FilterValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      status: (searchParams.get("status") as FilterValues["status"]) || "all",
      direction:
        (searchParams.get("direction") as FilterValues["direction"]) || "all",
      campaignId: searchParams.get("campaignId") || "all",
    },
  });

  // Create a query string from the filters
  const createQueryString = useCallback(
    (values: FilterValues) => {
      const params = new URLSearchParams(searchParams.toString());

      // Update params with filter values
      Object.entries(values).forEach(([key, value]) => {
        if (value && value !== "all") {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });

      // Preserve the callId parameter if it exists
      const callId = searchParams.get("callId");
      if (callId) {
        params.set("callId", callId);
      }

      return params.toString();
    },
    [searchParams],
  );

  // Handle form submission
  const onSubmit = useCallback(
    function onSubmit(values: FilterValues) {
      // Update URL with new query params
      const queryString = createQueryString(values);
      router.push(`${pathname}${queryString ? `?${queryString}` : ""}`);
    },
    [router, pathname, createQueryString],
  );

  // Reset filters
  function resetFilters() {
    form.reset({
      status: "all",
      direction: "all",
      campaignId: "all",
    });

    // When resetting filters, preserve the callId if it exists
    const callId = searchParams.get("callId");
    if (callId) {
      router.push(`${pathname}?callId=${callId}`);
    } else {
      router.push(pathname);
    }
  }

  // Apply filters as they change
  useEffect(() => {
    const subscription = form.watch((values) => {
      if (values.status || values.direction || values.campaignId) {
        onSubmit(values as FilterValues);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, form.watch, onSubmit]);

  return (
    <div className="rounded-md border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-medium">
          <FilterIcon className="h-4 w-4 text-muted-foreground" />
          <span>Filters</span>
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={resetFilters}
          className="h-8 px-3 text-xs"
        >
          Reset
        </Button>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {/* Status Filter */}
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-xs font-medium">Status</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="voicemail">Voicemail</SelectItem>
                    <SelectItem value="no-answer">No Answer</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          {/* Direction Filter */}
          <FormField
            control={form.control}
            name="direction"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-xs font-medium">Direction</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select direction" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="all">All Directions</SelectItem>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="outbound">Outbound</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          {/* Campaign Filter */}
          <FormField
            control={form.control}
            name="campaignId"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-xs font-medium">Campaign</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={isLoadingCampaigns}
                >
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select campaign" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="all">All Campaigns</SelectItem>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  );
}
