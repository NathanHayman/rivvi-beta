// src/types/api/campaigns.ts
export type Campaign = {
  id: string;
  name: string;
  orgId: string;
  templateId: string;
  direction: "inbound" | "outbound";
  isActive: boolean;
  isDefaultInbound: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
};

export type CampaignTemplate = {
  id: string;
  name: string;
  description?: string;
  agentId: string;
  llmId: string;
  basePrompt: string;
  voicemailMessage?: string;
  postCallWebhookUrl?: string;
  inboundWebhookUrl?: string;
  variablesConfig: {
    patient: {
      fields: Array<{
        key: string;
        label: string;
        possibleColumns: string[];
        transform?:
          | "text"
          | "short_date"
          | "long_date"
          | "time"
          | "phone"
          | "provider";
        required: boolean;
        description?: string;
      }>;
      validation: {
        requireValidPhone: boolean;
        requireValidDOB: boolean;
        requireName: boolean;
      };
    };
    campaign: {
      fields: Array<{
        key: string;
        label: string;
        possibleColumns: string[];
        transform?:
          | "text"
          | "short_date"
          | "long_date"
          | "time"
          | "phone"
          | "provider";
        required: boolean;
        description?: string;
      }>;
    };
  };
  analysisConfig: {
    standard: {
      fields: Array<{
        key: string;
        label: string;
        type: "boolean" | "string" | "date" | "enum";
        options?: string[];
        required: boolean;
        description?: string;
      }>;
    };
    campaign: {
      fields: Array<{
        key: string;
        label: string;
        type: "boolean" | "string" | "date" | "enum";
        options?: string[];
        required: boolean;
        description?: string;
        isMainKPI?: boolean;
      }>;
    };
  };
  createdAt: string;
  updatedAt?: string;
};

export type CampaignWithTemplate = Campaign & {
  template: CampaignTemplate;
  config?: {
    basePrompt: string;
    voicemailMessage?: string;
    variables: CampaignTemplate["variablesConfig"];
    analysis: CampaignTemplate["analysisConfig"];
  };
};

export type CampaignRequest = {
  id: string;
  orgId: string;
  requestedBy?: string;
  name: string;
  direction: "inbound" | "outbound";
  description: string;
  mainGoal?: string;
  desiredAnalysis?: string[];
  exampleSheets?: Array<{
    name: string;
    url: string;
    fileType: string;
  }>;
  status: "pending" | "approved" | "rejected" | "completed";
  adminNotes?: string;
  resultingCampaignId?: string;
  createdAt: string;
  updatedAt?: string;
};

export type CreateCampaignRequestInput = {
  name: string;
  description: string;
  mainGoal?: string;
  desiredAnalysis?: string[];
  exampleSheets?: CampaignRequest["exampleSheets"];
  direction?: "inbound" | "outbound";
};

export type ProcessCampaignRequestInput = {
  requestId: string;
  status: "approved" | "rejected" | "completed";
  adminNotes?: string;
  resultingCampaignId?: string;
};
