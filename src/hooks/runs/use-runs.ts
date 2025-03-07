// src/hooks/runs/use-runs.ts
"use client";

import {
  createRun,
  getRun,
  getRuns,
  pauseRun,
  startRun,
  uploadFile,
} from "@/server/actions/runs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function useRuns(campaignId: string, params = {}) {
  return useQuery({
    queryKey: ["runs", campaignId, params],
    queryFn: () => getRuns({ campaignId, ...params }),
    staleTime: 30 * 1000,
  });
}

export function useRun(id: string | null) {
  return useQuery({
    queryKey: ["run", id],
    queryFn: () => (id ? getRun(id) : null),
    enabled: !!id,
    staleTime: 10 * 1000, // Lower stale time for active runs
  });
}

export function useCreateRun(campaignId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: any) => createRun({ ...data, campaignId }),
    onSuccess: (data) => {
      toast.success("Run created successfully");

      // Invalidate runs queries
      queryClient.invalidateQueries({
        queryKey: ["runs", campaignId],
      });

      // Navigate to the new run
      router.push(`/campaigns/${campaignId}/runs/${data.id}`);

      return data;
    },
    onError: (error) => {
      toast.error(`Failed to create run: ${error.message}`);
    },
  });
}

export function useStartRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: string) => startRun({ runId }),
    onSuccess: (data, runId) => {
      toast.success("Run started successfully");

      // Invalidate run query
      queryClient.invalidateQueries({
        queryKey: ["run", runId],
      });

      return data;
    },
    onError: (error) => {
      toast.error(`Failed to start run: ${error.message}`);
    },
  });
}

export function usePauseRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: string) => pauseRun({ runId }),
    onSuccess: (data, runId) => {
      toast.success("Run paused successfully");

      // Invalidate run query
      queryClient.invalidateQueries({
        queryKey: ["run", runId],
      });

      return data;
    },
    onError: (error) => {
      toast.error(`Failed to pause run: ${error.message}`);
    },
  });
}

export function useUploadFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      runId,
      file,
      fileName,
    }: {
      runId: string;
      file: File;
      fileName: string;
    }) => {
      // Convert file to base64
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      return uploadFile({
        runId,
        fileContent,
        fileName,
      });
    },
    onSuccess: (data, { runId }) => {
      toast.success(
        `File processed successfully: ${data.rowsAdded} rows added`,
      );

      if (data.invalidRows > 0) {
        toast.warning(`${data.invalidRows} invalid rows were skipped`);
      }

      // Invalidate run query
      queryClient.invalidateQueries({
        queryKey: ["run", runId],
      });

      return data;
    },
    onError: (error) => {
      toast.error(`Failed to process file: ${error.message}`);
    },
  });
}
