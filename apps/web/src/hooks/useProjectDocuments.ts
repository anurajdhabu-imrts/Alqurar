import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteProjectDocApi,
  listProjectDocsApi,
  uploadProjectDocApi,
  type UploadArgs,
} from "@/api/projectDocuments";

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

/** Upload a real file (stored in Google Drive via the backend). */
export function useCreateProjectDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: UploadArgs) => uploadProjectDocApi(args),
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
