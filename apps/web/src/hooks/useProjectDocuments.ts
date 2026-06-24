import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProjectDocApi, deleteProjectDocApi, listProjectDocsApi } from "@/api/projectDocuments";
import type { UploadedClaimDocument } from "@/types";

export const projectDocsKey = (projectId: string) => ["project-documents", projectId] as const;

/** Documents for a project (admin workspace + client portal both use this). */
export function useProjectDocuments(projectId: string) {
  return useQuery({
    queryKey: projectDocsKey(projectId),
    queryFn: () => listProjectDocsApi(projectId),
    enabled: !!projectId,
    staleTime: 10_000,
  });
}

export function useCreateProjectDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (doc: UploadedClaimDocument) => createProjectDocApi(doc),
    onSuccess: (doc) => qc.invalidateQueries({ queryKey: projectDocsKey(doc.projectId) }),
  });
}

export function useDeleteProjectDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) => deleteProjectDocApi(id),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: projectDocsKey(vars.projectId) }),
  });
}
