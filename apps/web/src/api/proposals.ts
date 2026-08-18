import { api } from "./client";

/**
 * One piece of content inside a claim section. Registers and contract
 * particulars come back as tables; `note` marks a section the underlying data
 * can't yet support (today: the windowed Time Impact Analysis, which needs a
 * parsed baseline programme).
 */
export type ClaimBlock =
  | { type: "paragraph"; text?: string }
  | { type: "note"; text?: string }
  | { type: "bullets"; items?: string[] }
  | { type: "table"; caption?: string; columns?: string[]; rows?: string[][] };

/** A numbered sub-heading within a section (e.g. "3.2 Summary of Relief Sought"). */
export interface ClaimSubsection {
  number: string;
  heading: string;
  blocks: ClaimBlock[];
}

/** A top-level numbered section of the generated EOT claim document. */
export interface ClaimSection {
  number: string;
  heading: string;
  blocks: ClaimBlock[];
  subsections: ClaimSubsection[];
}

/** The generated claim document itself. */
export interface ClaimContent {
  title: string;
  reference: string;
  sections: ClaimSection[];
}

/** The generated EOT claim document + its generation status. */
export interface Proposal {
  projectId: string;
  content: ClaimContent | null;
  model: string | null;
  status: "" | "running" | "done" | "failed";
  error: string | null;
  updatedAt: string | null;
}

/** Fetch the project's generated EOT claim document (and status). */
export async function getProposalApi(projectId: string): Promise<Proposal> {
  const { data } = await api.get(`/proposals/project/${projectId}`);
  return data;
}

/** Queue AI generation of the EOT claim document; returns immediately (poll GET). */
export async function generateProposalApi(projectId: string): Promise<{ status: string }> {
  const { data } = await api.post(`/proposals/project/${projectId}/generate`);
  return data;
}
