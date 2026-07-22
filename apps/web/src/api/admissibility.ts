import { api } from "./client";
import type { AdmissibilityAssessment, AdmissibilityContent } from "@/types";

/** Fetch the project's admissibility matrix (and generation status). */
export async function getAdmissibilityApi(projectId: string): Promise<AdmissibilityAssessment> {
  const { data } = await api.get(`/admissibility/project/${projectId}`);
  return data;
}

/** Queue AI generation of the admissibility matrix; returns immediately (poll GET). */
export async function generateAdmissibilityApi(projectId: string): Promise<{ status: string }> {
  const { data } = await api.post(`/admissibility/project/${projectId}/generate`);
  return data;
}

/** Persist an analyst-edited admissibility matrix. */
export async function saveAdmissibilityApi(
  projectId: string,
  content: AdmissibilityContent,
): Promise<AdmissibilityAssessment> {
  const { data } = await api.put(`/admissibility/project/${projectId}`, { content });
  return data;
}
