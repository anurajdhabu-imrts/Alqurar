# Al Qarar — EOT Claim Platform: UI Flow Spec & Gap Analysis

**Status:** Draft v1 · 2026-06-18
**Author:** Product (from client process walkthrough + Yiti Marina sample dataset)
**Purpose:** Define the end-to-end UI flow Al Qarar's EOT product must follow, and map it
against what already exists in [apps/web](../apps/web) as an exact **Keep / Change / Add** list.

---

## 1. Context — the real process (corrected model)

Validated against the **Yiti Marina Hotel** sample engagement (FIDIC Red Book CC 2017 + Particular
Conditions). Al Qarar Management Solutions (AQMS) is engaged **by the Contractor** as a specialist
claims consultant to prepare a formal **Extension of Time (EOT) Claim** that is presented to the
Engineer / Employer.

The real-world flow (and therefore the product flow) is:

```
Register (Client/Contractor + full details)
  → Create Project (contract type, parties, key dates, approved baseline programme)
    → Upload Data Room (contract, programme .xer, LPO, per-event correspondence & backup)
      → AI extraction (auto-detect Delay Events, dates, letter refs, chronology, FIDIC clauses)
        → Per-event analysis (narrative, chronology, Admissibility check, Entitlement test)
          → Windows forensic delay analysis (W1…Wn, cumulative Employer vs Contractor delay)
            → Queries / RFI register (chase missing info from Client/Engineer)
              → EOT Claim report (consolidated) → entitlement result → export DOCX/PDF
```

### The single most important correction

The product is **project-centric**, not single-claim-centric.

- **One Project → many Delay Events (the Yiti sample has 19–23) → one consolidated EOT Claim**,
  whose entitlement is computed across a series of **time windows** (the sample uses W1–W10).
- The headline deliverable is a number derived from windows analysis — e.g. the sample concludes
  **185 days EOT, 185 Employer delay, 0 concurrent, revised completion date** — not a per-event award.

The current app models a **single claim** as the central object with delay events nested inside it.
That is the core conceptual change captured below.

### Real deliverables Al Qarar produces (these define the UI's required outputs)

From the sample data room:

| Deliverable | Sample file | What the UI must produce |
|---|---|---|
| Delay Event Summary | `7. Delay Event Summary` | Per-event chronology (Sl.no · Activity · Date · Ref doc · Remarks) + impacted windows |
| Admissibility check | `8. Admisibility` | 16-point FIDIC SC 20.2 checklist per event (Time/Cost · Complied Y/N · Evidence · Consequence) |
| Entitlement Summary | `10. Entitlement Summary` | Windows table → cumulative Employer/Contractor/Concurrent delay → EOT days + revised completion |
| Entitlement tests | `8. Admisibility` → "Sheet2" | E1–E18 entitlement tests per event |
| Queries register | `6. Al Qarar Queries` | RFI log (Date · Topic · Query · Raised to · Response · Status Open/Closed) |
| EOT Claim report | `9. AQMS-EOT-F-08 … EOT Claim` | 7-section consolidated claim document → DOCX/PDF |
| Engagement proposal | `1. Proposal for EOT GIC` | (out of app scope — sales artifact) |

---

## 2. Actors & roles

| Actor | Description | Existing support |
|---|---|---|
| **Client (Contractor)** | Registers company, creates/owns project, uploads documents, answers queries, views results. | Partial — `Client View` role, client portal `/client`, `/client/upload`. No self-registration or project creation. |
| **Al Qarar Analyst** (Claims Manager / Planner) | Runs & reviews AI extraction, edits findings, runs windows analysis, builds the claim. | Yes — `Claims Manager`, internal area, full RBAC. |
| **Reviewer** (Legal / Commercial) | Internal sign-off before the claim is finalised. | Yes — approvals panel in claim detail. |
| **Administrator** | Users, roles, permissions, project↔client assignment. | Yes — strong RBAC (`/users`, `/roles`, assignments). |

Keep the existing RBAC model wholesale — it is more complete than the flow requires.

---

## 3. Information architecture (target navigation)

```
Internal app (analyst)                       Client portal
─────────────────────                        ─────────────
Dashboard (portfolio)                        My Projects
Projects            ← NEW top-level             └ Project overview + status
  └ Project workspace                           └ Upload data room
      • Overview / entitlement                   └ Queries addressed to me
      • Data Room (documents)
      • Delay Events           ← reworked
          └ Event detail: Chronology · Admissibility · Entitlement
      • Windows Analysis        ← NEW (core)
      • Queries / RFI           ← NEW
      • EOT Claim (report)
Clause Library
Contract Lifecycle (Contracts · Obligations · Variations · Notices)   ← keep
Dispute Resolution (Phase 2 placeholder)                              ← keep
Administration (Users · Roles)                                        ← keep
```

The current top-level is **Claims Register**. Target adds **Projects** as the primary object;
"Claims Register" becomes a view *inside* a project (the consolidated EOT claim), or a
portfolio-wide list of project claims.

---

## 4. Screen-by-screen spec + Keep/Change/Add

Tag legend: **KEEP** (use as-is) · **CHANGE** (exists, needs rework) · **ADD** (build new).

### 4.1 Auth & Client Registration
- **KEEP** — login, session, `ProtectedRoute`, role guards. Files: [LoginPage](../apps/web/src/pages/auth/LoginPage.tsx), [authStore](../apps/web/src/store/authStore.ts).
- **ADD** — Client self-registration ("register with full details"): company name, CR/registration no.,
  role on project, country, authorised representative, contacts. Today a client is only created by an
  admin via `AddClientModal`. Decide: self-serve signup vs admin-invite (recommend admin-invite + an
  onboarding profile step, given B2B engagement nature).

### 4.2 Project Setup (wizard) — **ADD**
New 4-step wizard creating the central `Project` object:
1. **Basics** — project name, location, employer, engineer, contractor.
2. **Contract** — form (FIDIC Red 2017 + PCC…), contract value/currency, LOA/LPO ref.
3. **Key dates** — commencement, baseline completion, Time for Completion, current data date.
4. **Baseline programme** — upload approved baseline `.xer` + approval letters.

Today projects are *derived from contracts* and read-only to clients
([clientData mock](../apps/web/src/mock/clientData.ts), [Project type](../apps/web/src/types/index.ts)).
Reuse the contract-picker logic from [NewEOTClaimPage](../apps/web/src/pages/eot/NewEOTClaimPage.tsx)
but reframe it as project creation. Keep multi-standard support; prioritise the **FIDIC Red 2017 + windows** path.

### 4.3 Document Data Room — **CHANGE**
- **KEEP** — the upload + AI-classify engine: [DocumentsPanel](../apps/web/src/components/DocumentsPanel.tsx),
  `/documents/analyze` ([api/documents](../apps/web/src/api/documents.ts)), `AnalyzedDocument` summaries,
  [UploadedDocsList](../apps/web/src/components/client/UploadedDocsList.tsx).
- **CHANGE** — flat per-claim list → structured **data room** mirroring the real folder taxonomy:
  - Categories: `Contract` · `Programme/Baseline` · `Engagement (LPO)` · `Delay-Event backup` · `General`.
  - Per-document metadata: **doc type** (Letter / WIR / MIR / DPR / Drawing / NCR / Report), **party**
    (Contractor / Engineer / Employer), **date**, **letter reference no.** (e.g. `GIC002-SSH-040-AHS`),
    **linked delay event**.
  - Bulk folder upload with auto-sort (suggest event + party from filename — the sample filenames are
    highly structured and parseable).
- **ADD** — programme ingestion for **`.xer` / P6** files (baseline + monthly updates). `DocType` already
  lists `P6 XML`; no parser/timeline consumer exists yet.

### 4.4 AI Extraction Review — **CHANGE/ADD**
- **KEEP** — document classification + confidence (`AnalyzedDocument`, `onDocumentAnalyzed`).
- **ADD** — **Delay Event auto-extraction**: AI proposes events (DE-01…DE-n) with confidence; analyst
  confirms / merges / renames. Today `runAiAnalysis()` is a mock that only flips a flag and surfaces
  pre-seeded `delayEvents` ([EOTClaimDetailPage](../apps/web/src/pages/eot/EOTClaimDetailPage.tsx) L174).
- **ADD** — **Chronology extraction** per event: the `Sl.no · Activity · Start · Finish · Reference document`
  table, each row deep-linked to its source PDF.

### 4.5 Delay Events Workspace — **CHANGE** (biggest rework)
Promote `DelayEvent` from a nested struct to a **first-class object** with its own list + detail page.

- **KEEP** — `DelayEvent` base fields & `DelayCause` (`Employer / Concurrent / Contractor / …`), the
  cause badges and the per-event card UI (AI tab of claim detail).
- **CHANGE** — list view per project: status · admissibility · entitlement · impacted windows ·
  Employer/Contractor/Concurrent tag · "admissible / not admissible / weak-try" classification
  (the sample's Remarks column literally carries these dispositions).
- **ADD** — Event **detail page** with tabs:
  - **Overview** — narrative, occurrence start–finish, impacted windows, disposition.
  - **Chronology** — the event timeline table with linked evidence.
  - **Documents** — Contractor letters ↔ Engineer replies, threaded.
  - **Contractual basis** — mapped FIDIC clauses (SC 8.4, 13, 20.2…).
  - **Admissibility checklist** — 16-point FIDIC SC 20.2 list, each with Time(EOT)/Cost applicability,
    Complied Y/N, evidence ref, consequence-if-not-met. (Source: `8. Admisibility`.)
  - **Entitlement test** — E1–E18 (Employer-risk event, causation, critical-path impact, concurrency,
    mitigation, cost substantiation, double-recovery…), Complied Y/N + analysis ref.

### 4.6 Windows / Forensic Delay Analysis — **ADD** (the core deliverable, currently absent)
New module producing the Entitlement Summary:
- **Windows table** (W1…Wn): window start/finish, data date, impacted programme, EOT entitlement (days),
  dominant cause of delay, driving activity ID, **Employer vs Contractor vs Concurrent** (cumulative),
  revised completion date.
- **Cumulative entitlement strip** → final headline (e.g. 185 days / Employer 185 / Concurrent 0 /
  revised completion date).
- Baseline-vs-impacted-vs-as-built timeline visual.

The existing [criticalPath mock](../apps/web/src/mock/criticalPath.ts) (As-Planned vs As-Built bars for a
*single* claim) is a useful **visual primitive to KEEP**, but it is not windows analysis — it has no
window segmentation, no cumulative employer/contractor split, no driving-activity tracking. This is net-new.

### 4.7 Clause Library / FIDIC mapping — **KEEP/CHANGE**
- **KEEP** — [ClauseLibraryPage](../apps/web/src/pages/eot/ClauseLibraryPage.tsx),
  [clauses mock](../apps/web/src/mock/clauses.ts), [api/clauses](../apps/web/src/api/clauses.ts), `ClauseRef` type.
- **CHANGE** — seed with the **actual FIDIC Red Book 2017 + PCC** clauses the sample relies on
  (SC 20.2.1 notice, 20.2.4 particulars, 20.2.3 records, 3.7 determination, 8.4 EOT, 13 variations, 1.9…),
  and link clauses bi-directionally to events' admissibility/entitlement rows.

### 4.8 Queries / RFI Register — **ADD**
New per-project log: `# · Date · Event/Topic · Query · Raised to (Client/Engineer) · Response · Date ·
Status (Open/Closed)`. Source: `6. Al Qarar Queries`. This drives the "send to client → client replies"
loop the client described. Distinct from `Notices` (contractual notice deadlines) and from the Phase-2
`Disputes` module — do not conflate.

### 4.9 EOT Claim Builder (report) — **CHANGE**
- **KEEP** — the sectioned draft + export buttons in the claim-detail "Claim Document" tab, the
  AI-confidence panel, and the generate→review→submit lifecycle scaffolding.
- **CHANGE** — replace the 6 fixed `DraftSection`s with Al Qarar's **standard 7-section structure**
  (from the proposal): Project Description · Executive Summary · Contractual Basis · Detailed Description &
  Chronology · Delay Analysis (windows) · Conclusion / Requested Relief · Attachments (auto-numbered
  evidence index). Pull content from confirmed events + windows analysis. **Wire up** DOCX/PDF export
  (currently static buttons).

### 4.10 Dashboards — **CHANGE**
- **KEEP** — [DashboardPage](../apps/web/src/pages/Dashboard/DashboardPage.tsx),
  [ClientDashboardPage](../apps/web/src/pages/client/ClientDashboardPage.tsx),
  [StatCard](../apps/web/src/components/ui/StatCard.tsx), [Sparkline](../apps/web/src/components/ui/Sparkline.tsx).
- **CHANGE** — project workspace landing should headline **project-level** metrics: total EOT entitlement
  (days), revised completion date, Employer/Contractor/Concurrent split, # admissible events, # open
  queries, documents processed.

### 4.11 9-stage claim lifecycle — **CHANGE (re-scope)**
- **KEEP** — the lifecycle machinery ([claimFlow.ts](../apps/web/src/lib/claimFlow.ts)): stage tracker,
  CTA-per-stage, audit trail, approvals, notice clock. It is genuinely good.
- **CHANGE** — it currently models **one claim from event → engineer assessment**. Re-scope it to the
  **consolidated EOT claim / engagement** level, with delay-event analysis (admissibility, entitlement,
  windows) as the work *inside* the "Evidence & AI Analysis" + "Claim Preparation" stages. The notice
  clock is per-event (each event has its own SC 20.2.1 28-day window) — lift it to the event object.

### 4.12 Contract Lifecycle Management (Contracts / Obligations / Variations / Notices) — **KEEP**
Useful adjacency and already built. The contract + notice data feed admissibility. No change required for v1.

### 4.13 Dispute Resolution — **KEEP** (Phase-2 placeholder as-is).

---

## 5. Core data model — target vs existing

Target entity graph:

```
Project ──< Document
Project ──< DelayEvent ──< ChronologyItem
DelayEvent ──< AdmissibilityCheck (16 rows)
DelayEvent ──< EntitlementTest  (E1–E18)
Project ──< Window (W1…Wn delay analysis)
Project ──< Query (RFI)
Project ──1 EOTClaimReport (consolidated)
```

Existing [types/index.ts](../apps/web/src/types/index.ts) coverage:

| Target entity | Existing type | Action |
|---|---|---|
| `Project` | `Project` (client-portal, derived) | CHANGE — promote to first-class, add key dates/programme |
| `Document` | `ClaimDocument`, `UploadedClaimDocument`, `AnalyzedDocument` | CHANGE — add party, letterRef, category, eventId |
| `DelayEvent` | `DelayEvent` (nested in `EOTClaim`) | CHANGE — first-class, add admissibility/entitlement/chronology/windows |
| `ChronologyItem` | — | ADD |
| `AdmissibilityCheck` | — | ADD |
| `EntitlementTest` | — | ADD |
| `Window` | `CriticalPathActivity` (partial) | ADD (windows engine); keep CP as visual |
| `Query` (RFI) | — | ADD |
| `EOTClaimReport` | `EOTClaim` | CHANGE — consolidated, project-scoped, 7-section |
| Clause | `ClauseRef`, `ContractClause` | KEEP; reseed FIDIC Red 2017 |
| Users/Roles/Perms | `ManagedUser`, `Role`, `Permission` | KEEP |

---

## 6. Keep / Change / Add — one-glance summary

**KEEP (reuse as-is)**
- Auth, session, route guards, RBAC (users/roles/permissions/assignments)
- Document upload + AI classification engine (`DocumentsPanel`, `/documents/analyze`)
- Clause Library shell, Contract Lifecycle module, Disputes placeholder
- Claim lifecycle machinery (stage tracker, audit trail, approvals, notice clock)
- UI kit (Card, Badge, Tabs, StatCard, Sparkline, PageHeader) and visual language

**CHANGE (exists, rework)**
- Single-claim model → **project-centric** (Project as the central object)
- Document list → structured **data room** (taxonomy, party, letter-ref, event link)
- AI "run analysis" mock → real **event + chronology extraction & review**
- Nested delay events → **first-class events** with detail pages
- Claim-document 6 sections → **7-section Al Qarar format**; wire DOCX/PDF export
- Dashboards → **project-level entitlement** metrics
- Clause seed → **FIDIC Red 2017 + PCC**
- 9-stage lifecycle → re-scope to **consolidated claim / engagement** level

**ADD (net-new)**
- Client self-registration / company onboarding
- Project Setup wizard (contract, key dates, baseline programme)
- Programme (`.xer` / P6) ingestion
- **Windows forensic delay analysis** engine (the core deliverable)
- Per-event **Admissibility checklist** (16-pt FIDIC SC 20.2)
- Per-event **Entitlement test** (E1–E18)
- **Queries / RFI register**

---

## 7. Suggested build order (UI-first, mockable on current stack)

1. **Project as first-class object** + Project Setup wizard + project workspace shell. (Unblocks everything.)
2. **Data Room rework** (taxonomy + tagging) — reuse existing upload/AI engine.
3. **Delay Events first-class** + detail page (Overview, Chronology, Documents, Clause basis).
4. **Admissibility + Entitlement** checklists (static schema → AI-filled later).
5. **Windows analysis** module + entitlement headline (the differentiator).
6. **Queries/RFI register**.
7. **EOT Claim report** 7-section builder + export.
8. Re-scope lifecycle + project-level dashboards.

Steps 1–4 and 6 are mostly UI + schema work on the existing React/TanStack stack. Step 5 (windows engine)
and `.xer` parsing are the substantive new logic and should be spiked early to de-risk.
