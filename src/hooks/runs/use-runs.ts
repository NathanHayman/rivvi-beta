// src/hooks/runs/use-runs.ts
"use client";

import {
  createRun,
  getRun,
  getRuns,
  pauseRun,
  startRun,
} from "@/server/actions/runs";
import { TCreateRun } from "@/server/actions/runs/create";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function useRuns(campaignId: string, params = {}) {
  return useQuery({
    queryKey: ["runs", campaignId, params],
    queryFn: async () => {
      return getRuns({ campaignId, ...params });
    },
    enabled: !!campaignId,
  });
}

export function useRun(id: string) {
  return useQuery({
    queryKey: ["run", id],
    queryFn: async () => {
      return getRun(id);
    },
    enabled: !!id,
  });
}

export function useCreateRun(campaignId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: Omit<TCreateRun, "campaignId">) => {
      return createRun({
        ...data,
        campaignId,
      });
    },
    onSuccess: (data) => {
      toast.success("Run created successfully");
      queryClient.invalidateQueries({ queryKey: ["runs", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      return data;
    },
    onError: (error) => {
      toast.error(
        `Failed to create run: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
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
