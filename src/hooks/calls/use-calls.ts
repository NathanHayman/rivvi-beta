// src/hooks/calls/use-calls.ts
"use client";

import {
  createManualCall,
  getCall,
  getCalls,
  getCallTranscript,
} from "@/server/actions/calls";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCalls(params = {}) {
  return useQuery({
    queryKey: ["calls", params],
    queryFn: () => getCalls(params),
    staleTime: 30 * 1000,
  });
}

export function useCall(id: string | null) {
  return useQuery({
    queryKey: ["call", id],
    queryFn: () => (id ? getCall(id) : null),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useCallTranscript(callId: string | null) {
  return useQuery({
    queryKey: ["call-transcript", callId],
    queryFn: () => (callId ? getCallTranscript(callId) : null),
    enabled: !!callId,
    staleTime: 60 * 1000,
  });
}

export function useCreateManualCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => createManualCall(data),
    onSuccess: (data) => {
      toast.success("Call initiated successfully");

      // Invalidate affected queries
      queryClient.invalidateQueries({ queryKey: ["calls"] });

      if (data.patientId) {
        queryClient.invalidateQueries({
          queryKey: ["patient", data.patientId],
        });
      }

      return data;
    },
    onError: (error) => {
      toast.error(`Failed to initiate call: ${error.message}`);
    },
  });
}
