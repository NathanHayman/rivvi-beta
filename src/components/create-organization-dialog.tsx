"use client";

// src/components/admin/create-organization-dialog.tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { api } from "@/trpc/react";

// Define timezone options
export const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "America/Adak", label: "Hawaii-Aleutian Time (HAT)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "Europe/London", label: "UK (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European Time (CET)" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST)" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (AET)" },
];

// Form schema
const organizationFormSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  clerkId: z.string().min(1, "Clerk ID is required"),
  phone: z
    .string()
    .min(10, "Phone number is required")
    .regex(/^\+?[0-9\-\(\) ]+$/, "Invalid phone number format"),
  timezone: z.string().min(1, "Timezone is required"),
  concurrentCallLimit: z
    .number()
    .int()
    .min(1, "Must be at least 1")
    .max(100, "Maximum is 100"),
});

type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateOrganizationDialogProps) {
  const [isFetching, setIsFetching] = useState(false);

  // Form setup
  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: "",
      clerkId: "",
      phone: "",
      timezone: "America/New_York",
      concurrentCallLimit: 20,
    },
  });

  // Create organization mutation
  const createOrgMutation = api.organization.create.useMutation({
    onSuccess: () => {
      toast.success("Organization created successfully");
      form.reset();
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      toast.error(`Error creating organization: ${error.message}`);
    },
  });

  // Handle form submission
  const onSubmit = (values: OrganizationFormValues) => {
    createOrgMutation.mutate(values);
  };

  // Handle fetching organization from Clerk
  const handleFetchFromClerk = async () => {
    try {
      setIsFetching(true);

      // TODO: In a real implementation, this would make an API call to Clerk
      // to fetch organization details by ID. For now, we'll simulate success.

      // Simulate fetching organization data from Clerk
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Example data that would come back from Clerk API
      const mockClerkOrgData = {
        name: "Sample Healthcare Group",
        id: form.getValues("clerkId"),
      };

      // Update the form with fetched data
      form.setValue("name", mockClerkOrgData.name);

      toast.success("Organization details fetched from Clerk");
    } catch (error) {
      toast.error("Failed to fetch organization details from Clerk");
      console.error("Error fetching from Clerk:", error);
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Create New Organization</DialogTitle>
          <DialogDescription>
            Add a new organization to the platform. The organization will be
            provisioned with default settings.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="clerkId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clerk Organization ID</FormLabel>
                    <div className="flex space-x-2">
                      <FormControl>
                        <Input placeholder="org_123abc" {...field} />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleFetchFromClerk}
                        disabled={
                          isFetching ||
                          !form.getValues("clerkId") ||
                          form.formState.errors.clerkId !== undefined
                        }
                      >
                        {isFetching ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Fetch
                      </Button>
                    </div>
                    <FormDescription>
                      The Clerk Organization ID to link with
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Healthcare" {...field} />
                    </FormControl>
                    <FormDescription>
                      The name of the organization
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 (555) 123-4567" {...field} />
                    </FormControl>
                    <FormDescription>
                      The outbound phone number for this organization
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The organization's primary timezone for scheduling
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="concurrentCallLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Concurrent Call Limit</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        placeholder="20"
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? parseInt(e.target.value) : 0,
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum number of concurrent calls
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createOrgMutation.isPending}>
                {createOrgMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Organization"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
