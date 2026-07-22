import { api } from "./client";
import type { ProjectQuery } from "@/types";

/** Queries / RFIs for a project (server-side, persistent). */
export async function listProjectQueriesApi(projectId: string): Promise<ProjectQuery[]> {
  const { data } = await api.get(`/project-queries/project/${projectId}`);
  return data;
}

/** Payload for creating a query — id is assigned by the server if omitted. */
export type CreateProjectQueryArgs = Partial<ProjectQuery> & { projectId: string };

export async function createProjectQueryApi(body: CreateProjectQueryArgs): Promise<ProjectQuery> {
  const { data } = await api.post("/project-queries/", body);
  return data;
}

export async function updateProjectQueryApi(
  id: string,
  patch: Partial<ProjectQuery>,
): Promise<ProjectQuery> {
  const { data } = await api.put(`/project-queries/${id}`, patch);
  return data;
}

export async function deleteProjectQueryApi(id: string): Promise<void> {
  await api.delete(`/project-queries/${id}`);
}
