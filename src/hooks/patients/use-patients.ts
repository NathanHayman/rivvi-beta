// src/hooks/patients/use-patients.ts
"use client";

import {
  createPatient,
  getPatient,
  getPatients,
} from "@/server/actions/patients";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function usePatients(params = {}) {
  return useQuery({
    queryKey: ["patients", params],
    queryFn: () => getPatients(params),
    staleTime: 30 * 1000,
  });
}

export function usePatient(id: string | null) {
  return useQuery({
    queryKey: ["patient", id],
    queryFn: () => (id ? getPatient(id) : null),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => createPatient(data),
    onSuccess: (data) => {
      toast.success("Patient created successfully");

      // Invalidate patients list query
      queryClient.invalidateQueries({
        queryKey: ["patients"],
      });

      return data;
    },
    onError: (error) => {
      toast.error(`Failed to create patient: ${error.message}`);
    },
  });
}
