// src/lib/patient-service.ts
import { organizationPatients, patients } from "@/server/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { generatePatientHash } from "./patient-utils";

type DatabaseClient = typeof import("@/server/db").db;

type PatientInput = {
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  secondaryPhone?: string;
  emrId?: string;
  orgId?: string;
};

type PatientResult = {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  primaryPhone: string;
  patientHash: string;
  isNewPatient: boolean;
};

export class PatientService {
  private db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  /**
   * Find or create a patient based on provided information
   */
  async findOrCreatePatient(
    input: PatientInput,
  ): Promise<PatientResult | null> {
    const { firstName, lastName, dob, phone, secondaryPhone, emrId, orgId } =
      input;

    try {
      // Generate a hash for deduplication
      const patientHash = generatePatientHash(phone, dob);

      // Check if patient already exists
      const existingPatients = await this.db
        .select()
        .from(patients)
        .where(eq(patients.patientHash, patientHash));

      let patient;
      let isNewPatient = false;

      if (existingPatients.length > 0) {
        // Patient exists, use the first match
        patient = existingPatients[0];

        // Optionally update patient info
        if (firstName && lastName) {
          await this.db
            .update(patients)
            .set({
              firstName,
              lastName,
              updatedAt: new Date(),
            })
            .where(eq(patients.id, patient?.id || ""));
        }
      } else {
        // Create new patient
        const dobDate = new Date(dob);
        const isMinor =
          dobDate > new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000);

        const [newPatient] = await this.db
          .insert(patients)
          .values({
            id: createId(),
            patientHash,
            firstName,
            lastName,
            dob: dobDate.toISOString(),
            isMinor,
            primaryPhone: phone,
            secondaryPhone: secondaryPhone,
          })
          .returning();

        patient = newPatient;
        isNewPatient = true;
      }

      // If orgId is provided, link patient to organization
      if (orgId && patient) {
        // Check if link already exists
        const existingLinks = await this.db
          .select()
          .from(organizationPatients)
          .where(
            and(
              eq(organizationPatients.patientId, patient.id),
              eq(organizationPatients.orgId, orgId),
            ),
          );

        if (existingLinks.length === 0) {
          // Create link
          await this.db.insert(organizationPatients).values({
            orgId,
            patientId: patient.id,
            emrIdInOrg: emrId,
            isActive: true,
          });
        } else if (emrId) {
          // Update EMR ID if provided
          await this.db
            .update(organizationPatients)
            .set({
              emrIdInOrg: emrId,
              isActive: true,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(organizationPatients.patientId, patient.id),
                eq(organizationPatients.orgId, orgId),
              ),
            );
        }
      }

      // Return patient with additional metadata
      return {
        id: patient?.id || "",
        firstName: patient?.firstName || "",
        lastName: patient?.lastName || "",
        dob: patient?.dob.toString() || "",
        primaryPhone: patient?.primaryPhone || "",
        patientHash: patient?.patientHash || "",
        isNewPatient,
      };
    } catch (error) {
      console.error("Error in findOrCreatePatient:", error);
      return null;
    }
  }

  /**
   * Find a patient by phone number
   */
  async findPatientByPhone(
    phone: string,
    orgId?: string,
  ): Promise<typeof patients.$inferSelect | null> {
    try {
      // Clean phone input
      const cleanPhone = phone.replace(/\D/g, "");

      // Find patients with matching phone
      const matchingPatients = await this.db
        .select()
        .from(patients)
        .where(eq(patients.primaryPhone, cleanPhone));

      if (matchingPatients.length === 0) {
        // Try with secondary phone
        const matchingSecondary = await this.db
          .select()
          .from(patients)
          .where(eq(patients.secondaryPhone, cleanPhone));

        if (matchingSecondary.length === 0) {
          return null;
        }

        // Use the first match from secondary phone
        return matchingSecondary[0] || null;
      }

      // If we have an orgId, prioritize patients linked to that org
      if (orgId && matchingPatients.length > 1) {
        for (const patient of matchingPatients) {
          const links = await this.db
            .select()
            .from(organizationPatients)
            .where(
              and(
                eq(organizationPatients.patientId, patient.id),
                eq(organizationPatients.orgId, orgId),
                eq(organizationPatients.isActive, true),
              ),
            );

          if (links.length > 0) {
            return patient;
          }
        }
      }

      // Default to first match
      return matchingPatients[0] || null;
    } catch (error) {
      console.error("Error in findPatientByPhone:", error);
      return null;
    }
  }

  /**
   * Find a patient by ID
   */
  async findPatientById(
    id: string,
  ): Promise<typeof patients.$inferSelect | null> {
    try {
      const [patient] = await this.db
        .select()
        .from(patients)
        .where(eq(patients.id, id));

      return patient || null;
    } catch (error) {
      console.error("Error in findPatientById:", error);
      return null;
    }
  }
}
