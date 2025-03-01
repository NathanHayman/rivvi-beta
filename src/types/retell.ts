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
  call_analysis: {
    call_summary: string;
    in_voicemail: boolean;
    user_sentiment: string;
    call_successful: boolean;
    transcript: string;
    custom_analysis_data: {
      notes: string;
      callback_requested: boolean;
      callback_date_time: string;
      transferred: boolean;
      transfer_reason: string;
      patient_reached: boolean;
      patient_questions: string;
      detected_ai: boolean;
      call_summary: string;
      [key: string]:
        | string
        | boolean
        | number
        | Record<string, string>
        | Record<string, boolean>
        | Record<string, number>
        | null;
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
