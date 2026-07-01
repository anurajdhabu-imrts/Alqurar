import { api } from "./client";
import type { ClauseRef } from "@/types";

/**
 * Raw clause row from the per-project `project_clauses` table. The card/table UI
 * works in terms of {@link ClauseRef} (book/clause/title/summary), so responses
 * are mapped to that shape here.
 */
interface ProjectClauseRow {
  id: string;
  projectId: string;
  contract_standard: string;
  clause_number: string;
  clause_title: string;
  clause_description: string;
  tags: string[];
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProjectClauseCreatePayload {
  contract_standard: string;
  clause_number: string;
  clause_title: string;
  clause_description?: string;
  tags?: string[];
}

export type ProjectClauseUpdatePayload = Partial<ProjectClauseCreatePayload>;

export interface ClauseExtractStatus {
  status: "idle" | "running" | "done" | "failed";
  error?: string;
  count?: number;
}

export interface ContractExtractResult {
  stored: boolean;
  documentId: string;
  status: ClauseExtractStatus["status"];
  message: string;
}

function toClauseRef(row: ProjectClauseRow): ClauseRef {
  return {
    id: row.id,
    book: row.contract_standard,
    clause: row.clause_number,
    title: row.clause_title,
    summary: row.clause_description,
    tags: row.tags ?? [],
  };
}

export async function listProjectClausesApi(projectId: string): Promise<ClauseRef[]> {
  const { data } = await api.get<ProjectClauseRow[]>(`/projects/${projectId}/clauses`);
  return data.map(toClauseRef);
}

export async function createProjectClauseApi(
  projectId: string,
  payload: ProjectClauseCreatePayload,
): Promise<ClauseRef> {
  const { data } = await api.post<ProjectClauseRow>(`/projects/${projectId}/clauses`, payload);
  return toClauseRef(data);
}

export async function updateProjectClauseApi(
  projectId: string,
  id: string,
  patch: ProjectClauseUpdatePayload,
): Promise<ClauseRef> {
  const { data } = await api.patch<ProjectClauseRow>(`/projects/${projectId}/clauses/${id}`, patch);
  return toClauseRef(data);
}

export async function deleteProjectClauseApi(projectId: string, id: string): Promise<void> {
  await api.delete(`/projects/${projectId}/clauses/${id}`);
}

/** Upload the project's contract; the backend extracts its clauses with AI in
 * the background. Returns quickly — poll {@link getClauseExtractStatusApi}. */
export async function extractProjectClausesApi(
  projectId: string,
  file: File,
): Promise<ContractExtractResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<ContractExtractResult>(
    `/projects/${projectId}/clauses/extract`,
    form,
    { headers: { "Content-Type": "multipart/form-data" }, timeout: 60_000 },
  );
  return data;
}

/** Current state of background clause extraction for a project. */
export async function getClauseExtractStatusApi(projectId: string): Promise<ClauseExtractStatus> {
  const { data } = await api.get<ClauseExtractStatus>(`/projects/${projectId}/clauses/extract-status`);
  return data;
}
