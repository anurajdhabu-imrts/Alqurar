import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProjectClauseApi,
  deleteProjectClauseApi,
  extractProjectClausesApi,
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

/** Upload the contract document for AI clause extraction (AI step on hold). */
export function useExtractProjectClauses(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => extractProjectClausesApi(projectId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectClausesKey(projectId) }),
  });
}
