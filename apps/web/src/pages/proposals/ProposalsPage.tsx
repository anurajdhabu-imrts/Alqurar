import { useMemo, useState, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, Check, CheckCircle2, FileSignature, Loader2, Plus, Search, Send, Trash2, UserPlus, Users, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { AssignClientsModal } from "@/components/projects/AssignClientsModal";
import { useProjectClients } from "@/hooks/useAssignments";
import { useClientProposal, useSendToClient } from "@/hooks/useClientProposal";
import { useAllProposals, useConvertProposal, useDeleteProject, type ProjectDetails } from "@/store/projects";
import { formatDate } from "@/lib/utils";

type Decision = "confirmed" | "rejected";
type Tab = "all" | "confirmed" | "rejected";

const DECISIONS_KEY = "proposalDecisions";
// Maps a confirmed proposal's id → the id of the project created from it, so we
// never create a second project on a repeat click and can link straight to it.
const CONVERSIONS_KEY = "proposalConversions";

function loadDecisions(): Record<string, Decision> {
  try {
    return JSON.parse(localStorage.getItem(DECISIONS_KEY) || "{}");
  } catch {
    return {};
  }
}

function loadConversions(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CONVERSIONS_KEY) || "{}");
  } catch {
    return {};
  }
}

function ProposalCard({
  proposal,
  decision,
  converting,
  convertedProjectId,
  convertError,
  onConfirm,
  onReject,
  onOpen,
  onOpenProject,
  onAssign,
  onDelete,
}: {
  proposal: ProjectDetails;
  decision?: Decision;
  converting: boolean;
  convertedProjectId?: string;
  convertError?: string;
  onConfirm: () => void;
  onReject: () => void;
  onOpen: () => void;
  onOpenProject: () => void;
  onAssign: () => void;
  onDelete: () => void;
}) {
  const { data: clientIds } = useProjectClients(proposal.id);
  const { data: clientProposal } = useClientProposal(proposal.id);
  const sendToClient = useSendToClient(proposal.id);
  const count = clientIds?.length ?? 0;
  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  const isDone = clientProposal?.status === "done";
  const isSent = clientProposal?.sentToClient === true;
  const [justSent, setJustSent] = useState(false);

  function handleSend() {
    sendToClient.mutate(undefined, {
      onSuccess: () => setJustSent(true),
    });
  }

  return (
    <Card className="p-5 card-hover cursor-pointer" onClick={onOpen}>
      <div className="flex items-start justify-between gap-3">
        <span className="size-10 rounded-xl bg-linear-to-br from-navy-700 to-navy-900 text-amber-400 grid place-items-center font-bold shrink-0">
          <FileSignature className="size-5" />
        </span>
        <button
          className="btn btn-ghost px-1.5 h-7 text-error hover:bg-error-bg"
          onClick={stop(onDelete)}
          title="Delete proposal"
          aria-label="Delete proposal"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <h3 className="mt-3 font-semibold text-ink leading-snug">{proposal.name}</h3>
      <p className="text-xs text-muted mt-0.5">{proposal.code}{proposal.standard ? ` · ${proposal.standard}` : ""}</p>

      <div className="mt-3 space-y-1.5 text-xs text-muted">
        <p className="flex items-center gap-1.5">
          <Building2 className="size-3.5 text-faint" /> {proposal.employer || "—"}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
        <span className="text-xs text-faint">
          {proposal.createdAt ? `Created ${formatDate(proposal.createdAt)}` : "—"}
        </span>
        <div className="flex items-center gap-2">
          {isSent && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success-bg rounded-full px-2 py-0.5">
              <CheckCircle2 className="size-3" /> Sent
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Users className="size-3.5 text-faint" />
            {count} client{count === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {justSent && !sendToClient.isPending && (
        <div className="mt-3 flex justify-end">
          <span className="text-xs text-success inline-flex items-center gap-1">
            <CheckCircle2 className="size-3.5" /> Sent!
          </span>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className="btn btn-outline btn-sm" onClick={stop(onAssign)}>
          <UserPlus className="size-3.5" /> Assign
        </button>
        <button className="btn btn-primary btn-sm" onClick={stop(onOpen)}>
          Open <ArrowRight className="size-3.5" />
        </button>

        {isDone && !isSent && (
          <button
            className="btn btn-outline btn-sm col-span-2 text-navy-700 border-navy-200 hover:bg-navy-50"
            onClick={stop(handleSend)}
            disabled={sendToClient.isPending}
          >
            {sendToClient.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Send to Client
          </button>
        )}

        {convertedProjectId ? (
          <>
            <div className="col-span-2 flex items-center gap-1.5 text-xs font-medium text-success">
              <CheckCircle2 className="size-3.5" /> Confirmed — copied to Projects
            </div>
            <button className="btn btn-primary btn-sm col-span-2" onClick={stop(onOpenProject)}>
              Open project <ArrowRight className="size-3.5" />
            </button>
          </>
        ) : converting ? (
          <button className="btn btn-outline btn-sm col-span-2" disabled>
            <Loader2 className="size-3.5 animate-spin" /> Confirming…
          </button>
        ) : (
          <>
            <button
              className="btn btn-sm btn-outline text-success border-success/30 hover:bg-success-bg"
              onClick={stop(onConfirm)}
            >
              <Check className="size-3.5" /> Confirm
            </button>
            <button
              className={`btn btn-sm ${decision === "rejected" ? "btn-primary bg-error border-error" : "btn-outline text-error border-error/30 hover:bg-error-bg"}`}
              onClick={stop(onReject)}
            >
              <X className="size-3.5" /> Reject
            </button>
          </>
        )}

        {convertError && (
          <p className="col-span-2 text-xs text-error">{convertError}</p>
        )}
      </div>
    </Card>
  );
}

export function ProposalsPage() {
  const navigate = useNavigate();
  const proposals = useAllProposals();
  const deleteProposal = useDeleteProject();
  const convert = useConvertProposal();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [decisions, setDecisions] = useState<Record<string, Decision>>(loadDecisions);
  const [conversions, setConversions] = useState<Record<string, string>>(loadConversions);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertErrors, setConvertErrors] = useState<Record<string, string>>({});
  const [assignTarget, setAssignTarget] = useState<ProjectDetails | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectDetails | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ProjectDetails | null>(null);

  function writeDecisions(updater: (prev: Record<string, Decision>) => Record<string, Decision>) {
    setDecisions((prev) => {
      const updated = updater(prev);
      localStorage.setItem(DECISIONS_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  function toggleReject(id: string) {
    writeDecisions((prev) => {
      const updated = { ...prev };
      if (updated[id] === "rejected") delete updated[id];
      else updated[id] = "rejected";
      return updated;
    });
  }

  function handleConfirm(p: ProjectDetails) {
    // Already converted → just open the project we created earlier.
    const existing = conversions[p.id];
    if (existing) {
      navigate(`/projects/${existing}`);
      return;
    }
    if (convertingId) return; // one conversion at a time
    // Ask before creating the project.
    setConfirmTarget(p);
  }

  function runConvert(p: ProjectDetails) {
    setConfirmTarget(null);
    if (conversions[p.id] || convertingId) return;
    const stamp = Date.now();
    const newId = `p-${stamp}`;
    const newCode = `PRJ-${new Date().getFullYear()}-${String(stamp).slice(-4)}`;
    setConvertErrors((e) => {
      const { [p.id]: _removed, ...rest } = e;
      return rest;
    });
    setConvertingId(p.id);
    convert.mutate(
      { proposalId: p.id, newId, newCode },
      {
        onSuccess: (created) => {
          setConversions((prev) => {
            const updated = { ...prev, [p.id]: created.id };
            localStorage.setItem(CONVERSIONS_KEY, JSON.stringify(updated));
            return updated;
          });
          writeDecisions((prev) => ({ ...prev, [p.id]: "confirmed" }));
        },
        onError: () =>
          setConvertErrors((e) => ({ ...e, [p.id]: "Couldn't create the project. Please try again." })),
        onSettled: () => setConvertingId(null),
      },
    );
  }

  const counts = useMemo(() => {
    let confirmed = 0;
    let rejected = 0;
    for (const p of proposals) {
      if (decisions[p.id] === "confirmed") confirmed++;
      else if (decisions[p.id] === "rejected") rejected++;
    }
    return { all: proposals.length, confirmed, rejected };
  }, [proposals, decisions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return proposals.filter((p) => {
      if (tab === "confirmed" && decisions[p.id] !== "confirmed") return false;
      if (tab === "rejected" && decisions[p.id] !== "rejected") return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.employer.toLowerCase().includes(q)
      );
    });
  }, [proposals, query, tab, decisions]);

  return (
    <>
      <PageHeader
        title="Proposals"
        subtitle="Draft, manage and track proposals. Each proposal takes the client's documents, identifies the delay events with AI, and produces a costed proposal."
        actions={
          <Link to="/proposals/new" className="btn btn-primary">
            <Plus className="size-4" /> New proposal
          </Link>
        }
      />

      <div className="flex items-center gap-1 mb-4 border-b border-border">
        {([
          { key: "all", label: "All Proposals", count: counts.all },
          { key: "confirmed", label: "Confirmed", count: counts.confirmed },
          { key: "rejected", label: "Rejected", count: counts.rejected },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-navy-700 text-navy-700"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-faint">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
          <input
            className="input pl-9"
            placeholder="Search proposals…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="text-sm text-muted ml-auto">
          {filtered.length} of {proposals.length} proposals
        </span>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <div className="px-5 py-16 text-center">
            <FileSignature className="size-8 text-faint mx-auto mb-3" />
            <p className="text-sm text-muted">
              {proposals.length === 0
                ? "No proposals yet. Click “New proposal” to create one."
                : tab === "confirmed"
                  ? "No confirmed proposals yet."
                  : tab === "rejected"
                    ? "No rejected proposals yet."
                    : "No proposals match your search."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              decision={decisions[p.id]}
              converting={convertingId === p.id}
              convertedProjectId={conversions[p.id]}
              convertError={convertErrors[p.id]}
              onConfirm={() => handleConfirm(p)}
              onReject={() => toggleReject(p.id)}
              onOpen={() => navigate(`/proposals/${p.id}`)}
              onOpenProject={() => conversions[p.id] && navigate(`/projects/${conversions[p.id]}`)}
              onAssign={() => setAssignTarget(p)}
              onDelete={() => setDeleteTarget(p)}
            />
          ))}
        </div>
      )}

      {assignTarget && (
        <AssignClientsModal project={assignTarget} onClose={() => setAssignTarget(null)} />
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        variant="primary"
        title="Confirm proposal?"
        message={
          confirmTarget
            ? `“${confirmTarget.name}” will be copied into a new project — its documents, delay events, clauses and EOT report carry over. The proposal itself stays here.`
            : ""
        }
        confirmLabel="Confirm & create project"
        onConfirm={() => confirmTarget && runConvert(confirmTarget)}
        onCancel={() => setConfirmTarget(null)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete proposal?"
        message={deleteTarget ? `“${deleteTarget.name}” will be permanently removed. This can't be undone.` : ""}
        confirmLabel="Delete proposal"
        onConfirm={() => {
          if (deleteTarget) deleteProposal.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
