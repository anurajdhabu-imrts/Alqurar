import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ADDITIONAL_ITEM_NO,
  addChecklistItemApi,
  attachChecklistDocApi,
  detachChecklistDocApi,
  getChecklistApi,
  removeChecklistItemApi,
  saveChecklistApi,
  type ChecklistItemIn,
  type ProposalChecklist,
} from "@/api/proposalChecklist";
import { uploadProjectDocApi } from "@/api/projectDocuments";
import { projectDocsKey } from "./useProjectDocuments";

export const proposalChecklistKey = (projectId: string) => ["proposal-checklist", projectId] as const;

export function useProposalChecklist(projectId: string) {
  return useQuery({
    queryKey: proposalChecklistKey(projectId),
    queryFn: () => getChecklistApi(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useSaveChecklist(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: ChecklistItemIn[]) => saveChecklistApi(projectId, items),
    // The PUT returns the freshly stored checklist, so seed the cache with it.
    onSuccess: (data: ProposalChecklist) => qc.setQueryData(proposalChecklistKey(projectId), data),
  });
}

interface UploadToChecklistArgs {
  file: File;
  uploadedBy: string;
  /** Attach to this existing item. Ignored when `newRow` is set. */
  no?: number;
  /** Create a fresh "additional document" row (28, 29, …) for this file. */
  newRow?: boolean;
  /** Name for the row — additional documents (27+) only. Falls back to the
   *  file name when a new row is created without one. */
  name?: string;
}

/**
 * Upload a file against a checklist item. The file goes through the ordinary
 * project-document pipeline first — so it appears in the proposal's Documents tab
 * exactly like any other upload — and is then linked to the checklist row.
 *
 * Attaching is immediate (not part of the local edit/save cycle), so both the
 * analyst and the client can add files without entering edit mode.
 */
export function useUploadChecklistDoc(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, uploadedBy, no, newRow, name = "" }: UploadToChecklistArgs) => {
      const doc = await uploadProjectDocApi({ file, projectId, uploadedBy });
      let target = no ?? ADDITIONAL_ITEM_NO;
      if (newRow) {
        const created = await addChecklistItemApi(projectId, name.trim() || file.name);
        target = created.no;
      }
      return attachChecklistDocApi(projectId, target, doc.id, name);
    },
    onSuccess: (data: ProposalChecklist) => {
      qc.setQueryData(proposalChecklistKey(projectId), data);
      // The file is a normal project document — refresh the Documents tab too.
      qc.invalidateQueries({ queryKey: projectDocsKey(projectId) });
    },
  });
}

/** Unlink a file from a checklist item (the document itself is kept). */
export function useDetachChecklistDoc(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ no, documentId }: { no: number; documentId: string }) =>
      detachChecklistDocApi(projectId, no, documentId),
    onSuccess: (data: ProposalChecklist) => qc.setQueryData(proposalChecklistKey(projectId), data),
  });
}

/** Add an empty "additional document" row beyond the canonical 27. */
export function useAddChecklistItem(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: string) => addChecklistItemApi(projectId, item),
    onSuccess: ({ checklist }) => qc.setQueryData(proposalChecklistKey(projectId), checklist),
  });
}

/** Remove a user-added row. */
export function useRemoveChecklistItem(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (no: number) => removeChecklistItemApi(projectId, no),
    onSuccess: (data: ProposalChecklist) => qc.setQueryData(proposalChecklistKey(projectId), data),
  });
}
