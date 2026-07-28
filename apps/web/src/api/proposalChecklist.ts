import { api } from "./client";

/** Answer for a checklist row. "" = not yet answered. */
export type ChecklistStatus = "yes" | "no" | "na" | "";

/** One row of the EOT-documentation checklist: the canonical item text plus the
 * editable state (status / date / remarks). */
export interface ChecklistItem {
  no: number;
  item: string;
  status: ChecklistStatus;
  /** Date the information was provided ("YYYY-MM-DD"), or "". */
  date: string;
  remarks: string;
}

export interface ProposalChecklist {
  projectId: string;
  items: ChecklistItem[];
  updatedAt: string | null;
}

/** State-only payload sent on save (item text is owned by the server). */
export interface ChecklistItemIn {
  no: number;
  status: ChecklistStatus;
  date: string;
  remarks: string;
}

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
