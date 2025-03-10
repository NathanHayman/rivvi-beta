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
      console.log("Uploading file:", {
        fileName: data.fileName,
        fileSize: data.fileContent.length,
        hasProcessedData: !!data.processedData,
        rowCount: data.processedData?.rows?.length || 0,
      });

      // Ensure processedData is correctly structured for server processing
      if (data.processedData?.rows) {
        // Keep the original structure but ensure variables are properly formatted
        data.processedData.rows = data.processedData.rows.map((row) => {
          if (!row)
            return { patientId: null, patientHash: null, variables: {} };

          // Ensure patientId is preserved in both top level and variables
          const patientId = row.patientId || null;
          let variables =
            typeof row.variables === "object" ? row.variables : {};

          // If patientId exists, ensure it's also in the variables
          if (patientId) {
            variables = { ...variables, patientId };
          }

          return {
            patientId,
            patientHash: row.patientHash || null,
            variables,
          };
        });
      }

      // Validate that the data is well-formed before sending
      if (!data.runId) {
        throw new Error("Missing runId for file upload");
      }

      if (!data.fileContent) {
        throw new Error("Missing file content for upload");
      }

      const result = await uploadFile(data);

      // Check for success or error based on the server response format
      if (!result) {
        console.error(
          "File upload failed: Received null or undefined response",
        );
        throw new Error("File upload failed: Server returned no response");
      }

      if (!result.success) {
        // Enhanced error logging with detailed inspection
        console.error("File upload failed:", {
          error: result.error,
          errorMessage: result.error?.message || "No error message",
          errorDetails: result.error?.details || "No error details",
          rawResult: JSON.stringify(result).substring(0, 200) + "...",
        });

        // Construct a helpful error message based on available information
        let errorMessage = "File upload failed";

        if (result.error && typeof result.error === "object") {
          if (result.error.message) {
            errorMessage = result.error.message;
          }

          // Add details if available
          if (
            result.error.details &&
            typeof result.error.details === "object"
          ) {
            const detailsStr = Object.entries(result.error.details)
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ");
            if (detailsStr) {
              errorMessage += ` (${detailsStr})`;
            }
          }
        }

        throw new Error(errorMessage);
      }

      return result.data;
    },
    onSuccess: (data) => {
      toast.success("File uploaded successfully", {
        description: `Processed ${data.totalRows || 0} rows`,
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["run"] });
    },
    onError: (error: any) => {
      console.error("File upload error:", error);
      toast.error("File upload failed", {
        description: error?.message || "Please try again or contact support",
      });
    },
  });
}
