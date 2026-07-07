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
  /** Indicative timeline for the line (e.g. "Week 1-3"); may be empty. */
  timeline?: string;
  amount: number;
}

/** An admin-priced commercial line item (amount kept as a string for the form). */
export interface ProposalLineItem {
  item: string;
  timeline?: string;
  description?: string;
  amount: string;
}

/** Admin-entered fields that steer proposal generation. */
export interface ProposalInputs {
  clientCompany?: string;
  attention?: string;
  clientAddress?: string;
  subject?: string;
  reference?: string;
  date?: string;
  signatory?: string;
  discount?: string;
  feeBasis?: string;
  notes?: string;
  /** Admin-set prices — used verbatim as the costing (AI does not invent fees). */
  lineItems?: ProposalLineItem[];
  /** Client logo as a data URL, shown on the proposal + PDF. */
  logo?: string;
}

/** The generated costed client proposal + its generation status. */
export interface ClientProposal {
  projectId: string;
  content: {
    title: string;
    /** AQMS proposal reference, e.g. "AQMS/Proposal/26/13". */
    reference?: string;
    /** Proposal date. */
    date?: string;
    sections: ProposalSection[];
    costing: CostingLine[];
    currency: string;
    total: number;
    /** Payment-schedule bullet lines. */
    paymentTerms?: string[];
  } | null;
  model: string | null;
  status: "" | "running" | "done" | "failed";
  error: string | null;
  /** Admin-entered fields the proposal was (or will be) generated with. */
  inputs?: ProposalInputs;
  updatedAt: string | null;
  /** Whether this proposal has been sent to the client via their portal. */
  sentToClient: boolean;
  /** ISO datetime when the proposal was sent to the client. */
  sentAt: string | null;
}

/** Fetch the proposal's generated costed client proposal (and status). */
export async function getClientProposalApi(projectId: string): Promise<ClientProposal> {
  const { data } = await api.get(`/client-proposals/project/${projectId}`);
  return data;
}

/** Save the admin-entered proposal fields without generating. */
export async function saveProposalInputsApi(projectId: string, inputs: ProposalInputs): Promise<ClientProposal> {
  const { data } = await api.put(`/client-proposals/project/${projectId}/inputs`, inputs);
  return data;
}

/** Save any inputs, then queue AI generation; returns immediately (poll GET). */
export async function generateClientProposalApi(
  projectId: string,
  inputs?: ProposalInputs,
): Promise<{ status: string }> {
  const { data } = await api.post(`/client-proposals/project/${projectId}/generate`, inputs ?? {});
  return data;
}

/** Mark a finished proposal as "Sent to Client". */
export async function sendToClientApi(projectId: string): Promise<ClientProposal> {
  const { data } = await api.post(`/client-proposals/project/${projectId}/send`);
  return data;
}
