import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookText,
  CheckCircle2,
  FileUp,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AddProjectClauseModal } from "@/components/projects/AddProjectClauseModal";
import { apiErrorMessage } from "@/api/client";
import {
  useDeleteProjectClause,
  useExtractProjectClauses,
  useProjectClausesQuery,
} from "@/hooks/useProjectClauses";
import { useHasPermission } from "@/hooks/usePermission";
import type { ClauseRef } from "@/types";

/**
 * Per-project Clause Library tab.
 *
 * Each project keeps its OWN clauses, built from that project's contract. The
 * analyst uploads the contract (AI extraction is on hold until the Anthropic key
 * is enabled) and/or adds clauses by hand. Later, delay events for this project
 * are matched against these clauses.
 */
export function ClauseLibraryTab({
  projectId,
  projectStandard,
}: {
  projectId: string;
  projectStandard?: string;
}) {
  const canManage = useHasPermission("contracts.manage");

  const { data: clauses, isLoading, isError, error } = useProjectClausesQuery(projectId);
  const deleteClause = useDeleteProjectClause(projectId);
  const extract = useExtractProjectClauses(projectId);

  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editClause, setEditClause] = useState<ClauseRef | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClauseRef | null>(null);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadErr, setUploadErr] = useState("");

  const library = useMemo(() => clauses ?? [], [clauses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return library;
    return library.filter(
      (c) =>
        c.clause.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.book.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [query, library]);

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteClause.mutate(deleteTarget.id);
    setDeleteTarget(null);
  }

  async function onPickContract(file: File | undefined) {
    if (!file) return;
    setUploadMsg("");
    setUploadErr("");
    try {
      const res = await extract.mutateAsync(file);
      setUploadMsg(res.message);
    } catch (err) {
      setUploadErr(apiErrorMessage(err, "Could not upload the contract."));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Contract upload / AI extraction ── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h3 className="text-base font-semibold text-ink inline-flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500" /> Build this project's clause library
            </h3>
            <p className="text-sm text-muted mt-1">
              Upload this project's contract (e.g. the FIDIC conditions). AI will read it and extract the
              clauses that apply to this project — saved here only. Delay events are then matched against
              these clauses.
            </p>
          </div>
          {canManage && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                className="btn btn-outline"
                onClick={() => fileRef.current?.click()}
                disabled={extract.isPending}
              >
                {extract.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
                {extract.isPending ? "Uploading…" : "Upload contract"}
              </button>
              <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
                <Plus className="size-4" /> Add clause
              </button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => onPickContract(e.target.files?.[0])}
          />
        </div>

        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-md px-2.5 py-1">
          <AlertTriangle className="size-3.5" /> AI extraction coming soon — the contract is saved now and
          clauses can be added by hand in the meantime.
        </p>

        {uploadMsg && (
          <p className="mt-3 text-sm text-success bg-success-bg rounded-md px-3 py-2 inline-flex items-center gap-2">
            <CheckCircle2 className="size-4" /> {uploadMsg}
          </p>
        )}
        {uploadErr && (
          <p className="mt-3 text-sm text-error bg-error-bg rounded-md px-3 py-2 inline-flex items-center gap-2">
            <AlertTriangle className="size-4" /> {uploadErr}
          </p>
        )}
      </Card>

      {/* ── Search ── */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
        <input
          className="input pl-9"
          placeholder="Search this project's clauses…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* ── Clause list ── */}
      {isLoading ? (
        <div className="py-16 text-center text-muted inline-flex items-center gap-2 justify-center w-full">
          <Loader2 className="size-4 animate-spin" /> Loading clauses…
        </div>
      ) : isError ? (
        <p className="py-16 text-center text-error">
          {apiErrorMessage(error, "Could not load this project's clauses.")}
        </p>
      ) : library.length === 0 ? (
        <Card className="p-10 text-center">
          <span className="size-12 mx-auto rounded-xl bg-navy-50 text-navy-600 grid place-items-center">
            <BookText className="size-6" />
          </span>
          <h3 className="mt-3 font-semibold text-ink">No clauses yet</h3>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            Upload this project's contract or add a clause by hand to start building its library.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((c) => (
            <Card key={c.id} className="card-hover p-5 relative group">
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

      {showAdd && (
        <AddProjectClauseModal
          projectId={projectId}
          projectStandard={projectStandard}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editClause && (
        <AddProjectClauseModal
          projectId={projectId}
          projectStandard={projectStandard}
          clause={editClause}
          onClose={() => setEditClause(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete clause"
        message={`Delete Clause ${deleteTarget?.clause ?? ""} — ${deleteTarget?.title ?? "this clause"}? This removes it from the project's library.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
