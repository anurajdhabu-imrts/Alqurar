import { useMemo, useState } from "react";
import { BookText, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AddClauseModal } from "@/components/clauses/AddClauseModal";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/api/client";
import { useClausesQuery, useDeleteClause } from "@/hooks/useClauses";
import { useHasPermission } from "@/hooks/usePermission";
import { clauseBooks } from "@/mock/clauses";
import type { ClauseRef } from "@/types";

export function ClauseLibraryPage() {
  const [query, setQuery] = useState("");
  const [book, setBook] = useState<string>("All");

  // Adding/editing/removing clauses is a contract-management action; everyone
  // else sees a read-only library.
  const canManage = useHasPermission("contracts.manage");

  const { data: clauses, isLoading, isError, error } = useClausesQuery();
  const deleteClause = useDeleteClause();

  const [showAdd, setShowAdd] = useState(false);
  const [editClause, setEditClause] = useState<ClauseRef | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClauseRef | null>(null);

  const library = clauses ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return library.filter((c) => {
      const matchesBook = book === "All" || c.book === book;
      const matchesQuery =
        !q ||
        c.clause.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q));
      return matchesBook && matchesQuery;
    });
  }, [query, book, library]);

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteClause.mutate(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <>
      <PageHeader
        title="Clause Reference Library"
        subtitle="FIDIC 1999 / 2017 (Red, Yellow, Silver) and NEC4 — the grounding source for every AI clause citation."
        actions={
          canManage ? (
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
              <Plus className="size-4" /> Add New Clause
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
          <input className="input pl-9" placeholder="Search clauses, topics or tags…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["All", ...clauseBooks] as string[]).map((b) => (
            <button
              key={b}
              onClick={() => setBook(b)}
              className={cn(
                "px-3 h-9 rounded-lg text-sm font-medium transition-colors",
                book === b ? "bg-navy-900 text-white" : "bg-card border border-border text-muted hover:text-ink hover:border-navy-300",
              )}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-muted inline-flex items-center gap-2 justify-center w-full">
          <Loader2 className="size-4 animate-spin" /> Loading clauses…
        </div>
      ) : isError ? (
        <p className="py-16 text-center text-error">{apiErrorMessage(error, "Could not load the clause library.")}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((c) => (
            <Card key={c.id} className="card-hover p-5 relative group">
              {/* Manager-only actions — hover-revealed so the resting card is unchanged. */}
              {canManage && (
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 rounded-lg">
                  <button
                    className="btn btn-ghost px-2"
                    title="Edit clause"
                    aria-label={`Edit clause ${c.clause}`}
                    onClick={() => setEditClause(c)}
                  >
                    <Pencil className="size-4 text-navy-700" />
                  </button>
                  <button
                    className="btn btn-ghost px-2"
                    title="Delete clause"
                    aria-label={`Delete clause ${c.clause}`}
                    onClick={() => setDeleteTarget(c)}
                  >
                    <Trash2 className="size-4 text-error" />
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="badge bg-navy-50 text-navy-700"><BookText className="size-3" /> {c.book}</span>
                <span className="text-xs font-bold text-faint tabular-nums">Clause {c.clause}</span>
              </div>
              <h3 className="mt-2.5 font-semibold text-ink">{c.title}</h3>
              <p className="mt-1 text-sm text-muted">{c.summary}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.tags.map((t) => (
                  <span key={t} className="text-[11px] font-medium text-muted bg-navy-50 rounded px-2 py-0.5">#{t}</span>
                ))}
              </div>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-center text-muted py-12">No clauses match your search.</p>
          )}
        </div>
      )}

      {showAdd && <AddClauseModal onClose={() => setShowAdd(false)} />}
      {editClause && <AddClauseModal clause={editClause} onClose={() => setEditClause(null)} />}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete clause"
        message={`Delete Clause ${deleteTarget?.clause ?? ""} — ${deleteTarget?.title ?? "this clause"}? This removes it from the library.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
