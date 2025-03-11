// src/types/analytics.ts

/**
 * Organization dashboard stats
 */
export type DashboardStats = {
  counts: {
    campaigns: number;
    activeRuns: number;
    completedCalls: number;
    patients: number;
  };
  rates: {
    success: number;
  };
  lastUpdated: string;
};

/**
 * Organization dashboard with charts data
 */
export type OrgDashboardData = {
  callVolume: {
    total: number;
    inbound: number;
    outbound: number;
    completed: number;
    failed: number;
    voicemail: number;
    connected: number;
    avgDuration: number;
  };
  callTrends: {
    date: string;
    count: number;
  }[];
  callOutcomes: {
    connected: number;
    voicemail: number;
    missed: number;
    failed: number;
  };
  recentCalls: Array<{
    id: string;
    status: string;
    direction: string;
    createdAt: string;
    patientId?: string | null;
    insights: {
      patientReached: boolean;
      voicemailLeft: boolean;
      sentiment: "positive" | "negative" | "neutral";
      followUpNeeded: boolean;
    };
  }>;
  topCampaigns: Array<{
    id: string;
    name: string;
    callCount: number;
    successRate: number;
  }>;
};

/**
 * Time-based analytics data
 */
export type TimeBasedAnalytics = {
  byHourOfDay: Array<{
    hour: number;
    total: number;
    reached: number;
    rate: number;
  }>;
  byDayOfWeek: Array<{
    day: number;
    name: string;
    total: number;
    reached: number;
    rate: number;
  }>;
  callOutcomes: Array<{
    date: string;
    connected: number;
    voicemail: number;
    failed: number;
  }>;
  period: "day" | "week" | "month";
  timezone: string;
  campaignId?: string;
};

/**
 * Campaign analytics data
 */
export type CampaignAnalytics = {
  campaign: {
    id: string;
    name: string;
    direction: "inbound" | "outbound";
  };
  callMetrics: {
    total: number;
    completed: number;
    failed: number;
    voicemail: number;
    inProgress: number;
    pending: number;
    successRate: number;
  };
  conversionMetrics: Array<{
    field: string;
    label: string;
    type: string;
    values: Record<string, number>;
    total: number;
    rate: number;
  }>;
  runMetrics: Array<{
    id: string;
    name: string;
    totalCalls: number;
    completedCalls: number;
    conversionRate: number;
  }>;
  lastUpdated: string;
};

/**
 * Run analytics data
 */
export type RunAnalytics = {
  overview: {
    name: string;
    campaignName: string;
    status: string;
    totalRows: number;
    completedCalls: number;
    pendingCalls: number;
    failedCalls: number;
    startTime: string;
    endTime: string;
    duration: number;
  };
  callMetrics: {
    patientsReached: number;
    voicemailsLeft: number;
    noAnswer: number;
    averageCallDuration: number;
    conversionRate: number;
    inboundReturns?: number;
  };
  callTimeline: Array<{
    time: string;
    status: string;
    reached: boolean;
  }>;
  analysis: Array<{
    field: string;
    value: string;
    count: number;
    percentage: number;
  }>;
};

/**
 * Report generation options
 */
export type ReportOptions = {
  orgId: string;
  reportType: "calls" | "campaigns" | "runs" | "patients";
  startDate?: Date;
  endDate?: Date;
  campaignId?: string;
  runId?: string;
  format: "csv" | "json";
};

/**
 * Report data
 */
export type Report = {
  data: string;
  filename: string;
  contentType: string;
};

/**
 * Call insights from analysis
 */
export type CallInsights = {
  sentiment: "positive" | "negative" | "neutral";
  followUpNeeded: boolean;
  followUpReason?: string;
  patientReached: boolean;
  voicemailLeft: boolean;
};
