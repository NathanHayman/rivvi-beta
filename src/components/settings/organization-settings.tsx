"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  getCurrentOrganization,
  updateOrganization,
} from "@/server/actions/organizations";
import { useRouter } from "next/navigation";

// Timezone options
export const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "America/Puerto_Rico", label: "Atlantic Time (AT)" },
];

// Form schema for editing limited organization settings
const OrganizationSettingsFormSchema = z.object({
  id: z.string(),
  timezone: z.string().min(1, "Timezone is required"),
  officeHours: z
    .object({
      monday: z.object({
        start: z.string(),
        end: z.string(),
      }),
      tuesday: z.object({
        start: z.string(),
        end: z.string(),
      }),
      wednesday: z.object({
        start: z.string(),
        end: z.string(),
      }),
      thursday: z.object({
        start: z.string(),
        end: z.string(),
      }),
      friday: z.object({
        start: z.string(),
        end: z.string(),
      }),
      saturday: z
        .object({
          start: z.string(),
          end: z.string(),
        })
        .nullable()
        .optional(),
      sunday: z
        .object({
          start: z.string(),
          end: z.string(),
        })
        .nullable()
        .optional(),
    })
    .optional(),
});

type OrganizationSettingsFormValues = z.infer<
  typeof OrganizationSettingsFormSchema
>;

const DEFAULT_OFFICE_HOURS = {
  monday: { start: "09:00", end: "17:00" },
  tuesday: { start: "09:00", end: "17:00" },
  wednesday: { start: "09:00", end: "17:00" },
  thursday: { start: "09:00", end: "17:00" },
  friday: { start: "09:00", end: "17:00" },
  saturday: null,
  sunday: null,
};

export function OrganizationSettings() {
  const [organization, setOrganization] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [weekendEnabled, setWeekendEnabled] = useState({
    saturday: false,
    sunday: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<OrganizationSettingsFormValues>({
    resolver: zodResolver(OrganizationSettingsFormSchema),
    defaultValues: {
      id: "",
      timezone: "America/New_York",
      officeHours: DEFAULT_OFFICE_HOURS,
    },
  });

  // Fetch organization data
  useEffect(() => {
    async function fetchOrganization() {
      try {
        const org = await getCurrentOrganization();
        setOrganization(org);

        // Set form values
        form.reset({
          id: org.id,
          timezone: org.timezone || "America/New_York",
          officeHours: org.officeHours || DEFAULT_OFFICE_HOURS,
        });

        // Initialize weekend toggles
        if (org.officeHours) {
          setWeekendEnabled({
            saturday: Boolean(org.officeHours.saturday),
            sunday: Boolean(org.officeHours.sunday),
          });
        }
      } catch (error) {
        console.error("Error fetching organization:", error);
        toast.error("Could not load organization settings");
      } finally {
        setLoading(false);
      }
    }

    fetchOrganization();
  }, [form]);

  // Handle office hours changes
  const handleWeekendToggle = (
    day: "saturday" | "sunday",
    enabled: boolean,
  ) => {
    setWeekendEnabled((prev) => ({ ...prev, [day]: enabled }));

    const updatedOfficeHours = { ...form.getValues("officeHours") };
    if (enabled) {
      updatedOfficeHours[day] = { start: "09:00", end: "17:00" };
    } else {
      updatedOfficeHours[day] = null;
    }
    form.setValue("officeHours", updatedOfficeHours as any, {
      shouldValidate: true,
    });
  };

  // Handle form submission
  const onSubmit = async (values: OrganizationSettingsFormValues) => {
    try {
      setIsSubmitting(true);

      // Prepare the office hours data
      const officeHours = { ...values.officeHours };

      // Ensure weekend days are properly set based on the enabled state
      if (!weekendEnabled.saturday) {
        officeHours.saturday = null;
      }

      if (!weekendEnabled.sunday) {
        officeHours.sunday = null;
      }

      // Preserve original organization information that members can't change
      const formData = {
        id: organization.id,
        name: organization.name,
        phone: organization.phone,
        concurrentCallLimit: organization.concurrentCallLimit,
        timezone: values.timezone,
        officeHours,
      };

      await updateOrganization(formData);
      toast.success("Organization settings updated successfully");
      router.refresh();
    } catch (error) {
      console.error("Error updating organization:", error);
      toast.error(
        `Error updating organization: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-8 w-64" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-96" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Organization Settings</CardTitle>
        <CardDescription>
          Manage your organization&apos;s settings and preferences
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Name - Read Only */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Organization Name</h3>
                  <Input
                    value={organization?.name || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-sm text-muted-foreground">
                    Your organization&apos;s name cannot be changed
                  </p>
                </div>

                {/* Phone - Read Only */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Phone Number</h3>
                  <Input
                    value={organization?.phone || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-sm text-muted-foreground">
                    Contact support to change organization phone number
                  </p>
                </div>
              </div>

              {/* Concurrent Call Limit - Read Only */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Concurrent Call Limit</h3>
                <Input
                  value={organization?.concurrentCallLimit?.toString() || "20"}
                  disabled
                  className="bg-muted"
                />
                <p className="text-sm text-muted-foreground">
                  Contact support to change your organization&apos;s concurrent
                  call limit
                </p>
              </div>

              {/* Timezone - Editable */}
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                      The organization&apos;s primary timezone for scheduling
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Office Hours Section - Editable */}
              <div className="mt-6 w-full space-y-4">
                <h3 className="text-lg font-medium">Office Hours</h3>
                <p className="text-sm text-muted-foreground">
                  Set the hours when your organization is available for calls
                </p>

                {/* Weekday Office Hours */}
                {["monday", "tuesday", "wednesday", "thursday", "friday"].map(
                  (day) => (
                    <div
                      key={day}
                      className="grid w-full grid-cols-3 items-center gap-4"
                    >
                      <div className="capitalize">{day}</div>
                      <div className="col-span-2 flex items-center gap-2">
                        <Input
                          type="time"
                          className="w-24"
                          {...form.register(`officeHours.${day}.start` as any)}
                        />
                        <span>to</span>
                        <Input
                          type="time"
                          className="w-24"
                          {...form.register(`officeHours.${day}.end` as any)}
                        />
                      </div>
                    </div>
                  ),
                )}

                {/* Weekend Office Hours */}
                {["saturday", "sunday"].map((day) => (
                  <div
                    key={day}
                    className="grid w-full grid-cols-3 items-center gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={weekendEnabled[day as "saturday" | "sunday"]}
                        onCheckedChange={(checked) =>
                          handleWeekendToggle(
                            day as "saturday" | "sunday",
                            checked,
                          )
                        }
                      />
                      <span className="capitalize">{day}</span>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <Input
                        type="time"
                        className="w-24"
                        disabled={!weekendEnabled[day as "saturday" | "sunday"]}
                        {...form.register(`officeHours.${day}.start` as any)}
                      />
                      <span>to</span>
                      <Input
                        type="time"
                        className="w-24"
                        disabled={!weekendEnabled[day as "saturday" | "sunday"]}
                        {...form.register(`officeHours.${day}.end` as any)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
