import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMethodologyApi,
  saveMethodologyApi,
  type MethodologyAssessment,
  type MethodologyStateIn,
} from "@/api/methodology";

export const methodologyKey = (projectId: string) => ["methodology", projectId] as const;

export function useMethodology(projectId: string) {
  return useQuery({
    queryKey: methodologyKey(projectId),
    queryFn: () => getMethodologyApi(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useSaveMethodology(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (state: MethodologyStateIn) => saveMethodologyApi(projectId, state),
    // The PUT returns the freshly stored assessment, so seed the cache with it.
    onSuccess: (data: MethodologyAssessment) => qc.setQueryData(methodologyKey(projectId), data),
  });
}
