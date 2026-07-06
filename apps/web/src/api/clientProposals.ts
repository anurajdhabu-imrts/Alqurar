import { api } from "./client";

/** A narrative section of the generated client proposal. */
export interface ProposalSection {
  heading: string;
  body: string;
}

/** A costing line item in the generated client proposal. */
export interface CostingLine {
  item: string;
  description: string;
  amount: number;
}

/** The generated costed client proposal + its generation status. */
export interface ClientProposal {
  projectId: string;
  content: {
    title: string;
    sections: ProposalSection[];
    costing: CostingLine[];
    currency: string;
    total: number;
  } | null;
  model: string | null;
  status: "" | "running" | "done" | "failed";
  error: string | null;
  updatedAt: string | null;
}

/** Fetch the proposal's generated costed client proposal (and status). */
export async function getClientProposalApi(projectId: string): Promise<ClientProposal> {
  const { data } = await api.get(`/client-proposals/project/${projectId}`);
  return data;
}

/** Queue AI generation of the costed client proposal; returns immediately (poll GET). */
export async function generateClientProposalApi(projectId: string): Promise<{ status: string }> {
  const { data } = await api.post(`/client-proposals/project/${projectId}/generate`);
  return data;
}
