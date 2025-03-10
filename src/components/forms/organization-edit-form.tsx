"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { TIMEZONES } from "./organization-create-form";
// Import server actions
import { updateOrganization } from "@/server/actions/organizations";
import { ZOrganization } from "@/types/zod";

// Form schema for editing organization
const EditOrganizationFormFormSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Organization name is required"),
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

type EditOrganizationFormFormValues = z.infer<
  typeof EditOrganizationFormFormSchema
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

interface EditOrganizationFormFormProps {
  organization: ZOrganization;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditOrganizationForm({
  organization,
  onOpenChange,
  onSuccess,
}: EditOrganizationFormFormProps) {
  const [weekendEnabled, setWeekendEnabled] = useState({
    saturday: false,
    sunday: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form setup
  const form = useForm<EditOrganizationFormFormValues>({
    resolver: zodResolver(EditOrganizationFormFormSchema),
    defaultValues: {
      id: organization.id,
      name: organization.name,
      phone: organization.phone || "",
      timezone: organization.timezone || "America/New_York",
      concurrentCallLimit: organization.concurrentCallLimit || 20,
      officeHours: organization.officeHours || DEFAULT_OFFICE_HOURS,
    },
  });

  // Initialize weekend enabled state based on organization's office hours
  useEffect(() => {
    if (organization.officeHours) {
      setWeekendEnabled({
        saturday: Boolean(organization.officeHours.saturday),
        sunday: Boolean(organization.officeHours.sunday),
      });

      // Ensure the form has the correct office hours values
      const officeHours = {
        ...organization.officeHours,
        // If weekend days are enabled but null, initialize them with default values
        saturday:
          organization.officeHours.saturday ||
          (organization.officeHours.saturday === null
            ? null
            : { start: "09:00", end: "17:00" }),
        sunday:
          organization.officeHours.sunday ||
          (organization.officeHours.sunday === null
            ? null
            : { start: "09:00", end: "17:00" }),
      };

      form.setValue("officeHours", officeHours);
    }
  }, [organization.officeHours, form]);

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
  const onSubmit = async (values: EditOrganizationFormFormValues) => {
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

      // Prepare the data for submission
      const formData = {
        id: organization.id,
        name: values.name,
        phone: values.phone,
        timezone: values.timezone,
        concurrentCallLimit: values.concurrentCallLimit,
        officeHours,
      };

      await updateOrganization(formData);
      toast.success("Organization updated successfully");
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error updating organization:", error);
      toast.error(
        `Error updating organization: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Organization Name</FormLabel>
                <FormControl>
                  <Input placeholder="Acme Healthcare" {...field} />
                </FormControl>
                <FormDescription>The name of the organization</FormDescription>
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
                        e.target.value === ""
                          ? ""
                          : parseInt(e.target.value, 10),
                      )
                    }
                  />
                </FormControl>
                <FormDescription>
                  Maximum number of concurrent calls allowed
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Office Hours Section */}
          <div className="w-full space-y-4">
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
                      handleWeekendToggle(day as "saturday" | "sunday", checked)
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
          Update Organization
        </Button>
      </form>
    </Form>
  );
}
