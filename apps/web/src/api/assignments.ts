import { api } from "./client";

/** Project ids assigned to the currently signed-in user (client dashboard). */
export async function listMyProjectIdsApi(): Promise<string[]> {
  const { data } = await api.get<{ project_ids: string[] }>("/assignments/me/projects");
  return data.project_ids;
}

/** Client user ids currently assigned to a project (admin). */
export async function listProjectClientsApi(projectId: string): Promise<string[]> {
  const { data } = await api.get<{ client_user_ids: string[] }>(
    `/assignments/projects/${projectId}/clients`,
  );
  return data.client_user_ids;
}

/** Assign one or more client users to a project (admin). */
export async function assignClientsApi(
  projectId: string,
  clientUserIds: string[],
): Promise<string[]> {
  const { data } = await api.post<{ client_user_ids: string[] }>("/assignments/", {
    project_id: projectId,
    client_user_ids: clientUserIds,
  });
  return data.client_user_ids;
}

/** Remove a client assignment from a project (admin). */
export async function unassignClientApi(
  projectId: string,
  clientUserId: string,
): Promise<string[]> {
  const { data } = await api.delete<{ client_user_ids: string[] }>(
    `/assignments/projects/${projectId}/clients/${clientUserId}`,
  );
  return data.client_user_ids;
}
