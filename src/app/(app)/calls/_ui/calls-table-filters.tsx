// src/app/(app)/calls/_components/calls-table-filters.tsx
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
import { Check, ChevronDown, Filter, Loader2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

// Define the filter schema with improved typing
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
    .enum(["all", "today", "yesterday", "week", "month"])
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
    variant: "yellow_solid" as const,
  },
  {
    value: "outbound",
    label: "Outbound",
    color:
      "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300",
    variant: "violet_solid" as const,
  },
];

// Date range options
const dateRangeOptions = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

export function CallsTableFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Fetch campaigns for the dropdown with proper error handling
  const { data: campaignsData, isLoading: isLoadingCampaigns } = useCampaigns();

  // Memoize campaigns to prevent unnecessary re-renders
  const campaigns = useMemo(() => {
    if (!campaignsData) return [];

    // Extract and sort campaigns
    return (campaignsData || [])
      .map((campaign: any) => ({
        id: campaign.id,
        name: campaign.name || "Unnamed Campaign",
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [campaignsData]);

  // Count active filters for UI
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchParams.get("status") && searchParams.get("status") !== "all")
      count++;
    if (
      searchParams.get("direction") &&
      searchParams.get("direction") !== "all"
    )
      count++;
    if (
      searchParams.get("campaignId") &&
      searchParams.get("campaignId") !== "all"
    )
      count++;
    if (
      searchParams.get("dateRange") &&
      searchParams.get("dateRange") !== "all"
    )
      count++;
    return count;
  }, [searchParams]);

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

  // Sync form with URL params when they change
  useEffect(() => {
    // Get current URL values
    const urlStatus = searchParams.get("status") as FilterValues["status"];
    const urlDirection = searchParams.get(
      "direction",
    ) as FilterValues["direction"];
    const urlCampaignId = searchParams.get("campaignId");
    const urlDateRange = searchParams.get(
      "dateRange",
    ) as FilterValues["dateRange"];

    // Update form silently (without triggering onSubmit)
    form.setValue("status", urlStatus || "all", { shouldDirty: false });
    form.setValue("direction", urlDirection || "all", { shouldDirty: false });
    form.setValue("campaignId", urlCampaignId || "all", { shouldDirty: false });
    form.setValue("dateRange", urlDateRange || "all", { shouldDirty: false });
  }, [searchParams, form]);

  // Handle form submission with improved URL parameter handling
  const onSubmit = useCallback(
    function onSubmit(values: FilterValues) {
      // Create a new URLSearchParams object from current params
      const params = new URLSearchParams(searchParams.toString());

      // Only add non-default filter values to URL params
      if (values.status && values.status !== "all") {
        params.set("status", values.status);
      } else {
        params.delete("status");
      }

      if (values.direction && values.direction !== "all") {
        params.set("direction", values.direction);
      } else {
        params.delete("direction");
      }

      if (values.campaignId && values.campaignId !== "all") {
        params.set("campaignId", values.campaignId);
      } else {
        params.delete("campaignId");
      }

      if (values.dateRange && values.dateRange !== "all") {
        params.set("dateRange", values.dateRange);
      } else {
        params.delete("dateRange");
      }

      // Update the URL - this will trigger the data fetch via hooks
      router.replace(
        `${pathname}${params.toString() ? `?${params.toString()}` : ""}`,
        {
          scroll: false,
        },
      );

      // Close the filter popover after applying
      setIsFiltersOpen(false);
    },
    [router, pathname, searchParams],
  );

  // Reset filters with proper URL handling
  function resetFilters() {
    // Reset form values
    form.reset({
      status: "all",
      direction: "all",
      campaignId: "all",
      dateRange: "all",
    });

    // Create a new URLSearchParams object from current params
    const params = new URLSearchParams(searchParams.toString());

    // Delete filter params explicitly
    const filterParams = ["status", "direction", "campaignId", "dateRange"];
    filterParams.forEach((param) => {
      params.delete(param);
    });

    // Update the URL
    router.replace(
      `${pathname}${params.toString() ? `?${params.toString()}` : ""}`,
      {
        scroll: false,
      },
    );

    // Close the filter popover
    setIsFiltersOpen(false);
  }

  // Helper to get status badge styling
  const getStatusBadgeStyle = (status: string) => {
    const option = statusOptions.find((opt) => opt.value === status);
    return option?.color || "";
  };

  // Helper to get direction badge styling
  const getDirectionBadgeStyle = (direction: string) => {
    const option = directionOptions.find((opt) => opt.value === direction);
    return option?.variant || ("neutral_solid" as const);
  };

  // Renders active filters as badges
  const renderActiveFilters = () => {
    const values = form.getValues();
    const filters: React.ReactNode[] = [];

    if (values.status && values.status !== "all") {
      const statusLabel = statusOptions.find(
        (opt) => opt.value === values.status,
      )?.label;
      filters.push(
        <Badge
          key="status"
          variant="neutral_solid"
          className={cn("gap-1 px-2 py-1", getStatusBadgeStyle(values.status))}
        >
          {statusLabel}
          <X
            className="h-3 w-3 cursor-pointer"
            onClick={() => {
              // Update form and URL params
              form.setValue("status", "all");
              onSubmit({
                ...form.getValues(),
                status: "all",
              });
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
          variant={getDirectionBadgeStyle(values.direction)}
          className="gap-1 px-2 py-1"
        >
          {directionLabel}
          <X
            className="h-3 w-3 cursor-pointer"
            onClick={() => {
              // Update form and URL params
              form.setValue("direction", "all");
              onSubmit({
                ...form.getValues(),
                direction: "all",
              });
            }}
          />
        </Badge>,
      );
    }

    if (values.campaignId && values.campaignId !== "all") {
      const campaignName =
        campaigns.find((c) => c.id === values.campaignId)?.name ||
        "Unknown Campaign";
      filters.push(
        <Badge
          key="campaignId"
          variant="neutral_solid"
          className="gap-1 px-2 py-1"
        >
          {campaignName}
          <X
            className="h-3 w-3 cursor-pointer"
            onClick={() => {
              // Update form and URL params
              form.setValue("campaignId", "all");
              onSubmit({
                ...form.getValues(),
                campaignId: "all",
              });
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
              // Update form and URL params
              form.setValue("dateRange", "all");
              onSubmit({
                ...form.getValues(),
                dateRange: "all",
              });
            }}
          />
        </Badge>,
      );
    }

    return filters;
  };

  // Handle individual filter changes with proper typing
  const handleFilterChange = (field: keyof FilterValues, value: string) => {
    // Properly typed update based on field type
    let updatedValues: FilterValues = { ...form.getValues() };

    if (field === "status") {
      form.setValue("status", value as FilterValues["status"]);
      updatedValues.status = value as FilterValues["status"];
    } else if (field === "direction") {
      form.setValue("direction", value as FilterValues["direction"]);
      updatedValues.direction = value as FilterValues["direction"];
    } else if (field === "campaignId") {
      form.setValue("campaignId", value);
      updatedValues.campaignId = value;
    } else if (field === "dateRange") {
      form.setValue("dateRange", value as FilterValues["dateRange"]);
      updatedValues.dateRange = value as FilterValues["dateRange"];
    }

    // Submit the form with updated values
    onSubmit(updatedValues);
  };

  return (
    <div className="flex w-full flex-col gap-2 md:w-auto">
      <div className="flex items-center">
        <div className="flex flex-wrap items-center gap-2">
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
            <PopoverContent className="w-[300px] p-4" align="start">
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
                  className="space-y-4"
                  onSubmit={(e) => e.preventDefault()}
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
                          value={field.value}
                          onValueChange={(value) =>
                            handleFilterChange("status", value)
                          }
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
                          value={field.value}
                          onValueChange={(value) =>
                            handleFilterChange("direction", value)
                          }
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
                                <div className="flex items-center gap-2">
                                  {option.value !== "all" && (
                                    <div
                                      className={cn(
                                        "h-2 w-2 rounded-full",
                                        option.value === "inbound"
                                          ? "bg-yellow-500"
                                          : "bg-violet-500",
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
                              <CommandEmpty>
                                {isLoadingCampaigns
                                  ? "Loading campaigns..."
                                  : "No campaign found."}
                              </CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="all"
                                  onSelect={() => {
                                    handleFilterChange("campaignId", "all");
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
                                {isLoadingCampaigns ? (
                                  <div className="flex items-center justify-center py-6">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                  </div>
                                ) : campaigns.length === 0 ? (
                                  <div className="py-6 text-center text-sm text-muted-foreground">
                                    No campaigns available
                                  </div>
                                ) : (
                                  campaigns.map((campaign) => (
                                    <CommandItem
                                      value={campaign.name}
                                      key={campaign.id}
                                      onSelect={() => {
                                        handleFilterChange(
                                          "campaignId",
                                          campaign.id,
                                        );
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
                                  ))
                                )}
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
                          value={field.value}
                          onValueChange={(value) =>
                            handleFilterChange("dateRange", value)
                          }
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
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        onSubmit(form.getValues());
                      }}
                    >
                      Apply Filters
                    </Button>
                  </div>
                </form>
              </Form>
            </PopoverContent>
          </Popover>

          {/* Render active filter badges */}
          <div className="flex max-w-full flex-wrap items-center gap-1.5 overflow-x-auto">
            {renderActiveFilters()}
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-7 whitespace-nowrap px-2 text-xs"
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
