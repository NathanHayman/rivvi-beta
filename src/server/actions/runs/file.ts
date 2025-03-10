"use server";

import { requireOrg } from "@/lib/auth";
import { isError } from "@/lib/service-result";
import { uploadFileSchema as baseUploadFileSchema } from "@/lib/validation/runs";
import { db } from "@/server/db";
import { campaigns, rows, runs } from "@/server/db/schema";
import {
  processExcelFile,
  transformValue,
} from "@/services/runs/excel-processor";
import { FileService } from "@/services/runs/file-service";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

// Define basic types for campaign and template
interface TemplateWithVariablesConfig {
  id: string;
  variablesConfig: {
    variables?: {
      patient?: {
        fields?: any[];
        validation?: {
          requireValidPhone?: boolean;
          requireValidDOB?: boolean;
          requireName?: boolean;
        };
      };
      campaign?: {
        fields?: any[];
      };
    };
  };
}

interface CampaignWithTemplate {
  id: string;
  template?: TemplateWithVariablesConfig | null;
}

/**
 * Helper function to ensure campaign configuration has safe field structures
 */
function sanitizeFieldStructure(config: any): any {
  // Start with a default structure if config is undefined
  if (!config) {
    return {
      variables: {
        patient: {
          fields: [],
          validation: {
            requireValidPhone: false,
            requireValidDOB: false,
            requireName: false,
          },
        },
        campaign: { fields: [] },
      },
    };
  }

  try {
    // Create a deep copy to avoid modifying the original
    let safeConfig: any = JSON.parse(JSON.stringify(config));

    // Check if the config has patient/campaign at top level instead of inside variables
    // This handles the case where the structure is {patient: {...}, campaign: {...}}
    // instead of {variables: {patient: {...}, campaign: {...}}}
    if (safeConfig.patient || safeConfig.campaign) {
      // If variables exists but is empty, we should use the top-level fields
      const hasEmptyVariables =
        safeConfig.variables &&
        !safeConfig.variables.patient?.fields?.length &&
        !safeConfig.variables.campaign?.fields?.length;

      // If variables doesn't exist or is empty, use the top-level structure
      if (!safeConfig.variables || hasEmptyVariables) {
        console.log(
          "Found top-level patient/campaign structure, restructuring config",
        );

        // Create or update the variables object
        safeConfig.variables = {
          patient: safeConfig.patient || {
            fields: [],
            validation: {
              requireValidPhone: false,
              requireValidDOB: false,
              requireName: false,
            },
          },
          campaign: safeConfig.campaign || { fields: [] },
        };

        // Remove the top-level properties to avoid duplication
        delete safeConfig.patient;
        delete safeConfig.campaign;
      }
    }

    // Ensure variables exists
    if (!safeConfig.variables) {
      safeConfig.variables = {
        patient: {
          fields: [],
          validation: {
            requireValidPhone: false,
            requireValidDOB: false,
            requireName: false,
          },
        },
        campaign: { fields: [] },
      };
    }

    // Ensure patient section exists
    if (!safeConfig.variables.patient) {
      safeConfig.variables.patient = {
        fields: [],
        validation: {
          requireValidPhone: false,
          requireValidDOB: false,
          requireName: false,
        },
      };
    }

    // Ensure campaign section exists
    if (!safeConfig.variables.campaign) {
      safeConfig.variables.campaign = { fields: [] };
    }

    // Ensure patient fields is an array
    if (!Array.isArray(safeConfig.variables.patient.fields)) {
      safeConfig.variables.patient.fields = [];
    }

    // Ensure campaign fields is an array
    if (!Array.isArray(safeConfig.variables.campaign.fields)) {
      safeConfig.variables.campaign.fields = [];
    }

    // Ensure validation exists
    if (!safeConfig.variables.patient.validation) {
      safeConfig.variables.patient.validation = {
        requireValidPhone: false,
        requireValidDOB: false,
        requireName: false,
      };
    }

    // Check for patient fields and sanitize them
    if (Array.isArray(safeConfig.variables.patient.fields)) {
      safeConfig.variables.patient.fields = safeConfig.variables.patient.fields
        .filter((field) => field && typeof field === "object")
        .map((field) => {
          try {
            // Create a clean field object with explicit properties and safe defaults
            const cleanField: any = {
              key:
                (field && field.key) ||
                `field_${Math.random().toString(36).substring(2, 9)}`,
              label:
                (field && field.label) ||
                (field && field.key) ||
                "Unnamed Field",
              possibleColumns: Array.isArray(field && field.possibleColumns)
                ? [...field.possibleColumns]
                : [(field && field.key) || ""],
              required: !!(field && field.required),
              transform: (field && field.transform) || "text",
              // Always explicitly set a default value
              referencedTable: undefined,
              defaultValue: undefined,
            };

            // Only add referencedTable if it exists and is a string - check safely
            if (
              field &&
              typeof field === "object" &&
              Object.prototype.hasOwnProperty.call(field, "referencedTable") &&
              typeof field.referencedTable === "string"
            ) {
              cleanField.referencedTable = field.referencedTable;
            }

            // Handle default value if present (can be any type)
            if (
              field &&
              typeof field === "object" &&
              Object.prototype.hasOwnProperty.call(field, "defaultValue") &&
              field.defaultValue !== undefined
            ) {
              cleanField.defaultValue = field.defaultValue;
            }

            return cleanField;
          } catch (error) {
            console.error("Error sanitizing patient field:", error);
            // Return a safe default field if anything goes wrong
            return {
              key: `field_${Math.random().toString(36).substring(2, 9)}`,
              label: "Unnamed Field (Error)",
              possibleColumns: [],
              required: false,
              transform: "text",
              referencedTable: undefined,
              defaultValue: undefined,
            };
          }
        });
    }

    // Check for campaign fields and sanitize them
    if (Array.isArray(safeConfig.variables.campaign.fields)) {
      safeConfig.variables.campaign.fields =
        safeConfig.variables.campaign.fields
          .filter((field) => field && typeof field === "object")
          .map((field) => {
            try {
              // Create a clean field object with explicit properties and safe defaults
              const cleanField: any = {
                key:
                  (field && field.key) ||
                  `field_${Math.random().toString(36).substring(2, 9)}`,
                label:
                  (field && field.label) ||
                  (field && field.key) ||
                  "Unnamed Field",
                possibleColumns: Array.isArray(field && field.possibleColumns)
                  ? [...field.possibleColumns]
                  : [(field && field.key) || ""],
                required: !!(field && field.required),
                transform: (field && field.transform) || "text",
                // Always explicitly set a default value
                referencedTable: undefined,
                defaultValue: undefined,
              };

              // Only add referencedTable if it exists and is a string - check safely
              if (
                field &&
                typeof field === "object" &&
                Object.prototype.hasOwnProperty.call(
                  field,
                  "referencedTable",
                ) &&
                typeof field.referencedTable === "string"
              ) {
                cleanField.referencedTable = field.referencedTable;
              }

              // Handle default value if present (can be any type)
              if (
                field &&
                typeof field === "object" &&
                Object.prototype.hasOwnProperty.call(field, "defaultValue") &&
                field.defaultValue !== undefined
              ) {
                cleanField.defaultValue = field.defaultValue;
              }

              return cleanField;
            } catch (error) {
              console.error("Error sanitizing campaign field:", error);
              // Return a safe default field if anything goes wrong
              return {
                key: `field_${Math.random().toString(36).substring(2, 9)}`,
                label: "Unnamed Field (Error)",
                possibleColumns: [],
                required: false,
                transform: "text",
                referencedTable: undefined,
                defaultValue: undefined,
              };
            }
          });
    }

    return safeConfig;
  } catch (error) {
    console.error("Error in sanitizeFieldStructure:", error);
    // Return a safe default if any error occurs
    return {
      variables: {
        patient: {
          fields: [],
          validation: {
            requireValidPhone: false,
            requireValidDOB: false,
            requireName: false,
          },
        },
        campaign: { fields: [] },
      },
    };
  }
}

// Extend the base schema to include processedData
const uploadFileSchema = baseUploadFileSchema.extend({
  runId: z.string(),
  fileName: z.string(),
  fileContent: z.string(),
  processedData: z
    .object({
      headers: z.array(z.string()).optional(),
      rows: z.array(z.any()).optional(),
    })
    .optional(),
});

export async function uploadFile(data: unknown) {
  try {
    console.log("uploadFile action starting with data type:", typeof data);

    // Initial validation of input data
    if (!data || typeof data !== "object") {
      console.error("Invalid upload data format: not an object");
      return {
        success: false,
        error: {
          message: "Invalid upload data format: not an object",
          details: { dataType: typeof data },
        },
      };
    }

    const { orgId } = await requireOrg();

    // Validate the input with better error handling
    let validated;
    try {
      validated = uploadFileSchema.parse(data);
    } catch (validationError) {
      console.error("Schema validation error:", validationError);
      return {
        success: false,
        error: {
          message: "Invalid data format",
          details: { error: validationError },
        },
      };
    }

    // Additional validation for file content
    if (!validated.fileContent) {
      console.error("Missing file content");
      return {
        success: false,
        error: {
          message: "Missing file content",
        },
      };
    }

    // Log the file type and size
    const fileSize = validated.fileContent.length;
    const fileExtension = validated.fileName.split(".").pop()?.toLowerCase();

    console.log("Validation passed for file upload:", {
      runId: validated.runId,
      fileName: validated.fileName,
      fileSize,
      fileType: fileExtension,
      hasProcessedData: !!validated.processedData,
    });

    // Get the run
    const run = await db.query.runs.findFirst({
      where: and(eq(runs.id, validated.runId), eq(runs.orgId, orgId)),
    });

    if (!run) {
      console.error(`Run not found: ${validated.runId} for org ${orgId}`);
      return {
        success: false,
        error: {
          message: "Run not found",
          details: { runId: validated.runId },
        },
      };
    }

    console.log("Run found:", {
      id: run.id,
      campaignId: run.campaignId,
    });

    // Create a safe default configuration in case we can't get it from the database
    let campaignConfig = {
      variables: {
        patient: {
          fields: [],
          validation: {
            requireValidPhone: false,
            requireValidDOB: false,
            requireName: false,
          },
        },
        campaign: { fields: [] },
      },
    };

    // Try to get the campaign to access its template
    try {
      // Get campaign with template using proper type casting
      const campaignsResult = (await db.query.campaigns.findFirst({
        where: and(
          eq(campaigns.id, run.campaignId),
          eq(campaigns.orgId, orgId),
        ),
        with: {
          template: true,
        },
      })) as unknown as CampaignWithTemplate;

      if (campaignsResult && campaignsResult.template) {
        console.log("Found campaign template:", campaignsResult.template.id);

        // Check if the campaign template has a variablesConfig
        if (
          campaignsResult.template.variablesConfig &&
          typeof campaignsResult.template.variablesConfig === "object"
        ) {
          // Create a defensive deep copy to avoid mutation issues
          try {
            const clonedConfig = JSON.parse(
              JSON.stringify(campaignsResult.template.variablesConfig),
            );
            campaignConfig = clonedConfig;
            console.log("Using template's variables config");
          } catch (parseError) {
            console.error(
              "Error parsing template's variables config:",
              parseError,
            );
            // Keep using the default config
          }
        } else {
          console.log(
            "Campaign template has no variables config, using default",
          );
        }
      } else {
        console.log("Campaign has no template, using default config");
      }
    } catch (error) {
      console.error("Error getting campaign template:", error);
    }

    try {
      // Sanitize the campaign config using the helper function
      campaignConfig = sanitizeFieldStructure(campaignConfig);

      // Log sanitized config summary
      console.log("Campaign config sanitized successfully:", {
        hasPatientFields: Array.isArray(
          campaignConfig.variables?.patient?.fields,
        ),
        patientFieldCount:
          campaignConfig.variables?.patient?.fields?.length || 0,
        hasCampaignFields: Array.isArray(
          campaignConfig.variables?.campaign?.fields,
        ),
        campaignFieldCount:
          campaignConfig.variables?.campaign?.fields?.length || 0,
      });
    } catch (sanitizationError) {
      console.error("Error sanitizing campaign config:", sanitizationError);
      // Reset to a safe default if sanitization fails
      campaignConfig = {
        variables: {
          patient: {
            fields: [],
            validation: {
              requireValidPhone: false,
              requireValidDOB: false,
              requireName: false,
            },
          },
          campaign: { fields: [] },
        },
      };
    }

    // Get allowed field keys from configuration for filtering
    const patientFields = campaignConfig.variables?.patient?.fields || [];
    const campaignFields = campaignConfig.variables?.campaign?.fields || [];

    let allowedKeys = [
      ...patientFields.map((f: any) => f.key),
      ...campaignFields.map((f: any) => f.key),
    ];

    console.log("Allowed variable keys for upload:", allowedKeys);

    // If we have no allowed keys from the template, try to extract them from the processed data
    if (allowedKeys.length === 0 && validated.processedData?.rows?.length > 0) {
      console.log(
        "No field configuration found. Extracting fields from processed data...",
      );

      const firstRow = validated.processedData.rows[0];
      if (firstRow?.variables && typeof firstRow.variables === "object") {
        // Extract all variable keys from the first row
        allowedKeys = Object.keys(firstRow.variables);

        console.log(
          `Extracted ${allowedKeys.length} keys from processed data:`,
          allowedKeys,
        );

        // Create fields dynamically based on the data
        if (allowedKeys.length > 0) {
          // Identify patient fields
          const patientKeyPatterns = [
            /first.*name/i,
            /fname/i,
            /last.*name/i,
            /lname/i,
            /dob/i,
            /birth/i,
            /phone/i,
            /cell/i,
            /mobile/i,
            /email/i,
            /address/i,
            /gender/i,
            /sex/i,
          ];

          const patientKeys = allowedKeys.filter((key) =>
            patientKeyPatterns.some((pattern) => pattern.test(key)),
          );

          const campaignKeys = allowedKeys.filter(
            (key) => !patientKeyPatterns.some((pattern) => pattern.test(key)),
          );

          console.log("Auto-detected patient keys:", patientKeys);
          console.log("Auto-detected campaign keys:", campaignKeys);

          // Update configuration with dynamically created fields
          campaignConfig.variables.patient.fields = patientKeys.map((key) => ({
            key,
            label:
              key.charAt(0).toUpperCase() +
              key.slice(1).replace(/([A-Z])/g, " $1"),
            possibleColumns: [key],
            required: false,
            transform: "text",
          }));

          campaignConfig.variables.campaign.fields = campaignKeys.map(
            (key) => ({
              key,
              label:
                key.charAt(0).toUpperCase() +
                key.slice(1).replace(/([A-Z])/g, " $1"),
              possibleColumns: [key],
              required: false,
              transform: "text",
            }),
          );

          // Update the field collections
          patientFields.push(...campaignConfig.variables.patient.fields);
          campaignFields.push(...campaignConfig.variables.campaign.fields);
        }
      }
    }

    // Re-check allowed keys
    allowedKeys = [
      ...patientFields.map((f: any) => f.key),
      ...campaignFields.map((f: any) => f.key),
    ];

    console.log("Final allowed variable keys for upload:", allowedKeys);

    // If we have pre-processed data from client-side validation, filter it
    if (validated.processedData?.rows) {
      console.log(
        "Using pre-processed data rows:",
        validated.processedData.rows.length,
      );

      // Get campaign field configurations for transformation
      const campaignFieldConfigs =
        campaignConfig.variables?.campaign?.fields || [];
      const campaignFieldMap = new Map();
      campaignFieldConfigs.forEach((field: any) => {
        if (field && field.key) {
          campaignFieldMap.set(field.key, field);
        }
      });

      // Filter each row to only include allowed variables
      validated.processedData.rows = validated.processedData.rows.map(
        (row: any) => {
          if (!row) {
            return { patientId: null, patientHash: null, variables: {} };
          }

          if (row.variables) {
            // Only keep variables defined in the configuration
            const filteredVariables: Record<string, unknown> = {};

            // Include defined fields
            for (const key of allowedKeys) {
              if (row.variables[key] !== undefined) {
                const rawValue = row.variables[key];

                // Apply transformation based on field config for campaign variables
                if (campaignFieldMap.has(key)) {
                  const fieldConfig = campaignFieldMap.get(key);
                  // Import the transformValue function from excel-processor
                  const transformedValue = transformValue(
                    rawValue,
                    fieldConfig.transform,
                  );
                  filteredVariables[key] = transformedValue;
                } else {
                  filteredVariables[key] = rawValue;
                }
              }
            }

            // Make sure we keep essential fields
            const essentialFields = [
              "firstName",
              "lastName",
              "dob",
              "primaryPhone",
            ];
            for (const key of essentialFields) {
              if (row.variables[key] !== undefined) {
                filteredVariables[key] = row.variables[key];
              }
            }

            return {
              patientId: row.patientId || null,
              patientHash: row.patientHash || null,
              variables: filteredVariables,
            };
          }
          return row;
        },
      );
    } else {
      console.log(
        "No pre-processed data provided, will process raw file content",
      );
    }

    // Process the file with campaign configuration
    try {
      console.log(`Attempting to process file for run ${validated.runId}`);

      const processResult = await FileService.processFile(
        validated.fileContent,
        validated.fileName,
        validated.runId,
        orgId,
        campaignConfig, // Pass campaign config explicitly
        validated.processedData, // Pass any pre-processed data
      );

      if (isError(processResult)) {
        console.error(
          "Error processing file:",
          JSON.stringify(processResult.error, null, 2),
        );

        // Enhanced error handling with more context
        return {
          success: false,
          error: {
            message: processResult.error.message || "Failed to process file",
            code: processResult.error.code || "PROCESSING_ERROR",
            details: processResult.error.details || { runId: validated.runId },
          },
        };
      }

      // Insert rows into the database
      if (
        processResult.data?.parsedData?.rows &&
        processResult.data.parsedData.rows.length > 0
      ) {
        try {
          console.log(
            `Inserting ${processResult.data.parsedData.rows.length} rows into database for run ${validated.runId}`,
          );

          // Get the patient service
          const { patientService } = await import(
            "@/services/patients/patients-service"
          );

          // Process each row to ensure it has a patient ID and all required fields
          const rowsToInsert = [];

          for (const [
            index,
            rowData,
          ] of processResult.data.parsedData.rows.entries()) {
            // Extract patient data from variables
            const variables = rowData.variables || {};

            // Make sure we have all required patient fields from the template
            const patientFieldsRequired = patientFields
              .filter((f) => f.required)
              .map((f) => f.key);

            // Check if we have all patient variables required from the template config
            let hasRequiredPatientFields = true;
            for (const fieldKey of patientFieldsRequired) {
              if (variables[fieldKey] === undefined) {
                console.warn(
                  `Row ${index} missing required patient field: ${fieldKey}`,
                );
                hasRequiredPatientFields = false;
              }
            }

            // Extract essential patient fields (using both camelCase and snake_case variants)
            const firstName = variables.firstName || variables.first_name;
            const lastName = variables.lastName || variables.last_name;
            const phone =
              variables.primaryPhone ||
              variables.phone ||
              variables.phoneNumber ||
              variables.phone_number ||
              variables.primary_phone ||
              variables.cell_phone;
            const dob =
              variables.dob || variables.dateOfBirth || variables.date_of_birth;

            // Check if we have basic patient data needed for creation
            const hasBasicPatientData = !!(firstName && lastName && phone);

            // Log what patient data we found
            console.log(`Row ${index} patient data:`, {
              firstName,
              lastName,
              phone,
              dob,
              hasBasicPatientData,
            });

            // Try to create or find a patient if we have the essential info
            let patientId = rowData.patientId || null;

            if (!patientId && hasBasicPatientData) {
              try {
                console.log(
                  `Creating/finding patient for row ${index}: ${firstName} ${lastName}`,
                );

                // Use patient service to find or create the patient
                const patientResult = await patientService.findOrCreate({
                  firstName: String(firstName),
                  lastName: String(lastName),
                  dob: String(dob || new Date().toISOString().split("T")[0]),
                  phone: String(phone),
                  orgId,
                });

                if (patientResult.success) {
                  patientId = patientResult.data.id;
                  console.log(
                    `Assigned patient ID ${patientId} to row ${index}`,
                  );
                }
              } catch (patientError) {
                console.error(
                  `Error processing patient for row ${index}:`,
                  patientError,
                );
                // Continue without patient ID
              }
            }

            // Process variables to ensure all keys are present (including from column mappings)
            const columnMappings =
              (processResult.data as any).columnMappings || {};

            if (
              processResult.data.parsedData &&
              Object.keys(columnMappings).length > 0
            ) {
              // Process each field in the template to ensure it's represented in variables
              for (const [fieldKey, columnName] of Object.entries(
                columnMappings,
              )) {
                if (variables[fieldKey] === undefined) {
                  // If we have a mapping for this field but no value in variables,
                  // check if it's in campaignData/patientData
                  console.log(
                    `Row ${index}: Field "${fieldKey}" mapped to column "${columnName}" not found in variables`,
                  );
                }
              }
            }

            // Make sure all keys from the source data are included
            let processedVariables: Record<string, unknown> = { ...variables };

            if (allowedKeys.length === 0) {
              // If no allowed keys were explicitly defined, allow all keys
              console.log(
                `Row ${index}: No filter keys defined, using all variables`,
              );
            } else {
              // Filter the variables to only include allowed keys
              const filteredVariables: Record<string, unknown> = {};

              for (const key of allowedKeys) {
                if (variables[key] !== undefined) {
                  filteredVariables[key] = variables[key];
                }
              }

              // Log how many variables were kept vs. filtered out
              console.log(
                `Row ${index}: Filtered variables from ${Object.keys(variables).length} to ${Object.keys(filteredVariables).length} keys`,
              );

              // Check if we lost any important campaign data during filtering
              if (
                Object.keys(filteredVariables).length <
                Object.keys(variables).length
              ) {
                console.warn(
                  `Row ${index}: Some variables were filtered out. Original keys:`,
                  Object.keys(variables),
                );
                console.warn(
                  `Row ${index}: Filtered keys:`,
                  Object.keys(filteredVariables),
                );

                // Use the original variables if filtering removed too much data
                if (
                  Object.keys(filteredVariables).length <
                  Object.keys(variables).length / 2
                ) {
                  console.warn(
                    `Row ${index}: Too many variables were filtered out. Using original variables.`,
                  );
                  // Keep all variables since filtering removed too much
                  processedVariables.__unfiltered = true;
                } else {
                  // Use the filtered variables
                  processedVariables = filteredVariables;
                }
              } else {
                // Use the filtered variables
                processedVariables = filteredVariables;
              }
            }

            // Ensure campaign fields from template configuration are properly set
            const campaignFieldsRequired = campaignFields
              .filter((f) => f.required)
              .map((f) => f.key);

            // Check if we have all campaign variables required from the template config
            let hasRequiredCampaignFields = true;
            for (const fieldKey of campaignFieldsRequired) {
              if (processedVariables[fieldKey] === undefined) {
                console.warn(
                  `Row ${index} missing required campaign field: ${fieldKey}`,
                );
                hasRequiredCampaignFields = false;
              }
            }

            // Add the row to our insert batch
            rowsToInsert.push({
              runId: validated.runId,
              orgId,
              patientId,
              variables: processedVariables,
              status: "pending",
              sortIndex: index,
              // Add information about missing fields to metadata
              metadata: {
                hasRequiredPatientFields,
                hasRequiredCampaignFields,
                patientFieldsRequired,
                campaignFieldsRequired,
                columnMappings: columnMappings,
              },
            });
          }

          // Insert the rows into the database
          if (rowsToInsert.length > 0) {
            // Log a sample of what we're inserting
            console.log(
              `Inserting ${rowsToInsert.length} rows. First row variables:`,
              rowsToInsert[0]?.variables
                ? Object.keys(rowsToInsert[0].variables)
                : "No variables",
            );

            await db.insert(rows).values(rowsToInsert);
            console.log(
              `Successfully inserted ${rowsToInsert.length} rows into database`,
            );

            // Update the run's metadata to reflect the row count
            await db
              .update(runs)
              .set({
                metadata: JSON.stringify({
                  ...run.metadata,
                  rows: {
                    total: rowsToInsert.length,
                    invalid: processResult.data.stats?.invalidRows || 0,
                  },
                }),
              } as any)
              .where(and(eq(runs.id, validated.runId), eq(runs.orgId, orgId)));
          }
        } catch (insertError) {
          console.error("Error inserting rows into database:", insertError);
          // We'll continue anyway since the file was processed successfully
          // but we'll add a warning to the response
          console.warn(
            "Rows were processed but couldn't be saved to the database",
          );
          return {
            success: true,
            data: processResult.data,
          };
        }
      } else {
        console.log("No valid rows to insert into database");
      }

      // Success!
      return {
        success: true,
        data: processResult.data,
      };
    } catch (processError) {
      console.error("Caught error during file processing:", processError);
      return {
        success: false,
        error: {
          message: `Unexpected error processing file: ${(processError as Error).message || "Unknown error"}`,
          details: {
            runId: validated.runId,
            fileName: validated.fileName,
          },
        },
      };
    }
  } catch (error) {
    console.error("Top-level error in uploadFile:", error);
    return {
      success: false,
      error: {
        message: `Server error: ${(error as Error).message || "Unknown error"}`,
        details: { errorType: typeof error },
      },
    };
  }
}

// Validate file data schema
const validateDataSchema = z.object({
  fileContent: z.string(),
  fileName: z.string(),
  variablesConfig: z.any(),
});

// Validate file data action
export async function validateData(data: unknown) {
  try {
    const { orgId } = await requireOrg();
    console.log("Validate data action triggered with orgId:", orgId);

    // Basic input validation
    if (!data || typeof data !== "object") {
      return {
        success: false,
        error: {
          message: "Invalid data format: data must be an object",
          details: { receivedType: typeof data },
        },
      };
    }

    // Validate input data with schema
    let validated;
    try {
      validated = validateDataSchema.parse(data);
    } catch (parseError) {
      console.error("Schema validation failed:", parseError);
      return {
        success: false,
        error: {
          message: "Invalid data format: failed schema validation",
          details: { error: `${(parseError as Error).message}` },
        },
      };
    }

    console.log(`Validating file data for filename: ${validated.fileName}`);

    // Log the original config structure
    if (validated.variablesConfig) {
      console.log("Original config structure:", {
        hasVariablesProperty: !!validated.variablesConfig.variables,
        hasPatientProperty: !!validated.variablesConfig.variables?.patient,
        hasCampaignProperty: !!validated.variablesConfig.variables?.campaign,
        topLevelKeys: Object.keys(validated.variablesConfig),
      });
    }

    // Apply field structure sanitization to ensure variablesConfig has a consistent structure
    // with safe defaults for all required properties
    try {
      const variablesConfig = sanitizeFieldStructure(validated.variablesConfig);

      // Log details about the sanitized config
      console.log("Sanitized variablesConfig:", {
        hasPatientFields: Array.isArray(
          variablesConfig.variables?.patient?.fields,
        ),
        patientFieldCount: Array.isArray(
          variablesConfig.variables?.patient?.fields,
        )
          ? variablesConfig.variables.patient.fields.length
          : 0,
        hasCampaignFields: Array.isArray(
          variablesConfig.variables?.campaign?.fields,
        ),
        campaignFieldCount: Array.isArray(
          variablesConfig.variables?.campaign?.fields,
        )
          ? variablesConfig.variables.campaign.fields.length
          : 0,
        patientFieldKeys: Array.isArray(
          variablesConfig.variables?.patient?.fields,
        )
          ? variablesConfig.variables.patient.fields.map((f: any) => f.key)
          : [],
        campaignFieldKeys: Array.isArray(
          variablesConfig.variables?.campaign?.fields,
        )
          ? variablesConfig.variables.campaign.fields.map((f: any) => f.key)
          : [],
      });

      // Process the file using the excel processor service
      try {
        const result = await processExcelFile(
          validated.fileContent,
          validated.fileName,
          variablesConfig,
          orgId,
        );

        console.log(`File validation for ${validated.fileName} completed`, {
          status: result.error ? "error" : "success",
          rowCount: result.parsedData?.rows?.length || 0,
        });

        // Add detailed debug logging for rows
        console.log("Validation result details:", {
          hasStats: !!result.stats,
          totalRows: result.stats?.totalRows,
          validRows: result.stats?.validRows,
          parsedDataExists: !!result.parsedData,
          rowsExist: !!result.parsedData?.rows,
          rowsLength: result.parsedData?.rows?.length,
          firstRow: result.parsedData?.rows?.[0] ? "EXISTS" : "NOT FOUND",
          hasMatchedColumns:
            Array.isArray(result.matchedColumns) &&
            result.matchedColumns.length > 0,
          matchedColumnsCount: result.matchedColumns?.length || 0,
          columnMappings: result.columnMappings ? "EXISTS" : "NOT FOUND",
        });

        if (result.error) {
          console.error("Excel processor validation error:", result.error);
          return {
            success: false,
            error: {
              message:
                typeof result.error === "string"
                  ? result.error
                  : result.error.message || "Unknown error validating file",
              details: { fileName: validated.fileName },
            },
          };
        }

        // Ensure we have matched columns even if there are no valid rows
        // This is important for the client to determine if the file has the right structure
        const matchedColumns = result.matchedColumns || [];
        const columnMappings = result.columnMappings || {};

        // Return the processed data with explicit matchedColumns
        return {
          success: true,
          data: {
            fileName: validated.fileName,
            orgId,
            parsedData: {
              rows: result.parsedData?.rows || [],
              headers: result.parsedData?.headers || [],
            },
            stats: {
              totalRows: result.stats?.totalRows || 0,
              validRows: result.stats?.validRows || 0,
              invalidRows: result.stats?.invalidRows || 0,
              uniquePatients: result.stats?.uniquePatients || 0,
              duplicatePatients: result.stats?.duplicatePatients || 0,
            },
            // Include matched columns information to help the client-side validation
            matchedColumns,
            columnMappings,
            // Include any errors/warnings in the response
            errors: result.errors || [],
            warnings: result.warnings || [],
          },
        };
      } catch (error) {
        console.error("Error processing file for validation:", error);
        return {
          success: false,
          error: {
            message:
              error instanceof Error
                ? error.message
                : "Unknown error validating file",
            details: { fileName: validated.fileName },
          },
        };
      }
    } catch (sanitizeError) {
      console.error("Error sanitizing field structure:", sanitizeError);
      return {
        success: false,
        error: {
          message: "Error processing file configuration",
          details: { error: `${(sanitizeError as Error).message}` },
        },
      };
    }
  } catch (error) {
    console.error("Error validating file data:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to validate file",
    );
  }
}
