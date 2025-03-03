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
import { zodResolver } from "@hookform/resolvers/zod";
import { FilterIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
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
});

type FilterValues = z.infer<typeof filterSchema>;

export function CallsTableFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize form with values from URL params
  const form = useForm<FilterValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      status: (searchParams.get("status") as FilterValues["status"]) || "all",
      direction:
        (searchParams.get("direction") as FilterValues["direction"]) || "all",
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

      return params.toString();
    },
    [searchParams],
  );

  // Handle form submission
  function onSubmit(values: FilterValues) {
    // Update URL with new query params
    const queryString = createQueryString(values);
    router.push(`${pathname}${queryString ? `?${queryString}` : ""}`);
  }

  // Reset filters
  function resetFilters() {
    form.reset({
      status: "all",
      direction: "all",
    });
    router.push(pathname);
  }

  // Apply filters as they change
  useEffect(() => {
    const subscription = form.watch((values) => {
      if (values.status || values.direction) {
        onSubmit(values as FilterValues);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, form.watch]);

  return (
    <>
      <div className="mb-4 flex justify-between">
        <h3 className="flex items-center gap-2 text-base font-medium">
          <FilterIcon className="h-4 w-4" />
          Filters
        </h3>
        <Button variant="outline" size="sm" onClick={resetFilters}>
          Reset
        </Button>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          {/* Status Filter */}
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
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
              <FormItem>
                <FormLabel>Direction</FormLabel>
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
                    <SelectItem value="all">All Directions</SelectItem>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="outbound">Outbound</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </>
  );
}
