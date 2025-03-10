// src/hooks/runs/use-runs.ts
import { createRun } from "@/server/actions/runs/create";
import { getRun, getRuns } from "@/server/actions/runs/fetch";
import { uploadFile } from "@/server/actions/runs/file";
import { pauseRun, startRun } from "@/server/actions/runs/start";
import { useCallback, useEffect, useState } from "react";

// Define types for run hooks
type RunFilters = {
  campaignId: string;
  limit?: number;
  offset?: number;
};

type RunsHookReturn = {
  data: {
    runs: any[];
    totalCount: number;
    hasMore: boolean;
  } | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

type RunHookReturn = {
  run: any | null;
  isLoading: boolean;
  error: Error | null;
  startRun: () => Promise<boolean>;
  pauseRun: () => Promise<boolean>;
  isStartingRun: boolean;
  isPausingRun: boolean;
  refetch: () => Promise<void>;
};

type CreateRunInput = {
  name: string;
  campaignId: string;
  customPrompt?: string;
  customVoicemailMessage?: string;
  aiGenerated?: boolean;
  variationNotes?: string;
  naturalLanguageInput?: string;
  promptVersion?: number;
  scheduledAt?: string;
  summary?: string;
  metadata?: {
    categories?: string[];
    tags?: string[];
    keyChanges?: string[];
    toneShift?: string;
    focusArea?: string;
    promptLength?: {
      before: number;
      after: number;
      difference: number;
    };
    changeIntent?: string;
    sentimentShift?: {
      before?: string;
      after?: string;
    };
    formalityLevel?: {
      before?: number;
      after?: number;
    };
    complexityScore?: {
      before?: number;
      after?: number;
    };
  };
  comparison?: {
    structuralChanges?: Array<{
      section?: string;
      changeType?: "added" | "removed" | "modified" | "unchanged";
      description?: string;
    }>;
    keyPhrases?: {
      added?: string[];
      removed?: string[];
      modified?: Array<{
        before?: string;
        after?: string;
      }>;
    };
    performancePrediction?: {
      expectedImpact?: "positive" | "neutral" | "negative" | "uncertain";
      confidenceLevel?: number;
      rationale?: string;
    };
  };
  diffData?: {
    promptDiff?: Array<{
      type?: "unchanged" | "added" | "removed";
      value?: string;
    }>;
    voicemailDiff?: Array<{
      type?: "unchanged" | "added" | "removed";
      value?: string;
    }>;
  };
};

type CreateRunHookReturn = {
  mutateAsync: (data: CreateRunInput) => Promise<any>;
  isPending: boolean;
  error: Error | null;
};

type UploadFileInput = {
  runId: string;
  fileContent: string;
  fileName: string;
};

type UploadFileHookReturn = {
  mutateAsync: (data: UploadFileInput) => Promise<any>;
  isPending: boolean;
  error: Error | null;
};

/**
 * Hook to fetch runs with filtering
 */
export function useRuns(filters: RunFilters): RunsHookReturn {
  const [data, setData] = useState<{
    runs: any[];
    totalCount: number;
    hasMore: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRuns = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getRuns({
        campaignId: filters.campaignId,
        limit: filters.limit || 20,
        offset: filters.offset || 0,
      });

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch runs"));
    } finally {
      setIsLoading(false);
    }
  }, [filters.campaignId, filters.limit, filters.offset]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchRuns,
  };
}

/**
 * Hook to fetch a single run by ID and manage its state
 */
export function useRun(runId: string): RunHookReturn {
  const [run, setRun] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isStartingRun, setIsStartingRun] = useState<boolean>(false);
  const [isPausingRun, setIsPausingRun] = useState<boolean>(false);

  const fetchRun = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getRun(runId);
      setRun(result);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error(`Failed to fetch run ${runId}`),
      );
    } finally {
      setIsLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  const handleStartRun = async (): Promise<boolean> => {
    setIsStartingRun(true);

    try {
      await startRun({ runId });
      await fetchRun();
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error(`Failed to start run ${runId}`),
      );
      return false;
    } finally {
      setIsStartingRun(false);
    }
  };

  const handlePauseRun = async (): Promise<boolean> => {
    setIsPausingRun(true);

    try {
      await pauseRun({ runId });
      await fetchRun();
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error(`Failed to pause run ${runId}`),
      );
      return false;
    } finally {
      setIsPausingRun(false);
    }
  };

  return {
    run,
    isLoading,
    error,
    startRun: handleStartRun,
    pauseRun: handlePauseRun,
    isStartingRun,
    isPausingRun,
    refetch: fetchRun,
  };
}

/**
 * Hook to create a new run
 */
export function useCreateRun(campaignId: string): CreateRunHookReturn {
  const [isPending, setIsPending] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async (data: CreateRunInput): Promise<any> => {
    setIsPending(true);
    setError(null);

    try {
      const result = await createRun({
        ...data,
        campaignId,
      });

      return result;
    } catch (err) {
      const thrownError =
        err instanceof Error ? err : new Error("Failed to create run");
      setError(thrownError);
      throw thrownError;
    } finally {
      setIsPending(false);
    }
  };

  return {
    mutateAsync,
    isPending,
    error,
  };
}

/**
 * Hook to upload a file for a run
 */
export function useUploadFile(): UploadFileHookReturn {
  const [isPending, setIsPending] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async (data: UploadFileInput): Promise<any> => {
    setIsPending(true);
    setError(null);

    try {
      const result = await uploadFile(data);
      return result;
    } catch (err) {
      const thrownError =
        err instanceof Error ? err : new Error("Failed to upload file");
      setError(thrownError);
      throw thrownError;
    } finally {
      setIsPending(false);
    }
  };

  return {
    mutateAsync,
    isPending,
    error,
  };
}
