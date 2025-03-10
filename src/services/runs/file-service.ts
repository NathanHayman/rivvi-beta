// src/services/runs/file-service.ts
import {
  ServiceResult,
  createError,
  createSuccess,
} from "@/lib/service-result";
import { db } from "@/server/db";
import { rows, runs } from "@/server/db/schema";
import { type ProcessedFileData } from "@/types/api/runs";
import { and, eq, sql } from "drizzle-orm";
import { processExcelFile, transformValue } from "./excel-processor";

export const fileService = {
  async processFile(
    fileContent: string,
    fileName: string,
    runId: string,
    orgId: string,
    patchedConfig?: any,
    preProcessedData?: {
      headers?: string[];
      rows?: any[];
    },
  ): Promise<ServiceResult<ProcessedFileData>> {
    // Declare run variable at the function scope level
    let run: any = null;

    try {
      console.log(`Processing file for run ${runId} in org ${orgId}`);

      // Get the run
      run = await db.query.runs.findFirst({
        where: and(eq(runs.id, runId), eq(runs.orgId, orgId)),
        with: {
          campaign: {
            with: {
              template: true,
            },
          },
        },
      });

      if (!run) {
        console.error(`Run not found: ${runId}`);
        return createError("NOT_FOUND", "Run not found");
      }

      console.log(`Run found: ${run.id} for campaign ${run.campaign?.id}`);

      // Update run status to processing
      await db
        .update(runs)
        .set({ status: "processing" } as Partial<typeof runs.$inferInsert>)
        .where(eq(runs.id, runId));

      // Safely extract campaign config with better error handling
      let campaignConfig: any = {};

      // Check if we have a patched config to use instead
      if (patchedConfig) {
        console.log("Using patched config instead of campaign template config");
        campaignConfig = patchedConfig;
      } else {
        try {
          if (run.campaign?.template?.variablesConfig) {
            console.log(
              "Raw template config:",
              JSON.stringify(run.campaign.template.variablesConfig, null, 2),
            );

            // Clone the config to avoid modifying the original
            campaignConfig = JSON.parse(
              JSON.stringify(run.campaign.template.variablesConfig),
            );

            // Initialize default structure if any parts are missing
            if (!campaignConfig.variables) campaignConfig.variables = {};
            if (!campaignConfig.variables.campaign)
              campaignConfig.variables.campaign = {};
            if (!campaignConfig.variables.patient)
              campaignConfig.variables.patient = {};

            // Ensure fields arrays exist
            if (!Array.isArray(campaignConfig.variables.campaign.fields)) {
              campaignConfig.variables.campaign.fields = [];
            }

            if (!Array.isArray(campaignConfig.variables.patient.fields)) {
              campaignConfig.variables.patient.fields = [];
            }

            // Safely sanitize campaign fields
            const sanitizedCampaignFields = [];
            for (const field of campaignConfig.variables.campaign.fields) {
              if (!field || typeof field !== "object") continue;

              // Create a new sanitized field object with proper typing
              const sanitizedField: Record<string, any> = {
                key:
                  field.key ||
                  `field_${Math.random().toString(36).substring(2, 9)}`,
                label: field.label || field.key || "Unnamed Field",
                possibleColumns: Array.isArray(field.possibleColumns)
                  ? field.possibleColumns
                  : [field.key || ""],
                required: !!field.required,
                transform: field.transform || "text",
              };

              // Only add referencedTable if it exists and is a string
              if (
                field.referencedTable &&
                typeof field.referencedTable === "string"
              ) {
                sanitizedField.referencedTable = field.referencedTable;
              }

              sanitizedCampaignFields.push(sanitizedField);
            }
            campaignConfig.variables.campaign.fields = sanitizedCampaignFields;

            // Safely sanitize patient fields
            const sanitizedPatientFields = [];
            for (const field of campaignConfig.variables.patient.fields) {
              if (!field || typeof field !== "object") continue;

              // Create a new sanitized field object with proper typing
              const sanitizedField: Record<string, any> = {
                key:
                  field.key ||
                  `field_${Math.random().toString(36).substring(2, 9)}`,
                label: field.label || field.key || "Unnamed Field",
                possibleColumns: Array.isArray(field.possibleColumns)
                  ? field.possibleColumns
                  : [field.key || ""],
                required: !!field.required,
                transform: field.transform || "text",
              };

              // Only add referencedTable if it exists and is a string
              if (
                field.referencedTable &&
                typeof field.referencedTable === "string"
              ) {
                sanitizedField.referencedTable = field.referencedTable;
              }

              sanitizedPatientFields.push(sanitizedField);
            }
            campaignConfig.variables.patient.fields = sanitizedPatientFields;

            console.log(
              "Sanitized config:",
              JSON.stringify(campaignConfig, null, 2),
            );
          } else {
            console.warn(
              "No campaign variables config found, using default empty config",
            );
          }
        } catch (configError) {
          console.error("Error extracting campaign config:", configError);
          console.warn("Using default empty config due to extraction error");

          // Reset to empty config if there was an error
          campaignConfig = {
            variables: {
              patient: { fields: [] },
              campaign: { fields: [] },
            },
          };
        }
      }

      // Check if we have already processed data
      let processedData;

      if (
        preProcessedData &&
        preProcessedData.rows &&
        preProcessedData.rows.length > 0
      ) {
        console.log(
          "Using pre-processed data with",
          preProcessedData.rows.length,
          "rows",
          "First row sample:",
          JSON.stringify(preProcessedData.rows[0], null, 2).substring(0, 200) +
            "...",
        );

        // Convert the pre-processed data format to the expected format
        processedData = {
          headers: preProcessedData.headers || [],
          validRows: preProcessedData.rows.map((row) => {
            // Make sure each row has the correct format for further processing
            // If 'variables' is already on the object, use it; otherwise wrap the row in variables
            // While preserving any other important fields on the row
            const normalizedRow = {
              variables: {},
              patientId: row.patientId || null, // Will be set later during patient processing
            };

            // Apply campaign variable mappings and transformations from config when available
            // We need to properly map fields from the excel/csv according to the campaign configuration
            if (campaignConfig?.variables?.campaign?.fields) {
              const campaignFields = campaignConfig.variables.campaign.fields;

              // Process each campaign field defined in the config
              campaignFields.forEach((field: any) => {
                if (
                  field?.key &&
                  (row[field.key] !== undefined ||
                    (row.variables && row.variables[field.key] !== undefined))
                ) {
                  // Get the value either from the row directly or from row.variables
                  const value =
                    row.variables && row.variables[field.key] !== undefined
                      ? row.variables[field.key]
                      : row[field.key];

                  // Apply any transformations defined in the config
                  normalizedRow.variables[field.key] = field.transform
                    ? transformValue(value, field.transform)
                    : value;
                }
              });
            }

            // For any fields not explicitly mapped in the campaign config,
            // preserve them as they came in (either from row directly or row.variables)
            const sourceVars = row.variables || row;
            Object.keys(sourceVars).forEach((key) => {
              if (normalizedRow.variables[key] === undefined) {
                normalizedRow.variables[key] = sourceVars[key];
              }
            });

            console.log(
              "Normalized row:",
              JSON.stringify(normalizedRow).substring(0, 100) + "...",
            );
            return normalizedRow;
          }),
          invalidRows: [],
          errors: [],
        };

        console.log(
          "Converted preprocessed data to validRows format, count:",
          processedData.validRows.length,
          "First normalized row sample:",
          JSON.stringify(processedData.validRows[0], null, 2).substring(
            0,
            200,
          ) + "...",
        );
      } else {
        // Process the Excel file with the extracted config
        console.log("Processing file with campaign config:", campaignConfig);
        processedData = await processExcelFile(
          fileContent,
          fileName,
          campaignConfig,
          orgId,
        );
      }

      // Log processing results
      console.log(
        `Processed file with ${processedData.validRows.length} valid rows and ${processedData.invalidRows.length} invalid rows`,
      );

      // Skip row creation for files with no valid rows
      if (processedData.validRows.length === 0) {
        console.warn("No valid rows to insert");

        // Update run with warning
        await db
          .update(runs)
          .set({
            status: "failed",
            metadata: {
              ...run.metadata,
              error: "No valid rows found in the file",
            },
          } as Partial<typeof runs.$inferInsert>)
          .where(eq(runs.id, runId));

        return createError(
          "VALIDATION_ERROR",
          "No valid rows found in the file",
        );
      }

      // Only attempt to insert rows if there are valid rows to insert
      if (processedData.validRows.length > 0) {
        try {
          const rowsToInsert = processedData.validRows.map((rowData, index) => {
            // Log each row being inserted to ensure data structure is correct
            const row = {
              runId,
              orgId,
              variables: rowData.variables || {}, // Ensure variables is never null
              patientId: rowData.patientId || null, // Ensure patientId is never undefined
              status: "pending",
              sortIndex: index,
            };

            // Enhanced logging to debug patient ID issues
            if (index < 3) {
              console.log(`Row ${index} preparation:`, {
                hasPatientId: !!rowData.patientId,
                patientIdValue: rowData.patientId || "NULL",
                variablesKeys: Object.keys(rowData.variables || {}),
                finalRowPatientId: row.patientId || "NULL",
              });
              console.log(
                `Row ${index} being inserted:`,
                JSON.stringify(row).substring(0, 200) + "...",
              );
            }

            return row;
          });

          // Defensive check to ensure all required fields are present
          const validRowsToInsert = rowsToInsert.filter((row) => {
            if (!row.variables || typeof row.variables !== "object") {
              console.warn(
                `Skipping row with invalid variables: ${JSON.stringify(row)}`,
              );
              return false;
            }
            return true;
          });

          if (validRowsToInsert.length > 0) {
            console.log(
              `Attempting to insert ${validRowsToInsert.length} rows into database...`,
            );
            try {
              // Log the database schema information
              console.log(
                "Using rows schema with columns:",
                Object.keys(rows).join(", "),
              );

              // Perform the insert with detailed logging
              const insertResult = await db
                .insert(rows)
                .values(validRowsToInsert);

              console.log("Database insert completed successfully:");
              console.log(
                `- Insert result:`,
                JSON.stringify(insertResult).substring(0, 200) + "...",
              );
              console.log(
                `- ${validRowsToInsert.length} rows inserted into database`,
              );

              // Verify rows were actually inserted
              try {
                const insertedRowsCount = await db
                  .select({ count: sql`count(*)` })
                  .from(rows)
                  .where(eq(rows.runId, runId));
                console.log(
                  `- Verification query shows ${insertedRowsCount[0]?.count || 0} rows for this run`,
                );

                // If zero rows inserted, try direct SQL as fallback
                if (
                  insertedRowsCount[0]?.count === 0 ||
                  insertedRowsCount[0]?.count === "0"
                ) {
                  console.log(
                    "No rows found after drizzle insert, trying direct SQL insert as fallback...",
                  );

                  // Create a sample row for testing direct insert
                  const sampleRow = validRowsToInsert[0];

                  // Create a direct SQL INSERT statement
                  const directSql = sql`
                    INSERT INTO "rivvi_row" (
                      "run_id", "org_id", "variables", "status", "sort_index"
                    ) VALUES (
                      ${sampleRow.runId}, 
                      ${sampleRow.orgId}, 
                      ${JSON.stringify(sampleRow.variables)}::json, 
                      'pending', 
                      0
                    ) RETURNING "id"
                  `;

                  try {
                    const directInsertResult = await db.execute(directSql);
                    console.log(
                      "Direct SQL insert result:",
                      directInsertResult,
                    );

                    // Check again
                    const recheck = await db
                      .select({ count: sql`count(*)` })
                      .from(rows)
                      .where(eq(rows.runId, runId));
                    console.log(
                      `- After direct SQL, verification query shows ${recheck[0]?.count || 0} rows`,
                    );
                  } catch (directError) {
                    console.error("Direct SQL insert failed:", directError);
                  }
                }
              } catch (verifyError) {
                console.error("Error verifying row count:", verifyError);
              }
            } catch (dbError) {
              // Detailed error logging for database errors
              console.error("Database insert error details:");
              console.error(`- Error type: ${dbError.constructor.name}`);
              console.error(`- Error message: ${dbError.message}`);
              console.error(`- Error stack: ${dbError.stack}`);

              if (dbError.cause) {
                console.error(
                  `- Error cause: ${JSON.stringify(dbError.cause)}`,
                );
              }

              // Try direct SQL as a fallback after an error
              console.log("Trying direct SQL insert after error...");

              if (validRowsToInsert.length > 0) {
                try {
                  const sampleRow = validRowsToInsert[0];
                  const directSql = sql`
                    INSERT INTO "rivvi_row" (
                      "run_id", "org_id", "variables", "status", "sort_index"
                    ) VALUES (
                      ${sampleRow.runId}, 
                      ${sampleRow.orgId}, 
                      ${JSON.stringify(sampleRow.variables)}::json, 
                      'pending', 
                      0
                    ) RETURNING "id"
                  `;
                  const directInsertResult = await db.execute(directSql);
                  console.log(
                    "Emergency direct SQL insert result:",
                    directInsertResult,
                  );
                } catch (emergencyError) {
                  console.error(
                    "Emergency direct SQL also failed:",
                    emergencyError,
                  );
                }
              }

              // Rethrow to be caught by the outer catch block
              throw dbError;
            }
          } else {
            console.warn("No valid rows to insert after filtering");
          }
        } catch (insertError) {
          console.error("Error inserting rows:", insertError);

          // Update run with error state but don't fail the entire operation
          await db
            .update(runs)
            .set({
              status: "failed",
              metadata: {
                ...run.metadata,
                error:
                  insertError instanceof Error
                    ? insertError.message
                    : "Unknown error inserting rows",
              },
            } as Partial<typeof runs.$inferInsert>)
            .where(eq(runs.id, runId));

          // Return error with details
          return createError(
            "INTERNAL_ERROR",
            "Failed to insert rows from file",
            insertError instanceof Error
              ? insertError
              : new Error(String(insertError)),
          );
        }
      } else {
        console.warn("No valid rows to insert from processed file");
      }

      // Update run metadata
      const updatedMetadata = {
        rows: {
          total: processedData.validRows.length,
          invalid: processedData.invalidRows.length,
        },
        calls: {
          total: processedData.validRows.length,
          pending: processedData.validRows.length,
          completed: 0,
          failed: 0,
          calling: 0,
          skipped: 0,
          voicemail: 0,
          connected: 0,
          converted: 0,
        },
      };

      // Update run status to ready
      await db
        .update(runs)
        .set({
          status: "ready",
          metadata: updatedMetadata,
          rawFileUrl: processedData.rawFileUrl,
          processedFileUrl: processedData.processedFileUrl,
        } as Partial<typeof runs.$inferInsert>)
        .where(eq(runs.id, runId));

      return createSuccess({
        rowsAdded: processedData.validRows.length,
        invalidRows: processedData.invalidRows.length,
        errors: processedData.errors,
        success: true,
      });
    } catch (error) {
      console.error("Error processing file:", error);

      // Update run status to failed
      if (run) {
        await db
          .update(runs)
          .set({
            status: "failed",
            metadata: {
              ...run.metadata,
              error: error instanceof Error ? error.message : String(error),
            },
          } as Partial<typeof runs.$inferInsert>)
          .where(eq(runs.id, runId));
      }

      return createError(
        "INTERNAL_ERROR",
        "Failed to process file",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  },
};
