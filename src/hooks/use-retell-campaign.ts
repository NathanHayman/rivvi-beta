// src/hooks/useRetellCampaign.ts
import {
  convertPostCallToAnalysisFields,
  getAgentComplete,
} from "@/lib/retell/retell-client-safe";
import { useEffect, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

/**
 * Custom hook to handle Retell agent data fetching and integration with campaign form
 */
export function useRetellCampaign(form: UseFormReturn<any>) {
  const [isLoadingAgent, setIsLoadingAgent] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentData, setAgentData] = useState<any | null>(null);

  // Handle agent selection
  useEffect(() => {
    // Check if agent ID is already set when component mounts
    const currentAgentId = form.getValues("agentId");
    if (currentAgentId) {
      setSelectedAgentId(currentAgentId);
    }

    // Set up form watcher for agentId changes
    const subscription = form.watch((value, { name }) => {
      if (name === "agentId" && value.agentId) {
        setSelectedAgentId(value.agentId);
      }
    });

    // Cleanup the subscription on unmount
    return () => subscription.unsubscribe();
  }, [form]);

  // Fetch agent data when agent ID changes
  useEffect(() => {
    async function fetchAgentData() {
      if (!selectedAgentId) return;

      setIsLoadingAgent(true);
      try {
        const completeAgentData = await getAgentComplete(selectedAgentId);
        setAgentData(completeAgentData);

        // Set LLM ID in form
        form.setValue("llmId", completeAgentData.combined.llm_id);

        // Set base prompt if it's not already set
        if (
          !form.getValues("basePrompt") ||
          form.getValues("basePrompt") === ""
        ) {
          form.setValue(
            "basePrompt",
            completeAgentData.combined.general_prompt,
          );
        }

        // Set voicemail message if available
        if (completeAgentData.combined.voicemail_message) {
          form.setValue(
            "voicemailMessage",
            completeAgentData.combined.voicemail_message,
          );
        }

        // Process post-call analysis fields if available
        if (completeAgentData.combined.post_call_analysis_data?.length > 0) {
          const { standardFields, campaignFields } =
            convertPostCallToAnalysisFields(
              completeAgentData.combined.post_call_analysis_data,
            );

          if (standardFields.length > 0) {
            form.setValue("standardAnalysisFields", standardFields);
          }

          if (campaignFields.length > 0) {
            form.setValue("campaignAnalysisFields", campaignFields);
          }
        }

        toast.success("Agent data loaded successfully");
      } catch (error) {
        console.error("Error fetching agent data:", error);
        toast.error(
          `Failed to load agent data: ${error instanceof Error ? error.message : "Unknown error"}`,
        );

        // Allow the user to continue by setting a placeholder LLM ID if needed
        const currentLlmId = form.getValues("llmId");
        if (!currentLlmId) {
          form.setValue("llmId", "placeholder_llm_id");
          toast.warning(
            "Using placeholder LLM ID due to API issues. You can still save the form.",
            { duration: 5000 },
          );
        }
      } finally {
        setIsLoadingAgent(false);
      }
    }

    void fetchAgentData();
  }, [selectedAgentId, form]);

  // Method to manually fetch agent data
  const refreshAgentData = async () => {
    const agentId = form.getValues("agentId");
    if (!agentId) {
      toast.error("Please select an agent first");
      return;
    }

    setSelectedAgentId(agentId);
  };

  return {
    isLoadingAgent,
    agentData,
    refreshAgentData,
  };
}
