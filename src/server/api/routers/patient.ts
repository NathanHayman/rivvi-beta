// src/server/api/routers/patient.ts
import { generatePatientHash } from "@/lib/patient-utils";
import { createTRPCRouter, orgProcedure } from "@/server/api/trpc";
import { calls, organizationPatients, patients } from "@/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

export const patientRouter = createTRPCRouter({
  // Get all patients for the current organization
  getAll: orgProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset, search } = input;
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      // Build query to get patients linked to the organization
      let baseCondition = and(
        eq(patients.id, organizationPatients.patientId),
        eq(organizationPatients.orgId, orgId),
        eq(organizationPatients.isActive, true),
      );

      // Add search filter if provided
      if (search && search.trim() !== "") {
        const searchTerm = `%${search.trim()}%`;
        const searchCondition = sql`(${patients.firstName} ILIKE ${searchTerm} OR 
             ${patients.lastName} ILIKE ${searchTerm} OR 
             ${patients.primaryPhone} LIKE ${searchTerm} OR
             ${organizationPatients.emrIdInOrg} LIKE ${searchTerm})`;

        baseCondition = and(baseCondition, searchCondition);
      }

      // Execute query with pagination
      const results = await ctx.db
        .select({
          patient: patients,
          organizationData: organizationPatients,
        })
        .from(patients)
        .innerJoin(organizationPatients, baseCondition)
        .limit(limit)
        .offset(offset)
        .orderBy(patients.lastName, patients.firstName);

      // Count total patients matching filter
      const [{ value: totalCount }] = (await ctx.db
        .select({ value: count() })
        .from(patients)
        .innerJoin(organizationPatients, baseCondition)) as [{ value: number }];

      // Format the response
      const patientsWithMetadata = results.map(
        ({ patient, organizationData }) => ({
          ...patient,
          emrIdInOrg: organizationData.emrIdInOrg,
        }),
      );

      return {
        patients: patientsWithMetadata,
        totalCount,
        hasMore: offset + limit < totalCount,
      };
    }),

  // Get a patient by ID
  getById: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      // Get patient and check if linked to organization
      const [result] = await ctx.db
        .select({
          patient: patients,
          organizationData: organizationPatients,
        })
        .from(patients)
        .innerJoin(
          organizationPatients,
          and(
            eq(patients.id, organizationPatients.patientId),
            eq(organizationPatients.orgId, orgId),
            eq(organizationPatients.isActive, true),
          ),
        )
        .where(eq(patients.id, input.id));

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Patient not found or not linked to your organization",
        });
      }

      // Get recent call count
      const callCount = await ctx.db
        .select({ value: count() })
        .from(calls)
        .where(and(eq(calls.patientId, input.id), eq(calls.orgId, orgId)))
        .then((res) => Number(res[0]?.value || 0));

      const lastCall = await ctx.db
        .select()
        .from(calls)
        .where(and(eq(calls.patientId, input.id), eq(calls.orgId, orgId)))
        .orderBy(desc(calls.createdAt))
        .limit(1)
        .then((res) => res[0] || null);

      return {
        ...result.patient,
        emrIdInOrg: result.organizationData.emrIdInOrg,
        callCount,
        lastCall,
      };
    }),

  // Create a new patient
  create: orgProcedure
    .input(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        dob: z.string().refine(
          (val) => {
            const date = new Date(val);
            return !isNaN(date.getTime());
          },
          {
            message: "Invalid date format",
          },
        ),
        primaryPhone: z.string().min(10),
        secondaryPhone: z.string().optional(),
        emrIdInOrg: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      const {
        firstName,
        lastName,
        dob,
        primaryPhone,
        secondaryPhone,
        emrIdInOrg,
      } = input;

      // Format date of birth
      const dobDate = new Date(dob);

      // Generate patient hash for deduplication
      const patientHash = generatePatientHash(primaryPhone, dob);

      // Check if patient with this hash already exists
      const existingPatient = await ctx.db
        .select()
        .from(patients)
        .where(eq(patients.patientHash, patientHash))
        .limit(1);

      let patientId;

      if (existingPatient.length > 0) {
        // Patient exists, check if linked to this organization
        patientId = existingPatient[0]?.id;

        // Ensure patientId is defined
        if (!patientId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to retrieve patient ID",
          });
        }

        const existingLink = await ctx.db
          .select()
          .from(organizationPatients)
          .where(
            and(
              eq(organizationPatients.patientId, patientId),
              eq(organizationPatients.orgId, orgId),
            ),
          )
          .limit(1);

        if (existingLink.length > 0) {
          // Already linked, update the link
          await ctx.db
            .update(organizationPatients)
            .set({
              emrIdInOrg,
              isActive: true,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(organizationPatients.patientId, patientId),
                eq(organizationPatients.orgId, orgId),
              ),
            );
        } else {
          // Create new link
          await ctx.db.insert(organizationPatients).values({
            orgId,
            patientId: patientId as string,
            emrIdInOrg: emrIdInOrg || null,
            isActive: true,
          });
        }

        // Update patient info with latest data
        await ctx.db
          .update(patients)
          .set({
            firstName,
            lastName,
            primaryPhone,
            secondaryPhone,
            updatedAt: new Date(),
          })
          .where(eq(patients.id, patientId as string));
      } else {
        // Create new patient
        const isMinor =
          dobDate < new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000);

        const [newPatient] = await ctx.db
          .insert(patients)
          .values({
            patientHash,
            firstName,
            lastName,
            dob: dobDate.toISOString(),
            isMinor,
            primaryPhone,
            secondaryPhone,
          })
          .returning();

        patientId = newPatient?.id;

        // Ensure patientId is defined
        if (!patientId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create patient record",
          });
        }

        // Link to organization
        await ctx.db.insert(organizationPatients).values({
          orgId,
          patientId: patientId as string,
          emrIdInOrg: emrIdInOrg || null,
          isActive: true,
        });
      }

      // Return the patient with organization data
      const [result] = await ctx.db
        .select({
          patient: patients,
          organizationData: organizationPatients,
        })
        .from(patients)
        .innerJoin(
          organizationPatients,
          and(
            eq(patients.id, organizationPatients.patientId),
            eq(organizationPatients.orgId, orgId),
          ),
        )
        .where(eq(patients.id, patientId as string));

      return {
        ...result?.patient,
        emrIdInOrg: result?.organizationData.emrIdInOrg,
      };
    }),

  // Update a patient
  update: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        primaryPhone: z.string().min(10).optional(),
        secondaryPhone: z.string().optional(),
        emrIdInOrg: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, emrIdInOrg, ...patientFields } = input;
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      // Check if patient exists and is linked to organization
      const [existingLink] = await ctx.db
        .select()
        .from(organizationPatients)
        .where(
          and(
            eq(organizationPatients.patientId, id),
            eq(organizationPatients.orgId, orgId),
            eq(organizationPatients.isActive, true),
          ),
        );

      if (!existingLink) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Patient not found or not linked to your organization",
        });
      }

      // Start a transaction to update both patient and link
      // Update patient fields if provided
      if (Object.keys(patientFields).length > 0) {
        await ctx.db
          .update(patients)
          .set({
            ...patientFields,
            updatedAt: new Date(),
          })
          .where(eq(patients.id, id));
      }

      // Update organization link if EMR ID is provided
      if (emrIdInOrg !== undefined) {
        await ctx.db
          .update(organizationPatients)
          .set({
            emrIdInOrg,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(organizationPatients.patientId, id),
              eq(organizationPatients.orgId, orgId),
            ),
          );
      }

      // Return updated patient with organization data
      const [result] = await ctx.db
        .select({
          patient: patients,
          organizationData: organizationPatients,
        })
        .from(patients)
        .innerJoin(
          organizationPatients,
          and(
            eq(patients.id, organizationPatients.patientId),
            eq(organizationPatients.orgId, orgId),
          ),
        )
        .where(eq(patients.id, id));

      return {
        ...result?.patient,
        emrIdInOrg: result?.organizationData.emrIdInOrg,
      };
    }),

  // Search patients by phone number
  searchByPhone: orgProcedure
    .input(z.object({ phone: z.string().min(4) }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.auth.organization?.id;

      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }

      // Clean phone input by removing non-digit characters
      const cleanPhone = input.phone.replace(/\D/g, "");

      if (cleanPhone.length < 4) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Phone number must contain at least 4 digits",
        });
      }

      // Search by phone number (including partial matches)
      const searchTerm = `%${cleanPhone}%`;

      const results = await ctx.db
        .select({
          patient: patients,
          organizationData: organizationPatients,
        })
        .from(patients)
        .innerJoin(
          organizationPatients,
          and(
            eq(patients.id, organizationPatients.patientId),
            eq(organizationPatients.orgId, orgId),
            eq(organizationPatients.isActive, true),
          ),
        )
        .where(
          or(
            sql`REPLACE(${patients.primaryPhone}, '-', '') LIKE ${searchTerm}`,
            sql`REPLACE(${patients.secondaryPhone}, '-', '') LIKE ${searchTerm}`,
          ),
        )
        .limit(10);

      return results.map(({ patient, organizationData }) => ({
        ...patient,
        emrIdInOrg: organizationData.emrIdInOrg,
      }));
    }),
});
