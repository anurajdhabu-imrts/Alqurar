import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDelayEventApi,
  deleteDelayEventApi,
  getDelayEventExtractionStatusApi,
  listDelayEventsApi,
  setDelayEventStatusApi,
  startDelayEventExtractionApi,
  updateDelayEventApi,
  type CreateDelayEventArgs,
} from "@/api/delayEvents";
import { useProjectDocuments } from "./useProjectDocuments";
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

export const extractionStatusKey = (projectId: string) =>
  ["delay-extract-status", projectId] as const;

// Projects whose events were auto-extracted this session — prevents the auto
// trigger from firing repeatedly (incl. when the AI legitimately finds 0 events).
const autoExtracted = new Set<string>();

/**
 * Drives AI delay-event extraction for both the Delay Events and Events by
 * Document tabs. Extraction runs in the background on the server; this hook:
 *   - polls the extraction status while it runs,
 *   - refreshes the events list when a run finishes,
 *   - auto-starts a run once the data-room documents have been analysed by AI
 *     and the project has no events yet,
 *   - exposes `start()` for the manual "Extract with AI" button.
 *
 * Open either tab after the documents are analysed and the register appears.
 */
export function useDelayEventsExtractor(
  projectId: string,
  eventsLoaded: boolean,
  eventCount: number,
) {
  const qc = useQueryClient();
  const { data: docs = [] } = useProjectDocuments(projectId);

  const statusQ = useQuery({
    queryKey: extractionStatusKey(projectId),
    queryFn: () => getDelayEventExtractionStatusApi(projectId),
    enabled: !!projectId,
    refetchInterval: (query) => (query.state.data?.status === "running" ? 3000 : false),
  });

  const start = useMutation({
    mutationFn: () => startDelayEventExtractionApi(projectId),
    onSuccess: (s) => qc.setQueryData(extractionStatusKey(projectId), s),
  });

  const status = statusQ.data?.status;

  // When a run transitions out of "running", refresh the events list.
  const prevStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevStatus.current === "running" && (status === "done" || status === "failed")) {
      qc.invalidateQueries({ queryKey: delayEventsKey(projectId) });
    }
    prevStatus.current = status;
  }, [status, projectId, qc]);

  // Auto-start once documents are analysed and there are no events yet.
  useEffect(() => {
    if (!projectId || !eventsLoaded || eventCount > 0) return;
    if (statusQ.isLoading || status === "running" || start.isPending) return;
    if (autoExtracted.has(projectId)) return;
    const anyAnalysed = docs.some((d) => !!d.analysis);
    const stillAnalysing = docs.some(
      (d) => d.analysisStatus === "pending" || d.analysisStatus === "analyzing",
    );
    if (!anyAnalysed || stillAnalysing) return;

    autoExtracted.add(projectId);
    start.mutate(undefined, { onError: () => autoExtracted.delete(projectId) });
  }, [projectId, eventsLoaded, eventCount, docs, status, statusQ.isLoading, start]);

  const isRunning = status === "running" || start.isPending;
  const error = status === "failed" ? statusQ.data?.error || "AI extraction failed." : "";
  return { isRunning, error, start: () => start.mutate() };
}
