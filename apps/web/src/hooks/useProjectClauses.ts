import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProjectClauseApi,
  deleteProjectClauseApi,
  extractProjectClausesApi,
  getClauseExtractStatusApi,
  listProjectClausesApi,
  updateProjectClauseApi,
  type ProjectClauseCreatePayload,
  type ProjectClauseUpdatePayload,
} from "@/api/projectClauses";

export const projectClausesKey = (projectId: string) => ["project-clauses", projectId] as const;

/** A single project's own clause library. */
export function useProjectClausesQuery(projectId: string) {
  return useQuery({
    queryKey: projectClausesKey(projectId),
    queryFn: () => listProjectClausesApi(projectId),
    enabled: !!projectId,
    staleTime: 5 * 60_000,
  });
}

export function useCreateProjectClause(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectClauseCreatePayload) => createProjectClauseApi(projectId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectClausesKey(projectId) }),
  });
}

export function useUpdateProjectClause(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ProjectClauseUpdatePayload }) =>
      updateProjectClauseApi(projectId, id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectClausesKey(projectId) }),
  });
}

export function useDeleteProjectClause(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProjectClauseApi(projectId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectClausesKey(projectId) }),
  });
}

export const clauseExtractStatusKey = (projectId: string) =>
  ["clause-extract-status", projectId] as const;

/** Upload the contract; the backend extracts clauses with AI in the background.
 * Seeds the status query so {@link useClauseExtractStatus} starts polling. */
export function useExtractProjectClauses(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => extractProjectClausesApi(projectId, file),
    onSuccess: (res) =>
      qc.setQueryData(clauseExtractStatusKey(projectId), {
        status: res.status,
        // carry the "not configured" message through as an error when idle
        error: res.status === "idle" ? res.message : undefined,
      }),
  });
}

/** Polls background clause-extraction status; when it finishes, refreshes the
 * project's clause list so the newly extracted clauses appear. */
export function useClauseExtractStatus(projectId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: clauseExtractStatusKey(projectId),
    queryFn: () => getClauseExtractStatusApi(projectId),
    enabled: !!projectId,
    refetchInterval: (q) => (q.state.data?.status === "running" ? 3000 : false),
  });

  const prev = useRef<string | undefined>(undefined);
  useEffect(() => {
    const status = query.data?.status;
    if (prev.current === "running" && (status === "done" || status === "failed")) {
      qc.invalidateQueries({ queryKey: projectClausesKey(projectId) });
    }
    prev.current = status;
  }, [query.data?.status, projectId, qc]);

  return query;
}
