import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getChecklistApi,
  saveChecklistApi,
  type ChecklistItemIn,
  type ProposalChecklist,
} from "@/api/proposalChecklist";

export const proposalChecklistKey = (projectId: string) => ["proposal-checklist", projectId] as const;

export function useProposalChecklist(projectId: string) {
  return useQuery({
    queryKey: proposalChecklistKey(projectId),
    queryFn: () => getChecklistApi(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useSaveChecklist(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: ChecklistItemIn[]) => saveChecklistApi(projectId, items),
    // The PUT returns the freshly stored checklist, so seed the cache with it.
    onSuccess: (data: ProposalChecklist) => qc.setQueryData(proposalChecklistKey(projectId), data),
  });
}
