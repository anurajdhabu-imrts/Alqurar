import { api } from "./client";

/** Background per-event chronology generation status for a project. */
export interface ChronologyStatus {
  status: "idle" | "running" | "done" | "failed";
  error?: string;
  count?: number;
}

/**
 * Queue AI generation of a dated chronology for each of the project's delay
 * events. Returns immediately; poll `getChronologyStatusApi` for progress. On
 * completion each delay event's `chronology` is replaced with the generated one.
 */
export async function startChronologyGenerationApi(projectId: string): Promise<ChronologyStatus> {
  const { data } = await api.post(`/chronology/generate/${projectId}`);
  return data;
}

/** Current state of background chronology generation for a project. */
export async function getChronologyStatusApi(projectId: string): Promise<ChronologyStatus> {
  const { data } = await api.get(`/chronology/generate/${projectId}/status`);
  return data;
}
