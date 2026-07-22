import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProjectQueryApi,
  deleteProjectQueryApi,
  listProjectQueriesApi,
  updateProjectQueryApi,
  type CreateProjectQueryArgs,
} from "@/api/projectQueries";
import type { ProjectQuery } from "@/types";

export const projectQueriesKey = (projectId: string) => ["project-queries", projectId] as const;

/** Queries / RFIs for a project. */
export function useProjectQueries(projectId: string) {
  return useQuery({
    queryKey: projectQueriesKey(projectId),
    queryFn: () => listProjectQueriesApi(projectId),
    enabled: !!projectId,
    staleTime: 10_000,
  });
}

export function useCreateProjectQuery(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: CreateProjectQueryArgs) => createProjectQueryApi(args),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectQueriesKey(projectId) }),
  });
}

export function useUpdateProjectQuery(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ProjectQuery> }) =>
      updateProjectQueryApi(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectQueriesKey(projectId) }),
  });
}

export function useDeleteProjectQuery(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProjectQueryApi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectQueriesKey(projectId) }),
  });
}
