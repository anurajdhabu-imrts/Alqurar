import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCostingApi, saveCostingApi, type CostingSheet, type CostingSheetIn } from "@/api/costing";

export const costingKey = (projectId: string) => ["costing", projectId] as const;

export function useCostingQuery(projectId: string) {
  return useQuery({
    queryKey: costingKey(projectId),
    queryFn: () => getCostingApi(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useSaveCosting(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sheet: CostingSheetIn) => saveCostingApi(projectId, sheet),
    // The PUT returns the freshly stored sheet, so seed the cache with it.
    onSuccess: (data: CostingSheet) => qc.setQueryData(costingKey(projectId), data),
  });
}
