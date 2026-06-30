import { api } from "./client";
import type { DelayReviewStatus, ProjectDelayEvent } from "@/types";

/** Delay events for a project (server-side, persistent). */
export async function listDelayEventsApi(projectId: string): Promise<ProjectDelayEvent[]> {
  const { data } = await api.get(`/delay-events/project/${projectId}`);
  return data;
}

/** Payload for creating an event — id/ref are assigned by the server if omitted. */
export type CreateDelayEventArgs = Partial<ProjectDelayEvent> & { projectId: string };

export async function createDelayEventApi(body: CreateDelayEventArgs): Promise<ProjectDelayEvent> {
  const { data } = await api.post("/delay-events/", body);
  return data;
}

export async function updateDelayEventApi(
  id: string,
  patch: Partial<ProjectDelayEvent>,
): Promise<ProjectDelayEvent> {
  const { data } = await api.put(`/delay-events/${id}`, patch);
  return data;
}

export async function setDelayEventStatusApi(
  id: string,
  reviewStatus: DelayReviewStatus,
): Promise<ProjectDelayEvent> {
  const { data } = await api.patch(`/delay-events/${id}/status`, { reviewStatus });
  return data;
}

export async function deleteDelayEventApi(id: string): Promise<void> {
  await api.delete(`/delay-events/${id}`);
}

/** Background delay-event extraction status for a project. */
export interface ExtractionStatus {
  status: "idle" | "running" | "done" | "failed";
  error?: string;
  count?: number;
}

/**
 * Queue AI extraction of the project's delay-event register. Returns immediately;
 * poll `getDelayEventExtractionStatusApi` for progress. On completion the project's
 * events are replaced with the extracted set.
 */
export async function startDelayEventExtractionApi(projectId: string): Promise<ExtractionStatus> {
  const { data } = await api.post(`/delay-events/extract/${projectId}`);
  return data;
}

/** Current state of background extraction for a project. */
export async function getDelayEventExtractionStatusApi(projectId: string): Promise<ExtractionStatus> {
  const { data } = await api.get(`/delay-events/extract/${projectId}/status`);
  return data;
}
