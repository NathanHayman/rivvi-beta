"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCampaigns } from "@/hooks/campaigns/use-campaigns";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronDown, Filter, X } from "lucide-react";
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
  campaignId: z.string().optional().default("all"),
  dateRange: z
    .enum(["all", "today", "week", "month"])
    .optional()
    .default("all"),
});

type FilterValues = z.infer<typeof filterSchema>;

// Status options with proper labels and colors
const statusOptions = [
  { value: "all", label: "All Statuses" },
  {
    value: "pending",
    label: "Pending",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  },
  {
    value: "in-progress",
    label: "In Progress",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  },
  {
    value: "completed",
    label: "Completed",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  },
  {
    value: "failed",
    label: "Failed",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  },
  {
    value: "voicemail",
    label: "Voicemail",
    color:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  },
  {
    value: "no-answer",
    label: "No Answer",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  },
];

// Direction options with labels
const directionOptions = [
  { value: "all", label: "All Directions" },
  {
    value: "inbound",
    label: "Inbound",
    color:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  },
  {
    value: "outbound",
    label: "Outbound",
    color:
      "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300",
  },
];

// Date range options
const dateRangeOptions = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

export function CallsTableFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [activeFilterCount, setActiveFilterCount] = useState(0);

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
      dateRange:
        (searchParams.get("dateRange") as FilterValues["dateRange"]) || "all",
    },
  });

  // Count active filters
  useEffect(() => {
    const values = form.getValues();
    let count = 0;
    if (values.status && values.status !== "all") count++;
    if (values.direction && values.direction !== "all") count++;
    if (values.campaignId && values.campaignId !== "all") count++;
    if (values.dateRange && values.dateRange !== "all") count++;
    setActiveFilterCount(count);
  }, [form, searchParams]);

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
      // Close the filter popover after applying
      setIsFiltersOpen(false);
    },
    [router, pathname, createQueryString],
  );

  // Reset filters
  function resetFilters() {
    form.reset({
      status: "all",
      direction: "all",
      campaignId: "all",
      dateRange: "all",
    });

    // When resetting filters, preserve the callId if it exists
    const callId = searchParams.get("callId");
    if (callId) {
      router.push(`${pathname}?callId=${callId}`);
    } else {
      router.push(pathname);
    }

    // Close the filter popover after resetting
    setIsFiltersOpen(false);
  }

  // Apply filters as they change
  useEffect(() => {
    const subscription = form.watch((values) => {
      if (
        values.status ||
        values.direction ||
        values.campaignId ||
        values.dateRange
      ) {
        onSubmit(values as FilterValues);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, form.watch, onSubmit]);

  // Helper to get status badge styling
  const getStatusBadgeStyle = (status: string) => {
    const option = statusOptions.find((opt) => opt.value === status);
    return option?.color || "";
  };

  // Helper to get direction badge styling
  const getDirectionBadgeStyle = (direction: string) => {
    const option = directionOptions.find((opt) => opt.value === direction);
    return option?.color || "";
  };

  // Renders active filters as badges
  const renderActiveFilters = () => {
    const values = form.getValues();
    const filters = [];

    if (values.status && values.status !== "all") {
      const statusLabel = statusOptions.find(
        (opt) => opt.value === values.status,
      )?.label;
      filters.push(
        <Badge
          key="status"
          variant="outline"
          className={cn(
            "gap-1 border px-2 py-1",
            getStatusBadgeStyle(values.status),
          )}
        >
          {statusLabel}
          <X
            className="h-3 w-3 cursor-pointer"
            onClick={() => {
              form.setValue("status", "all");
              onSubmit({ ...values, status: "all" });
            }}
          />
        </Badge>,
      );
    }

    if (values.direction && values.direction !== "all") {
      const directionLabel = directionOptions.find(
        (opt) => opt.value === values.direction,
      )?.label;
      filters.push(
        <Badge
          key="direction"
          variant={
            values.direction === "inbound" ? "yellow_solid" : "violet_solid"
          }
          className="gap-1 px-2 py-1"
        >
          {directionLabel}
          <X
            className="h-3 w-3 cursor-pointer"
            onClick={() => {
              form.setValue("direction", "all");
              onSubmit({ ...values, direction: "all" });
            }}
          />
        </Badge>,
      );
    }

    if (values.campaignId && values.campaignId !== "all") {
      const campaignName =
        campaigns.find((c) => c.id === values.campaignId)?.name ||
        "Selected Campaign";
      filters.push(
        <Badge key="campaign" variant="blue_solid" className="gap-1 px-2 py-1">
          {campaignName}
          <X
            className="h-3 w-3 cursor-pointer"
            onClick={() => {
              form.setValue("campaignId", "all");
              onSubmit({ ...values, campaignId: "all" });
            }}
          />
        </Badge>,
      );
    }

    if (values.dateRange && values.dateRange !== "all") {
      const dateRangeLabel = dateRangeOptions.find(
        (opt) => opt.value === values.dateRange,
      )?.label;
      filters.push(
        <Badge
          key="dateRange"
          variant="neutral_solid"
          className="gap-1 px-2 py-1"
        >
          {dateRangeLabel}
          <X
            className="h-3 w-3 cursor-pointer"
            onClick={() => {
              form.setValue("dateRange", "all");
              onSubmit({ ...values, dateRange: "all" });
            }}
          />
        </Badge>,
      );
    }

    return filters;
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Popover open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 px-3 font-medium"
              >
                <Filter className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-5 min-w-5 rounded-full px-1.5"
                  >
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="start">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium">Filter Calls</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-8 px-2 text-xs"
                >
                  Reset all
                </Button>
              </div>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  {/* Status Filter */}
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-medium">
                          Status
                        </FormLabel>
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
                            {statusOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                <div className="flex items-center gap-2">
                                  {option.value !== "all" && (
                                    <span
                                      className={cn(
                                        "h-2 w-2 rounded-full",
                                        getStatusBadgeStyle(option.value),
                                      )}
                                    />
                                  )}
                                  {option.label}
                                </div>
                              </SelectItem>
                            ))}
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
                        <FormLabel className="text-xs font-medium">
                          Direction
                        </FormLabel>
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
                            {directionOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
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
                        <FormLabel className="text-xs font-medium">
                          Campaign
                        </FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "h-9 w-full justify-between pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                {field.value && field.value !== "all"
                                  ? campaigns.find(
                                      (campaign) => campaign.id === field.value,
                                    )?.name || "Select campaign"
                                  : "Select campaign"}
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput
                                placeholder="Search campaigns..."
                                className="h-9"
                              />
                              <CommandEmpty>No campaign found.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="all"
                                  onSelect={() => {
                                    form.setValue("campaignId", "all");
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === "all"
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  All Campaigns
                                </CommandItem>
                                {campaigns.map((campaign) => (
                                  <CommandItem
                                    value={campaign.name}
                                    key={campaign.id}
                                    onSelect={() => {
                                      form.setValue("campaignId", campaign.id);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === campaign.id
                                          ? "opacity-100"
                                          : "opacity-0",
                                      )}
                                    />
                                    {campaign.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </FormItem>
                    )}
                  />

                  {/* Date Range Filter */}
                  <FormField
                    control={form.control}
                    name="dateRange"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-medium">
                          Date Range
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select date range" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {dateRangeOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsFiltersOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm">
                      Apply Filters
                    </Button>
                  </div>
                </form>
              </Form>
            </PopoverContent>
          </Popover>

          {/* Render active filter badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            {renderActiveFilters()}
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-7 px-2 text-xs"
              >
                Clear all
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
