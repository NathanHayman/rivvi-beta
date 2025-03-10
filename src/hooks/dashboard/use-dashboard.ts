// src/hooks/dashboard/use-dashboard.ts
"use client";

import { getDashboardStats } from "@/server/actions/dashboard";
import { useQuery } from "@tanstack/react-query";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStats(),
    staleTime: 60 * 1000, // Dashboard data can be a bit more stale
  });
}
