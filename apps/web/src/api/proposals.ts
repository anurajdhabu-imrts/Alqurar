import { api } from "./client";

/** A section of the generated EOT claim document. */
export interface ClaimSection {
  heading: string;
  body: string;
}

/** The generated EOT claim document + its generation status. */
export interface Proposal {
  projectId: string;
  content: { title: string; sections: ClaimSection[] } | null;
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
