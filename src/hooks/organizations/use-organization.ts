// src/hooks/organizations/use-organization.ts
"use client";

import {
  getCurrentOrganization,
  updateOrganization,
} from "@/server/actions/organizations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCurrentOrganization() {
  return useQuery({
    queryKey: ["current-organization"],
    queryFn: () => getCurrentOrganization(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => updateOrganization(data),
    onSuccess: (data) => {
      toast.success("Organization updated successfully");

      // Invalidate affected queries
      queryClient.invalidateQueries({
        queryKey: ["current-organization"],
      });

      return data;
    },
    onError: (error) => {
      toast.error(`Failed to update organization: ${error.message}`);
    },
  });
}
