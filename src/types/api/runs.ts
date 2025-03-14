// src/types/api/runs.ts
export type Run = {
  id: string;
  campaignId: string;
  orgId: string;
  name: string;
  customPrompt?: string;
  customVoicemailMessage?: string;
  variationNotes?: string;
  naturalLanguageInput?: string;
  promptVersion?: number;
  aiGenerated?: boolean;
  status:
    | "draft"
    | "processing"
    | "ready"
    | "running"
    | "paused"
    | "completed"
    | "failed"
    | "scheduled";
  metadata?: {
    rows?: {
      total: number;
      invalid: number;
    };
    calls?: {
      total: number;
      completed: number;
      failed: number;
      calling: number;
      pending: number;
      skipped: number;
      voicemail: number;
      connected: number;
      converted: number;
    };
    run?: {
      error?: string;
      startTime?: string;
      endTime?: string;
      lastPausedAt?: string;
      scheduledTime?: string;
      duration?: number;
      batchSize?: number;
      callsPerMinute?: number;
      respectPatientTimezone?: boolean;
      callStartHour?: number;
      callEndHour?: number;
      maxRetries?: number;
      pausedOutsideHours?: boolean;
      lastCallTime?: string;
    };
  };
  rawFileUrl?: string;
  processedFileUrl?: string;
  scheduledAt?: string;
  createdAt: string;
  updatedAt?: string;
};

export type RunWithCampaign = Run & {
  campaign: {
    id: string;
    name: string;
    direction: "inbound" | "outbound";
    config?: {
      basePrompt: string;
      voicemailMessage?: string;
      variables: any;
      analysis: any;
    };
  };
};

export type Row = {
  id: string;
  runId: string;
  orgId: string;
  patientId?: string;
  variables: Record<string, any>;
  processedVariables?: Record<string, any>;
  analysis?: Record<string, any>;
  status: "pending" | "calling" | "completed" | "failed" | "skipped";
  error?: string;
  retellCallId?: string;
  sortIndex: number;
  priority?: number;
  batchEligible?: boolean;
  retryCount?: number;
  callAttempts?: number;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
};

export type RunResponse = {
  runs: Run[];
  totalCount: number;
  hasMore: boolean;
};

export type RowsResponse = {
  rows: Row[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  counts: {
    all: number;
    pending: number;
    calling: number;
    completed: number;
    failed: number;
    skipped: number;
  };
};

export type CreateRunInput = {
  name: string;
  campaignId: string;
  customPrompt?: string;
  customVoicemailMessage?: string;
  aiGenerated?: boolean;
  variationNotes?: string;
  naturalLanguageInput?: string;
  promptVersion?: number;
  scheduledAt?: string;
  clientRequestId?: string;
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

export type ProcessedFileData = {
  totalRows?: number;
  parsedData?: {
    rows?: any[];
    headers?: string[];
  };
  invalidRows?: number;
  stats?: {
    totalRows?: number;
    validRows?: number;
    invalidRows?: number;
    uniquePatients?: number;
    duplicatePatients?: number;
  };
};
