// src/services/patient-service.ts
import { isMinor } from "@/lib/patient/patient-utils";
import { db } from "@/server/db";
import { organizationPatients, patients } from "@/server/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, or, sql, SQL } from "drizzle-orm";

interface PatientCreateParams {
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  patientHash: string;
  emrId?: string;
  orgId?: string;
}

interface PatientSearchParams {
  patientHash?: string;
  phone?: string;
  emrId?: string;
  orgId?: string;
}

/**
 * Find a patient by multiple identifiers
 */
export async function findPatientByIdentifiers(params: PatientSearchParams) {
  const { patientHash, phone, emrId, orgId } = params;

  try {
    // Try to find by hash first (most accurate)
    if (patientHash) {
      const [patient] = await db
        .select()
        .from(patients)
        .where(eq(patients.patientHash, patientHash))
        .limit(1);

      if (patient) {
        // If we have an orgId, link the patient to the organization if not already linked
        if (orgId) {
          await linkPatientToOrganization(patient.id, orgId, emrId);
        }
        return patient;
      }
    }

    // Try by phone as fallback
    if (phone) {
      const [patient] = await db
        .select()
        .from(patients)
        .where(eq(patients.primaryPhone, phone))
        .limit(1);

      if (patient) {
        // If we have an orgId, link the patient to the organization if not already linked
        if (orgId) {
          await linkPatientToOrganization(patient.id, orgId, emrId);
        }
        return patient;
      }
    }

    // Try by EMR ID within the organization if both are provided
    if (emrId && orgId) {
      const result = await db
        .select({
          patient: patients,
        })
        .from(organizationPatients)
        .innerJoin(patients, eq(organizationPatients.patientId, patients.id))
        .where(
          and(
            eq(organizationPatients.orgId, orgId),
            eq(organizationPatients.emrIdInOrg, emrId),
          ),
        )
        .limit(1);

      if (result.length > 0) {
        return result[0]?.patient;
      }
    }

    return null;
  } catch (error) {
    console.error("Error finding patient:", error);
    return null;
  }
}

/**
 * Create a new patient
 */
export async function createPatient(params: PatientCreateParams) {
  const { firstName, lastName, dob, phone, patientHash, emrId, orgId } = params;

  try {
    // Check if patient already exists
    const existingPatient = await findPatientByIdentifiers({
      patientHash,
      phone,
    });
    if (existingPatient) {
      // If patient exists and orgId is provided, link to organization
      if (orgId) {
        await linkPatientToOrganization(existingPatient.id, orgId, emrId);
      }
      return existingPatient;
    }

    // Create new patient
    const dobDate = new Date(dob);
    const patientMinor = isMinor(dobDate);

    const [patient] = await db
      .insert(patients)
      .values({
        id: createId(),
        firstName,
        lastName,
        dob: dobDate.toISOString(),
        primaryPhone: phone,
        patientHash,
        isMinor: patientMinor,
      })
      .returning();

    // If orgId is provided, link patient to organization
    if (orgId && patient) {
      await linkPatientToOrganization(patient.id, orgId, emrId);
    }

    return patient;
  } catch (error) {
    console.error("Error creating patient:", error);
    return null;
  }
}

/**
 * Link a patient to an organization
 */
export async function linkPatientToOrganization(
  patientId: string,
  orgId: string,
  emrIdInOrg?: string,
) {
  try {
    // Check if link already exists
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
      // Update existing link
      await db
        .update(organizationPatients)
        .set({
          emrIdInOrg: emrIdInOrg || existingLink[0]?.emrIdInOrg,
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
      await db.insert(organizationPatients).values({
        orgId,
        patientId,
        emrIdInOrg: emrIdInOrg || null,
        isActive: true,
      });
    }

    return true;
  } catch (error) {
    console.error("Error linking patient to organization:", error);
    return false;
  }
}

/**
 * Get patients for an organization with pagination
 */
export async function getOrganizationPatients(
  orgId: string,
  options: {
    limit?: number;
    offset?: number;
    search?: string;
  } = {},
) {
  const { limit = 50, offset = 0, search } = options;

  try {
    let whereCondition = and(
      eq(patients.id, organizationPatients.patientId),
      eq(organizationPatients.orgId, orgId),
      eq(organizationPatients.isActive, true),
    );

    // Add search if provided
    if (search && search.trim() !== "") {
      const searchTerm = `%${search.trim()}%`;
      whereCondition = and(
        whereCondition,
        or(
          sql`${patients.firstName} ILIKE ${searchTerm}`,
          sql`${patients.lastName} ILIKE ${searchTerm}`,
          sql`${patients.primaryPhone} LIKE ${searchTerm}`,
          sql`${organizationPatients.emrIdInOrg} LIKE ${searchTerm}`,
        ),
      ) as SQL<unknown>;
    }

    let query = db
      .select({
        patient: patients,
        emrIdInOrg: organizationPatients.emrIdInOrg,
      })
      .from(patients)
      .innerJoin(organizationPatients, whereCondition)
      .limit(limit)
      .offset(offset);

    const results = await query;

    // Count total matching the same criteria
    const [countResult] = await db
      .select({
        count: sql`COUNT(*)`.mapWith(Number),
      })
      .from(patients)
      .innerJoin(organizationPatients, whereCondition);

    const count = countResult?.count ?? 0;

    return {
      patients: results.map((r) => ({
        ...r.patient,
        emrIdInOrg: r.emrIdInOrg,
      })),
      totalCount: count,
      hasMore: offset + limit < count,
    };
  } catch (error) {
    console.error("Error getting organization patients:", error);
    return {
      patients: [],
      totalCount: 0,
      hasMore: false,
    };
  }
}

/**
 * Get a patient by ID for an organization
 */
export async function getPatientById(patientId: string, orgId: string) {
  try {
    const result = await db
      .select({
        patient: patients,
        emrIdInOrg: organizationPatients.emrIdInOrg,
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
      .where(eq(patients.id, patientId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return {
      ...result[0]?.patient,
      emrIdInOrg: result[0]?.emrIdInOrg,
    };
  } catch (error) {
    console.error("Error getting patient by ID:", error);
    return null;
  }
}
