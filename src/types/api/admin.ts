// src/types/api/admin.ts
export interface AdminDashboardStats {
  counts: {
    organizations: number;
    campaigns: number;
    runs: number;
    calls: number;
    pendingRequests: number;
  };
  recentRequests: Array<CampaignRequest>;
  topOrganizations: Array<{
    id: string;
    name: string;
    callCount: number;
  }>;
}

export interface AdminCampaignRequestsOptions {
  status?: "pending" | "approved" | "rejected" | "completed" | "all";
  limit?: number;
  offset?: number;
}

export interface CampaignRequest {
  id: string;
  orgId: string;
  requestedBy: string;
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
  createdAt: Date;
  updatedAt?: Date;
  organization?: {
    name: string;
  };
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}
