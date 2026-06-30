import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CommentAnchor } from "@/types";
import {
  addDocCommentApi,
  analyzePendingProjectDocsApi,
  analyzeProjectDocApi,
  deleteDocCommentApi,
  deleteProjectDocApi,
  listDocCommentsApi,
  listProjectDocsApi,
  updateDocCommentApi,
  uploadProjectDocApi,
  type UploadArgs,
} from "@/api/projectDocuments";

export const projectDocsKey = (projectId: string) => ["project-documents", projectId] as const;

/** Documents for a project (admin workspace + client portal both use this).
 *  Polls every few seconds while any document is still being analysed, so the
 *  AI summaries appear without a manual refresh. */
export function useProjectDocuments(projectId: string) {
  return useQuery({
    queryKey: projectDocsKey(projectId),
    queryFn: () => listProjectDocsApi(projectId),
    enabled: !!projectId,
    staleTime: 10_000,
    refetchInterval: (query) => {
      const docs = query.state.data ?? [];
      const busy = docs.some((d) => d.analysisStatus === "pending" || d.analysisStatus === "analyzing");
      return busy ? 4000 : false;
    },
  });
}

/** Upload a real file. The backend queues AI analysis automatically; the list
 *  query polls for the result, so nothing here blocks on the model. */
export function useCreateProjectDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: UploadArgs) => uploadProjectDocApi(args),
    onSuccess: (doc) => qc.invalidateQueries({ queryKey: projectDocsKey(doc.projectId) }),
  });
}

/** Manually (re)queue AI analysis on a single stored document. */
export function useAnalyzeProjectDoc(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => analyzeProjectDocApi(documentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectDocsKey(projectId) }),
  });
}

/** Queue analysis for every not-yet-analysed document in the project (bulk). */
export function useAnalyzePendingDocs(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => analyzePendingProjectDocsApi(projectId),
    onSuccess: (docs) => qc.setQueryData(projectDocsKey(projectId), docs),
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
