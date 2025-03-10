"use client";

import { uploadFile } from "@/server/actions/runs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useUploadFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      runId: string;
      fileContent: string;
      fileName: string;
      processedData?: {
        headers?: string[];
        rows?: any[];
      };
    }) => {
      // Enhanced logging to debug processed data
      console.log("Uploading file with processedData:", {
        hasProcessedData: !!data.processedData,
        rowCount: data.processedData?.rows?.length || 0,
        firstRowSample: data.processedData?.rows?.[0]
          ? JSON.stringify(data.processedData.rows[0]).substring(0, 200) + "..."
          : "No rows",
      });

      // Ensure processedData has the right format for the server action
      if (data.processedData?.rows) {
        // Make sure each row is ready for database insertion
        data.processedData.rows = data.processedData.rows.map((row) => {
          if (typeof row === "object") {
            return {
              variables: row.variables || row, // Handle both formats: {variables: {...}} or direct object
              patientId: row.patientId || null,
            };
          }
          return { variables: row };
        });
      }

      return uploadFile(data);
    },
    onSuccess: (data, variables) => {
      const rowsMessage = data.rowsAdded
        ? `${data.rowsAdded} rows added successfully`
        : "File uploaded successfully";

      toast.success(`${rowsMessage}`);

      // Log successful upload
      console.log("File upload succeeded:", {
        runId: variables.runId,
        rowsAdded: data.rowsAdded,
        invalidRows: data.invalidRows || 0,
      });

      // Invalidate multiple queries to ensure UI is updated
      queryClient.invalidateQueries({ queryKey: ["run", variables.runId] });
      queryClient.invalidateQueries({
        queryKey: ["run-rows", variables.runId],
      });
      queryClient.invalidateQueries({
        queryKey: ["run-details", variables.runId],
      });
      queryClient.invalidateQueries({
        queryKey: ["runs"],
      });
    },
    onError: (error) => {
      console.error("File upload error:", error);
      toast.error(
        `Error uploading file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    },
  });
}
