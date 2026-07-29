import type { ProposalLineItem } from "@/api/clientProposals";
import type { ProposalType } from "@/lib/proposalTypes";

/**
 * Front-end per-type template data for the Proposal tab. Complements the backend
 * proposal_templates.py: here we only need what the Proposal form seeds locally —
 * the default subject line, whether the commercials are scoped around the identified
 * delay events (`delayDriven`), and the default fee line-item skeleton used for the
 * cost-driven service lines (Quantum Expert, Quantum Claims) that are NOT built from
 * delay events.
 */
interface FrontTemplate {
  subject: string;
  /** true → the Proposal commercials use the delay-event group structure. */
  delayDriven: boolean;
  /** Default fee lines for non-delay-driven types (empty for delay-driven types,
   *  which build their lines from the delay events + fixed anchors). */
  feeItems: ProposalLineItem[];
}

const fee = (item: string, description: string): ProposalLineItem => ({
  item,
  description,
  timeline: "",
  amount: "",
});

const TEMPLATES: Record<ProposalType, FrontTemplate> = {
  claims_support: {
    subject: "Proposal for Claims Support Services",
    delayDriven: true,
    feeItems: [],
  },
  eot_claims: {
    subject: "Proposal for Extension of Time (EOT) Claim Services",
    delayDriven: true,
    feeItems: [],
  },
  arbitration_expert: {
    subject: "Proposal for Delay Expert Services",
    delayDriven: true,
    feeItems: [],
  },
  quantum_expert: {
    subject: "Proposal for Quantum Expert Services",
    delayDriven: false,
    feeItems: [
      fee("Case familiarization & review of pleadings", "Onboarding, review of the pleadings and case documents, and scoping the quantum matters in dispute."),
      fee("Quantum assessment review & refinement", "Independent review, validation and refinement of the claimed heads and calculations for arbitration."),
      fee("Primary Quantum Expert Report", "Preparation of the independent primary quantum expert report with findings and schedules."),
      fee("Joint statement & Final Quantum Report", "Response to the opposing expert, joint expert statement, and the final quantum expert report."),
      fee("Arbitration hearing support", "Hearing preparation, expert evidence, witness conferencing and cross-examination support."),
    ],
  },
  quantum_claims: {
    subject: "Proposal for Quantum Claim Services",
    delayDriven: false,
    feeItems: [
      fee("Review & alignment of cost heads", "Review of the cost/accounting heads and alignment with the contract preliminaries / BOQ."),
      fee("Cost data collection & validation", "Collection, validation and compilation of cost data in the prescribed claim formats."),
      fee("Quantum (cost) claim preparation", "Preparation of the detailed, substantiated quantum (cost) claim with entitlement narrative."),
      fee("Supporting evidence & documentation", "Assembly and cross-referencing of supporting evidence and appendices for easy retrieval."),
    ],
  },
};

const DEFAULT: ProposalType = "claims_support";

function templateFor(ptype?: string): FrontTemplate {
  return TEMPLATES[(ptype as ProposalType) in TEMPLATES ? (ptype as ProposalType) : DEFAULT];
}

/** Default proposal subject line for a proposal type. */
export function proposalSubject(ptype?: string): string {
  return templateFor(ptype).subject;
}

/** Whether a proposal type scopes its commercials around the delay events. */
export function isDelayDriven(ptype?: string): boolean {
  return templateFor(ptype).delayDriven;
}

/** Default fee line-item skeleton for a cost-driven proposal type (a fresh copy). */
export function feeLineItems(ptype?: string): ProposalLineItem[] {
  return templateFor(ptype).feeItems.map((l) => ({ ...l }));
}
