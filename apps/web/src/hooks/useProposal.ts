import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { generateProposalApi, getProposalApi } from "@/api/proposals";

export const proposalKey = (projectId: string) => ["proposal", projectId] as const;

/** The project's generated EOT claim document; polls while generation runs. */
export function useProposal(projectId: string) {
  return useQuery({
    queryKey: proposalKey(projectId),
    queryFn: () => getProposalApi(projectId),
    enabled: !!projectId,
    refetchInterval: (query) => (query.state.data?.status === "running" ? 3000 : false),
  });
}

/** Queue AI generation of the EOT claim document. */
export function useGenerateProposal(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => generateProposalApi(projectId),
    onSuccess: () => qc.invalidateQueries({ queryKey: proposalKey(projectId) }),
  });
}
