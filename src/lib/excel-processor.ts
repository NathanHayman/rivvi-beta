// src/lib/excel-processor.ts
import { db } from "@/server/db";
import { nanoid } from "nanoid";
import * as XLSX from "xlsx";
import { formatDate, formatPhoneNumber, isValidDate } from "./format-utils";
import { PatientService } from "./patient-service";

// Types for campaign configuration
type FieldConfig = {
  key: string;
  label: string;
  possibleColumns: string[];
  transform?: "text" | "date" | "time" | "phone" | "provider";
  required: boolean;
  description?: string;
};

type ValidationConfig = {
  requireValidPhone: boolean;
  requireValidDOB: boolean;
  requireName: boolean;
};

type CampaignConfig = {
  basePrompt: string;
  variables: {
    patient: {
      fields: FieldConfig[];
      validation: ValidationConfig;
    };
    campaign: {
      fields: FieldConfig[];
    };
  };
  postCall: {
    standard: {
      fields: any[];
    };
    campaign: {
      fields: any[];
    };
  };
};

// Result types
type ProcessedData = {
  validRows: {
    patientId: string | null;
    variables: Record<string, unknown>;
  }[];
  invalidRows: {
    index: number;
    rawData: Record<string, unknown>;
    error: string;
  }[];
  errors: string[];
  rawFileUrl: string;
  processedFileUrl: string;
};

/**
 * Find a matching column in the row data based on possible column names
 */
function findMatchingColumn(
  row: Record<string, unknown>,
  possibleColumns: string[],
): string | null {
  const rowKeys = Object.keys(row).map((key) => key.toLowerCase().trim());

  for (const column of possibleColumns) {
    const normalizedColumn = column.toLowerCase().trim();
    const matchIndex = rowKeys.findIndex((key) => key === normalizedColumn);
    if (matchIndex !== -1) {
      return Object.keys(row)[matchIndex] || null;
    }
  }

  return null;
}

/**
 * Transform field value based on the specified transform type
 */
function transformValue(value: unknown, transform?: string): unknown {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const stringValue = String(value).trim();
  if (!stringValue) {
    return null;
  }

  switch (transform) {
    case "date":
      return formatDate(stringValue);
    case "phone":
      return formatPhoneNumber(stringValue);
    case "text":
    default:
      return stringValue;
  }
}

/**
 * Validate a patient record against the configuration
 */
function validatePatientData(
  patientData: Record<string, unknown>,
  validation: ValidationConfig,
): string | null {
  // Check for required phone
  if (validation.requireValidPhone && !patientData.phone) {
    return "Valid phone number is required";
  }

  // Check for valid DOB
  if (validation.requireValidDOB && patientData.dob) {
    if (!isValidDate(String(patientData.dob))) {
      return "Valid date of birth is required";
    }
  } else if (validation.requireValidDOB) {
    return "Date of birth is required";
  }

  // Check for name
  if (validation.requireName) {
    if (!patientData.firstName) {
      return "First name is required";
    }
    if (!patientData.lastName) {
      return "Last name is required";
    }
  }

  return null;
}

/**
 * Extract field values from a row based on field configuration
 */
function extractFields(
  row: Record<string, unknown>,
  fields: FieldConfig[],
): {
  extractedData: Record<string, unknown>;
  missingRequired: string[];
} {
  const extractedData: Record<string, unknown> = {};
  const missingRequired: string[] = [];

  for (const field of fields) {
    const columnName = findMatchingColumn(row, field.possibleColumns);

    if (columnName) {
      const rawValue = row[columnName];
      extractedData[field.key] = transformValue(rawValue, field.transform);
    } else if (field.required) {
      missingRequired.push(field.label);
    }
  }

  return { extractedData, missingRequired };
}

/**
 * Process Excel file content according to campaign configuration
 * Returns the processed data including valid rows, invalid rows, and error information
 */
export async function processExcelFile(
  fileContent: string,
  fileName: string,
  config: CampaignConfig,
): Promise<ProcessedData> {
  const patientService = new PatientService(db);
  const result: ProcessedData = {
    validRows: [],
    invalidRows: [],
    errors: [],
    rawFileUrl: "",
    processedFileUrl: "",
  };

  try {
    // Parse base64 content or buffer
    let workbook;
    if (fileContent.startsWith("data:")) {
      const base64Content = fileContent.split(",")[1];
      workbook = XLSX.read(base64Content, { type: "base64" });
    } else {
      workbook = XLSX.read(fileContent, { type: "string" });
    }

    // Get the first sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName || ""];

    // Convert to JSON
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      worksheet || {},
    );

    if (rows.length === 0) {
      throw new Error("No data found in the uploaded file");
    }

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        // Extract patient data
        const {
          extractedData: patientData,
          missingRequired: missingPatientFields,
        } = extractFields(row || {}, config.variables.patient.fields);

        // Check for missing required patient fields
        if (missingPatientFields.length > 0) {
          throw new Error(
            `Missing required patient fields: ${missingPatientFields.join(", ")}`,
          );
        }

        // Validate patient data
        const validationError = validatePatientData(
          patientData,
          config.variables.patient.validation,
        );
        if (validationError) {
          throw new Error(validationError);
        }

        // Extract campaign data
        const {
          extractedData: campaignData,
          missingRequired: missingCampaignFields,
        } = extractFields(row || {}, config.variables.campaign.fields);

        // Check for missing required campaign fields
        if (missingCampaignFields.length > 0) {
          throw new Error(
            `Missing required campaign fields: ${missingCampaignFields.join(", ")}`,
          );
        }

        // Process patient record - find or create in database
        let patientId: string | null = null;
        if (
          patientData.firstName &&
          patientData.lastName &&
          patientData.phone &&
          patientData.dob
        ) {
          const patient = await patientService.findOrCreatePatient({
            firstName: String(patientData.firstName),
            lastName: String(patientData.lastName),
            dob: String(patientData.dob),
            phone: String(patientData.phone),
            emrId: patientData.emrId ? String(patientData.emrId) : undefined,
          });

          patientId = patient?.id ?? null;
        }

        // Combine all variables
        const variables = {
          ...patientData,
          ...campaignData,
        };

        // Add to valid rows
        result.validRows.push({
          patientId,
          variables,
        });
      } catch (error) {
        // Add to invalid rows
        result.invalidRows.push({
          index: i + 2, // +2 for 1-based index and header row
          rawData: row || {},
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Store file URLs (in a real implementation, you might upload to S3 or another storage service)
    const fileId = nanoid();
    result.rawFileUrl = `/uploads/${fileId}_raw.xlsx`;
    result.processedFileUrl = `/uploads/${fileId}_processed.xlsx`;

    // Collect general errors
    if (result.validRows.length === 0 && rows.length > 0) {
      result.errors.push("No valid rows could be processed from the file");
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}
