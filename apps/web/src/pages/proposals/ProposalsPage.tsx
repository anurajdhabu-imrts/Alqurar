import { useMemo, useState, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, FileSignature, Plus, Search, Trash2, UserPlus, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { AssignClientsModal } from "@/components/projects/AssignClientsModal";
import { useProjectClients } from "@/hooks/useAssignments";
import { useAllProposals, useDeleteProject, type ProjectDetails } from "@/store/projects";
import { formatDate } from "@/lib/utils";

function ProposalCard({
  proposal,
  onOpen,
  onAssign,
  onDelete,
}: {
  proposal: ProjectDetails;
  onOpen: () => void;
  onAssign: () => void;
  onDelete: () => void;
}) {
  const { data: clientIds } = useProjectClients(proposal.id);
  const count = clientIds?.length ?? 0;
  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };

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
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <Users className="size-3.5 text-faint" />
          {count} client{count === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button className="btn btn-outline btn-sm" onClick={stop(onAssign)}>
          <UserPlus className="size-3.5" /> Assign
        </button>
        <button className="btn btn-primary btn-sm" onClick={stop(onOpen)}>
          Open <ArrowRight className="size-3.5" />
        </button>
      </div>
    </Card>
  );
}

export function ProposalsPage() {
  const navigate = useNavigate();
  const proposals = useAllProposals();
  const deleteProposal = useDeleteProject();
  const [query, setQuery] = useState("");
  const [assignTarget, setAssignTarget] = useState<ProjectDetails | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectDetails | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return proposals;
    return proposals.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.employer.toLowerCase().includes(q),
    );
  }, [proposals, query]);

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
              onOpen={() => navigate(`/proposals/${p.id}`)}
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
