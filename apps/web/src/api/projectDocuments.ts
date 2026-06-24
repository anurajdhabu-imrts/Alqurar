import { api } from "./client";
import type { UploadedClaimDocument } from "@/types";

/** Documents uploaded against a project (server-side, shared admin ↔ client). */
export async function listProjectDocsApi(projectId: string): Promise<UploadedClaimDocument[]> {
  const { data } = await api.get(`/project-documents/project/${projectId}`);
  return data;
}

export async function createProjectDocApi(doc: UploadedClaimDocument): Promise<UploadedClaimDocument> {
  const { data } = await api.post("/project-documents/", doc);
  return data;
}

export async function deleteProjectDocApi(documentId: string): Promise<void> {
  await api.delete(`/project-documents/${documentId}`);
}
