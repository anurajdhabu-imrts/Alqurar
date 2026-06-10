import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Filter, Pencil, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EditClaimModal } from "@/components/claims/EditClaimModal";
import { AddClientModal } from "@/components/claims/AddClientModal";
import { claimStatusTone, noticeStatusTone } from "@/lib/status";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useHasPermission } from "@/hooks/usePermission";
import { deleteClaim, eotClaims } from "@/mock/data";
import { getProjectByName } from "@/mock/clientData";
import type { ClaimStatus, EOTClaim } from "@/types";

const STATUSES: (ClaimStatus | "All")[] = [
  "All",
  "Draft",
  "In Review",
  "Submitted",
  "Under Assessment",
  "Granted",
  "Rejected",
];

const PAGE_SIZE = 8;

export function EOTClaimsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ClaimStatus | "All">("All");
  const [page, setPage] = useState(1);
  // Bumped after a mutate/delete so the table re-reads the live register array.
  const [tick, setTick] = useState(0);

  const canEdit = useHasPermission("claims.create");
  const canDelete = useHasPermission("claims.delete");
  const canAssign = useHasPermission("claims.assign_client");
  const showActions = canEdit || canDelete || canAssign;

  const [editClaim, setEditClaim] = useState<EOTClaim | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EOTClaim | null>(null);
  const [assignClaim, setAssignClaim] = useState<EOTClaim | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return eotClaims.filter((c) => {
      const matchesStatus = status === "All" || c.status === status;
      const matchesQuery =
        !q ||
        c.ref.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.project.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status, tick]);

  // Pagination — clamp the current page so deletes/filters can't strand it.
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const paged = filtered.slice(start, start + PAGE_SIZE);

  const assignProject = assignClaim ? getProjectByName(assignClaim.project) : undefined;

  function confirmDelete() {
    if (deleteTarget) {
      deleteClaim(deleteTarget.ref);
      setDeleteTarget(null);
      setTick((t) => t + 1);
    }
  }

  const colCount = showActions ? 8 : 7;

  return (
    <>
      <PageHeader
        title="EOT Claims Register"
        subtitle="Extension of Time claims across the portfolio, with entitlement, programme impact and notice compliance."
        actions={
          <Link to="/claims/new" className="btn btn-primary">
            <Plus className="size-4" /> New EOT Claim
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
          <input
            className="input pl-9"
            placeholder="Search by ref, title or project…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted" />
          <select className="input w-auto pr-8" value={status} onChange={(e) => { setStatus(e.target.value as ClaimStatus | "All"); setPage(1); }}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>
            ))}
          </select>
        </div>
        <span className="text-sm text-muted ml-auto">{filtered.length} of {eotClaims.length} claims</span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-faint border-b border-border bg-navy-50/40">
                <th className="font-semibold px-5 py-3">Claim</th>
                <th className="font-semibold px-3 py-3">Standard</th>
                <th className="font-semibold px-3 py-3">Status</th>
                <th className="font-semibold px-3 py-3">Notice</th>
                <th className="font-semibold px-3 py-3 text-right">Days</th>
                <th className="font-semibold px-3 py-3 text-right">Quantum</th>
                <th className="font-semibold px-5 py-3 text-right">Updated</th>
                {showActions && <th className="font-semibold px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {paged.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-navy-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <Link to={`/claims/${c.ref}`} className="font-semibold text-ink hover:text-navy-700">{c.ref}</Link>
                    <p className="text-xs text-muted truncate max-w-[300px]">{c.title}</p>
                    <p className="text-xs text-faint truncate max-w-[300px]">{c.project}</p>
                  </td>
                  <td className="px-3 py-3 text-muted whitespace-nowrap">{c.standard}</td>
                  <td className="px-3 py-3"><Badge tone={claimStatusTone[c.status]} dot>{c.status}</Badge></td>
                  <td className="px-3 py-3"><Badge tone={noticeStatusTone[c.noticeStatus]}>{c.noticeStatus}</Badge></td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <span className="text-ink font-medium">{c.daysClaimed}</span>
                    {c.daysGranted !== undefined && (
                      <span className="text-faint"> / {c.daysGranted}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium text-ink">{formatCurrency(c.quantum)}</td>
                  <td className="px-5 py-3 text-right text-muted whitespace-nowrap">{formatDate(c.updatedDate)}</td>
                  {showActions && (
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <button
                            className="btn btn-ghost px-2"
                            title="Edit claim"
                            aria-label={`Edit ${c.ref}`}
                            onClick={() => setEditClaim(c)}
                          >
                            <Pencil className="size-4 text-navy-700" />
                          </button>
                        )}
                        {canAssign && (
                          <button
                            className="btn btn-ghost px-2"
                            title="Assign client"
                            aria-label={`Assign client to ${c.ref}`}
                            onClick={() => setAssignClaim(c)}
                          >
                            <UserPlus className="size-4 text-navy-700" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className="btn btn-ghost px-2"
                            title="Delete claim"
                            aria-label={`Delete ${c.ref}`}
                            onClick={() => setDeleteTarget(c)}
                          >
                            <Trash2 className="size-4 text-error" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="px-5 py-12 text-center text-muted">No claims match your filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-border">
            <p className="text-xs text-muted">
              Showing <span className="font-medium text-ink">{start + 1}–{start + paged.length}</span> of{" "}
              <span className="font-medium text-ink">{filtered.length}</span>
            </p>
            <div className="flex items-center gap-1">
              <button
                className="btn btn-ghost px-2 disabled:opacity-40"
                onClick={() => setPage(current - 1)}
                disabled={current <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </button>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  aria-current={n === current ? "page" : undefined}
                  className={cn(
                    "min-w-8 h-8 px-2 rounded-lg text-sm font-medium transition-colors",
                    n === current ? "bg-navy-900 text-white" : "text-muted hover:bg-navy-50 hover:text-navy-900",
                  )}
                >
                  {n}
                </button>
              ))}
              <button
                className="btn btn-ghost px-2 disabled:opacity-40"
                onClick={() => setPage(current + 1)}
                disabled={current >= pageCount}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {editClaim && (
        <EditClaimModal
          claim={editClaim}
          onClose={() => setEditClaim(null)}
          onSaved={() => setTick((t) => t + 1)}
        />
      )}

      {assignClaim && assignProject && (
        <AddClientModal claim={assignClaim} project={assignProject} onClose={() => setAssignClaim(null)} />
      )}

      {assignClaim && !assignProject && (
        <ConfirmDialog
          open
          title="No linked project"
          message={`This claim's project "${assignClaim.project}" isn't in the project register, so a client can't be assigned to it.`}
          confirmLabel="OK"
          onConfirm={() => setAssignClaim(null)}
          onCancel={() => setAssignClaim(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete claim"
        message={`Delete ${deleteTarget?.ref ?? "this claim"}? This removes it from the register and cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
