// src/types/api/ai.ts
export interface AIPromptRequest {
    basePrompt: string;
    baseVoicemailMessage?: string;
    naturalLanguageInput: string;
    campaignContext?: {
      name?: string;
      description?: string;
      type?: string;
    };
  }
  
  export interface AIPromptResponse {
    prompt: string;
    voicemail?: string;
    summary?: string;
    suggestedRunName?: string;
  }
  
  export interface ContextGenerationRequest {
    context: Record<string, any>;
  }
  
  export interface ContextGenerationResponse {
    instructions: string;
  }