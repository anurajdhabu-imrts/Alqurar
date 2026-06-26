import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CommentAnchor } from "@/types";
import {
  addDocCommentApi,
  deleteDocCommentApi,
  deleteProjectDocApi,
  listDocCommentsApi,
  listProjectDocsApi,
  updateDocCommentApi,
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

// ── Document comments ──────────────────────────────────────────────────────

export const docCommentsKey = (documentId: string) => ["document-comments", documentId] as const;

/** Comments/notes attached to a single document. */
export function useDocComments(documentId: string) {
  return useQuery({
    queryKey: docCommentsKey(documentId),
    queryFn: () => listDocCommentsApi(documentId),
    enabled: !!documentId,
  });
}

export function useAddDocComment(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, anchor }: { body: string; anchor?: CommentAnchor | null }) =>
      addDocCommentApi(documentId, body, anchor),
    onSuccess: () => qc.invalidateQueries({ queryKey: docCommentsKey(documentId) }),
  });
}

export function useUpdateDocComment(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => updateDocCommentApi(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: docCommentsKey(documentId) }),
  });
}

export function useDeleteDocComment(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteDocCommentApi(commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: docCommentsKey(documentId) }),
  });
}
