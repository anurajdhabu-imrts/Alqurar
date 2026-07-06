import { useQuery } from "@tanstack/react-query";
import { getDashboardSummaryApi } from "@/api/dashboard";

export const dashboardSummaryKey = ["dashboard-summary"] as const;

/** Live dashboard counts (clients, projects, proposals, delay events). */
export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardSummaryKey,
    queryFn: getDashboardSummaryApi,
    staleTime: 30_000,
  });
}
