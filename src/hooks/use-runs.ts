// src/hooks/use-runs.ts
"use client";

import {
  createRun,
  getRun,
  getRuns,
  pauseRun as pauseRunAction,
  startRun as startRunAction,
  uploadFile,
} from "@/server/actions/runs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useRunEvents } from "./use-pusher";

/**
 * Hook to fetch and manage runs for a campaign
 */
export function useRuns(campaignId: string, initialLimit = 10) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: initialLimit,
  });

  // Get all runs for a campaign with pagination
  const query = useQuery({
    queryKey: ["runs", campaignId, pagination.pageIndex, pagination.pageSize],
    queryFn: async () => {
      return getRuns({
        campaignId,
        limit: pagination.pageSize,
        offset: pagination.pageIndex * pagination.pageSize,
      });
    },
  });

  // Create run mutation
  const createRunMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      campaignId: string;
      scheduledAt?: string;
    }) => {
      return createRun(data);
    },
    onSuccess: (data) => {
      toast.success("Run created successfully");
      queryClient.invalidateQueries({ queryKey: ["runs", campaignId] });
      router.push(`/campaigns/${campaignId}/runs/${data?.id}`);
    },
    onError: (error: Error) => {
      toast.error(`Error creating run: ${error.message}`);
    },
  });

  // Start run mutation
  const startRunMutation = useMutation({
    mutationFn: async (data: { runId: string }) => {
      return startRunAction(data);
    },
    onSuccess: () => {
      toast.success("Run started");
      queryClient.invalidateQueries({ queryKey: ["runs", campaignId] });
    },
    onError: (error: Error) => {
      toast.error("Error starting run", {
        description: error.message,
      });
    },
  });

  // Pause run mutation
  const pauseRunMutation = useMutation({
    mutationFn: async (data: { runId: string }) => {
      return pauseRunAction(data);
    },
    onSuccess: () => {
      toast.success("Run paused");
      queryClient.invalidateQueries({ queryKey: ["runs", campaignId] });
    },
    onError: (error: Error) => {
      toast.error("Error pausing run", {
        description: error.message,
      });
    },
  });

  const handleCreateRun = async (data: {
    name: string;
    scheduledAt?: string;
  }) => {
    try {
      await createRunMutation.mutateAsync({
        campaignId,
        ...data,
      });
      return true;
    } catch (error) {
      return false;
    }
  };

  return {
    runs: query.data?.runs || [],
    totalRuns: query.data?.totalCount || 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    pagination,
    setPagination,
    hasMore: query.data?.hasMore || false,

    createRun: handleCreateRun,
    isCreatingRun: createRunMutation.isPending,

    startRun: startRunMutation.mutate,
    isStartingRun: startRunMutation.isPending,

    pauseRun: pauseRunMutation.mutate,
    isPausingRun: pauseRunMutation.isPending,
  };
}

/**
 * Hook to fetch and manage a single run
 */
export function useRun(runId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Get run details
  const query = useQuery({
    queryKey: ["run", runId],
    queryFn: async () => {
      return getRun(runId);
    },
    enabled: !!runId,
    refetchOnWindowFocus: false,
  });

  // Setup real-time updates
  useRunEvents(runId, {
    onCallStarted: () => {
      queryClient.invalidateQueries({ queryKey: ["run", runId] });
    },
    onCallCompleted: () => {
      queryClient.invalidateQueries({ queryKey: ["run", runId] });
    },
    onMetricsUpdated: () => {
      queryClient.invalidateQueries({ queryKey: ["run", runId] });
    },
  });

  // Start run mutation
  const startRunMutation = useMutation({
    mutationFn: async () => {
      return startRunAction({ runId });
    },
    onSuccess: () => {
      toast.success("Run started successfully");
      queryClient.invalidateQueries({ queryKey: ["run", runId] });
    },
    onError: (error: Error) => {
      toast.error(`Error starting run: ${error.message}`);
    },
  });

  // Pause run mutation
  const pauseRunMutation = useMutation({
    mutationFn: async () => {
      return pauseRunAction({ runId });
    },
    onSuccess: () => {
      toast.success("Run paused successfully");
      queryClient.invalidateQueries({ queryKey: ["run", runId] });
    },
    onError: (error: Error) => {
      toast.error(`Error pausing run: ${error.message}`);
    },
  });

  const handleStartRun = async () => {
    try {
      await startRunMutation.mutateAsync();
      return true;
    } catch (error) {
      return false;
    }
  };

  const handlePauseRun = async () => {
    try {
      await pauseRunMutation.mutateAsync();
      return true;
    } catch (error) {
      return false;
    }
  };

  // Update run prompt mutation
  const updatePromptMutation = useMutation({
    mutationFn: async (customPrompt: string) => {
      // This is a placeholder until updateRunPrompt is implemented
      toast.error("Update prompt not implemented yet");
      return { success: false };
    },
    onSuccess: () => {
      toast.success("Run prompt updated successfully");
      queryClient.invalidateQueries({ queryKey: ["run", runId] });
    },
    onError: (error: Error) => {
      toast.error(`Error updating run prompt: ${error.message}`);
    },
  });

  const handleUpdatePrompt = async (customPrompt: string) => {
    try {
      await updatePromptMutation.mutateAsync(customPrompt);
      return true;
    } catch (error) {
      return false;
    }
  };

  // File upload mutation
  const uploadFileMutation = useMutation({
    mutationFn: async ({
      fileContent,
      fileName,
    }: {
      fileContent: string;
      fileName: string;
    }) => {
      return uploadFile({
        runId,
        fileContent,
        fileName,
      });
    },
    onSuccess: (data) => {
      toast.success(
        `File processed successfully: ${data.rowsAdded} rows added`,
      );
      if (data.invalidRows > 0) {
        toast.warning(`${data.invalidRows} invalid rows were skipped`);
      }
      queryClient.invalidateQueries({ queryKey: ["run", runId] });
    },
    onError: (error: Error) => {
      toast.error(`Error processing file: ${error.message}`);
    },
  });

  const handleUploadFile = async (file: File, fileName: string) => {
    try {
      // Convert file to base64
      const reader = new FileReader();
      const filePromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const fileContent = await filePromise;

      await uploadFileMutation.mutateAsync({
        fileContent,
        fileName,
      });

      return true;
    } catch (error) {
      return false;
    }
  };

  return {
    run: query.data,
    isLoading: query.isLoading,
    error: query.error,

    startRun: handleStartRun,
    isStartingRun: startRunMutation.isPending,

    pauseRun: handlePauseRun,
    isPausingRun: pauseRunMutation.isPending,

    updatePrompt: handleUpdatePrompt,
    isUpdatingPrompt: updatePromptMutation.isPending,

    uploadFile: handleUploadFile,
    isUploadingFile: uploadFileMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ["run", runId] }),
  };
}

/**
 * Hook to fetch and manage rows for a run
 */
export function useRunRows(runId: string) {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 50,
  });
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const queryClient = useQueryClient();

  // Get rows for a run with pagination
  const query = useQuery({
    queryKey: [
      "run-rows",
      runId,
      pagination.pageIndex,
      pagination.pageSize,
      filter,
    ],
    queryFn: async () => {
      // This is a placeholder until getRunRows is implemented
      return {
        rows: [],
        pagination: {
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          totalPages: 0,
          totalItems: 0,
        },
        counts: {
          pending: 0,
          calling: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          total: 0,
        },
      };
    },
  });

  // Setup real-time updates
  useRunEvents(runId, {
    onCallStarted: () =>
      queryClient.invalidateQueries({ queryKey: ["run-rows", runId] }),
    onCallCompleted: () =>
      queryClient.invalidateQueries({ queryKey: ["run-rows", runId] }),
  });

  return {
    rows: query.data?.rows || [],
    pagination: query.data?.pagination,
    counts: query.data?.counts,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    pageOptions: {
      pagination,
      setPagination,
    },
    filterOptions: {
      filter,
      setFilter,
    },
  };
}
