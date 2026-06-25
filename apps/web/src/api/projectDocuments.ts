import { api } from "./client";
import type { UploadedClaimDocument } from "@/types";

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

export async function deleteProjectDocApi(documentId: string): Promise<void> {
  await api.delete(`/project-documents/${documentId}`);
}
