/**
 * The service lines Al Qarar proposes for. Chosen when a proposal is created and
 * stored on the proposal (ProjectDetails.proposalType). This is the single source
 * of truth for the proposal-type dropdown, and — going forward — for which costing
 * defaults and proposal template a proposal uses.
 *
 * Derived from Al Qarar's standard proposal documents (Claims Support Services,
 * Quantum Expert, Delay/Arbitration Expert, Quantum Claims).
 */
export type ProposalType =
  | "claims_support"
  | "quantum_expert"
  | "eot_claims"
  | "arbitration_expert"
  | "quantum_claims";

export interface ProposalTypeDef {
  id: ProposalType;
  label: string;
  /** One-line primary purpose of this service line. */
  purpose: string;
  /** What the engagement focuses on / delivers. */
  focus: string;
}

export const PROPOSAL_TYPES: ProposalTypeDef[] = [
  {
    id: "claims_support",
    label: "Claims Support Services",
    purpose: "Prepare and manage claims before formal dispute resolution",
    focus:
      "Complete claims preparation — strategy report, EOT claims, quantum claims, documentation, and methodology.",
  },
  {
    id: "quantum_expert",
    label: "Quantum Expert",
    purpose: "Provide independent expert opinion during arbitration",
    focus:
      "Reviews, validates, and substantiates financial losses; prepares expert reports and rebuttals, and gives expert evidence.",
  },
  {
    id: "eot_claims",
    label: "EOT Claims",
    purpose: "Prepare or strengthen an Extension of Time (EOT) claim",
    focus:
      "Delay analysis, critical path, entitlement, causation, chronology, and extension-of-time claim preparation.",
  },
  {
    id: "arbitration_expert",
    label: "Arbitration Expert",
    purpose: "Support arbitration proceedings as an independent expert",
    focus:
      "Reviews existing claims, prepares expert reports, assists legal counsel, attends hearings, and provides expert testimony.",
  },
  {
    id: "quantum_claims",
    label: "Quantum Claims",
    purpose: "Prepare a quantum (cost) claim before arbitration",
    focus:
      "Calculates and substantiates financial entitlement — prolongation, disruption, loss of productivity, overheads, financing charges, and supporting evidence.",
  },
];

const BY_ID: Record<string, ProposalTypeDef> = Object.fromEntries(
  PROPOSAL_TYPES.map((t) => [t.id, t]),
);

/** Resolve a stored proposalType id to its definition (undefined if unset/unknown). */
export function proposalTypeDef(id?: string): ProposalTypeDef | undefined {
  return id ? BY_ID[id] : undefined;
}

/** Human label for a stored proposalType id, or "" when unset/unknown. */
export function proposalTypeLabel(id?: string): string {
  return proposalTypeDef(id)?.label ?? "";
}
