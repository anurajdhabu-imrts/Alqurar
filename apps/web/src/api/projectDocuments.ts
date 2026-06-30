import { api } from "./client";
import type { CommentAnchor, DocumentComment, UploadedClaimDocument } from "@/types";

/** Documents uploaded against a project (server-side, shared admin ↔ client). */
export async function listProjectDocsApi(projectId: string): Promise<UploadedClaimDocument[]> {
  const { data } = await api.get(`/project-documents/project/${projectId}`);
  return data;
}

export interface UploadArgs {
  file: File;
  projectId: string;
  uploadedBy: string;
}

/** Upload the real file — backend streams it to Google Drive and saves the record. */
export async function uploadProjectDocApi({ file, projectId, uploadedBy }: UploadArgs): Promise<UploadedClaimDocument> {
  const form = new FormData();
  form.append("file", file);
  form.append("projectId", projectId);
  form.append("uploadedBy", uploadedBy);
  const { data } = await api.post("/project-documents/upload", form);
  return data;
}

/** Fetch the file (from Drive, via the backend) and trigger a browser download. */
export async function downloadProjectDocApi(documentId: string, filename: string): Promise<void> {
  const { data } = await api.get(`/project-documents/${documentId}/download`, { responseType: "blob" });
  const url = URL.createObjectURL(data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Fetch the raw file bytes (stored server-side) as a Blob, for rendering inline
 * inside the in-app viewer page.
 */
export async function fetchProjectDocBlobApi(documentId: string): Promise<Blob> {
  const { data } = await api.get(`/project-documents/${documentId}/download`, { responseType: "blob" });
  return data as Blob;
}

export async function deleteProjectDocApi(documentId: string): Promise<void> {
  await api.delete(`/project-documents/${documentId}`);
}

/** Queue (re)analysis of a stored document — returns immediately; result is polled. */
export async function analyzeProjectDocApi(documentId: string): Promise<UploadedClaimDocument> {
  const { data } = await api.post(`/project-documents/${documentId}/analyze`);
  return data;
}

/** Queue analysis for every not-yet-analysed document in a project (bulk). */
export async function analyzePendingProjectDocsApi(projectId: string): Promise<UploadedClaimDocument[]> {
  const { data } = await api.post(`/project-documents/project/${projectId}/analyze-pending`);
  return data;
}

// ── Document comments ──────────────────────────────────────────────────────

/** All comments/notes attached to a document. */
export async function listDocCommentsApi(documentId: string): Promise<DocumentComment[]> {
  const { data } = await api.get(`/project-documents/${documentId}/comments`);
  return data;
}

/** Attach a new comment to a document (author is the logged-in user, server-side). */
export async function addDocCommentApi(
  documentId: string,
  body: string,
  anchor?: CommentAnchor | null,
): Promise<DocumentComment> {
  const payload = anchor
    ? { body, anchorText: anchor.text, anchorStart: anchor.start, anchorLength: anchor.length }
    : { body };
  const { data } = await api.post(`/project-documents/${documentId}/comments`, payload);
  return data;
}

/** Edit an existing comment's text. */
export async function updateDocCommentApi(commentId: string, body: string): Promise<DocumentComment> {
  const { data } = await api.put(`/project-documents/comments/${commentId}`, { body });
  return data;
}

export async function deleteDocCommentApi(commentId: string): Promise<void> {
  await api.delete(`/project-documents/comments/${commentId}`);
}
