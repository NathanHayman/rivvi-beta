import { z } from "zod";

// Define the office hours schema
const officeHourSchema = z.object({
  start: z.string(),
  end: z.string(),
});

const officeHoursSchema = z.object({
  monday: officeHourSchema,
  tuesday: officeHourSchema,
  wednesday: officeHourSchema,
  thursday: officeHourSchema,
  friday: officeHourSchema,
  saturday: officeHourSchema.nullable().optional(),
  sunday: officeHourSchema.nullable().optional(),
});

/**
 * Update Organization
 */
const updateOrgSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Organization name is required"),
  phone: z.string().min(10, "Phone number is required"),
  timezone: z.string().min(1, "Timezone is required"),
  concurrentCallLimit: z.number().int().min(1).max(100),
  officeHours: officeHoursSchema.optional(),
});

type TUpdateOrg = z.infer<typeof updateOrgSchema>;

/**
 * Get Members
 */
const getMembersSchema = z.object({
  organizationId: z.string().uuid().optional(),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

type TGetMembers = z.infer<typeof getMembersSchema>;

/**
 * Invite User to Organization
 */
const inviteUserToOrganizationSchema = z.object({
  emailAddress: z.string().email(),
  role: z.enum(["member", "admin", "superadmin"]),
});

type TInviteUserToOrganization = z.infer<typeof inviteUserToOrganizationSchema>;

export {
  getMembersSchema,
  inviteUserToOrganizationSchema,
  updateOrgSchema,
  type TGetMembers,
  type TInviteUserToOrganization,
  type TUpdateOrg,
};
