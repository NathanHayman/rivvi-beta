// src/services/patients/patients-service.ts
import {
  ServiceResult,
  createError,
  createSuccess,
} from "@/lib/service-result";
import { type TCreatePatient } from "@/lib/validation/patients";
import { db } from "@/server/db";
import { calls, organizationPatients, patients } from "@/server/db/schema";
import {
  PatientSearchOptions,
  PatientWithMetadata,
} from "@/types/api/patients";
import { and, count, desc, eq, sql } from "drizzle-orm";

export const patientService = {
  async getAll(options: PatientSearchOptions): Promise<
    ServiceResult<{
      patients: PatientWithMetadata[];
      totalCount: number;
      hasMore: boolean;
    }>
  > {
    try {
      const { limit = 50, offset = 0, search, orgId } = options;

      // Build base condition for organization association
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
      const results = await db
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
      const [{ value: totalCount }] = await db
        .select({ value: count() })
        .from(patients)
        .innerJoin(organizationPatients, baseCondition);

      // Format the response
      const patientsWithMetadata = results.map(
        ({ patient, organizationData }) => ({
          ...patient,
          emrIdInOrg: organizationData.emrIdInOrg,
          createdAt: patient.createdAt.toISOString(),
          updatedAt: patient.updatedAt?.toISOString(),
        }),
      );

      return createSuccess({
        patients: patientsWithMetadata,
        totalCount: Number(totalCount),
        hasMore: offset + limit < Number(totalCount),
      });
    } catch (error) {
      console.error("Error fetching patients:", error);
      return createError("INTERNAL_ERROR", "Failed to fetch patients", error);
    }
  },

  async getById(
    id: string,
    orgId: string,
  ): Promise<ServiceResult<PatientWithMetadata>> {
    try {
      // Get patient and check if linked to organization
      const [result] = await db
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
        .where(eq(patients.id, id));

      if (!result) {
        return createError(
          "NOT_FOUND",
          "Patient not found or not linked to your organization",
        );
      }

      // Get recent call count
      const [{ value: callCount }] = await db
        .select({ value: count() })
        .from(calls)
        .where(and(eq(calls.patientId, id), eq(calls.orgId, orgId)));

      // Get last call
      const [lastCall] = await db
        .select()
        .from(calls)
        .where(and(eq(calls.patientId, id), eq(calls.orgId, orgId)))
        .orderBy(desc(calls.createdAt))
        .limit(1);

      return createSuccess({
        ...result.patient,
        emrIdInOrg: result.organizationData.emrIdInOrg,
        callCount: Number(callCount),
        lastCall: lastCall || null,
        createdAt: result.patient.createdAt.toISOString(),
        updatedAt: result.patient.updatedAt?.toISOString(),
      });
    } catch (error) {
      console.error("Error fetching patient:", error);
      return createError("INTERNAL_ERROR", "Failed to fetch patient", error);
    }
  },

  // Generate patient hash for deduplication
  generatePatientHash(
    firstName: string,
    lastName: string,
    dob: string,
    phone: string,
  ): string {
    // Clean inputs
    const cleanFirstName = firstName.toLowerCase().trim();
    const cleanLastName = lastName.toLowerCase().trim();
    const cleanDob = new Date(dob).toISOString().split("T")[0]; // YYYY-MM-DD
    const cleanPhone = phone.replace(/\D/g, "");

    // Create hash
    return `${cleanFirstName}|${cleanLastName}|${cleanDob}|${cleanPhone}`;
  },

  async create(
    data: TCreatePatient,
  ): Promise<ServiceResult<PatientWithMetadata>> {
    try {
      const {
        firstName,
        lastName,
        dob,
        primaryPhone,
        secondaryPhone,
        emrIdInOrg,
        orgId,
      } = data;

      // Format date of birth
      const dobDate = new Date(dob);

      // Generate patient hash for deduplication
      const patientHash = this.generatePatientHash(
        firstName,
        lastName,
        dob,
        primaryPhone,
      );

      // Check if patient with this hash already exists
      const existingPatient = await db
        .select()
        .from(patients)
        .where(eq(patients.patientHash, patientHash))
        .limit(1);

      let patientId;

      if (existingPatient.length > 0) {
        // Patient exists, check if linked to this organization
        patientId = existingPatient[0]?.id;

        if (!patientId) {
          return createError("INTERNAL_ERROR", "Failed to retrieve patient ID");
        }

        const existingLink = await db
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
          await db
            .update(organizationPatients)
            .set({
              emrIdInOrg: emrIdInOrg,
              isActive: true,
              updatedAt: new Date(),
            } as Partial<typeof organizationPatients.$inferInsert>)
            .where(
              and(
                eq(organizationPatients.patientId, patientId),
                eq(organizationPatients.orgId, orgId),
              ),
            );
        } else {
          // Create new link
          await db.insert(organizationPatients).values({
            orgId,
            patientId,
            emrIdInOrg: emrIdInOrg || null,
            isActive: true,
          } as typeof organizationPatients.$inferInsert);
        }

        // Update patient info with latest data
        await db
          .update(patients)
          .set({
            firstName,
            lastName,
            primaryPhone,
            secondaryPhone,
          } as Partial<typeof patients.$inferInsert>)
          .where(eq(patients.id, patientId));
      } else {
        // Create new patient
        const isMinor =
          dobDate < new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000);

        const [newPatient] = await db
          .insert(patients)
          .values({
            patientHash,
            firstName,
            lastName,
            dob: dobDate.toISOString(),
            isMinor,
            primaryPhone,
            secondaryPhone,
          } as typeof patients.$inferInsert)
          .returning();

        patientId = newPatient?.id;

        if (!patientId) {
          return createError(
            "INTERNAL_ERROR",
            "Failed to create patient record",
          );
        }

        // Link to organization
        await db.insert(organizationPatients).values({
          orgId,
          patientId,
          emrIdInOrg: emrIdInOrg || null,
          isActive: true,
        } as typeof organizationPatients.$inferInsert);
      }

      // Return the patient with organization data
      const [result] = await db
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
        .where(eq(patients.id, patientId));

      return createSuccess({
        ...result?.patient,
        emrIdInOrg: result?.organizationData.emrIdInOrg,
        createdAt: result?.patient.createdAt.toISOString(),
        updatedAt: result?.patient.updatedAt?.toISOString(),
      });
    } catch (error) {
      console.error("Error creating patient:", error);
      return createError("INTERNAL_ERROR", "Failed to create patient", error);
    }
  },
};
