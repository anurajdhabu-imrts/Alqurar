import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createClauseApi,
  deleteClauseApi,
  listClausesApi,
  updateClauseApi,
  type ClauseCreatePayload,
  type ClauseUpdatePayload,
} from "@/api/clauses";

export const clausesKey = ["clauses"] as const;

export function useClausesQuery() {
  return useQuery({ queryKey: clausesKey, queryFn: listClausesApi, staleTime: 10 * 60_000 });
}

export function useCreateClause() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ClauseCreatePayload) => createClauseApi(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: clausesKey }),
  });
}

export function useUpdateClause() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ClauseUpdatePayload }) => updateClauseApi(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: clausesKey }),
  });
}

export function useDeleteClause() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteClauseApi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: clausesKey }),
  });
}
