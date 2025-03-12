// Types for Retell webhook payloads
export type RetellCallStatus =
  | "registered"
  | "ongoing"
  | "ended"
  | "error"
  | "voicemail";
export type RowStatus =
  | "pending"
  | "calling"
  | "completed"
  | "failed"
  | "skipped";
export type CallStatus =
  | "pending"
  | "in-progress"
  | "completed"
  | "failed"
  | "voicemail"
  | "no-answer";

export type RetellInboundWebhookPayload = {
  from_number: string;
  to_number: string;
  agent_id: string;
  [key: string]: any;
};

export type RetellInboundWebhookResponse = {
  status: "success" | "error";
  message?: string;
  error?: string;
  call_inbound: {
    override_agent_id: string | null;
    dynamic_variables: Record<string, any>;
    metadata: Record<string, any>;
  };
};

export type RetellPostCallObjectRaw = {
  call_id?: string;
  direction?: "inbound" | "outbound";
  agent_id?: string;
  metadata?: Record<string, any>;
  to_number?: string;
  from_number?: string;
  call_status?: string;
  recording_url?: string | null;
  disconnection_reason?: string | null;
  transcript?: string;
  duration_ms?: number;
  start_timestamp?: string;
  end_timestamp?: string;
  call_analysis?: {
    transcript?: string;
    call_summary?: string | null;
    in_voicemail?: boolean;
    user_sentiment?: string;
    call_successful?: boolean;
    custom_analysis_data?: Record<string, any>;
    call_completion_rating?: string;
    agent_task_completion_rating?: string;
  };
  [key: string]: any;
};

// Find the type definition for the object and add outreachEffortId
export type CallLogEntry = {
  callId: string;
  patientId?: string;
  fromNumber: string;
  toNumber: string;
  retellCallId: string;
  isReturnCall?: boolean;
  campaignId?: string;
  outreachEffortId?: string; // Add this field
  hotSwapPerformed?: boolean;
  time: string;
};

/**
 * Ensure values are always strings for Retell dynamic variables
 */
export function ensureStringValue(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Extract insights from a call transcript using pattern matching and NLP
 */
export function extractCallInsights(payload: {
  transcript?: string;
  analysis?: Record<string, any>;
}): {
  sentiment: "positive" | "negative" | "neutral";
  followUpNeeded: boolean;
  followUpReason?: string;
  patientReached: boolean;
  voicemailLeft: boolean;
} {
  try {
    const { transcript, analysis } = payload;
    const processedAnalysis = analysis || {};

    // Determine sentiment - check multiple possible field names
    let sentiment: "positive" | "negative" | "neutral" = "neutral";
    const possibleSentimentFields = [
      "sentiment",
      "user_sentiment",
      "patient_sentiment",
      "call_sentiment",
    ];

    for (const field of possibleSentimentFields) {
      if (field in processedAnalysis) {
        const value = processedAnalysis[field];
        if (typeof value === "string") {
          if (value.toLowerCase().includes("positive")) {
            sentiment = "positive";
            break;
          } else if (value.toLowerCase().includes("negative")) {
            sentiment = "negative";
            break;
          }
        }
      }
    }

    // Check if patient was reached - normalize different field names
    const patientReachedValue =
      processedAnalysis.patient_reached !== undefined
        ? processedAnalysis.patient_reached
        : processedAnalysis.patientReached;

    const patientReached =
      patientReachedValue === true ||
      patientReachedValue === "true" ||
      patientReachedValue === "yes";

    // Check if voicemail was left
    const voicemailLeft =
      processedAnalysis.voicemail_left === true ||
      processedAnalysis.voicemailLeft === true ||
      processedAnalysis.left_voicemail === true ||
      processedAnalysis.leftVoicemail === true ||
      processedAnalysis.voicemail === true ||
      processedAnalysis.in_voicemail === true ||
      processedAnalysis.voicemail_detected === true;

    // Determine if follow-up is needed - check multiple possible conditions
    const scheduleFollowUp =
      processedAnalysis.callback_requested === true ||
      processedAnalysis.callbackRequested === true ||
      processedAnalysis.callback_requested === "true" ||
      processedAnalysis.callbackRequested === "true";

    const patientHadQuestions =
      processedAnalysis.patient_questions === true ||
      processedAnalysis.patientQuestion === true ||
      processedAnalysis.has_questions === true ||
      processedAnalysis.hasQuestions === true ||
      processedAnalysis.patient_question === "true" ||
      processedAnalysis.patientQuestion === "true";

    let followUpNeeded =
      scheduleFollowUp ||
      patientHadQuestions ||
      !patientReached ||
      sentiment === "negative";

    // Determine reason for follow-up
    let followUpReason;
    if (followUpNeeded) {
      if (scheduleFollowUp) {
        followUpReason = "Patient requested follow-up";
      } else if (patientHadQuestions) {
        followUpReason = "Patient had unanswered questions";
      } else if (!patientReached) {
        followUpReason = "Unable to reach patient";
      } else if (sentiment === "negative") {
        followUpReason = "Negative sentiment detected";
      }
    }

    // Use transcript to enhance insights if available
    if (transcript && typeof transcript === "string") {
      // Check for callback requests in transcript
      if (
        !followUpNeeded &&
        (transcript.toLowerCase().includes("call me back") ||
          transcript.toLowerCase().includes("callback") ||
          transcript.toLowerCase().includes("call me tomorrow"))
      ) {
        followUpNeeded = true;
        followUpReason = "Callback request detected in transcript";
      }

      // Detect sentiment from transcript if not already determined
      if (sentiment === "neutral") {
        const positiveWords = [
          "great",
          "good",
          "excellent",
          "happy",
          "pleased",
          "thank you",
          "appreciate",
        ];
        const negativeWords = [
          "bad",
          "unhappy",
          "disappointed",
          "frustrated",
          "upset",
          "angry",
          "not right",
        ];

        let positiveCount = 0;
        let negativeCount = 0;

        const transcriptLower = transcript.toLowerCase();

        positiveWords.forEach((word) => {
          if (transcriptLower.includes(word)) positiveCount++;
        });

        negativeWords.forEach((word) => {
          if (transcriptLower.includes(word)) negativeCount++;
        });

        if (positiveCount > negativeCount + 1) {
          sentiment = "positive";
        } else if (negativeCount > positiveCount) {
          sentiment = "negative";
        }
      }
    }

    return {
      sentiment,
      followUpNeeded,
      followUpReason,
      patientReached,
      voicemailLeft,
    };
  } catch (error) {
    console.error("Error extracting call insights:", error);

    // Return default values on error
    return {
      sentiment: "neutral",
      followUpNeeded: false,
      patientReached: false,
      voicemailLeft: false,
    };
  }
}

/**
 * Helper function to map Retell call status to our internal status
 */
export function getStatus(
  type: "call" | "row",
  status: RetellCallStatus,
): CallStatus | RowStatus {
  console.log(`[STATUS CONVERSION] Converting ${status} to ${type} status`);

  if (type === "call") {
    switch (status) {
      case "registered":
        return "pending";
      case "ongoing":
        return "in-progress";
      case "ended":
        return "completed";
      case "error":
        return "failed";
      case "voicemail":
        return "voicemail"; // Keep "voicemail" status for calls
      default:
        console.log(
          `[WARNING] Unknown call status: ${status}, defaulting to pending`,
        );
        return "pending";
    }
  } else {
    switch (status) {
      case "ongoing":
        return "calling";
      case "registered":
        return "pending";
      case "ended":
        return "completed";
      case "error":
        return "failed";
      case "voicemail":
        // For row status, we need to use "completed" since rowStatusEnum doesn't have "voicemail"
        // BUT we'll add a flag in metadata to track that it was actually a voicemail
        return "completed";
      default:
        console.log(
          `[WARNING] Unknown row status: ${status}, defaulting to pending`,
        );
        return "pending";
    }
  }
}
