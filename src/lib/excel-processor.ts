// src/lib/excel-processor.ts
import { db } from "@/server/db";
import { createHash } from "crypto";
import { nanoid } from "nanoid";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { formatDate, formatPhoneNumber, isValidDate } from "./format-utils";
import { PatientService } from "./patient/patient-service";

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
  analysis: {
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
    patientHash: string | null;
    variables: Record<string, unknown>;
  }[];
  invalidRows: {
    index: number;
    rawData: Record<string, unknown>;
    error: string;
  }[];
  stats: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    uniquePatients: number;
    duplicatePatients: number;
  };
  columnMappings: Record<string, string>;
  errors: string[];
  rawFileUrl: string;
  processedFileUrl: string;
};

/**
 * Parse file content based on file type (Excel or CSV)
 */
export function parseFileContent(
  fileContent: string | ArrayBuffer,
  fileName: string,
): { headers: string[]; rows: Record<string, unknown>[] } {
  try {
    if (fileName.toLowerCase().endsWith(".csv")) {
      // Parse CSV
      let csvText: string;
      if (typeof fileContent === "string") {
        if (fileContent.startsWith("data:")) {
          const base64Content = fileContent.split(",")[1];
          if (base64Content) {
            csvText = atob(base64Content);
          } else {
            throw new Error("Invalid base64 content");
          }
        } else {
          csvText = fileContent;
        }
      } else {
        csvText = new TextDecoder().decode(fileContent);
      }

      const { data, errors } = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
      });

      if (errors.length > 0) {
        throw new Error(`CSV parsing error: ${errors[0]?.message}`);
      }

      return {
        headers: Object.keys(data[0] || {}),
        rows: data as Record<string, unknown>[],
      };
    } else {
      // Parse Excel
      let workbook;
      if (typeof fileContent === "string") {
        if (fileContent.startsWith("data:")) {
          const base64Content = fileContent.split(",")[1];
          workbook = XLSX.read(base64Content, { type: "base64" });
        } else {
          workbook = XLSX.read(fileContent, { type: "string" });
        }
      } else {
        workbook = XLSX.read(fileContent);
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName ?? ""];
      if (!worksheet) {
        throw new Error("No worksheet found in the uploaded file");
      }
      const data = XLSX.utils.sheet_to_json(worksheet);

      return {
        headers: Object.keys(data[0] || {}),
        rows: data as Record<string, unknown>[],
      };
    }
  } catch (error) {
    throw new Error(`Failed to parse file: ${(error as Error).message}`);
  }
}

/**
 * Find a matching column in the row data based on possible column names
 * with enhanced fuzzy matching for better column detection
 */
function findMatchingColumn(
  row: Record<string, unknown>,
  possibleColumns: string[],
): string | null {
  const rowKeys = Object.keys(row);
  const normalizedRowKeys = rowKeys.map((key) => key.toLowerCase().trim());

  // Try exact match first
  for (const column of possibleColumns) {
    const normalizedColumn = column.toLowerCase().trim();
    const exactMatchIndex = normalizedRowKeys.findIndex(
      (key) => key === normalizedColumn,
    );
    if (exactMatchIndex !== -1) {
      return rowKeys[exactMatchIndex] ?? null;
    }
  }

  // Try contains match (header contains the column name)
  for (const column of possibleColumns) {
    const normalizedColumn = column.toLowerCase().trim();
    const containsMatchIndex = normalizedRowKeys.findIndex((key) =>
      key.includes(normalizedColumn),
    );
    if (containsMatchIndex !== -1) {
      return rowKeys[containsMatchIndex] ?? null;
    }
  }

  // Try reverse contains match (column name contains the header)
  for (const column of possibleColumns) {
    const normalizedColumn = column.toLowerCase().trim();
    const reverseContainsIndex = normalizedRowKeys.findIndex(
      (key) => normalizedColumn.includes(key) && key.length > 3, // Only consider substantial matches
    );
    if (reverseContainsIndex !== -1) {
      return rowKeys[reverseContainsIndex] ?? null;
    }
  }

  return null;
}

/**
 * Transform field value based on the specified transform type
 * with enhanced transformation options
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
    case "time":
      // Convert various time formats to HH:MM format
      try {
        const timeParts = stringValue.match(
          /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i,
        );
        if (!timeParts) {
          return stringValue;
        }

        let hours = parseInt(timeParts[1] ?? "0", 10);
        const minutes = timeParts[2] ?? "0";
        const ampm = timeParts[4]?.toLowerCase();

        if (ampm === "pm" && hours < 12) {
          hours += 12;
        } else if (ampm === "am" && hours === 12) {
          hours = 0;
        }

        return `${hours.toString().padStart(2, "0")}:${minutes}`;
      } catch (error) {
        return stringValue;
      }
    case "provider":
      // Normalize provider name format (capitalize)
      return stringValue
        .split(" ")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join(" ");
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
  if (validation.requireValidPhone && !patientData.primaryPhone) {
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
  columnMappings: Record<string, string>;
  missingRequired: string[];
} {
  const extractedData: Record<string, unknown> = {};
  const columnMappings: Record<string, string> = {};
  const missingRequired: string[] = [];

  for (const field of fields) {
    const columnName = findMatchingColumn(row, field.possibleColumns);

    if (columnName) {
      columnMappings[field.key] = columnName;
      const rawValue = row[columnName];
      extractedData[field.key] = transformValue(rawValue, field.transform);
    } else if (field.required) {
      missingRequired.push(field.label);
    }
  }

  return { extractedData, columnMappings, missingRequired };
}

/**
 * Generate a hash for patient identification and deduplication
 */
export function generatePatientHash(
  firstName: string,
  lastName: string,
  dob: string,
  phone: string,
): string {
  const normalizedPhone = String(phone).replace(/\D/g, "");
  const normalizedDob = String(dob).replace(/\D/g, "");
  const normalizedFirstName = String(firstName).toLowerCase().trim();
  const normalizedLastName = String(lastName).toLowerCase().trim();

  const hash = createHash("sha256");
  hash.update(
    `${normalizedFirstName}-${normalizedLastName}-${normalizedDob}-${normalizedPhone}`,
  );
  return hash.digest("hex");
}

/**
 * Process Excel or CSV file content according to campaign configuration
 * Returns the processed data including valid rows, invalid rows, and error information
 */
export async function processExcelFile(
  fileContent: string | ArrayBuffer,
  fileName: string,
  config: CampaignConfig,
  orgId: string,
): Promise<ProcessedData> {
  const patientService = new PatientService(db);
  const result: ProcessedData = {
    validRows: [],
    invalidRows: [],
    stats: {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      uniquePatients: 0,
      duplicatePatients: 0,
    },
    columnMappings: {},
    errors: [],
    rawFileUrl: "",
    processedFileUrl: "",
  };

  try {
    // Parse the file
    const { headers, rows } = parseFileContent(fileContent, fileName);

    if (rows.length === 0) {
      throw new Error("No data found in the uploaded file");
    }

    result.stats.totalRows = rows.length;

    // Track column mappings for all fields
    const allColumnMappings: Record<string, string> = {};

    // Track unique patients for deduplication
    const patientHashes = new Set<string>();

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) {
        throw new Error("Row is undefined");
      }

      try {
        // Extract patient data
        const {
          extractedData: patientData,
          columnMappings: patientColumnMappings,
          missingRequired: missingPatientFields,
        } = extractFields(row, config.variables.patient.fields);

        // Merge column mappings
        Object.assign(allColumnMappings, patientColumnMappings);

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
          columnMappings: campaignColumnMappings,
          missingRequired: missingCampaignFields,
        } = extractFields(row, config.variables.campaign.fields);

        // Merge column mappings
        Object.assign(allColumnMappings, campaignColumnMappings);

        // Check for missing required campaign fields
        if (missingCampaignFields.length > 0) {
          throw new Error(
            `Missing required campaign fields: ${missingCampaignFields.join(", ")}`,
          );
        }

        // Generate patient hash for deduplication
        let patientHash: string | null = null;
        if (
          patientData.firstName &&
          patientData.lastName &&
          patientData.primaryPhone &&
          patientData.dob
        ) {
          patientHash = generatePatientHash(
            String(patientData.firstName),
            String(patientData.lastName),
            String(patientData.dob),
            String(patientData.primaryPhone),
          );

          // Check if this patient has been seen before in this file
          if (patientHashes.has(patientHash)) {
            result.stats.duplicatePatients++;
          } else {
            patientHashes.add(patientHash);
            result.stats.uniquePatients++;
          }
        }

        // Process patient record - find or create in database
        let patientId: string | null = null;
        if (
          patientData.firstName &&
          patientData.lastName &&
          patientData.primaryPhone &&
          patientData.dob
        ) {
          const patient = await patientService.findOrCreatePatient({
            firstName: String(patientData.firstName),
            lastName: String(patientData.lastName),
            dob: String(patientData.dob),
            phone: String(patientData.primaryPhone),
            emrId: patientData.emrId ? String(patientData.emrId) : undefined,
            orgId,
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
          patientHash,
          variables,
        });
        result.stats.validRows++;
      } catch (error) {
        // Add to invalid rows
        result.invalidRows.push({
          index: i + 2, // +2 for 1-based index and header row
          rawData: row,
          error: error instanceof Error ? error.message : String(error),
        });
        result.stats.invalidRows++;
      }
    }

    // Store overall column mappings
    result.columnMappings = allColumnMappings;

    // Store file URLs (in a real implementation, you might upload to S3 or another storage service)
    const fileId = nanoid();
    result.rawFileUrl = `/uploads/${fileId}_raw.${fileName.split(".").pop()}`;
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

/**
 * Extract unique patients from processed rows
 */
export function extractUniquePatients(
  processedRows: ProcessedData["validRows"],
): Record<string, Record<string, unknown>> {
  const uniquePatients: Record<string, Record<string, unknown>> = {};

  processedRows.forEach((row) => {
    if (row.patientHash) {
      // If this is the first time we've seen this patient, or if we have better data
      if (
        !uniquePatients[row.patientHash] ||
        Object.values(uniquePatients[row.patientHash] ?? {}).filter(Boolean)
          .length < Object.values(row.variables).filter(Boolean).length
      ) {
        uniquePatients[row.patientHash] = row.variables;
      }
    }
  });

  return uniquePatients;
}
