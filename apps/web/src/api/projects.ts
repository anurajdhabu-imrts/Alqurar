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
