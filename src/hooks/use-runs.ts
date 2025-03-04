// src/hooks/use-runs.ts
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useRunEvents } from "./use-pusher";

/**
 * Hook to fetch and manage runs for a campaign
 */
export function useRuns(campaignId: string, initialLimit = 10) {
  const router = useRouter();
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: initialLimit,
  });

  // Get all runs for a campaign with pagination
  const {
    data: runsData,
    isLoading,
    error,
    refetch,
  } = api.runs.getAll.useQuery({
    campaignId,
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
  });

  // Create run mutation
  const createRunMutation = api.runs.create.useMutation({
    onSuccess: (data) => {
      toast.success("Run created successfully");
      router.push(`/campaigns/${campaignId}/runs/${data?.id}`);
    },
    onError: (error) => {
      toast.error(`Error creating run: ${error.message}`);
    },
  });

  const createRun = async (data: { name: string; scheduledAt?: string }) => {
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
    runs: runsData?.runs || [],
    totalRuns: runsData?.totalCount || 0,
    isLoading,
    error,
    refetch,
    pagination,
    setPagination,
    hasMore: runsData?.hasMore || false,

    createRun,
    isCreatingRun: createRunMutation.isPending,
  };
}

/**
 * Hook to fetch and manage a single run
 */
export function useRun(runId: string) {
  const router = useRouter();
  const utils = api.useUtils();

  // Get run details
  const {
    data: run,
    isLoading,
    error,
  } = api.runs.getById.useQuery(
    { id: runId },
    {
      enabled: !!runId,
      refetchOnWindowFocus: false,
    },
  );

  // Setup real-time updates
  useRunEvents(runId, {
    onCallStarted: () => {
      utils.runs.getById.invalidate({ id: runId });
    },
    onCallCompleted: () => {
      utils.runs.getById.invalidate({ id: runId });
    },
    onMetricsUpdated: () => {
      utils.runs.getById.invalidate({ id: runId });
    },
  });

  // Start run mutation
  const startRunMutation = api.runs.start.useMutation({
    onSuccess: () => {
      toast.success("Run started successfully");
      utils.runs.getById.invalidate({ id: runId });
    },
    onError: (error) => {
      toast.error(`Error starting run: ${error.message}`);
    },
  });

  // Pause run mutation
  const pauseRunMutation = api.runs.pause.useMutation({
    onSuccess: () => {
      toast.success("Run paused successfully");
      utils.runs.getById.invalidate({ id: runId });
    },
    onError: (error) => {
      toast.error(`Error pausing run: ${error.message}`);
    },
  });

  const startRun = async () => {
    try {
      await startRunMutation.mutateAsync({ runId });
      return true;
    } catch (error) {
      return false;
    }
  };

  const pauseRun = async () => {
    try {
      await pauseRunMutation.mutateAsync({ runId });
      return true;
    } catch (error) {
      return false;
    }
  };

  // Update run prompt
  const updatePromptMutation = api.runs.updatePrompt.useMutation({
    onSuccess: () => {
      toast.success("Run prompt updated successfully");
      utils.runs.getById.invalidate({ id: runId });
    },
    onError: (error) => {
      toast.error(`Error updating run prompt: ${error.message}`);
    },
  });

  const updatePrompt = async (customPrompt: string) => {
    try {
      await updatePromptMutation.mutateAsync({ runId, customPrompt });
      return true;
    } catch (error) {
      return false;
    }
  };

  // File upload mutation
  const uploadFileMutation = api.runs.uploadFile.useMutation({
    onSuccess: (data) => {
      toast.success(
        `File processed successfully: ${data.rowsAdded} rows added`,
      );
      if (data.invalidRows > 0) {
        toast.warning(`${data.invalidRows} invalid rows were skipped`);
      }
      utils.runs.getById.invalidate({ id: runId });
    },
    onError: (error) => {
      toast.error(`Error processing file: ${error.message}`);
    },
  });

  const uploadFile = async (file: File, fileName: string) => {
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
        runId,
        fileContent,
        fileName,
      });

      return true;
    } catch (error) {
      return false;
    }
  };

  return {
    run,
    isLoading,
    error,

    startRun,
    isStartingRun: startRunMutation.isPending,

    pauseRun,
    isPausingRun: pauseRunMutation.isPending,

    updatePrompt,
    isUpdatingPrompt: updatePromptMutation.isPending,

    uploadFile,
    isUploadingFile: uploadFileMutation.isPending,

    refetch: () => utils.runs.getById.invalidate({ id: runId }),
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

  // Get rows for a run with pagination
  const { data, isLoading, error, refetch } = api.runs.getRows.useQuery({
    runId,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    filter: filter as any,
  });

  // Setup real-time updates
  useRunEvents(runId, {
    onCallStarted: () => refetch(),
    onCallCompleted: () => refetch(),
  });

  return {
    rows: data?.rows || [],
    pagination: data?.pagination,
    counts: data?.counts,
    isLoading,
    error,
    refetch,
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
