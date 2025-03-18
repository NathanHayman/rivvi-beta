export type RetellPostCallObjectRaw = {
  call_id: string;
  call_type: string;
  from_number: string;
  to_number: string;
  direction: string;
  agent_id: string;
  retell_llm_dynamic_variables: Record<string, string>;
  call_status: string;
  start_timestamp: number;
  end_timestamp: number;
  duration_ms: number;
  recording_url: string;
  public_log_url: string;
  disconnection_reason: string;
  metadata: Record<string, string>;
  transcript: string;
  call_analysis: {
    call_summary: string;
    in_voicemail: boolean;
    user_sentiment: string;
    call_successful: boolean;
    custom_analysis_data: {
      notes: string;
      questions: string;
      transferred: boolean;
      detected_ai: boolean;
      // * Campaign Specific Variables (based on the campaign config)
      [key: string]: string | boolean | number | null | undefined;
    };
    agent_task_completion_rating: string;
    call_completion_rating: string;
  };
};

export type RetellPostCallWebhookRaw = {
  headers: {
    Accept: string;
    "Accept-Encoding": string;
    "Content-Type": string;
    Host: string;
    "User-Agent": string;
  };
  body: {
    event: string; // later add the full enum of events
    call: RetellPostCallObjectRaw;
  };
};

export type RetellInboundWebhookRaw = {
  headers: {
    Accept: string;
    "Accept-Encoding": string;
    "Content-Type": string;
    Host: string;
    "User-Agent": string;
  };
  body: {
    event: "call_inbound"; // later add the full enum of events
    call_inbound: RetellInboundWebhookPayload;
  };
};

export type RetellInboundWebhookPayload = {
  agent_id: string;
  to_number: string;
  from_number: string;
};

export type RetellInboundWebhookResponse = {
  status: "success" | "error" | "pending" | "warning" | "partial_success";
  message?: string;
  error?: string | null;
  call_inbound: {
    override_agent_id?: string | null;
    dynamic_variables: Record<
      string,
      string | boolean | number | null | undefined
    >;
    metadata: Record<string, string | boolean | number | null | undefined>;
  };
};
