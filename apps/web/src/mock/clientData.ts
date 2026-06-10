// ── Client portal mock data ───────────────────────────────────────────────
// Projects are derived from the existing contracts so the client portal stays
// consistent with the rest of the (mock-backed) app. Uploaded claim documents
// live in a tiny in-memory store wired to React via useSyncExternalStore.
import { useSyncExternalStore } from "react";
import type { DocType, Project, UploadedClaimDocument } from "@/types";
import { contracts, eotClaims, notices } from "./data";

export const projects: Project[] = contracts.map((c) => ({
  id: c.id.replace("ct-", "p-"),
  name: c.project,
  code: c.ref,
  employer: c.employer,
  contractor: c.contractor,
  standard: c.standard,
  value: c.value,
  currency: c.currency,
  startDate: c.startDate,
  completionDate: c.completionDate,
  status: c.status,
  riskLevel: c.riskLevel,
}));

export function getProjectById(id: string): Project | undefined {
  return projects.find((p) => p.id === id);
}

/** Resolve a project by its name (claims/contracts reference projects by name). */
export function getProjectByName(name: string): Project | undefined {
  return projects.find((p) => p.name === name);
}

export function claimsForProject(projectName: string) {
  return eotClaims.filter((c) => c.project === projectName);
}

export function noticesForProject(projectName: string) {
  return notices.filter((n) => n.project === projectName);
}

// Client → assigned projects is now persisted server-side (see
// hooks/useAssignments.ts → /assignments). Resolve ids to Project objects here.
export function projectsByIds(ids: string[]): Project[] {
  return projects.filter((p) => ids.includes(p.id));
}

// ── Uploaded claim documents (in-memory store) ────────────────────────────
let docs: UploadedClaimDocument[] = [
  {
    id: "doc-1",
    projectId: "p-1",
    name: "Site-instruction-L3-transfer-slab.pdf",
    type: "PDF",
    sizeKB: 842,
    uploadedAt: "2026-05-02T09:12:00.000Z",
    uploadedBy: "James Whitfield",
    claimRef: "EOT-2026-014",
    status: "Under Review",
  },
  {
    id: "doc-2",
    projectId: "p-1",
    name: "Progress-photos-February.zip",
    type: "Other",
    sizeKB: 15360,
    uploadedAt: "2026-05-05T14:40:00.000Z",
    uploadedBy: "James Whitfield",
    status: "Uploaded",
  },
  {
    id: "doc-3",
    projectId: "p-2",
    name: "MEP-riser-RFI-log.xlsx",
    type: "XLSX",
    sizeKB: 318,
    uploadedAt: "2026-05-10T11:05:00.000Z",
    uploadedBy: "James Whitfield",
    claimRef: "EOT-2026-009",
    status: "Under Review",
  },
];

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

export const claimDocStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  snapshot(): UploadedClaimDocument[] {
    return docs;
  },
  add(doc: UploadedClaimDocument) {
    docs = [doc, ...docs];
    emit();
  },
  remove(id: string) {
    docs = docs.filter((d) => d.id !== id);
    emit();
  },
};

/** Subscribe to the full document list; filter by project in the component. */
export function useClaimDocuments(): UploadedClaimDocument[] {
  return useSyncExternalStore(claimDocStore.subscribe, claimDocStore.snapshot, claimDocStore.snapshot);
}

const EXT_TO_TYPE: Record<string, DocType> = {
  pdf: "PDF",
  doc: "DOCX",
  docx: "DOCX",
  xls: "XLSX",
  xlsx: "XLSX",
  xml: "P6 XML",
  mpp: "MPP",
  png: "Scan",
  jpg: "Scan",
  jpeg: "Scan",
  tif: "Scan",
  tiff: "Scan",
};

export function docTypeFromName(name: string): DocType {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_TYPE[ext] ?? "Other";
}
