import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Brain,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileSignature,
  FileText,
  History,
  Mail,
  Forward,
  Paperclip,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { claimStatusTone, noticeStatusTone } from "@/lib/status";
import { cn, daysUntil, formatCurrencyFull, formatDate, relativeDays } from "@/lib/utils";
import {
  NEXT,
  STAGES,
  STAGE_NUMBER,
  defaultApprovals,
  isTerminal,
  outcomeOf,
  stageOf,
  statusForStage,
} from "@/lib/claimFlow";
import { currentUser, getClaim, mutateClaim } from "@/mock/data";
import { getCriticalPath } from "@/mock/criticalPath";
import { getClaimDocuments } from "@/mock/documents";
import type { DocumentAnalysisResult } from "@/api/documents";
import type {
  AnalyzedDocument,
  AuditEntry,
  ClaimOutcome,
  DelayCause,
  EOTClaim,
  NoticeLogEntry,
} from "@/types";

const causeTone: Record<DelayCause, Tone> = {
  Employer: "info",
  "Force Majeure": "warning",
  Concurrent: "neutral",
  Contractor: "error",
  Neutral: "neutral",
};

const OUTCOMES: ClaimOutcome[] = ["Full Award", "Partial Award", "Rejected", "Default"];

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-faint uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-ink mt-0.5">{value}</p>
    </div>
  );
}

function Cite({ children }: { children: ReactNode }) {
  return <span className="badge bg-navy-50 text-navy-600 align-middle">{children}</span>;
}

const nowISO = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => `x-${Math.random().toString(36).slice(2, 9)}`;

export function EOTClaimDetailPage() {
  const { ref } = useParams<{ ref: string }>();
  const [claim, setClaim] = useState<EOTClaim | undefined>(() => (ref ? getClaim(ref) : undefined));
  const [tab, setTab] = useState("overview");

  if (!claim) {
    return (
      <div className="text-center py-20">
        <p className="text-lg font-semibold text-ink">Claim not found</p>
        <p className="text-muted mt-1">No claim matches “{ref}”.</p>
        <Link to="/claims" className="btn btn-outline mt-4 inline-flex">Back to register</Link>
      </div>
    );
  }

  const documents = getClaimDocuments(claim.ref);
  const activities = getCriticalPath(claim.ref);
  const stage = stageOf(claim);
  const stageIdx = STAGE_NUMBER[stage] - 1;
  const outcome = outcomeOf(claim);
  const terminal = isTerminal(claim);
  const step = NEXT[stage];
  const confColor = claim.aiConfidence >= 80 ? "#18794e" : claim.aiConfidence >= 60 ? "#c2700a" : "#c0392b";

  // ── Apply a lifecycle mutation + record an audit entry ──
  function apply(patch: Partial<EOTClaim>, action: string, actor = currentUser.name) {
    const current = claim!;
    const entry: AuditEntry = { id: uid(), at: nowISO(), actor, action };
    const updated = mutateClaim(current.ref, {
      ...patch,
      auditTrail: [entry, ...(current.auditTrail ?? [])],
    });
    if (updated) setClaim({ ...updated });
  }

  // ── Persist an AI document analysis onto the claim (reads live to avoid races) ──
  function onDocumentAnalyzed(filename: string, a: DocumentAnalysisResult) {
    const live = (ref && getClaim(ref)) || claim!;
    const entry: AnalyzedDocument = {
      name: filename,
      documentType: a.document_type,
      summary: a.summary,
      relevanceToClaim: a.relevance_to_claim,
      supportsEot: a.supports_eot,
      confidence: a.confidence,
    };
    const analyzedDocuments = [
      entry,
      ...(live.analyzedDocuments ?? []).filter((d) => d.name !== filename),
    ];
    const audit: AuditEntry = {
      id: uid(),
      at: nowISO(),
      actor: "System",
      action: `AI analysed "${filename}" — classified as ${a.document_type} (${a.confidence}% confidence).`,
    };
    const updated = mutateClaim(live.ref, {
      analyzedDocuments,
      auditTrail: [audit, ...(live.auditTrail ?? [])],
    });
    if (updated) setClaim({ ...updated });
  }

  // ── Stage actions ──
  function issueNotice() {
    const late = !!claim!.noticeDeadline && daysUntil(claim!.noticeDeadline) < 0;
    const noticeLog: NoticeLogEntry[] = (claim!.noticeLog ?? []).map((n) =>
      n.type === "Notice of Claim"
        ? { ...n, status: "Issued", issuedDate: today(), ref: `${claim!.ref}/NOC-001` }
        : n,
    );
    apply(
      {
        stage: "Claim Registration",
        status: statusForStage("Claim Registration"),
        noticeIssued: true,
        noticeIssuedDate: today(),
        lateNotice: late,
        noticeStatus: late ? "Overdue" : "Compliant",
        noticeLog,
      },
      `Notice of Claim issued — ${claim!.noticeClause ?? ""} (${claim!.ref}/NOC-001)${late ? " — LATE" : ""}.`,
    );
    setTab("notices");
  }

  function completeRegistration() {
    apply(
      { stage: "Evidence & AI Analysis", status: statusForStage("Evidence & AI Analysis") },
      "Claim registration completed — register entry ACTIVE; evidence collection task created.",
    );
    setTab("documents");
  }

  function runAiAnalysis() {
    const conf = claim!.aiConfidence || 72;
    apply(
      {
        stage: "Claim Preparation",
        status: statusForStage("Claim Preparation"),
        aiAnalysisComplete: true,
        aiConfidence: conf,
      },
      `AI analysis completed — ${claim!.delayEvents.length || 0} delay event(s) mapped; entitlement confidence ${conf}%.`,
      "System",
    );
    setTab("ai");
  }

  function generateDocument() {
    apply(
      {
        stage: "Internal Review",
        status: statusForStage("Internal Review"),
        claimDocumentReady: true,
      },
      "Claim document generated (AI-assisted draft) — sent for internal review.",
    );
    setTab("review");
  }

  function decideReview(approved: boolean) {
    if (approved) {
      const approvals = defaultApprovals(claim!).map((a) => ({
        ...a,
        status: "Approved" as const,
        date: today(),
      }));
      apply(
        {
          stage: "Formal Submission",
          status: statusForStage("Formal Submission"),
          approvals,
        },
        "Internal review approved by all reviewers.",
      );
    } else {
      apply(
        { stage: "Claim Preparation", status: statusForStage("Claim Preparation") },
        "Claim returned for revision by reviewer.",
      );
      setTab("document");
    }
  }

  function submitToEngineer() {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 42);
    const responseDeadline = deadline.toISOString().slice(0, 10);
    apply(
      {
        stage: "Engineer Assessment",
        status: statusForStage("Engineer Assessment"),
        submittedDate: today(),
        responseDeadline,
      },
      `Claim submitted to Engineer — response due ${responseDeadline}.`,
    );
  }

  function logDetermination(result: ClaimOutcome) {
    const daysGranted =
      result === "Full Award" ? claim!.daysClaimed : result === "Partial Award" ? Math.round(claim!.daysClaimed * 0.6) : 0;
    apply(
      {
        outcome: result,
        status: statusForStage("Engineer Assessment", result),
        daysGranted,
      },
      `Engineer determination logged — ${result}${result !== "Rejected" && result !== "Default" ? ` (${daysGranted} days)` : ""}.`,
    );
  }

  // Critical-path timeline bounds
  const times = activities.flatMap((a) => [a.plannedStart, a.plannedEnd, a.actualStart, a.actualEnd].map((d) => +new Date(d)));
  const min = times.length ? Math.min(...times) : 0;
  const span = (times.length ? Math.max(...times) : 1) - min || 1;
  const pct = (d: string) => ((+new Date(d) - min) / span) * 100;

  const noticeLog: NoticeLogEntry[] = claim.noticeLog ?? [
    {
      id: "noc-1",
      type: "Notice of Claim",
      clause: claim.noticeClause ?? "—",
      status: claim.noticeIssued ? "Issued" : "Pending",
      direction: "Outgoing",
      dueDate: claim.noticeDeadline,
      issuedDate: claim.noticeIssuedDate,
    },
  ];
  const approvals = defaultApprovals(claim);
  const auditTrail: AuditEntry[] = claim.auditTrail ?? [];

  return (
    <>
      <Link to="/claims" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy-700 mb-4">
        <ArrowLeft className="size-4" /> Claims Register
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[26px] leading-tight font-bold text-ink tracking-tight">{claim.ref}</h1>
            <Badge tone={claimStatusTone[claim.status]} dot>{claim.status}</Badge>
            <Badge tone="neutral">Stage {STAGE_NUMBER[stage]} · {stage}</Badge>
            {claim.lateNotice && <Badge tone="error">Late notice</Badge>}
            {outcome && <Badge tone={outcome === "Rejected" || outcome === "Default" ? "error" : "success"}>{outcome}</Badge>}
          </div>
          <p className="mt-1.5 text-muted max-w-2xl">{claim.title}</p>
          <p className="text-sm text-faint">{claim.project} · {claim.contractRef} · {claim.standard}</p>
        </div>
        <div className="flex items-center gap-2">
          {step && !terminal && (
            <button className="btn btn-accent btn-sm" onClick={() => runStage(step.cta)}>
              {ctaIcon(step.cta)} {step.cta}
            </button>
          )}
          <button className="btn btn-outline btn-sm"><Download className="size-4" /> Export DOCX</button>
        </div>
      </div>

      {/* Stage progress tracker */}
      <Card className="p-4 mb-5">
        <div className="flex items-center gap-1 overflow-x-auto scroll-thin pb-1">
          {STAGES.map((s, i) => {
            const done = terminal || i < stageIdx;
            const active = !terminal && i === stageIdx;
            return (
              <div key={s} className="flex items-center shrink-0">
                <div className="flex flex-col items-center gap-1 w-[88px] text-center">
                  <span
                    className={cn(
                      "size-7 rounded-full grid place-items-center text-xs font-semibold border",
                      done && "bg-success text-white border-success",
                      active && "bg-teal-600 text-white border-teal-600",
                      !done && !active && "bg-bg text-faint border-border",
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className={cn("text-[10px] leading-tight", active ? "text-teal-700 font-semibold" : done ? "text-muted" : "text-faint")}>
                    {s}
                  </span>
                </div>
                {i < STAGES.length - 1 && <div className={cn("h-px w-4 shrink-0", done ? "bg-success" : "bg-border")} />}
              </div>
            );
          })}
        </div>
      </Card>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview", icon: FileText },
          { id: "documents", label: "Documents", icon: Paperclip, count: documents.length },
          { id: "notices", label: "Notices", icon: Forward, count: noticeLog.length },
          { id: "ai", label: "AI Analysis", icon: Brain, count: claim.delayEvents.length },
          { id: "document", label: "Claim Document", icon: FileSignature },
          { id: "review", label: "Review & Approval", icon: CheckCircle2 },
          { id: "audit", label: "Audit Trail", icon: History, count: auditTrail.length },
        ]}
      />

      <div className="pt-5">
        {/* ── Overview ── */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader title="Claim summary" />
                <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-5">
                  {claim.claimType && <Field label="Claim Type" value={claim.claimType} />}
                  {claim.priority && <Field label="Priority" value={claim.priority} />}
                  <Field label="Days Claimed" value={`${claim.daysClaimed} days`} />
                  <Field label="Days Granted" value={claim.daysGranted !== undefined ? `${claim.daysGranted} days` : "—"} />
                  <Field label="Quantum" value={formatCurrencyFull(claim.quantum)} />
                  <Field label="Owner" value={claim.owner} />
                  {claim.eventDate && <Field label="Event Date" value={formatDate(claim.eventDate)} />}
                  {claim.noticeDeadline && <Field label="Notice Deadline" value={formatDate(claim.noticeDeadline)} />}
                  <Field label="Submitted" value={formatDate(claim.submittedDate)} />
                  <Field label="Last Updated" value={formatDate(claim.updatedDate)} />
                </div>
              </Card>
              <Card>
                <CardHeader title="Causation narrative" subtitle="AI-generated, grounded in cited records" />
                <p className="p-5 text-sm text-ink leading-relaxed">{claim.causationSummary || "—"}</p>
              </Card>
              <Card>
                <CardHeader title="Relief sought" />
                <p className="p-5 text-sm text-ink leading-relaxed">{claim.reliefSought || "—"}</p>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Sparkles className="size-4 text-amber-500" /> AI entitlement confidence
                </div>
                <p className="mt-3 text-3xl font-bold font-display tabular-nums" style={{ color: confColor }}>{claim.aiConfidence}%</p>
                <div className="mt-2 h-2 rounded-full bg-navy-100 overflow-hidden">
                  <div className="h-2 rounded-full" style={{ width: `${claim.aiConfidence}%`, backgroundColor: confColor }} />
                </div>
                <p className="mt-3 text-xs text-muted">Likelihood of entitlement based on clause analysis, causation strength and notice compliance.</p>
              </Card>
              <Card>
                <CardHeader title="Contractual entitlement" />
                <div className="p-5">
                  <FileText className="size-5 text-navy-500 mb-2" />
                  <p className="text-sm font-medium text-ink">{claim.entitlementClause || "—"}</p>
                  <p className="text-xs text-muted mt-2">Grounded in the {claim.standard} clause library.</p>
                </div>
              </Card>
              {claim.noticeDeadline && (
                <Card className="p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <Clock className="size-4 text-navy-500" /> Notice status
                  </div>
                  <p className="mt-2 text-sm text-ink">
                    {claim.noticeIssued
                      ? `Issued ${formatDate(claim.noticeIssuedDate)}${claim.lateNotice ? " (late)" : " — on time"}.`
                      : `Due ${formatDate(claim.noticeDeadline)} (${relativeDays(claim.noticeDeadline)}).`}
                  </p>
                  <Badge tone={noticeStatusTone[claim.noticeStatus]}>{claim.noticeStatus}</Badge>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ── Documents ── */}
        {tab === "documents" && (
          <Card className="p-5">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-ink">Document ingestion</h3>
              <p className="text-sm text-muted">Upload programmes, correspondence and site records. Each file is read by AI, which classifies it and explains what it is about and how it bears on the claim.</p>
            </div>
            <DocumentsPanel
              seed={documents}
              kind="claim"
              claimContext={{ claimRef: claim.ref, claimTitle: claim.title, standard: claim.standard }}
              onAnalyzed={onDocumentAnalyzed}
            />
          </Card>
        )}

        {/* ── Notices ── */}
        {tab === "notices" && (
          <div className="space-y-4">
            {!claim.noticeIssued && stage === "Notice of Claim" && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-sm">
                <span className="flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="size-4" />
                  Notice of Claim not yet issued{claim.noticeDeadline && ` — due ${formatDate(claim.noticeDeadline)} (${relativeDays(claim.noticeDeadline)})`}.
                </span>
                <button className="btn btn-accent btn-sm" onClick={issueNotice}><Forward className="size-4" /> Issue Notice</button>
              </div>
            )}
            <Card>
              <CardHeader title="Notice log" subtitle="Contractual notices issued and pending" />
              <ul className="divide-y divide-border">
                {noticeLog.map((n) => (
                  <li key={n.id} className="flex items-center gap-3 p-4">
                    {n.status === "Issued" ? <Forward className="size-5 text-teal-600 shrink-0" /> : <Mail className="size-5 text-faint shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium", n.status === "Issued" ? "text-ink" : "text-muted")}>{n.type} — {n.clause}</p>
                      <p className="text-xs text-faint">
                        {n.status === "Issued"
                          ? `Issued ${formatDate(n.issuedDate)}${n.ref ? ` · Ref ${n.ref}` : ""}`
                          : `Due ${formatDate(n.dueDate)}${n.dueDate ? ` (${relativeDays(n.dueDate)})` : ""}`}
                      </p>
                    </div>
                    <Badge tone="info">{n.direction}</Badge>
                    <Badge tone={n.status === "Issued" ? "success" : "neutral"}>{n.status}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
            {claim.noticeIssued && (
              <div className={cn("rounded-lg border p-3.5 flex items-center gap-2.5 text-sm", claim.lateNotice ? "border-error/30 bg-error-bg text-error" : "border-success/30 bg-success-bg text-success")}>
                {claim.lateNotice ? <AlertTriangle className="size-4.5" /> : <CheckCircle2 className="size-4.5" />}
                {claim.lateNotice
                  ? "Notice was issued after the contractual deadline — late-notice flag set."
                  : `Notice issued within the contractual window on ${formatDate(claim.noticeIssuedDate)}.`}
              </div>
            )}
          </div>
        )}

        {/* ── AI Analysis ── */}
        {tab === "ai" && (
          <div className="space-y-4">
            {!claim.aiAnalysisComplete && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-navy-50/50 p-3.5 text-sm">
                <span className="flex items-center gap-2 text-muted"><Brain className="size-4" /> AI analysis has not been run for this claim yet.</span>
                <button className="btn btn-accent btn-sm" onClick={runAiAnalysis} disabled={STAGE_NUMBER[stage] < STAGE_NUMBER["Evidence & AI Analysis"]}>
                  <Brain className="size-4" /> Run AI Analysis
                </button>
              </div>
            )}
            <Card>
              <CardHeader title="AI-identified delay events" subtitle="Auto-detected & categorised from correspondence, site records and variation orders" />
              <ul className="divide-y divide-border">
                {claim.delayEvents.length === 0 && <li className="p-5 text-sm text-muted">No delay events yet. Run AI analysis after uploading evidence.</li>}
                {claim.delayEvents.map((e) => (
                  <li key={e.id} className="p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-ink">{e.title}</p>
                          <Badge tone={causeTone[e.cause]}>{e.cause}</Badge>
                          {e.criticalPath && <span className="badge bg-error-bg text-error"><TrendingUp className="size-3" /> Critical path</span>}
                        </div>
                        <p className="text-sm text-muted mt-1.5">{e.description}</p>
                        <p className="text-xs text-faint mt-2 flex items-center gap-3">
                          <span>{formatDate(e.startDate)} → {formatDate(e.endDate)}</span>
                          <span className="flex items-center gap-1"><Paperclip className="size-3" /> {e.evidenceCount} evidence items</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-2xl font-bold font-display text-ink tabular-nums">{e.daysImpact}</p>
                          <p className="text-xs text-faint">days impact</p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button className="text-success hover:opacity-70"><Check className="size-4" /></button>
                          <button className="text-error hover:opacity-70"><X className="size-4" /></button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            {activities.length > 0 && (
              <Card>
                <CardHeader
                  title="Critical path — As-Planned vs As-Built"
                  subtitle="AI-assisted impact analysis with supporting document citations"
                  action={
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-navy-300" /> As-Planned</span>
                      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-amber-500" /> As-Built</span>
                    </div>
                  }
                />
                <div className="p-5 divide-y divide-border">
                  {activities.map((a) => {
                    const pW = Math.max(1, pct(a.plannedEnd) - pct(a.plannedStart));
                    const aW = Math.max(1, pct(a.actualEnd) - pct(a.actualStart));
                    return (
                      <div key={a.id} className="py-3.5">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-sm font-medium text-ink flex items-center gap-2">
                            {a.name}
                            {a.onCriticalPath && <span className="text-[10px] font-semibold text-error bg-error-bg rounded px-1.5 py-0.5">CRITICAL</span>}
                          </p>
                          {a.delayDays > 0 ? <Badge tone="error">+{a.delayDays}d</Badge> : <Badge tone="success">On time</Badge>}
                        </div>
                        <div className="space-y-1.5">
                          <div className="relative h-3 rounded bg-navy-50">
                            <div className="absolute h-3 rounded bg-navy-300" style={{ left: `${pct(a.plannedStart)}%`, width: `${pW}%` }} />
                          </div>
                          <div className="relative h-3 rounded bg-navy-50">
                            <div className="absolute h-3 rounded" style={{ left: `${pct(a.actualStart)}%`, width: `${aW}%`, backgroundColor: a.delayDays > 0 ? "#e8920c" : "#18794e" }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {claim.aiAnalysisComplete && (
              <Card>
                <CardHeader title="AI quantum estimate" subtitle="Indicative breakdown of the prolongation claim" />
                <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <Field label="Prelim / Site Overheads" value={formatCurrencyFull(Math.round(claim.quantum * 0.6))} />
                  <Field label="Loss of Productivity" value={formatCurrencyFull(Math.round(claim.quantum * 0.25))} />
                  <Field label="Finance Charges" value={formatCurrencyFull(Math.round(claim.quantum * 0.15))} />
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ── Claim Document (a.k.a. Claim Draft) ── */}
        {tab === "document" && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-base font-semibold text-ink">EOT Claim — {claim.ref}</h3>
                <p className="text-xs text-muted">Structured draft · {claim.standard} · clause-cited</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn btn-outline btn-sm"><RefreshCw className="size-4" /> Regenerate</button>
                <button className="btn btn-outline btn-sm"><Download className="size-4" /> DOCX</button>
                <button className="btn btn-accent btn-sm"><Download className="size-4" /> PDF</button>
              </div>
            </div>

            {!claim.claimDocumentReady ? (
              <div className="p-10 text-center">
                <FileSignature className="size-8 text-faint mx-auto mb-3" />
                <p className="text-sm text-muted">The claim document has not been generated yet.</p>
                <button className="btn btn-accent btn-sm mt-4 inline-flex" onClick={generateDocument} disabled={STAGE_NUMBER[stage] < STAGE_NUMBER["Claim Preparation"]}>
                  <Sparkles className="size-4" /> Generate Claim Document
                </button>
              </div>
            ) : (
              <div className="p-6 sm:p-8 max-w-3xl space-y-7">
                <DraftSection n={1} title="Event Description">
                  <p>The Contractor was delayed by the following event(s) on the Works at {claim.project}:</p>
                  {claim.delayEvents.length ? (
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      {claim.delayEvents.map((e) => (
                        <li key={e.id}>{e.title} ({formatDate(e.startDate)} – {formatDate(e.endDate)}, {e.daysImpact} days, {e.cause.toLowerCase()}).</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1">{claim.causationSummary}</p>
                  )}
                </DraftSection>
                <DraftSection n={2} title="Contractual Entitlement">
                  <p>Entitlement is claimed under <strong>{claim.entitlementClause || claim.noticeClause}</strong> of the {claim.standard}. <Cite>{claim.standard}</Cite></p>
                </DraftSection>
                <DraftSection n={3} title="Causation">
                  <p>{claim.causationSummary}</p>
                </DraftSection>
                <DraftSection n={4} title="Programme Impact">
                  <p>An As-Planned vs As-Built analysis demonstrates a net critical-path delay of <strong>{claim.daysClaimed} calendar days</strong>. <Cite>programme.xml</Cite></p>
                </DraftSection>
                <DraftSection n={5} title="Supporting Evidence">
                  <p>This claim is substantiated by the following ingested records:</p>
                  {claim.analyzedDocuments?.length ? (
                    <ul className="mt-2 space-y-2">
                      {claim.analyzedDocuments.map((d) => (
                        <li key={d.name} className="text-sm">
                          <span className="font-medium text-ink">{d.name}</span>
                          {" — "}
                          <span className="text-navy-600 font-medium">{d.documentType}</span>
                          <span className="text-muted">: {d.summary}</span>
                          {d.supportsEot && <span className="badge bg-success-bg text-success ml-1.5 align-middle">Supports EOT</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {documents.slice(0, 6).map((d) => <Cite key={d.id}>{d.name}</Cite>)}
                    </div>
                  )}
                </DraftSection>
                <DraftSection n={6} title="Relief Sought">
                  <p>{claim.reliefSought}</p>
                </DraftSection>
              </div>
            )}
          </Card>
        )}

        {/* ── Review & Approval ── */}
        {tab === "review" && (
          <div className="space-y-4">
            <Card>
              <CardHeader
                title="Internal approval status"
                subtitle="Claims manager, legal and commercial sign-off"
                action={<Badge tone={claimStatusTone[claim.status]}>{claim.status}</Badge>}
              />
              <ul className="divide-y divide-border">
                {approvals.map((a) => (
                  <li key={a.role} className="flex items-center gap-3 p-4">
                    <Avatar name={a.name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink">{a.name}</p>
                      <p className="text-xs text-faint">{a.role}{a.note ? ` · ${a.note}` : ""}</p>
                    </div>
                    <div className="text-right">
                      <Badge tone={a.status === "Approved" ? "success" : a.status === "Returned" ? "error" : "neutral"}>{a.status}</Badge>
                      {a.date && <p className="text-xs text-faint mt-1">{formatDate(a.date)}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
            {stage === "Internal Review" && (
              <div className="flex items-center gap-2">
                <button className="btn btn-primary btn-sm" onClick={() => decideReview(true)}><Check className="size-4" /> Approve &amp; Submit</button>
                <button className="btn btn-outline btn-sm" onClick={() => decideReview(false)}><RefreshCw className="size-4" /> Return for Revision</button>
              </div>
            )}
          </div>
        )}

        {/* ── Audit Trail ── */}
        {tab === "audit" && (
          <Card>
            <CardHeader title={`Audit trail — ${claim.ref}`} subtitle="Every stage transition and key action, time-stamped" action={<button className="btn btn-outline btn-sm"><Download className="size-4" /> Export CSV</button>} />
            <ul className="divide-y divide-border">
              {auditTrail.length === 0 && <li className="p-5 text-sm text-muted">No audit entries recorded yet.</li>}
              {auditTrail.map((a) => (
                <li key={a.id} className="flex gap-4 p-4">
                  <span className="text-xs text-faint font-mono whitespace-nowrap min-w-[140px]">{formatDateTime(a.at)}</span>
                  <span className="text-sm text-ink"><strong className="font-semibold">{a.actor}:</strong> {a.action}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* Engineer Assessment — determination panel */}
      {stage === "Engineer Assessment" && !terminal && (
        <Card className="p-5 mt-5 border-teal-300">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Engineer assessment in progress</p>
              <p className="text-xs text-muted">
                Submitted {formatDate(claim.submittedDate)}{claim.responseDeadline && ` · response due ${formatDate(claim.responseDeadline)} (${relativeDays(claim.responseDeadline)})`}. Log the determination once received.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {OUTCOMES.map((o) => (
                <button
                  key={o}
                  className={cn("btn btn-sm", o === "Rejected" || o === "Default" ? "btn-outline" : "btn-primary")}
                  onClick={() => logDetermination(o)}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}
    </>
  );

  // ── Dispatch the header CTA to the right handler ──
  function runStage(cta: string) {
    if (cta.startsWith("Issue Notice")) return issueNotice();
    if (cta.startsWith("Complete Registration")) return completeRegistration();
    if (cta.startsWith("Run AI")) return runAiAnalysis();
    if (cta.startsWith("Generate")) return generateDocument();
    if (cta.startsWith("Approve")) return setTab("review");
    if (cta.startsWith("Submit")) return submitToEngineer();
  }
}

function ctaIcon(cta: string) {
  if (cta.startsWith("Issue Notice")) return <Forward className="size-4" />;
  if (cta.startsWith("Run AI")) return <Brain className="size-4" />;
  if (cta.startsWith("Generate")) return <Sparkles className="size-4" />;
  if (cta.startsWith("Approve")) return <CheckCircle2 className="size-4" />;
  if (cta.startsWith("Submit")) return <Send className="size-4" />;
  return <Activity className="size-4" />;
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return <div className="size-8 rounded-full bg-navy-100 text-navy-700 grid place-items-center text-xs font-semibold shrink-0">{initials}</div>;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${formatDate(iso)} ${d.toTimeString().slice(0, 5)}`;
  } catch {
    return iso;
  }
}

function DraftSection({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className={cn("text-sm font-bold font-display text-navy-900 uppercase tracking-wide mb-2")}>{n}. {title}</h4>
      <div className="text-sm text-ink leading-relaxed">{children}</div>
    </section>
  );
}
