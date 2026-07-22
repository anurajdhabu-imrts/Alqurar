import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  generateAdmissibilityApi,
  getAdmissibilityApi,
  saveAdmissibilityApi,
} from "@/api/admissibility";
import type { AdmissibilityContent } from "@/types";

export const admissibilityKey = (projectId: string) => ["admissibility", projectId] as const;

/** The project's admissibility matrix; polls while generation runs. */
export function useAdmissibility(projectId: string) {
  return useQuery({
    queryKey: admissibilityKey(projectId),
    queryFn: () => getAdmissibilityApi(projectId),
    enabled: !!projectId,
    refetchInterval: (query) => (query.state.data?.status === "running" ? 3000 : false),
  });
}

/** Queue AI generation of the admissibility matrix. */
export function useGenerateAdmissibility(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => generateAdmissibilityApi(projectId),
    onSuccess: () => qc.invalidateQueries({ queryKey: admissibilityKey(projectId) }),
  });
}

/** Save an analyst-edited admissibility matrix. */
export function useSaveAdmissibility(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: AdmissibilityContent) => saveAdmissibilityApi(projectId, content),
    onSuccess: (data) => qc.setQueryData(admissibilityKey(projectId), data),
  });
}
