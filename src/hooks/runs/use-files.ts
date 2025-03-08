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
    }) => {
      return uploadFile(data);
    },
    onSuccess: (data, variables) => {
      toast.success(`File uploaded successfully: ${data.rowsAdded} rows added`);

      // Invalidate run query to refetch the run data
      queryClient.invalidateQueries({ queryKey: ["run", variables.runId] });
    },
    onError: (error) => {
      toast.error(
        `Error uploading file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    },
  });
}
