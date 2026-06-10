import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { addClaim, contracts, nextClaimSequence } from "@/mock/data";
import { addCalendarDays, cn, daysUntil, formatDate, relativeDays } from "@/lib/utils";
import type {
  ClaimPriority,
  ClaimType,
  ContractStandard,
  EOTClaim,
  NoticeStatus,
} from "@/types";

const STANDARDS: ContractStandard[] = [
  "FIDIC Red 1999",
  "FIDIC Yellow 2017",
  "FIDIC Silver 2017",
  "NEC4",
  "CPWD",
  "Bespoke",
];

const CLAIM_TYPES: ClaimType[] = [
  "EOT & Cost",
  "EOT Only",
  "Cost Only",
  "Disruption",
  "Force Majeure",
];

const PRIORITIES: ClaimPriority[] = ["Critical", "High", "Medium", "Low"];

const REVIEWER_OPTIONS = [
  "Akshay Patil",
  "Sara Khan",
  "Legal Counsel",
  "Commercial Director",
];

/**
 * Contractual notice windows per standard. `notice` drives the Notice-of-Claim
 * deadline (calendar days from awareness of the event); `particulars` drives the
 * fully-detailed / further-particulars deadline. `clause` pre-fills the notice clause.
 */
const NOTICE_WINDOW: Record<
  ContractStandard,
  { notice: number; particulars: number; clause: string }
> = {
  "FIDIC Red 1999": { notice: 28, particulars: 42, clause: "Sub-Clause 20.1 (Contractor's Claims)" },
  "FIDIC Yellow 2017": { notice: 28, particulars: 84, clause: "Sub-Clause 20.2.1 (Notice of Claim)" },
  "FIDIC Silver 2017": { notice: 28, particulars: 84, clause: "Sub-Clause 20.2.1 (Notice of Claim)" },
  NEC4: { notice: 56, particulars: 0, clause: "Clause 61.3 (Compensation Event notification)" },
  CPWD: { notice: 28, particulars: 0, clause: "GCC Clause 5.2 (Extension of Time)" },
  Bespoke: { notice: 0, particulars: 0, clause: "" },
};

/** Notice compliance status derived from the deadline relative to today. */
function noticeStatusFor(deadlineIso: string): NoticeStatus {
  if (!deadlineIso) return "Compliant";
  const d = daysUntil(deadlineIso);
  if (d < 0) return "Overdue";
  if (d <= 7) return "Due Soon";
  return "Compliant";
}

// Horizontal stepper definition. `id` matches the `tab` state values; order
// here is the step order shown in the stepper and used to mark completed steps.
const STEP_IDS = ["event", "contract", "assignment"] as const;
const STEPS = [
  { id: "event", n: 1, title: "Event Details" },
  { id: "contract", n: 2, title: "Contract" },
  { id: "assignment", n: 3, title: "Assignment" },
] as const;

export function NewEOTClaimPage() {
  const navigate = useNavigate();

  // Event details
  const [title, setTitle] = useState("");
  const [claimType, setClaimType] = useState<ClaimType>("EOT & Cost");
  const [eventDate, setEventDate] = useState("");
  const [eventIdentifiedDate, setEventIdentifiedDate] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ClaimPriority>("High");
  const [quantum, setQuantum] = useState("");

  // Contract & notice
  const [contractRef, setContractRef] = useState("");
  const [project, setProject] = useState("");
  const [standard, setStandard] = useState<ContractStandard>("FIDIC Yellow 2017");
  const [noticeClause, setNoticeClause] = useState(NOTICE_WINDOW["FIDIC Yellow 2017"].clause);
  const [noticeClauseTouched, setNoticeClauseTouched] = useState(false);
  const [entitlementClause, setEntitlementClause] = useState("");
  const [daysClaimed, setDaysClaimed] = useState("");

  // Assignment
  const [owner, setOwner] = useState("");
  const [reviewers, setReviewers] = useState<string[]>([]);
  const [reliefSought, setReliefSought] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const [errors, setErrors] = useState<{ title?: string; project?: string; eventDate?: string }>({});

  // Which section is visible. Splits the long form into tabs to cut scrolling.
  const [tab, setTab] = useState<"event" | "contract" | "assignment">("event");

  // ── Auto-calculated deadlines ──
  const window = NOTICE_WINDOW[standard];
  const noticeAnchor = eventIdentifiedDate || eventDate;
  const noticeDeadline = useMemo(
    () => (noticeAnchor && window.notice ? addCalendarDays(noticeAnchor, window.notice) : ""),
    [noticeAnchor, window.notice],
  );
  const fpDeadline = useMemo(
    () => (eventDate && window.particulars ? addCalendarDays(eventDate, window.particulars) : ""),
    [eventDate, window.particulars],
  );
  const noticeDaysLeft = noticeDeadline ? daysUntil(noticeDeadline) : null;
  const noticeUrgent = noticeDaysLeft !== null && noticeDaysLeft <= 7;

  /** Pick a known contract → auto-fill project, standard and contract ref. */
  function onPickContract(ref: string) {
    setContractRef(ref);
    const c = contracts.find((x) => x.ref === ref);
    if (c) {
      setProject(c.project);
      setStandard(c.standard);
      if (!noticeClauseTouched) setNoticeClause(NOTICE_WINDOW[c.standard].clause);
    }
  }

  function onChangeStandard(s: ContractStandard) {
    setStandard(s);
    if (!noticeClauseTouched) setNoticeClause(NOTICE_WINDOW[s].clause);
  }

  function toggleReviewer(name: string) {
    setReviewers((prev) =>
      prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name],
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!title.trim()) next.title = "A claim title is required.";
    if (!project.trim()) next.project = "Project is required.";
    if (!eventDate) next.eventDate = "Event date is required.";
    setErrors(next);
    if (Object.keys(next).length) {
      // Reveal the tab that holds the first error so it isn't hidden off-tab.
      if (next.title || next.eventDate) setTab("event");
      else if (next.project) setTab("contract");
      return;
    }

    const seq = nextClaimSequence(2026);
    const ref = `EOT-2026-${String(seq).padStart(3, "0")}`;
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();
    const ownerName = owner.trim() || "Unassigned";

    const claim: EOTClaim = {
      id: `c-${ref}`,
      ref,
      title: title.trim(),
      project: project.trim(),
      contractRef: contractRef.trim(),
      standard,
      status: "Draft",
      claimType,
      priority,
      daysClaimed: Number(daysClaimed) || 0,
      quantum: Number(quantum) || 0,
      noticeStatus: noticeStatusFor(noticeDeadline),
      updatedDate: today,
      owner: ownerName,
      reviewers,
      eventDate,
      eventIdentifiedDate: eventIdentifiedDate || eventDate,
      noticeClause: noticeClause.trim(),
      noticeDeadline: noticeDeadline || undefined,
      furtherParticularsDeadline: fpDeadline || undefined,
      internalNotes: internalNotes.trim() || undefined,
      delayEvents: [],
      entitlementClause: entitlementClause.trim(),
      causationSummary: description.trim(),
      reliefSought: reliefSought.trim(),
      aiConfidence: 0,

      // ── Lifecycle: intake completes stages 1–2; claim awaits Notice of Claim ──
      stage: "Notice of Claim",
      noticeIssued: false,
      noticeLog: [
        {
          id: "noc-1",
          type: "Notice of Claim",
          clause: noticeClause.trim() || "—",
          status: "Pending",
          direction: "Outgoing",
          dueDate: noticeDeadline || undefined,
        },
        ...(fpDeadline
          ? [
              {
                id: "noc-fp",
                type: "Further Particulars",
                clause: "Fully-detailed claim",
                status: "Pending" as const,
                direction: "Outgoing" as const,
                dueDate: fpDeadline,
              },
            ]
          : []),
      ],
      auditTrail: [
        { id: "a-2", at: now, actor: ownerName, action: `Claim initiated — ${ref} created. Notice deadline set: ${noticeDeadline || "n/a"}.` },
        { id: "a-1", at: now, actor: ownerName, action: `Event identified — "${title.trim()}" classified as ${claimType}.` },
      ],
    };

    addClaim(claim);
    navigate(`/claims/${ref}`);
  }

  return (
    <div>
      <Link to="/claims" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy-700 mb-4">
        <ArrowLeft className="size-4" /> EOT Claims
      </Link>

      <div className="mb-6">
        <h1 className="text-[26px] leading-tight font-bold text-ink tracking-tight">New EOT Claim</h1>
        <p className="mt-1.5 text-sm text-muted">
          Register a new Extension of Time claim. It starts as a draft — the contractual notice deadline is calculated for you from the event date and contract standard.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        {/* One large card holds the stepper and the active step's fields. */}
        <Card className="overflow-hidden">
          {/* Horizontal stepper — Step 1 / Step 2 / Step 3. */}
          <div className="px-5 sm:px-6 py-5 border-b border-border">
            <ol className="flex items-center gap-2 sm:gap-4">
              {STEPS.map((s, i) => {
                const isActive = tab === s.id;
                const isComplete = STEP_IDS.indexOf(tab) > i;
                const done = isActive || isComplete;
                return (
                  <li key={s.id} className="flex items-center gap-2 sm:gap-4 flex-1 last:flex-none min-w-0">
                    <button
                      type="button"
                      onClick={() => setTab(s.id)}
                      className="flex items-center gap-3 min-w-0 text-left"
                    >
                      <span
                        className={cn(
                          "grid place-items-center size-9 rounded-full text-sm font-semibold shrink-0 transition-colors",
                          done ? "bg-navy-900 text-white" : "bg-navy-50 text-faint border border-border",
                        )}
                      >
                        {s.n}
                      </span>
                      <span className="min-w-0">
                        <span className={cn("block text-[11px] font-bold uppercase tracking-wide", done ? "text-navy-700" : "text-faint")}>
                          Step {s.n}
                        </span>
                        <span className={cn("block text-sm font-medium truncate", isActive ? "text-ink" : "text-muted")}>
                          {s.title}
                        </span>
                      </span>
                    </button>
                    {i < STEPS.length - 1 && (
                      <span className={cn("hidden sm:block h-px flex-1 min-w-6", isComplete ? "bg-navy-300" : "bg-border")} />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

        {/* ── Event details ── */}
        {tab === "event" && (
        <>
          <CardHeader title="Event Details" subtitle="What happened, and when" />
          <div className="p-5 space-y-5">
            <div>
              <label className="label" htmlFor="title">Claim title</label>
              <input id="title" className="input" placeholder="e.g. Late access to Podium Level 3 — design information delay" value={title} onChange={(e) => setTitle(e.target.value)} />
              {errors.title && <p className="mt-1 text-xs text-error">{errors.title}</p>}
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="label" htmlFor="claimType">Claim type</label>
                <select id="claimType" className="input" value={claimType} onChange={(e) => setClaimType(e.target.value as ClaimType)}>
                  {CLAIM_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="priority">Priority</label>
                <select id="priority" className="input" value={priority} onChange={(e) => setPriority(e.target.value as ClaimPriority)}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="label" htmlFor="eventDate">Event date</label>
                <input id="eventDate" type="date" className="input" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                {errors.eventDate && <p className="mt-1 text-xs text-error">{errors.eventDate}</p>}
              </div>
              <div>
                <label className="label" htmlFor="eventIdentifiedDate">Event identified date</label>
                <input id="eventIdentifiedDate" type="date" className="input" value={eventIdentifiedDate} onChange={(e) => setEventIdentifiedDate(e.target.value)} />
                <p className="mt-1 text-xs text-faint">Date of awareness — starts the notice clock. Defaults to the event date.</p>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="description">Event description</label>
              <textarea id="description" className="input min-h-[88px]" placeholder="Describe the cause of delay and its link to the critical path…" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="label" htmlFor="quantum">Initial quantum estimate (AED)</label>
                <input id="quantum" type="number" min="0" className="input" placeholder="0" value={quantum} onChange={(e) => setQuantum(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="daysClaimed">EOT days claimed</label>
                <input id="daysClaimed" type="number" min="0" className="input" placeholder="0" value={daysClaimed} onChange={(e) => setDaysClaimed(e.target.value)} />
              </div>
            </div>
          </div>
        </>
        )}

        {/* ── Contract & notice ── */}
        {tab === "contract" && (
        <>
          <CardHeader title="Contract Details" subtitle="The contractual basis and notice deadline" />
          <div className="p-5 space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="label" htmlFor="contract">Contract</label>
                <select id="contract" className="input" value={contractRef} onChange={(e) => onPickContract(e.target.value)}>
                  <option value="">Select a contract (optional)…</option>
                  {contracts.map((c) => (
                    <option key={c.ref} value={c.ref}>{c.ref} — {c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="standard">Contract standard</label>
                <select id="standard" className="input" value={standard} onChange={(e) => onChangeStandard(e.target.value as ContractStandard)}>
                  {STANDARDS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="label" htmlFor="project">Project</label>
                <input id="project" className="input" placeholder="e.g. Dubai Creek Tower – Podium" value={project} onChange={(e) => setProject(e.target.value)} />
                {errors.project && <p className="mt-1 text-xs text-error">{errors.project}</p>}
              </div>
              <div>
                <label className="label" htmlFor="contractRef">Contract ref</label>
                <input id="contractRef" className="input" placeholder="e.g. DCT-MC-001" value={contractRef} onChange={(e) => setContractRef(e.target.value)} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="label" htmlFor="noticeClause">Notice clause</label>
                <input
                  id="noticeClause"
                  className="input"
                  placeholder="e.g. Sub-Clause 20.2.1"
                  value={noticeClause}
                  onChange={(e) => {
                    setNoticeClause(e.target.value);
                    setNoticeClauseTouched(true);
                  }}
                />
              </div>
              <div>
                <label className="label" htmlFor="entitlementClause">Entitlement clause</label>
                <input id="entitlementClause" className="input" placeholder="e.g. Sub-Clause 8.5 (Extension of Time)" value={entitlementClause} onChange={(e) => setEntitlementClause(e.target.value)} />
              </div>
            </div>

            {/* Auto-calculated notice deadline */}
            {noticeDeadline ? (
              <div className={`rounded-lg border p-3.5 flex items-start gap-2.5 text-sm ${noticeUrgent ? "border-error/30 bg-error-bg text-error" : "border-success/30 bg-success-bg text-success"}`}>
                {noticeUrgent ? <AlertTriangle className="size-4.5 shrink-0 mt-0.5" /> : <CheckCircle2 className="size-4.5 shrink-0 mt-0.5" />}
                <div>
                  <p className="font-semibold">
                    Notice deadline: {formatDate(noticeDeadline)}
                    <span className="font-normal"> — {window.notice} calendar days from awareness ({noticeClause || standard})</span>
                  </p>
                  <p className="text-xs mt-0.5">
                    {noticeDaysLeft !== null && noticeDaysLeft < 0
                      ? `⚠ Notice window has lapsed (${relativeDays(noticeDeadline)}).`
                      : `Notice due ${relativeDays(noticeDeadline)}.`}
                    {fpDeadline && <> · Further particulars by {formatDate(fpDeadline)} ({window.particulars} days from event date).</>}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-navy-50/40 p-3.5 flex items-center gap-2.5 text-sm text-muted">
                <CalendarClock className="size-4.5 shrink-0" />
                {standard === "Bespoke"
                  ? "Bespoke contract — no standard notice window; set deadlines manually after creating."
                  : "Enter an event date to calculate the contractual notice deadline."}
              </div>
            )}
          </div>
        </>
        )}

        {/* ── Assignment ── */}
        {tab === "assignment" && (
        <>
          <CardHeader title="Assignment Details" subtitle="Ownership and review" />
          <div className="p-5 space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="label" htmlFor="owner">Claim owner</label>
                <input id="owner" className="input" placeholder="e.g. Akshay Patil" value={owner} onChange={(e) => setOwner(e.target.value)} />
              </div>
              <div>
                <label className="label">Reviewers</label>
                <div className="mt-1 grid grid-cols-2 gap-1.5">
                  {REVIEWER_OPTIONS.map((name) => (
                    <label key={name} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                      <input type="checkbox" checked={reviewers.includes(name)} onChange={() => toggleReviewer(name)} />
                      {name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="reliefSought">Relief sought</label>
              <input id="reliefSought" className="input" placeholder="e.g. Extension of time and associated prolongation cost" value={reliefSought} onChange={(e) => setReliefSought(e.target.value)} />
            </div>

            <div>
              <label className="label" htmlFor="internalNotes">Internal notes</label>
              <textarea id="internalNotes" className="input min-h-[72px]" placeholder="Internal notes — not included in any external submission" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
            </div>
          </div>
        </>
        )}
        </Card>

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            {tab !== "event" && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setTab(tab === "assignment" ? "contract" : "event")}
              >
                Back
              </button>
            )}
            {tab !== "assignment" && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setTab(tab === "event" ? "contract" : "assignment")}
              >
                Next
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Link to="/claims" className="btn btn-outline">Cancel</Link>
            <button type="submit" className="btn btn-primary">
              <Plus className="size-4" /> Create claim
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
