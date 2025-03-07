import { z } from "zod";

/**
 * Create Organization
 */
const createOrganizationSchema = z.object({
  name: z.string().min(1),
  clerkId: z.string(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  concurrentCallLimit: z.number().min(1).max(100).optional(),
  isSuperAdmin: z.boolean().optional(),
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
      saturday: z.object({
        start: z.string(),
        end: z.string(),
      }),
      sunday: z.object({
        start: z.string(),
        end: z.string(),
      }),
    })
    .optional(),
});
type TCreateOrganization = z.infer<typeof createOrganizationSchema>;

/**
 * Get Organizations
 */
const getOrganizationsSchema = z.object({
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
  search: z.string().optional(),
});
type TGetOrganizations = z.infer<typeof getOrganizationsSchema>;

export {
  createOrganizationSchema,
  getOrganizationsSchema,
  type TCreateOrganization,
  type TGetOrganizations,
};
