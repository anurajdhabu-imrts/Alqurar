import type {
  Approval,
  ClaimOutcome,
  ClaimStage,
  ClaimStatus,
  EOTClaim,
} from "@/types";

/**
 * The 9-stage claims lifecycle. `stage` on a claim is the step currently in
 * progress (the action the user must take next). A claim registered through the
 * intake form has already cleared "Event Identification" and "Claim Initiation",
 * so it lands on "Notice of Claim".
 */
export const STAGES: ClaimStage[] = [
  "Event Identification",
  "Claim Initiation",
  "Notice of Claim",
  "Claim Registration",
  "Evidence & AI Analysis",
  "Claim Preparation",
  "Internal Review",
  "Formal Submission",
  "Engineer Assessment",
];

export const STAGE_NUMBER: Record<ClaimStage, number> = STAGES.reduce(
  (acc, s, i) => ({ ...acc, [s]: i + 1 }),
  {} as Record<ClaimStage, number>,
);

/** The action available at each stage and the stage it advances to. */
export interface StageStep {
  cta: string;
  next: ClaimStage;
}

export const NEXT: Partial<Record<ClaimStage, StageStep>> = {
  "Event Identification": { cta: "Confirm & Initiate Claim", next: "Claim Initiation" },
  "Claim Initiation": { cta: "Issue Notice of Claim", next: "Notice of Claim" },
  "Notice of Claim": { cta: "Issue Notice of Claim", next: "Claim Registration" },
  "Claim Registration": { cta: "Complete Registration", next: "Evidence & AI Analysis" },
  "Evidence & AI Analysis": { cta: "Run AI Analysis", next: "Claim Preparation" },
  "Claim Preparation": { cta: "Generate Claim Document", next: "Internal Review" },
  "Internal Review": { cta: "Approve & Submit", next: "Formal Submission" },
  "Formal Submission": { cta: "Submit to Engineer", next: "Engineer Assessment" },
};

/** Map a legacy flat status to a lifecycle stage (for seed claims with no `stage`). */
export function stageForStatus(status: ClaimStatus): ClaimStage {
  switch (status) {
    case "Draft":
      return "Claim Registration";
    case "In Review":
      return "Internal Review";
    case "Submitted":
      return "Engineer Assessment";
    case "Under Assessment":
      return "Engineer Assessment";
    case "Granted":
    case "Rejected":
      return "Engineer Assessment";
    default:
      return "Notice of Claim";
  }
}

export function stageOf(claim: EOTClaim): ClaimStage {
  return claim.stage ?? stageForStatus(claim.status);
}

/** Derive the flat register status from a lifecycle stage + outcome. */
export function statusForStage(stage: ClaimStage, outcome?: ClaimOutcome): ClaimStatus {
  switch (stage) {
    case "Internal Review":
      return "In Review";
    case "Formal Submission":
      return "Submitted";
    case "Engineer Assessment":
      if (!outcome) return "Under Assessment";
      return outcome === "Rejected" || outcome === "Default" ? "Rejected" : "Granted";
    default:
      return "Draft";
  }
}

export function outcomeOf(claim: EOTClaim): ClaimOutcome | undefined {
  if (claim.outcome) return claim.outcome;
  if (claim.status === "Granted") {
    return claim.daysGranted != null && claim.daysGranted < claim.daysClaimed
      ? "Partial Award"
      : "Full Award";
  }
  if (claim.status === "Rejected") return "Rejected";
  return undefined;
}

/** A claim is finished once it has an outcome at Engineer Assessment. */
export function isTerminal(claim: EOTClaim): boolean {
  return stageOf(claim) === "Engineer Assessment" && outcomeOf(claim) !== undefined;
}

/** Default internal-approval panel, with statuses inferred from the stage. */
export function defaultApprovals(claim: EOTClaim): Approval[] {
  if (claim.approvals?.length) return claim.approvals;
  const reachedSubmission = STAGE_NUMBER[stageOf(claim)] >= STAGE_NUMBER["Formal Submission"];
  const status: Approval["status"] = reachedSubmission ? "Approved" : "Pending";
  return [
    { name: claim.owner || "Claims Manager", role: "Claims Manager", status },
    { name: "Priya Sharma", role: "Legal Counsel", status },
    { name: "Khalid Mendes", role: "Commercial Director", status },
  ];
}
