// src/lib/excel-processor.ts - Enhanced
import { db } from "@/server/db";
import { nanoid } from "nanoid";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { formatDate, formatPhoneNumber, isValidDate } from "./format-utils";
import { generatePatientHash, PatientService } from "./patient/patient-service";

// Types for campaign configuration
type FieldConfig = {
  key: string;
  label: string;
  possibleColumns: string[];
  transform?:
    | "text"
    | "short_date"
    | "long_date"
    | "time"
    | "phone"
    | "provider";
  required: boolean;
  description?: string;
};

// Additional type definitions omitted for brevity...

/**
 * Parse file content based on file type (Excel or CSV)
 */
export function parseFileContent(
  fileContent: string | ArrayBuffer,
  fileName: string,
): { headers: string[]; rows: Record<string, unknown>[] } {
  try {
    // Detect file type
    const isCSV = fileName.toLowerCase().endsWith(".csv");

    // Get content as text if it's a base64 string
    let contentToProcess = fileContent;
    if (typeof fileContent === "string" && fileContent.startsWith("data:")) {
      const base64Content = fileContent.split(",")[1];
      if (!base64Content) {
        throw new Error("Invalid base64 content");
      }

      if (isCSV) {
        contentToProcess = atob(base64Content);
      } else {
        // Keep as base64 for Excel
        contentToProcess = base64Content;
      }
    }

    if (isCSV) {
      // Parse CSV with enhanced options
      let csvText =
        typeof contentToProcess === "string"
          ? contentToProcess
          : new TextDecoder().decode(contentToProcess);

      const parseOptions = {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
        transform: (value: string) => value.trim(),
        dynamicTyping: true,
        delimitersToGuess: [",", "\t", "|", ";"],
        complete: (results: Papa.ParseResult<Record<string, unknown>>) => {
          data = results.data;
          errors = results.errors;
        },
      };

      let data: Record<string, unknown>[] = [];
      let errors: Papa.ParseError[] = [];

      Papa.parse<Record<string, unknown>>(csvText, parseOptions);

      if (errors.length > 0) {
        console.error("CSV parsing errors:", errors);
        throw new Error(`CSV parsing error: ${errors[0]?.message}`);
      }

      // Alert if no data
      if (!data.length) {
        throw new Error("No data found in CSV file");
      }

      return {
        headers: Object.keys(data[0] || {}),
        rows: data as Record<string, unknown>[],
      };
    } else {
      // Parse Excel with enhanced options
      let workbook;
      if (typeof contentToProcess === "string") {
        workbook = XLSX.read(contentToProcess, { type: "base64" });
      } else {
        workbook = XLSX.read(contentToProcess, {
          cellDates: true, // Keep dates as dates
          cellNF: true, // Keep number formatting
          cellStyles: true, // Keep cell styling
        });
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName ?? ""];
      if (!worksheet) {
        throw new Error("No worksheet found in the uploaded file");
      }

      // Use header:1 to get headers separately, then process actual rows
      const rawHeaders = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
      })[0] as string[];
      const cleanHeaders = rawHeaders.map((h) => h.trim()); // Clean headers

      // Get all rows with properly formatted headers
      const data = XLSX.utils.sheet_to_json(worksheet, {
        raw: false, // Convert everything to strings
        defval: "", // Default empty cells to empty string
        header: cleanHeaders, // Use clean headers
      });

      // Alert if no data
      if (!data.length) {
        throw new Error("No data found in Excel file");
      }

      return {
        headers: cleanHeaders,
        rows: data as Record<string, unknown>[],
      };
    }
  } catch (error) {
    console.error("File parsing error:", error);
    throw new Error(`Failed to parse file: ${(error as Error).message}`);
  }
}

/**
 * Find a matching column in the row data based on possible column names
 * Enhanced with fuzzy matching and scoring
 */
function findMatchingColumn(
  headers: string[],
  possibleColumns: string[],
): string | null {
  if (!headers.length || !possibleColumns.length) {
    return null;
  }

  // Normalize all headers (lowercase, trim, remove special chars)
  const normalizedHeaders = headers.map((key) => ({
    original: key,
    normalized: key
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, ""),
  }));

  // Track best match with scoring
  let bestMatch = null;
  let bestScore = 0;

  for (const column of possibleColumns) {
    const normalizedColumn = column
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, "");

    // Try exact match (highest priority)
    const exactMatch = normalizedHeaders.find(
      (h) =>
        h.normalized === normalizedColumn ||
        h.original.toLowerCase() === column.toLowerCase(),
    );

    if (exactMatch) {
      return exactMatch.original;
    }

    // Try contains match with scoring based on length ratio
    for (const header of normalizedHeaders) {
      // Different match types with scores
      let score = 0;

      // Header contains the column name
      if (header.normalized.includes(normalizedColumn)) {
        // Score based on how much of the header is the column name
        score = (normalizedColumn.length / header.normalized.length) * 100;
      }
      // Column name contains the header
      else if (
        normalizedColumn.includes(header.normalized) &&
        header.normalized.length > 3
      ) {
        // Score based on how much of the column name is the header
        score = (header.normalized.length / normalizedColumn.length) * 90; // Slightly lower priority
      }
      // Word-by-word matching
      else {
        const columnWords = normalizedColumn.split(/[^a-z0-9]+/);
        const headerWords = header.normalized.split(/[^a-z0-9]+/);

        // Count matching words
        let matchingWords = 0;
        for (const word of columnWords) {
          if (
            word.length > 2 &&
            headerWords.some((hw) => hw.includes(word) || word.includes(hw))
          ) {
            matchingWords++;
          }
        }

        if (matchingWords > 0) {
          score =
            (matchingWords / Math.max(columnWords.length, headerWords.length)) *
            80;
        }
      }

      // Update best match if we found a better score
      if (score > bestScore) {
        bestScore = score;
        bestMatch = header.original;
      }
    }
  }

  // Set minimum threshold for match quality (60%)
  return bestScore >= 60 ? bestMatch : null;
}

/**
 * Transform field value based on the specified transform type
 * Enhanced with better error handling and format support
 */
function transformValue(value: unknown, transform?: string): unknown {
  // Handle null/undefined/empty values consistently
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  // Ensure we're working with a string for consistency
  const stringValue = String(value).trim();
  if (!stringValue) {
    return null;
  }

  try {
    switch (transform) {
      case "short_date":
        return formatShortDate(stringValue);
      case "long_date":
        return formatLongDate(stringValue);
      case "phone":
        return formatPhoneNumber(stringValue);
      case "time":
        return formatTimeValue(stringValue);
      case "provider":
        return formatProviderName(stringValue);
      case "text":
      default:
        return stringValue;
    }
  } catch (error) {
    console.warn(
      `Transform error for "${stringValue}" with transform "${transform}":`,
      error,
    );
    // Return original value if transformation fails
    return stringValue;
  }
}

// Enhanced date formatting with better format detection
function formatShortDate(dateString: string): string {
  try {
    // Handle Excel date (number of days since 1/1/1900)
    if (!isNaN(Number(dateString))) {
      const excelDate = Number(dateString);
      if (excelDate > 1000) {
        // Likely a date if over 1000
        // Excel dates are number of days since 1/1/1900, with a leap year bug
        const date = new Date(Date.UTC(1900, 0, excelDate - 1));
        return formatDate(date.toISOString());
      }
    }

    // Handle common date formats
    const formatsToTry = [
      // Try to parse with Date first
      () => {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
          return formatDate(date.toISOString());
        }
        return null;
      },
      // MM/DD/YYYY
      () => {
        const match = dateString.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
        if (match) {
          const [_, month, day, year] = match;
          return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }
        return null;
      },
      // DD/MM/YYYY
      () => {
        const match = dateString.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
        if (match) {
          const [_, day, month, year] = match;
          return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }
        return null;
      },
    ];

    // Try each format until one works
    for (const formatFn of formatsToTry) {
      const result = formatFn();
      if (result) return result;
    }

    // If all else fails, return original
    return dateString;
  } catch (error) {
    console.warn("Date parsing error:", error, dateString);
    return dateString;
  }
}

// Other helper functions (formatLongDate, formatTimeValue, formatProviderName)...

/**
 * Process Excel or CSV file content according to campaign configuration
 * Enhanced with better deduplication, validation and error reporting
 */
export async function processExcelFile(
  fileContent: string | ArrayBuffer,
  fileName: string,
  config: any,
  orgId: string,
): Promise<any> {
  console.log("Processing file with enhanced processor");
  const patientService = new PatientService(db);
  const result = {
    validRows: [],
    invalidRows: [],
    stats: {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      uniquePatients: 0,
      duplicatePatients: 0,
      newPatients: 0,
      existingPatients: 0,
    },
    columnMappings: {},
    matchedColumns: [],
    unmatchedColumns: [],
    sampleRows: [],
    errors: [],
    rawFileUrl: "",
    processedFileUrl: "",
  };

  try {
    // Parse the file
    const { headers, rows } = parseFileContent(fileContent, fileName);
    result.stats.totalRows = rows.length;

    if (rows.length === 0) {
      throw new Error("No data found in the uploaded file");
    }

    // Keep track of all columns for reporting
    const allColumns = new Set(headers);
    const matchedColumns = new Set<string>();

    // Track column mappings for all fields
    const allColumnMappings: Record<string, string> = {};

    // Track unique patients for deduplication
    const patientHashes = new Map<string, number>(); // Hash -> Row index
    const patientIds = new Map<string, string>(); // Hash -> Patient ID

    // Store sample rows for preview (first 5 valid, first 5 invalid)
    const sampleValidRows: any[] = [];
    const sampleInvalidRows: any[] = [];

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue; // Skip undefined rows

      try {
        // Extract patient data
        const {
          extractedData: patientData,
          columnMappings: patientColumnMappings,
          missingRequired: missingPatientFields,
        } = extractFields(row, headers, config.variables.patient.fields);

        // Track matched columns
        Object.values(patientColumnMappings).forEach((col) =>
          matchedColumns.add(col),
        );

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
        } = extractFields(row, headers, config.variables.campaign.fields);

        // Track matched columns
        Object.values(campaignColumnMappings).forEach((col) =>
          matchedColumns.add(col),
        );

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
        let patientId: string | null = null;
        let isNewPatient = true;

        if (
          patientData.firstName &&
          patientData.lastName &&
          (patientData.primaryPhone ||
            patientData.phoneNumber ||
            patientData.cellPhone) &&
          patientData.dob
        ) {
          const phoneToUse =
            patientData.primaryPhone ||
            patientData.phoneNumber ||
            patientData.cellPhone;

          // Generate primary hash
          patientHash = generatePatientHash(
            String(patientData.firstName),
            String(patientData.lastName),
            String(patientData.dob),
            String(phoneToUse),
          );

          // Check if this patient has been seen before in this file
          if (patientHashes.has(patientHash)) {
            result.stats.duplicatePatients++;
            const originalRowIndex = patientHashes.get(patientHash);
            console.log(
              `Duplicate patient found in rows ${originalRowIndex} and ${i + 2}`,
            );

            // Use existing patient ID if available
            patientId = patientIds.get(patientHash) || null;
            isNewPatient = false;
          } else {
            patientHashes.set(patientHash, i + 2); // Store 1-based row index for reporting
            result.stats.uniquePatients++;

            // Process patient record - find or create in database
            try {
              const patient = await patientService.findOrCreatePatient({
                firstName: String(patientData.firstName),
                lastName: String(patientData.lastName),
                dob: String(patientData.dob),
                phone: String(phoneToUse),
                emrId:
                  patientData.emrId || patientData.patientNumber
                    ? String(patientData.emrId || patientData.patientNumber)
                    : undefined,
                orgId,
              });

              if (patient) {
                patientId = patient.id;
                patientIds.set(patientHash, patientId);
                isNewPatient = patient.isNewPatient;

                // Update stats
                if (isNewPatient) {
                  result.stats.newPatients++;
                } else {
                  result.stats.existingPatients++;
                }
              }
            } catch (error) {
              console.error("Error finding/creating patient:", error);
              throw new Error(
                `Patient record error: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }
        }

        // Combine all variables into a structured format
        const processedRow = {
          id: nanoid(),
          isValid: true,
          patientId,
          patientHash,
          patientData,
          campaignData,
          isNewPatient,
          validationErrors: [],
        };

        // Add to valid rows
        result.validRows.push({
          patientId,
          patientHash,
          variables: {
            ...patientData,
            ...campaignData,
          },
        });

        // Add to sample rows for preview (up to 5)
        if (sampleValidRows.length < 5) {
          sampleValidRows.push(processedRow);
        }

        result.stats.validRows++;
      } catch (error) {
        // Collect error info
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Add to invalid rows with detailed context
        const invalidRow = {
          id: nanoid(),
          index: i + 2, // +2 for 1-based index and header row
          isValid: false,
          rawData: row,
          error: errorMessage,
          validationErrors: [errorMessage],
          patientData: {}, // Default empty objects
          campaignData: {},
        };

        // Try to extract partial data even if validation failed
        try {
          // Get whatever patient data we can
          const { extractedData: partialPatientData } = extractFields(
            row,
            headers,
            config.variables.patient.fields,
            false, // Don't require fields for invalid rows
          );

          // Get whatever campaign data we can
          const { extractedData: partialCampaignData } = extractFields(
            row,
            headers,
            config.variables.campaign.fields,
            false, // Don't require fields for invalid rows
          );

          // Add partial data to the invalid row
          invalidRow.patientData = partialPatientData;
          invalidRow.campaignData = partialCampaignData;
        } catch (e) {
          // Ignore extraction errors for invalid rows
        }

        result.invalidRows.push(invalidRow);

        // Add to sample invalid rows for preview (up to 5)
        if (sampleInvalidRows.length < 5) {
          sampleInvalidRows.push(invalidRow);
        }

        result.stats.invalidRows++;
      }
    }

    // Add all sample rows
    result.sampleRows = [...sampleValidRows, ...sampleInvalidRows];

    // Store overall column mappings
    result.columnMappings = allColumnMappings;

    // Calculate unmatched columns
    result.matchedColumns = Array.from(matchedColumns);
    result.unmatchedColumns = Array.from(allColumns).filter(
      (col) => !matchedColumns.has(col),
    );

    // Store file URLs (in a real implementation, you might upload to S3 or another storage service)
    const fileId = nanoid();
    result.rawFileUrl = `/uploads/${fileId}_raw.${fileName.split(".").pop()}`;
    result.processedFileUrl = `/uploads/${fileId}_processed.xlsx`;

    // Collect general errors
    if (result.validRows.length === 0 && rows.length > 0) {
      result.errors.push("No valid rows could be processed from the file");
    }

    // Report unmatched columns if there are any
    if (result.unmatchedColumns.length > 0) {
      result.errors.push(
        `${result.unmatchedColumns.length} columns were not mapped: ${result.unmatchedColumns.join(", ")}`,
      );
    }
  } catch (error) {
    console.error("File processing error:", error);
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

/**
 * Extract field values from a row based on field configuration
 * Enhanced with better error handling and optional requirements
 */
function extractFields(
  row: Record<string, unknown>,
  headers: string[],
  fields: FieldConfig[],
  enforceRequired = true,
): {
  extractedData: Record<string, unknown>;
  columnMappings: Record<string, string>;
  missingRequired: string[];
} {
  const extractedData: Record<string, unknown> = {};
  const columnMappings: Record<string, string> = {};
  const missingRequired: string[] = [];

  for (const field of fields) {
    const columnName = findMatchingColumn(headers, field.possibleColumns);

    if (columnName) {
      columnMappings[field.key] = columnName;
      const rawValue = row[columnName];
      extractedData[field.key] = transformValue(rawValue, field.transform);
    } else if (field.required && enforceRequired) {
      missingRequired.push(field.label);
    }
  }

  return { extractedData, columnMappings, missingRequired };
}

/**
 * Validate a patient record against the configuration
 * Enhanced with more detailed validation
 */
function validatePatientData(
  patientData: Record<string, unknown>,
  validation: {
    requireValidPhone: boolean;
    requireValidDOB: boolean;
    requireName: boolean;
  },
): string | null {
  const errors = [];

  // Check for required phone
  if (validation.requireValidPhone) {
    const phone =
      patientData.primaryPhone ||
      patientData.phoneNumber ||
      patientData.cellPhone;

    if (!phone) {
      errors.push("Valid phone number is required");
    } else {
      // Basic phone validation - should have at least 10 digits
      const digitsOnly = String(phone).replace(/\D/g, "");
      if (digitsOnly.length < 10) {
        errors.push(`Phone number ${phone} does not appear to be valid`);
      }
    }
  }

  // Check for valid DOB
  if (validation.requireValidDOB) {
    if (!patientData.dob) {
      errors.push("Date of birth is required");
    } else if (!isValidDate(String(patientData.dob))) {
      errors.push(`Date of birth "${patientData.dob}" is not a valid date`);
    } else {
      // Additional check - date shouldn't be in the future
      const dobDate = new Date(String(patientData.dob));
      if (dobDate > new Date()) {
        errors.push("Date of birth cannot be in the future");
      }
    }
  }

  // Check for name
  if (validation.requireName) {
    if (!patientData.firstName) {
      errors.push("First name is required");
    }
    if (!patientData.lastName) {
      errors.push("Last name is required");
    }
  }

  return errors.length > 0 ? errors.join("; ") : null;
}

// Helper functions for date and time formatting
function formatTimeValue(timeString: string): string {
  try {
    // If it's a number, treat as Excel time (fraction of day)
    if (!isNaN(Number(timeString))) {
      const timeValue = Number(timeString);
      if (timeValue >= 0 && timeValue < 1) {
        const totalMinutes = Math.round(timeValue * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      }
    }

    // Handle various time formats with regex
    const formats = [
      // hh:mm:ss
      /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
      // hh:mm AM/PM
      /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|AM|PM)$/,
      // h AM/PM
      /^(\d{1,2})\s*(am|pm|AM|PM)$/,
    ];

    for (const regex of formats) {
      const match = timeString.match(regex);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2] ? parseInt(match[2], 10) : 0;
        const ampm = match[4]?.toLowerCase();

        // Adjust hours for AM/PM if present
        if (ampm === "pm" && hours < 12) {
          hours += 12;
        } else if (ampm === "am" && hours === 12) {
          hours = 0;
        }

        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      }
    }

    // Return original if no format matches
    return timeString;
  } catch (error) {
    return timeString;
  }
}

function formatLongDate(dateString: string): string {
  try {
    // Handle Excel date (number of days since 1/1/1900)
    if (!isNaN(Number(dateString))) {
      const excelDate = Number(dateString);
      const date = new Date(Date.UTC(1900, 0, excelDate - 1));
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    // Format as full date (e.g., Tuesday, March 10, 2025)
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    return dateString;
  } catch (error) {
    return dateString;
  }
}

function formatProviderName(providerName: string): string {
  try {
    // Normalize provider name format (capitalize properly)
    return providerName
      .split(" ")
      .map((word) => {
        // Handle common prefixes like "Dr." or suffixes like "MD"
        if (word.toUpperCase() === word && word.length <= 3) {
          return word.toUpperCase(); // Keep abbreviations uppercase
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(" ");
  } catch (error) {
    return providerName;
  }
}

/**
 * Extract unique patients from processed rows
 * Enhanced with better duplication handling
 */
export function extractUniquePatients(
  processedRows: {
    patientId: string | null;
    patientHash: string | null;
    variables: Record<string, unknown>;
  }[],
): Record<string, Record<string, unknown>> {
  const uniquePatients: Record<string, Record<string, unknown>> = {};
  const uniqueIds = new Set<string>();

  processedRows.forEach((row) => {
    // First prioritize actual patient IDs (which come from database lookups)
    if (row.patientId && !uniqueIds.has(row.patientId)) {
      uniqueIds.add(row.patientId);
      uniquePatients[row.patientId] = row.variables;
    }
    // Fall back to hash-based deduplication
    else if (
      row.patientHash &&
      !Object.keys(uniquePatients).includes(row.patientHash)
    ) {
      // Only add if we don't already have this patient by ID
      if (!row.patientId || !uniqueIds.has(row.patientId)) {
        uniquePatients[row.patientHash] = row.variables;
      }
    }
  });

  return uniquePatients;
}
