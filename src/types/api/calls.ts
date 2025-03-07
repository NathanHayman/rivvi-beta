// src/types/api/calls.ts
export type Call = {
    id: string;
    orgId: string;
    runId?: string;
    campaignId?: string;
    rowId?: string;
    patientId?: string;
    agentId: string;
    direction: 'inbound' | 'outbound';
    status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'voicemail' | 'no-answer';
    retellCallId?: string;
    recordingUrl?: string;
    toNumber: string;
    fromNumber: string;
    batchId?: string;
    retryCount?: number;
    nextRetryTime?: string;
    callMetrics?: Record<string, any>;
    metadata?: Record<string, any>;
    analysis?: Record<string, any>;
    transcript?: string;
    startTime?: string;
    endTime?: string;
    duration?: number;
    error?: string;
    relatedOutboundCallId?: string;
    createdAt: string;
    updatedAt?: string;
  };
  
  export type CallWithRelations = Call & {
    patient?: {
      id: string;
      firstName: string;
      lastName: string;
      primaryPhone?: string;
      dob?: string;
    } | null;
    campaign?: {
      id: string;
      name: string;
      config?: {
        basePrompt: string;
        voicemailMessage?: string;
        variables: any;
        analysis: any;
      };
    } | null;
    run?: {
      id: string;
      name: string;
      status: string;
    } | null;
    row?: any;
  };
  
  export type GetCallsOptions = {
    limit?: number;
    offset?: number;
    patientId?: string;
    runId?: string;
    status?: string;
    direction?: string;
    orgId: string;
  };
  
  export type CallsResponse = {
    calls: CallWithRelations[];
    totalCount: number;
    hasMore: boolean;
  };
  
  export type CreateManualCallInput = {
    patientId: string;
    campaignId?: string;
    agentId: string;
    variables?: Record<string, any>;
  };