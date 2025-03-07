import { z } from "zod";

/**
 * Update Organization
 */
const updateOrgSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  officeHours: z.record(z.any()).optional(),
  concurrentCallLimit: z.number().min(1).max(100).optional(),
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

export { getMembersSchema, updateOrgSchema, type TGetMembers, type TUpdateOrg };
