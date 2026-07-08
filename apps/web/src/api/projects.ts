import { api } from "./client";
import type { ProjectDetails } from "@/store/projects";

/** All created projects (server-side, shared across browsers/devices). */
export async function listProjectsApi(): Promise<ProjectDetails[]> {
  const { data } = await api.get("/projects/");
  return data;
}

export async function createProjectApi(project: ProjectDetails): Promise<ProjectDetails> {
  const { data } = await api.post("/projects/", project);
  return data;
}

export async function deleteProjectApi(projectId: string): Promise<void> {
  await api.delete(`/projects/${projectId}`);
}

/** Confirm a proposal: server-side copy into a brand-new project (kind="project")
 *  carrying over documents, delay events, clauses and any EOT claim. The source
 *  proposal stays put. Returns the created project. */
export async function convertProposalApi(
  proposalId: string,
  newId: string,
  newCode: string,
): Promise<ProjectDetails> {
  const { data } = await api.post(`/projects/${proposalId}/convert`, { newId, newCode });
  return data;
}
