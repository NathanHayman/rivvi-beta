// src/hooks/dashboard/use-dashboard.ts
"use client";

import { getCallsByTime, getDashboardStats } from "@/server/actions/dashboard";
import { useQuery } from "@tanstack/react-query";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStats(),
    staleTime: 60 * 1000, // Dashboard data can be a bit more stale
  });
}

export function useCallsByTime(
  period: "day" | "week" | "month" = "day",
  timezone?: string,
) {
  return useQuery({
    queryKey: ["calls-by-time", period, timezone],
    queryFn: () => getCallsByTime(period, timezone),
    staleTime: 60 * 1000,
  });
}
