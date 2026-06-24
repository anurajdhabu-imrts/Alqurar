import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignClientsApi,
  listMyProjectIdsApi,
  listProjectClientsApi,
  unassignClientApi,
} from "@/api/assignments";
import { useAllProjects } from "@/store/projects";
import type { Project } from "@/types";

export const myProjectsKey = ["assignments", "me", "projects"] as const;
export const projectClientsKey = (projectId: string) =>
  ["assignments", "project", projectId, "clients"] as const;

/** Project ids assigned to the signed-in user. */
export function useMyProjectIds() {
  return useQuery({ queryKey: myProjectsKey, queryFn: listMyProjectIdsApi, staleTime: 30_000 });
}

/** Assigned projects resolved to full Project objects for the client portal. */
export function useAssignedProjects(): { projects: Project[]; isLoading: boolean } {
  const { data: ids, isLoading } = useMyProjectIds();
  const all = useAllProjects();
  const resolved = useMemo(
    () => (ids ? all.filter((p) => ids.includes(p.id)) : []),
    [ids, all],
  );
  return { projects: resolved, isLoading };
}

/** Client user ids assigned to a project (admin view). */
export function useProjectClients(projectId: string | null) {
  return useQuery({
    queryKey: projectClientsKey(projectId ?? "none"),
    queryFn: () => listProjectClientsApi(projectId as string),
    enabled: !!projectId,
    staleTime: 10_000,
  });
}

export function useAssignClients() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, clientUserIds }: { projectId: string; clientUserIds: string[] }) =>
      assignClientsApi(projectId, clientUserIds),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: projectClientsKey(vars.projectId) });
      qc.invalidateQueries({ queryKey: myProjectsKey });
    },
  });
}

export function useUnassignClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, clientUserId }: { projectId: string; clientUserId: string }) =>
      unassignClientApi(projectId, clientUserId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: projectClientsKey(vars.projectId) });
      qc.invalidateQueries({ queryKey: myProjectsKey });
    },
  });
}
