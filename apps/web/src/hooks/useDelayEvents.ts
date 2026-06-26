import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDelayEventApi,
  deleteDelayEventApi,
  listDelayEventsApi,
  setDelayEventStatusApi,
  updateDelayEventApi,
  type CreateDelayEventArgs,
} from "@/api/delayEvents";
import type { DelayReviewStatus, ProjectDelayEvent } from "@/types";

export const delayEventsKey = (projectId: string) => ["delay-events", projectId] as const;

/** Delay events for a project. */
export function useDelayEvents(projectId: string) {
  return useQuery({
    queryKey: delayEventsKey(projectId),
    queryFn: () => listDelayEventsApi(projectId),
    enabled: !!projectId,
    staleTime: 10_000,
  });
}

export function useCreateDelayEvent(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: CreateDelayEventArgs) => createDelayEventApi(args),
    onSuccess: () => qc.invalidateQueries({ queryKey: delayEventsKey(projectId) }),
  });
}

export function useUpdateDelayEvent(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ProjectDelayEvent> }) =>
      updateDelayEventApi(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: delayEventsKey(projectId) }),
  });
}

export function useSetDelayEventStatus(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reviewStatus }: { id: string; reviewStatus: DelayReviewStatus }) =>
      setDelayEventStatusApi(id, reviewStatus),
    onSuccess: () => qc.invalidateQueries({ queryKey: delayEventsKey(projectId) }),
  });
}

export function useDeleteDelayEvent(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDelayEventApi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: delayEventsKey(projectId) }),
  });
}
