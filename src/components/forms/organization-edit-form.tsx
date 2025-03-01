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
import { api } from "@/trpc/react";
import { TIMEZONES } from "./organization-create-form";

// Form schema for editing organization
const EditOrganizationFormFormSchema = z.object({
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
  organizationId: string;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditOrganizationForm({
  organizationId,
  onOpenChange,
  onSuccess,
}: EditOrganizationFormFormProps) {
  const [weekendEnabled, setWeekendEnabled] = useState({
    saturday: false,
    sunday: false,
  });

  // Fetch organization data
  const { data: organization, isLoading } = api.organizations.getById.useQuery({
    id: organizationId,
  });

  // Form setup
  const form = useForm<EditOrganizationFormFormValues>({
    resolver: zodResolver(EditOrganizationFormFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      timezone: "America/New_York",
      concurrentCallLimit: 20,
      officeHours: DEFAULT_OFFICE_HOURS,
    },
  });

  // Update form when organization data is loaded
  useEffect(() => {
    if (organization) {
      form.reset({
        name: organization.name,
        phone: organization.phone || "",
        timezone: organization.timezone || "America/New_York",
        concurrentCallLimit: organization.concurrentCallLimit || 20,
        officeHours: organization.officeHours || DEFAULT_OFFICE_HOURS,
      });

      // Set weekend enabled states
      setWeekendEnabled({
        saturday: Boolean(organization.officeHours?.saturday),
        sunday: Boolean(organization.officeHours?.sunday),
      });
    }
  }, [organization, form]);

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
    form.setValue("officeHours", updatedOfficeHours as any);
  };

  // Update organization mutation
  const updateOrgMutation = api.organizations.update.useMutation({
    onSuccess: () => {
      toast.success("Organization updated successfully");
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      toast.error(`Error updating organization: ${error.message}`);
    },
  });

  // Handle form submission
  const onSubmit = (values: EditOrganizationFormFormValues) => {
    updateOrgMutation.mutate({
      id: organizationId,
      ...values,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Office Hours</h3>
            {["monday", "tuesday", "wednesday", "thursday", "friday"].map(
              (day) => (
                <div key={day} className="flex items-center gap-4">
                  <div className="w-28 capitalize">{day}</div>
                  <div className="flex flex-1 items-center gap-2">
                    <FormField
                      control={form.control}
                      name={`officeHours.${day}.start` as any}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <span>to</span>
                    <FormField
                      control={form.control}
                      name={`officeHours.${day}.end` as any}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ),
            )}

            {/* Weekend days with toggle */}
            {["saturday", "sunday"].map((day) => (
              <div key={day} className="flex items-center gap-4">
                <div className="flex w-28 items-center gap-2 capitalize">
                  <Switch
                    checked={weekendEnabled[day as "saturday" | "sunday"]}
                    onCheckedChange={(checked) =>
                      handleWeekendToggle(day as "saturday" | "sunday", checked)
                    }
                  />
                  {day}
                </div>
                <div className="flex flex-1 items-center gap-2">
                  {weekendEnabled[day as "saturday" | "sunday"] ? (
                    <>
                      <FormField
                        control={form.control}
                        name={`officeHours.${day}.start` as any}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <span>to</span>
                      <FormField
                        control={form.control}
                        name={`officeHours.${day}.end` as any}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">Closed</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange?.(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={updateOrgMutation.isPending}>
            {updateOrgMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Organization"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
