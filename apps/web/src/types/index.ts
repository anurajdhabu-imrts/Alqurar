// ── Domain model for the Al Qarar claims & contract platform ──────────────

/** Built-in role names; any custom role name from the backend is also accepted. */
export type UserRole =
  | "Administrator"
  | "Claims Manager"
  | "Contract Manager"
  | "Legal Reviewer"
  | "Client View"
  | (string & {});

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
  status?: "Active" | "Invited" | "Suspended";
}

export type ClaimStatus =
  | "Draft"
  | "In Review"
  | "Submitted"
  | "Under Assessment"
  | "Granted"
  | "Rejected";

export type ClaimType =
  | "EOT & Cost"
  | "EOT Only"
  | "Cost Only"
  | "Disruption"
  | "Force Majeure";

export type ClaimPriority = "Critical" | "High" | "Medium" | "Low";

/** The 9-stage claims lifecycle (stage 1 is performed at intake). */
export type ClaimStage =
  | "Event Identification"
  | "Claim Initiation"
  | "Notice of Claim"
  | "Claim Registration"
  | "Evidence & AI Analysis"
  | "Claim Preparation"
  | "Internal Review"
  | "Formal Submission"
  | "Engineer Assessment";

/** Terminal outcomes of Engineer Assessment (stage 9). */
export type ClaimOutcome = "Full Award" | "Partial Award" | "Rejected" | "Default";

export interface AuditEntry {
  id: string;
  /** ISO datetime. */
  at: string;
  /** User name or "System". */
  actor: string;
  action: string;
}

export interface NoticeLogEntry {
  id: string;
  type: string;
  clause: string;
  status: "Issued" | "Pending";
  direction: "Outgoing" | "Incoming";
  dueDate?: string;
  issuedDate?: string;
  ref?: string;
}

export interface Approval {
  name: string;
  role: string;
  status: "Approved" | "Pending" | "Returned";
  date?: string;
  note?: string;
}

export type DelayCause =
  | "Employer"
  | "Force Majeure"
  | "Concurrent"
  | "Contractor"
  | "Neutral";

export type NoticeStatus = "Compliant" | "Due Soon" | "Overdue" | "Missed";

export type ContractStandard =
  | "FIDIC Red 1999"
  | "FIDIC Red 2017"
  | "FIDIC Yellow 2017"
  | "FIDIC Silver 2017"
  | "NEC4"
  | "CPWD"
  | "Bespoke";

export type RiskLevel = "Low" | "Moderate" | "High";

export interface DelayEvent {
  id: string;
  title: string;
  cause: DelayCause;
  startDate: string;
  endDate: string;
  daysImpact: number;
  criticalPath: boolean;
  description: string;
  evidenceCount: number;
}

// ── Delay events (Project Workspace → Delay Events tab) ───────────────────
/** Where an AI-identified delay event sits in the analyst review flow. */
export type DelayReviewStatus =
  | "Pending"
  | "Confirmed"
  | "Edited"
  | "Merged"
  | "Rejected";

/** Quick FIDIC SC 20.2 admissibility read for an event. */
export type AdmissibilityStatus =
  | "Likely admissible"
  | "At risk"
  | "Inadmissible"
  | "Not assessed";

/** A source document the AI linked to a delay event. */
export interface DelayEventSource {
  id: string;
  name: string;
  type: DocType;
  /** Letter / transmittal reference, e.g. "CL-0412". */
  ref?: string;
  /** ISO date of the document. */
  date?: string;
}

/** One step in an event's correspondence chronology. */
export interface ChronologyItem {
  id: string;
  /** ISO date. */
  date: string;
  actor: "Contractor" | "Engineer" | "Employer" | "System";
  title: string;
  detail?: string;
  /** Links back to a DelayEventSource.id. */
  sourceId?: string;
}

/** A richer, reviewable delay event extracted from the data room. */
export interface ProjectDelayEvent {
  id: string;
  /** Human reference, e.g. "DE-03". */
  ref: string;
  title: string;
  /** Short category label, e.g. "Bus duct delay". */
  category: string;
  narrative: string;
  cause: DelayCause;
  /** FIDIC clause the event falls under, e.g. "Sub-Clause 8.5". */
  clause: string;
  /** ISO date. */
  startDate: string;
  /** ISO date. */
  endDate: string;
  daysImpact: number;
  criticalPath: boolean;
  admissibility: AdmissibilityStatus;
  /** 0–100 AI confidence in the extraction. */
  aiConfidence: number;
  reviewStatus: DelayReviewStatus;
  chronology: ChronologyItem[];
  sources: DelayEventSource[];
}

// ── Project queries / RFI register (Project Workspace → Queries tab) ──────
export type QueryStatus = "Open" | "Closed";

/** One query / RFI raised on a project, with the GIC response and its status. */
export interface ProjectQuery {
  id: string;
  projectId: string;
  /** ISO date the RFI was raised. */
  dateOfRfi: string;
  /** The EOT / delay matter the query concerns. */
  eotDescription: string;
  /** The question put to the client / GIC. */
  queryDescription: string;
  /** The response received from GIC (recorded by the analyst, or by the client). */
  responseFromGic: string;
  /** ISO date the response was received. */
  dateOfResponse: string;
  status: QueryStatus;
  remarks: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EOTClaim {
  id: string;
  ref: string;
  title: string;
  project: string;
  contractRef: string;
  standard: ContractStandard;
  status: ClaimStatus;
  daysClaimed: number;
  daysGranted?: number;
  quantum: number;
  noticeStatus: NoticeStatus;
  submittedDate?: string;
  updatedDate: string;
  owner: string;
  delayEvents: DelayEvent[];
  entitlementClause: string;
  causationSummary: string;
  reliefSought: string;
  aiConfidence: number;

  // ── Captured at registration (optional so seed data stays valid) ──
  claimType?: ClaimType;
  priority?: ClaimPriority;
  /** Date the delaying event occurred (ISO). */
  eventDate?: string;
  /** Date the Contractor became aware of the event (ISO) — drives the notice clock. */
  eventIdentifiedDate?: string;
  /** Notice clause invoked, e.g. "Sub-Clause 20.2.1". */
  noticeClause?: string;
  /** Auto-calculated contractual notice deadline (ISO). */
  noticeDeadline?: string;
  /** Auto-calculated fully-detailed / further-particulars deadline (ISO). */
  furtherParticularsDeadline?: string;
  reviewers?: string[];
  internalNotes?: string;
  /** AI-analysed documents linked to this claim (what each document is about). */
  analyzedDocuments?: AnalyzedDocument[];

  // ── 9-stage lifecycle state ──
  stage?: ClaimStage;
  outcome?: ClaimOutcome;
  noticeIssued?: boolean;
  noticeIssuedDate?: string;
  /** True if the notice was issued after the contractual deadline. */
  lateNotice?: boolean;
  aiAnalysisComplete?: boolean;
  claimDocumentReady?: boolean;
  /** Engineer's response deadline once the claim is submitted (ISO). */
  responseDeadline?: string;
  approvals?: Approval[];
  noticeLog?: NoticeLogEntry[];
  auditTrail?: AuditEntry[];
}

export interface ContractClause {
  id: string;
  type: string;
  reference: string;
  summary: string;
  risk: RiskLevel;
}

export interface Obligation {
  id: string;
  description: string;
  responsibleParty: string;
  dueDate: string;
  contractRef: string;
  reference: string;
  status: "Open" | "In Progress" | "Met" | "Overdue";
}

export interface Variation {
  id: string;
  ref: string;
  title: string;
  value: number;
  status: "Notified" | "Under Assessment" | "Agreed" | "Disputed";
  date: string;
}

export interface Contract {
  id: string;
  ref: string;
  title: string;
  project: string;
  employer: string;
  contractor: string;
  standard: ContractStandard;
  value: number;
  currency: string;
  startDate: string;
  completionDate: string;
  riskScore: number;
  riskLevel: RiskLevel;
  status: "Active" | "Closeout" | "Completed";
  clauses: ContractClause[];
  obligations: Obligation[];
  variations: Variation[];
}

export interface NoticeItem {
  id: string;
  clause: string;
  description: string;
  dueDate: string;
  status: NoticeStatus;
  project: string;
  claimRef?: string;
}

// ── Administration: users, roles & permissions ────────────────────────────
export type UserStatus = "Active" | "Invited" | "Suspended";

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  /** Optional contact number. */
  phone?: string;
  /** ISO date, or "" if never signed in. */
  lastActive: string;
}

export interface Permission {
  id: string;
  label: string;
}

export interface PermissionGroup {
  module: string;
  perms: Permission[];
}

export interface Role {
  id: string;
  name: string;
  description: string;
  /** Hex used for the role chip/dot. */
  color: string;
  /** Built-in roles cannot be deleted. */
  system: boolean;
  permissionIds: string[];
}

// ── Document ingestion ────────────────────────────────────────────────────
export type DocType = "PDF" | "DOCX" | "XLSX" | "P6 XML" | "MPP" | "Scan" | "Other";

/** AI classification + summary of an uploaded document. */
export interface AnalyzedDocument {
  name: string;
  documentType: string;
  summary: string;
  relevanceToClaim: string;
  supportsEot: boolean;
  confidence: number;
}

export interface ClaimDocument {
  id: string;
  name: string;
  type: DocType;
  sizeKB: number;
  status: "Parsed" | "Parsing" | "Queued";
  ocr?: boolean;
  pages?: number;
  uploadedAt?: string;
}

// ── Critical path (As-Planned vs As-Built) ────────────────────────────────
export interface CriticalPathActivity {
  id: string;
  name: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  delayDays: number;
  onCriticalPath: boolean;
  citation?: string;
}

// ── Client portal: projects & uploaded claim documents ────────────────────
/** A project the client is given visibility of (derived from a contract). */
export interface Project {
  id: string;
  name: string;
  /** Contract reference used as the project code. */
  code: string;
  employer: string;
  contractor: string;
  standard: ContractStandard;
  value: number;
  currency: string;
  startDate: string;
  completionDate: string;
  status: "Active" | "Closeout" | "Completed";
  riskLevel: RiskLevel;
}

/** A claim-related document uploaded by the client (in-memory for now). */
export interface UploadedClaimDocument {
  id: string;
  projectId: string;
  name: string;
  type: DocType;
  sizeKB: number;
  /** ISO datetime. */
  uploadedAt: string;
  uploadedBy: string;
  claimRef?: string;
  note?: string;
  status: "Uploaded" | "Under Review" | "Analysed";
  /** Google Drive file id once the file is stored. */
  driveFileId?: string;
  /** Cached AI analysis, present once the file has been analysed in the data room. */
  analysis?: StoredDocumentAnalysis | null;
  /** Background-analysis lifecycle: "" (never run) | pending | analyzing | done | failed. */
  analysisStatus?: "" | "pending" | "analyzing" | "done" | "failed";
  analysisError?: string | null;
}

/** Cached Claude analysis stored against an uploaded document (DocumentAnalysis shape). */
export interface StoredDocumentAnalysis {
  document_type: string;
  title: string;
  summary: string;
  relevance_to_claim: string;
  supports_eot: boolean;
  key_points: string[];
  parties: string[];
  key_dates: string[];
  confidence: number;
}

/** A text selection a comment refers to (Word/text documents). */
export interface CommentAnchor {
  text: string;
  /** Character offset of the selection within the rendered content. */
  start: number;
  length: number;
}

/** A free-text comment/note attached to an uploaded document. */
export interface DocumentComment {
  id: string;
  documentId: string;
  projectId: string;
  body: string;
  author: string;
  authorId?: string | null;
  /** ISO datetime. */
  createdAt: string;
  /** Set when the comment is anchored to selected text in the document. */
  anchorText?: string | null;
  anchorStart?: number | null;
  anchorLength?: number | null;
}

// ── FIDIC & NEC clause reference library ──────────────────────────────────
export interface ClauseRef {
  id: string;
  book: string;
  clause: string;
  title: string;
  summary: string;
  tags: string[];
  /** Where the clause came from: "manual" | "book" | "ai". */
  source?: string;
  /** True when the project's Particular Conditions amend this base clause. */
  modified?: boolean;
  /** One-line note on what the Particular Conditions changed. */
  modificationNote?: string;
}
