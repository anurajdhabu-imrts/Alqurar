import { api } from "./client";
import type { ClauseRef } from "@/types";

/**
 * Raw clause row as returned by the backend `clause_library` table. The card UI
 * works in terms of {@link ClauseRef} (book/clause/title/summary), so responses
 * are mapped to that shape here — the page rendering stays unchanged.
 */
interface ClauseRow {
  id: string;
  contract_standard: string;
  clause_number: string;
  clause_title: string;
  clause_description: string;
  tags: string[];
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ClauseCreatePayload {
  contract_standard: string;
  clause_number: string;
  clause_title: string;
  clause_description?: string;
  tags?: string[];
}

export type ClauseUpdatePayload = Partial<ClauseCreatePayload>;

function toClauseRef(row: ClauseRow): ClauseRef {
  return {
    id: row.id,
    book: row.contract_standard,
    clause: row.clause_number,
    title: row.clause_title,
    summary: row.clause_description,
    tags: row.tags ?? [],
  };
}

export async function listClausesApi(): Promise<ClauseRef[]> {
  const { data } = await api.get<ClauseRow[]>("/clauses/");
  return data.map(toClauseRef);
}

export async function createClauseApi(payload: ClauseCreatePayload): Promise<ClauseRef> {
  const { data } = await api.post<ClauseRow>("/clauses/", payload);
  return toClauseRef(data);
}

export async function updateClauseApi(id: string, patch: ClauseUpdatePayload): Promise<ClauseRef> {
  const { data } = await api.patch<ClauseRow>(`/clauses/${id}`, patch);
  return toClauseRef(data);
}

export async function deleteClauseApi(id: string): Promise<void> {
  await api.delete(`/clauses/${id}`);
}
