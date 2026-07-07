import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  generateClientProposalApi,
  getClientProposalApi,
  saveProposalInputsApi,
  type ProposalInputs,
} from "@/api/clientProposals";

export const clientProposalKey = (projectId: string) => ["client-proposal", projectId] as const;

/** The proposal's generated costed client proposal; polls while generation runs. */
export function useClientProposal(projectId: string) {
  return useQuery({
    queryKey: clientProposalKey(projectId),
    queryFn: () => getClientProposalApi(projectId),
    enabled: !!projectId,
    refetchInterval: (query) => (query.state.data?.status === "running" ? 3000 : false),
  });
}

/** Queue AI generation of the costed client proposal (optionally saving inputs first). */
export function useGenerateClientProposal(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inputs?: ProposalInputs) => generateClientProposalApi(projectId, inputs),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientProposalKey(projectId) }),
  });
}

/** Save the admin-entered proposal fields (without generating). */
export function useSaveProposalInputs(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inputs: ProposalInputs) => saveProposalInputsApi(projectId, inputs),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientProposalKey(projectId) }),
  });
}
