import { api } from "./client";

/** Answer for a checklist row. "" = not yet answered. */
export type ChecklistStatus = "yes" | "no" | "na" | "";

/** A file attached to a checklist item. It is an ordinary project document, so it
 *  also shows up in the proposal's Documents tab. */
export interface ChecklistDocument {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  uploadedBy: string;
  sizeKB: number;
}

/** One row of the EOT-documentation checklist: the item text plus the editable
 *  state (status / remarks) and the documents attached to it. */
export interface ChecklistItem {
  no: number;
  item: string;
  status: ChecklistStatus;
  remarks: string;
  documents: ChecklistDocument[];
}

export interface ProposalChecklist {
  projectId: string;
  items: ChecklistItem[];
  updatedAt: string | null;
}

/** State-only payload sent on save. Canonical item text and the attached document
 *  ids are owned by the server; `item` is only honoured for user-added rows. */
export interface ChecklistItemIn {
  no: number;
  status: ChecklistStatus;
  remarks: string;
  item?: string;
}

/** The "Any additional documents if deemed necessary." row — the first extra file
 *  lands here; every further one gets its own row (28, 29, …). */
export const ADDITIONAL_ITEM_NO = 27;
/** Items 1..26 are the fixed standard documents. */
export const FIXED_ITEM_COUNT = 26;

export async function getChecklistApi(projectId: string): Promise<ProposalChecklist> {
  const { data } = await api.get<ProposalChecklist>(`/proposal-checklist/project/${projectId}`);
  return data;
}

export async function saveChecklistApi(
  projectId: string,
  items: ChecklistItemIn[],
): Promise<ProposalChecklist> {
  const { data } = await api.put<ProposalChecklist>(`/proposal-checklist/project/${projectId}`, { items });
  return data;
}

/** Add a further "additional document" row; returns its number and the checklist. */
export async function addChecklistItemApi(
  projectId: string,
  item = "",
): Promise<{ no: number; checklist: ProposalChecklist }> {
  const { data } = await api.post(`/proposal-checklist/project/${projectId}/items`, { item });
  return data;
}

/** Delete a user-added row (its files stay in the Documents tab). */
export async function removeChecklistItemApi(projectId: string, no: number): Promise<ProposalChecklist> {
  const { data } = await api.delete<ProposalChecklist>(`/proposal-checklist/project/${projectId}/items/${no}`);
  return data;
}

/** Link an already-uploaded project document to a checklist item. `item` names the
 *  row and is only honoured for the additional-document rows (27+). */
export async function attachChecklistDocApi(
  projectId: string,
  no: number,
  documentId: string,
  item = "",
): Promise<ProposalChecklist> {
  const { data } = await api.post<ProposalChecklist>(
    `/proposal-checklist/project/${projectId}/items/${no}/documents`,
    { documentId, item },
  );
  return data;
}

/** Unlink a file from an item — the document itself is not deleted. */
export async function detachChecklistDocApi(
  projectId: string,
  no: number,
  documentId: string,
): Promise<ProposalChecklist> {
  const { data } = await api.delete<ProposalChecklist>(
    `/proposal-checklist/project/${projectId}/items/${no}/documents/${documentId}`,
  );
  return data;
}
