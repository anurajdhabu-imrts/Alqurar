import type {
  Contract,
  EOTClaim,
  NoticeItem,
  Obligation,
  User,
} from "@/types";

export const currentUser: User = {
  id: "u-1",
  name: "Akshay Patil",
  email: "Sign in to your workspace",
  role: "Claims Manager",
  initials: "AP",
};

// ── EOT Claims ────────────────────────────────────────────────────────────
export const eotClaims: EOTClaim[] = [
  {
    id: "c-1",
    ref: "EOT-2026-014",
    title: "Late access to Podium Level 3 — design information delay",
    project: "Dubai Creek Tower – Podium",
    contractRef: "DCT-MC-001",
    standard: "FIDIC Yellow 2017",
    status: "Under Assessment",
    daysClaimed: 47,
    quantum: 4_180_000,
    noticeStatus: "Compliant",
    submittedDate: "2026-04-22",
    updatedDate: "2026-05-18",
    owner: "Akshay Patil",
    entitlementClause: "Sub-Clause 8.5 (Extension of Time for Completion)",
    causationSummary:
      "Employer failed to release IFC drawings for the Level 3 transfer slab by the contractual date, preventing rebar fixing on the critical path. The 47-day delay is wholly attributable to the Employer's late information.",
    reliefSought:
      "Extension of Time of 47 calendar days and associated prolongation cost of AED 4.18M.",
    aiConfidence: 86,
    delayEvents: [
      {
        id: "de-1",
        title: "IFC drawing release delay — L3 transfer slab",
        cause: "Employer",
        startDate: "2026-02-03",
        endDate: "2026-03-21",
        daysImpact: 47,
        criticalPath: true,
        description:
          "Issued-for-construction drawings for the transfer slab were 46 days late against the Information Release Schedule.",
        evidenceCount: 12,
      },
      {
        id: "de-2",
        title: "Concurrent rebar supply shortfall",
        cause: "Concurrent",
        startDate: "2026-02-28",
        endDate: "2026-03-09",
        daysImpact: 9,
        criticalPath: false,
        description:
          "Contractor rebar delivery shortfall overlapped 9 days; assessed as concurrent and excluded from the net entitlement.",
        evidenceCount: 4,
      },
    ],
  },
  {
    id: "c-2",
    ref: "EOT-2026-011",
    title: "Exceptional rainfall — Marina basin flooding",
    project: "Lusail Marina – Residential Block C",
    contractRef: "LMR-C-2024",
    standard: "FIDIC Red 1999",
    status: "Submitted",
    daysClaimed: 18,
    quantum: 1_240_000,
    noticeStatus: "Compliant",
    submittedDate: "2026-05-06",
    updatedDate: "2026-05-12",
    owner: "Akshay Patil",
    entitlementClause: "Sub-Clause 8.4(c) (Exceptionally Adverse Climatic Conditions)",
    causationSummary:
      "Rainfall in March 2026 exceeded the 10-year mean for the period, flooding the basement excavation and halting works for 18 days.",
    reliefSought: "Extension of Time of 18 calendar days; cost reserved.",
    aiConfidence: 74,
    delayEvents: [
      {
        id: "de-3",
        title: "Basin flooding & dewatering",
        cause: "Force Majeure",
        startDate: "2026-03-11",
        endDate: "2026-03-29",
        daysImpact: 18,
        criticalPath: true,
        description:
          "Excavation submerged; dewatering and re-shoring required before works resumed.",
        evidenceCount: 8,
      },
    ],
  },
  {
    id: "c-3",
    ref: "EOT-2026-009",
    title: "Variation VO-22 — additional MEP risers",
    project: "NEOM The Line – Module 14 MEP",
    contractRef: "NEOM-M14-MEP",
    standard: "FIDIC Silver 2017",
    status: "In Review",
    daysClaimed: 31,
    quantum: 2_960_000,
    noticeStatus: "Due Soon",
    updatedDate: "2026-05-19",
    owner: "Sara Khan",
    entitlementClause: "Sub-Clause 13.3 (Variation Procedure) read with 8.5",
    causationSummary:
      "Instructed variation added two MEP risers, extending the riser installation sequence on the critical path by 31 days.",
    reliefSought: "Extension of Time of 31 calendar days and AED 2.96M.",
    aiConfidence: 91,
    delayEvents: [
      {
        id: "de-4",
        title: "VO-22 riser installation",
        cause: "Employer",
        startDate: "2026-04-02",
        endDate: "2026-05-03",
        daysImpact: 31,
        criticalPath: true,
        description:
          "Additional riser fabrication and installation extended the MEP critical path.",
        evidenceCount: 6,
      },
    ],
  },
  {
    id: "c-4",
    ref: "EOT-2026-006",
    title: "Unforeseen ground conditions — TBM launch shaft",
    project: "Abu Dhabi Loop – Tunnel Section 2",
    contractRef: "ADL-TS2",
    standard: "NEC4",
    status: "Granted",
    daysClaimed: 62,
    daysGranted: 55,
    quantum: 7_350_000,
    noticeStatus: "Compliant",
    submittedDate: "2026-02-14",
    updatedDate: "2026-04-30",
    owner: "Akshay Patil",
    entitlementClause: "Clause 60.1(12) (Physical Conditions) — Compensation Event",
    causationSummary:
      "Rock strata encountered at the launch shaft differed materially from the geotechnical baseline, requiring redesign of the shaft support.",
    reliefSought: "Extension of 62 days; tribunal granted 55 days.",
    aiConfidence: 88,
    delayEvents: [
      {
        id: "de-5",
        title: "Shaft support redesign",
        cause: "Employer",
        startDate: "2025-12-08",
        endDate: "2026-02-07",
        daysImpact: 62,
        criticalPath: true,
        description:
          "Differing site conditions required revised shaft support and additional grouting.",
        evidenceCount: 15,
      },
    ],
  },
  {
    id: "c-5",
    ref: "EOT-2026-003",
    title: "Station fit-out — late nominated subcontractor",
    project: "Riyadh Metro Line 6 – Station Fit-out",
    contractRef: "RML6-SFO",
    standard: "FIDIC Yellow 2017",
    status: "Rejected",
    daysClaimed: 24,
    daysGranted: 0,
    quantum: 980_000,
    noticeStatus: "Missed",
    submittedDate: "2026-01-28",
    updatedDate: "2026-03-15",
    owner: "Sara Khan",
    entitlementClause: "Sub-Clause 8.5",
    causationSummary:
      "Claim rejected — notice under Sub-Clause 20.2.1 was issued 9 days late, and the delay was assessed as contractor-culpable.",
    reliefSought: "Extension of 24 days (rejected).",
    aiConfidence: 38,
    delayEvents: [
      {
        id: "de-6",
        title: "Nominated subcontractor mobilisation",
        cause: "Contractor",
        startDate: "2025-12-20",
        endDate: "2026-01-13",
        daysImpact: 24,
        criticalPath: true,
        description: "Subcontractor mobilised late; held to be within Contractor control.",
        evidenceCount: 3,
      },
    ],
  },
  {
    id: "c-6",
    ref: "EOT-2026-016",
    title: "Coastal road — utility diversion delay",
    project: "Mumbai Coastal Road – Package IV",
    contractRef: "MCR-P4",
    standard: "CPWD",
    status: "Draft",
    daysClaimed: 28,
    quantum: 1_620_000,
    noticeStatus: "Due Soon",
    updatedDate: "2026-05-20",
    owner: "Akshay Patil",
    entitlementClause: "CPWD GCC Clause 5.2 (Extension of Time)",
    causationSummary:
      "Authority-controlled utility diversion of a high-tension line was delayed, blocking the carriageway works.",
    reliefSought: "Extension of 28 days; cost to be assessed.",
    aiConfidence: 69,
    delayEvents: [
      {
        id: "de-7",
        title: "HT line diversion",
        cause: "Employer",
        startDate: "2026-04-15",
        endDate: "2026-05-13",
        daysImpact: 28,
        criticalPath: true,
        description: "Statutory authority delayed the HT line diversion approval.",
        evidenceCount: 5,
      },
    ],
  },
];

// ── Contracts (CLM) ───────────────────────────────────────────────────────
export const contracts: Contract[] = [
  {
    id: "ct-1",
    ref: "DCT-MC-001",
    title: "Main Contract — Podium & Substructure",
    project: "Dubai Creek Tower – Podium",
    employer: "Creek Harbour Development LLC",
    contractor: "Al Qarar JV",
    standard: "FIDIC Yellow 2017",
    value: 412_000_000,
    currency: "AED",
    startDate: "2024-09-01",
    completionDate: "2027-02-28",
    riskScore: 72,
    riskLevel: "High",
    status: "Active",
    clauses: [
      { id: "cl-1", type: "Liquidated Damages", reference: "8.8", summary: "AED 250,000/day, capped at 10% of Contract Price.", risk: "High" },
      { id: "cl-2", type: "Time for Completion", reference: "8.2", summary: "915 days from Commencement; sectional completion for podium.", risk: "Moderate" },
      { id: "cl-3", type: "Variation Procedure", reference: "13.3", summary: "Engineer instruction required; 28-day quotation window.", risk: "Low" },
      { id: "cl-4", type: "Notice of Claim", reference: "20.2.1", summary: "28 days from awareness of event, else time-barred.", risk: "High" },
    ],
    obligations: [
      { id: "ob-1", description: "Submit revised baseline programme (Rev 4)", responsibleParty: "Contractor", dueDate: "2026-05-28", contractRef: "DCT-MC-001", reference: "8.3", status: "Open" },
      { id: "ob-2", description: "Issue IFC drawings — Level 4 slab", responsibleParty: "Employer", dueDate: "2026-06-04", contractRef: "DCT-MC-001", reference: "1.9", status: "Open" },
    ],
    variations: [
      { id: "v-1", ref: "VO-31", title: "Façade anchor redesign", value: 3_400_000, status: "Under Assessment", date: "2026-05-02" },
      { id: "v-2", ref: "VO-28", title: "Podium landscaping scope", value: 1_150_000, status: "Agreed", date: "2026-03-19" },
    ],
  },
  {
    id: "ct-2",
    ref: "NEOM-M14-MEP",
    title: "MEP Package — Module 14",
    project: "NEOM The Line – Module 14 MEP",
    employer: "NEOM Company",
    contractor: "Al Qarar JV",
    standard: "FIDIC Silver 2017",
    value: 188_000_000,
    currency: "SAR",
    startDate: "2025-03-15",
    completionDate: "2026-11-30",
    riskScore: 64,
    riskLevel: "High",
    status: "Active",
    clauses: [
      { id: "cl-5", type: "Liquidated Damages", reference: "8.8", summary: "SAR 180,000/day, no cap stated — flag for review.", risk: "High" },
      { id: "cl-6", type: "Design Responsibility", reference: "5.1", summary: "Full single-point design responsibility on Contractor.", risk: "High" },
      { id: "cl-7", type: "Force Majeure", reference: "18", summary: "Standard relief; 14-day notice requirement.", risk: "Low" },
    ],
    obligations: [
      { id: "ob-3", description: "Notice of Claim — VO-22 EOT", responsibleParty: "Contractor", dueDate: "2026-05-24", contractRef: "NEOM-M14-MEP", reference: "20.2.1", status: "Open" },
    ],
    variations: [
      { id: "v-3", ref: "VO-22", title: "Additional MEP risers", value: 6_900_000, status: "Disputed", date: "2026-04-01" },
    ],
  },
  {
    id: "ct-3",
    ref: "ADL-TS2",
    title: "Tunnel Section 2 — TBM Works",
    project: "Abu Dhabi Loop – Tunnel Section 2",
    employer: "Department of Municipalities & Transport",
    contractor: "Al Qarar JV",
    standard: "NEC4",
    value: 905_000_000,
    currency: "AED",
    startDate: "2024-01-10",
    completionDate: "2027-08-31",
    riskScore: 41,
    riskLevel: "Moderate",
    status: "Active",
    clauses: [
      { id: "cl-8", type: "Compensation Events", reference: "60.1", summary: "21 listed events; quotation within 3 weeks.", risk: "Moderate" },
      { id: "cl-9", type: "Early Warning", reference: "15.1", summary: "Both parties to give early warning of matters affecting time/cost.", risk: "Low" },
    ],
    obligations: [
      { id: "ob-4", description: "Early warning meeting — settlement monitoring", responsibleParty: "Both", dueDate: "2026-05-22", contractRef: "ADL-TS2", reference: "15.2", status: "In Progress" },
    ],
    variations: [],
  },
  {
    id: "ct-4",
    ref: "LMR-C-2024",
    title: "Residential Block C — Main Works",
    project: "Lusail Marina – Residential Block C",
    employer: "Qatari Diar",
    contractor: "Al Qarar JV",
    standard: "FIDIC Red 1999",
    value: 274_000_000,
    currency: "QAR",
    startDate: "2024-06-01",
    completionDate: "2026-12-15",
    riskScore: 38,
    riskLevel: "Moderate",
    status: "Active",
    clauses: [
      { id: "cl-10", type: "Liquidated Damages", reference: "8.7", summary: "QAR 120,000/day, capped 7.5%.", risk: "Moderate" },
      { id: "cl-11", type: "Adverse Weather", reference: "8.4(c)", summary: "EOT relief for exceptionally adverse climatic conditions.", risk: "Low" },
    ],
    obligations: [
      { id: "ob-5", description: "Submit dewatering records for EOT-2026-011", responsibleParty: "Contractor", dueDate: "2026-05-26", contractRef: "LMR-C-2024", reference: "4.21", status: "Open" },
    ],
    variations: [
      { id: "v-4", ref: "VO-09", title: "Marina balustrade upgrade", value: 820_000, status: "Notified", date: "2026-05-09" },
    ],
  },
  {
    id: "ct-5",
    ref: "MCR-P4",
    title: "Coastal Road — Package IV Civil Works",
    project: "Mumbai Coastal Road – Package IV",
    employer: "Municipal Corporation of Greater Mumbai",
    contractor: "Al Qarar JV",
    standard: "CPWD",
    value: 3_100_000_000,
    currency: "INR",
    startDate: "2023-11-01",
    completionDate: "2026-10-31",
    riskScore: 55,
    riskLevel: "Moderate",
    status: "Active",
    clauses: [
      { id: "cl-12", type: "Extension of Time", reference: "GCC 5.2", summary: "EOT for authority-controlled delays incl. utility diversions.", risk: "Moderate" },
      { id: "cl-13", type: "Price Variation", reference: "GCC 10C", summary: "Star-rate price adjustment formula applies.", risk: "Low" },
    ],
    obligations: [
      { id: "ob-6", description: "File notice — HT line diversion delay", responsibleParty: "Contractor", dueDate: "2026-05-25", contractRef: "MCR-P4", reference: "GCC 5.2", status: "Open" },
    ],
    variations: [],
  },
];

// ── Aggregated obligation register ────────────────────────────────────────
export const obligations: Obligation[] = contracts.flatMap((c) => c.obligations);

// ── Notice timeline ───────────────────────────────────────────────────────
export const notices: NoticeItem[] = [
  { id: "n-1", clause: "FIDIC 20.2.1", description: "Notice of Claim — VO-22 EOT entitlement", dueDate: "2026-05-24", status: "Due Soon", project: "NEOM The Line – Module 14 MEP", claimRef: "EOT-2026-009" },
  { id: "n-2", clause: "CPWD GCC 5.2", description: "Notice — HT line diversion delay", dueDate: "2026-05-25", status: "Due Soon", project: "Mumbai Coastal Road – Package IV", claimRef: "EOT-2026-016" },
  { id: "n-3", clause: "NEC4 61.3", description: "Compensation event notification — settlement", dueDate: "2026-05-22", status: "Due Soon", project: "Abu Dhabi Loop – Tunnel Section 2" },
  { id: "n-4", clause: "FIDIC 20.2.1", description: "Fully-detailed claim — Podium L3 delay", dueDate: "2026-06-19", status: "Compliant", project: "Dubai Creek Tower – Podium", claimRef: "EOT-2026-014" },
  { id: "n-5", clause: "FIDIC 8.3", description: "Programme revision submission (Rev 4)", dueDate: "2026-05-28", status: "Compliant", project: "Dubai Creek Tower – Podium" },
  { id: "n-6", clause: "FIDIC 20.2.1", description: "Notice — Station fit-out subcontractor", dueDate: "2026-01-22", status: "Missed", project: "Riyadh Metro Line 6 – Station Fit-out", claimRef: "EOT-2026-003" },
  { id: "n-7", clause: "FIDIC 14.3", description: "Interim Payment Application IPA-19", dueDate: "2026-05-15", status: "Overdue", project: "Lusail Marina – Residential Block C" },
  { id: "n-8", clause: "FIDIC 4.21", description: "Monthly progress report — April", dueDate: "2026-05-30", status: "Compliant", project: "Lusail Marina – Residential Block C" },
];

// ── Claims register persistence (localStorage) ────────────────────────────
// The seed claims above are the demo baseline. The full register — new claims
// AND lifecycle changes to any claim — is persisted so it survives a refresh.
const CLAIMS_STORAGE_KEY = "alqarar.claims.v2";

function persistClaims(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CLAIMS_STORAGE_KEY, JSON.stringify(eotClaims));
  } catch {
    /* storage unavailable / quota — ignore in this demo */
  }
}

// Hydrate the stored register over the seed, keeping any seed claims added since.
(function hydrateClaims() {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(CLAIMS_STORAGE_KEY);
    if (!raw) return;
    const stored = JSON.parse(raw) as EOTClaim[];
    if (!Array.isArray(stored) || !stored.length) return;
    const storedRefs = new Set(stored.map((c) => c.ref));
    const newSeeds = eotClaims.filter((c) => !storedRefs.has(c.ref));
    eotClaims.length = 0;
    eotClaims.push(...stored, ...newSeeds);
  } catch {
    /* corrupt storage — fall back to seed data */
  }
})();

/** Register a new claim: add it to the live register (newest first) and persist. */
export function addClaim(claim: EOTClaim): void {
  eotClaims.unshift(claim);
  persistClaims();
}

/** Apply a patch to a claim by ref, persist, and return the updated claim. */
export function mutateClaim(ref: string, patch: Partial<EOTClaim>): EOTClaim | undefined {
  const i = eotClaims.findIndex((c) => c.ref === ref);
  if (i < 0) return undefined;
  eotClaims[i] = {
    ...eotClaims[i],
    ...patch,
    updatedDate: new Date().toISOString().slice(0, 10),
  };
  persistClaims();
  return eotClaims[i];
}

/** Remove a claim from the register by ref, persist, and report success. */
export function deleteClaim(ref: string): boolean {
  const i = eotClaims.findIndex((c) => c.ref === ref);
  if (i < 0) return false;
  eotClaims.splice(i, 1);
  persistClaims();
  return true;
}

/** Highest existing EOT sequence number for the given year, e.g. 16 → next is 017. */
export function nextClaimSequence(year: number): number {
  return eotClaims.reduce((acc, c) => {
    const m = c.ref.match(new RegExp(`EOT-${year}-(\\d+)`));
    return m ? Math.max(acc, Number(m[1])) : acc;
  }, 0) + 1;
}

// ── Lookups ───────────────────────────────────────────────────────────────
export const getClaim = (ref: string) => eotClaims.find((c) => c.ref === ref);
export const getContract = (ref: string) => contracts.find((c) => c.ref === ref);

export const projects = [...new Set(contracts.map((c) => c.project))];
