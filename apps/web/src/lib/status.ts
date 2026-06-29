import type { Tone } from "@/components/ui/Badge";
import type {
  ClaimStatus,
  NoticeStatus,
  Obligation,
  RiskLevel,
  Variation,
} from "@/types";

export const claimStatusTone: Record<ClaimStatus, Tone> = {
  Draft: "neutral",
  "In Review": "info",
  Submitted: "info",
  "Under Assessment": "warning",
  Granted: "success",
  Rejected: "error",
};

export const noticeStatusTone: Record<NoticeStatus, Tone> = {
  Compliant: "success",
  "Due Soon": "warning",
  Overdue: "error",
  Missed: "error",
};

export const riskTone: Record<RiskLevel, Tone> = {
  Low: "success",
  Moderate: "warning",
  High: "error",
};

export const obligationTone: Record<Obligation["status"], Tone> = {
  Open: "info",
  "In Progress": "warning",
  Met: "success",
  Overdue: "error",
};

export const variationTone: Record<Variation["status"], Tone> = {
  Notified: "info",
  "Under Assessment": "warning",
  Agreed: "success",
  Disputed: "error",
};
