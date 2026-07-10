import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  BookUp,
  Filter,
  Library,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { BookStatusBadge } from "@/components/knowledge/BookStatusBadge";
import { UploadBookModal } from "@/components/knowledge/UploadBookModal";
import {
  useBooksQuery,
  useClauseSearch,
  useDeleteBook,
  useReextractBook,
} from "@/hooks/useKnowledge";
import { useHasPermission } from "@/hooks/usePermission";
import { formatDate } from "@/lib/utils";
import type { ContractBook } from "@/api/knowledge";

/** Progress bar shown while Claude reads a book chunk by chunk. */
function ExtractionProgress({ book }: { book: ContractBook }) {
  const total = book.totalChunks || 0;
  const done = book.processedChunks || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[11px] text-muted mb-1">
        <span>{total > 0 ? `Reading section ${Math.min(done + 1, total)} of ${total}` : "Preparing…"}</span>
        {total > 0 && <span className="tabular-nums">{pct}%</span>}
      </div>
      <div className="h-1.5 rounded-full bg-navy-50 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
          style={{ width: total > 0 ? `${pct}%` : "15%" }}
        />
      </div>
    </div>
  );
}

function BookCard({
  book,
  canManage,
  onDelete,
  onReextract,
  reextracting,
}: {
  book: ContractBook;
  canManage: boolean;
  onDelete: () => void;
  onReextract: () => void;
  reextracting: boolean;
}) {
  const busy = book.status === "pending" || book.status === "processing";
  return (
    <Card className="p-5 flex flex-col hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="size-10 shrink-0 rounded-xl bg-linear-to-br from-navy-700 to-navy-900 text-white grid place-items-center">
            <BookOpen className="size-5" />
          </div>
          <div className="min-w-0">
            <Link
              to={`/knowledge/${book.id}`}
              className="font-semibold text-ink hover:text-navy-700 transition-colors block truncate"
            >
              {book.name}
            </Link>
            <p className="text-xs text-muted truncate">
              {book.edition ? `${book.edition} edition` : "Edition not set"}
              {book.publisher ? ` · ${book.publisher}` : ""}
            </p>
          </div>
        </div>
        <BookStatusBadge status={book.status} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-xs">
        <div>
          <dt className="text-faint">Uploaded</dt>
          <dd className="text-ink font-medium mt-0.5">{formatDate(book.uploadedAt)}</dd>
        </div>
        <div>
          <dt className="text-faint">Clauses extracted</dt>
          <dd className="text-ink font-medium mt-0.5 tabular-nums">
            {book.status === "done" ? book.clauseCount : "—"}
          </dd>
        </div>
      </dl>

      {busy && <ExtractionProgress book={book} />}

      {book.status === "failed" && book.error && (
        <p className="mt-3 text-xs text-error bg-error-bg rounded-md px-2.5 py-2">{book.error}</p>
      )}

      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
        <Link to={`/knowledge/${book.id}`} className="btn btn-outline btn-sm">
          <BookOpen className="size-3.5" /> Open
        </Link>
        {canManage && (
          <>
            <button
              className="btn btn-ghost btn-sm px-2"
              onClick={onReextract}
              disabled={busy || reextracting}
              title="Re-run AI extraction"
              aria-label="Re-run AI extraction"
            >
              {reextracting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5 text-muted" />
              )}
            </button>
            <button
              className="btn btn-ghost btn-sm px-2 ml-auto text-error hover:bg-error-bg"
              onClick={onDelete}
              title="Remove book"
              aria-label="Remove book"
            >
              <Trash2 className="size-3.5" />
            </button>
          </>
        )}
      </div>
    </Card>
  );
}

export function KnowledgeCenterPage() {
  const { data: books = [], isLoading, isError, error } = useBooksQuery();
  const canManage = useHasPermission("contracts.manage");
  const deleteBook = useDeleteBook();
  const reextract = useReextractBook();

  const [showUpload, setShowUpload] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContractBook | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [keywords, setKeywords] = useState("");
  const [bookId, setBookId] = useState("");
  const [clauseNumber, setClauseNumber] = useState("");
  const [title, setTitle] = useState("");

  const params = useMemo(
    () => ({ q: keywords.trim(), bookId, clauseNumber: clauseNumber.trim(), title: title.trim() }),
    [keywords, bookId, clauseNumber, title],
  );
  const searching = Boolean(params.q || params.bookId || params.clauseNumber || params.title);
  const search = useClauseSearch(params, searching);

  function clearFilters() {
    setKeywords("");
    setBookId("");
    setClauseNumber("");
    setTitle("");
  }

  const readyBooks = books.filter((b) => b.status === "done");
  const summary = [
    { label: "Contract books", value: books.length },
    { label: "Ready to search", value: readyBooks.length },
    { label: "Total clauses", value: readyBooks.reduce((n, b) => n + b.clauseCount, 0) },
    {
      label: "Extracting",
      value: books.filter((b) => b.status === "processing" || b.status === "pending").length,
    },
  ];

  return (
    <>
      <PageHeader
        title="Knowledge Center"
        subtitle="The central library of standard contract books. Upload a form once and Claude extracts every clause — searchable across the whole library."
        actions={
          canManage && (
            <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
              <BookUp className="size-4" /> Upload book
            </button>
          )
        }
      />

      {isError && (
        <p className="mb-4 text-sm text-error bg-error-bg rounded-lg px-3 py-2">
          {apiErrorMessage(error, "Couldn't load the Knowledge Center — is the backend running?")}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {summary.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-xs font-medium text-muted">{s.label}</p>
            <p className="mt-1 text-2xl font-bold font-display text-ink tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Search across every book ─────────────────────────────────────── */}
      <Card className="p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
            <input
              className="input pl-9"
              placeholder="Search clause text, titles and summaries across all books…"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </div>
          <button
            className="btn btn-outline"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
          >
            <Filter className="size-4" /> Filters
          </button>
          {searching && (
            <button className="btn btn-ghost" onClick={clearFilters}>
              <X className="size-4" /> Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-border">
            <div>
              <label className="block text-xs font-medium text-muted mb-1" htmlFor="f-book">Book</label>
              <select id="f-book" className="input" value={bookId} onChange={(e) => setBookId(e.target.value)}>
                <option value="">All books</option>
                {readyBooks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.edition ? ` (${b.edition})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1" htmlFor="f-num">Clause number</label>
              <input
                id="f-num"
                className="input"
                placeholder="e.g. 4.12 or 8."
                value={clauseNumber}
                onChange={(e) => setClauseNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1" htmlFor="f-title">Clause title</label>
              <input
                id="f-title"
                className="input"
                placeholder="e.g. Extension of Time"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>
        )}
      </Card>

      {/* ── Results, or the book shelf ───────────────────────────────────── */}
      {searching ? (
        <div>
          <p className="text-sm text-muted mb-3">
            {search.isFetching
              ? "Searching…"
              : `${search.data?.length ?? 0} clause${search.data?.length === 1 ? "" : "s"} found`}
          </p>
          <div className="space-y-3">
            {(search.data ?? []).map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-sm font-semibold text-navy-800">{c.clause_number}</span>
                  <span className="font-semibold text-ink">{c.clause_title}</span>
                  <Link
                    to={`/knowledge/${c.bookId}`}
                    className="ml-auto text-xs text-muted hover:text-navy-700 transition-colors shrink-0"
                  >
                    {c.bookName}{c.bookEdition ? ` · ${c.bookEdition}` : ""}
                  </Link>
                </div>
                {c.summary && <p className="text-sm text-muted mt-2">{c.summary}</p>}
              </Card>
            ))}
            {!search.isFetching && (search.data?.length ?? 0) === 0 && (
              <Card className="p-12 text-center text-muted">
                No clauses match these filters.
              </Card>
            )}
          </div>
        </div>
      ) : (
        <>
          {isLoading && books.length === 0 && (
            <Card className="p-12 text-center text-muted">
              <Loader2 className="size-4 animate-spin inline mr-2" /> Loading contract books…
            </Card>
          )}
          {!isLoading && books.length === 0 && (
            <Card className="p-12 text-center">
              <Library className="size-8 mx-auto text-faint mb-3" />
              <p className="font-semibold text-ink">No contract books yet</p>
              <p className="text-sm text-muted mt-1 max-w-md mx-auto">
                Upload a standard form — FIDIC Red, Yellow or Silver Book, NEC4 — and its clauses
                become searchable across every project.
              </p>
              {canManage && (
                <button className="btn btn-primary mt-4" onClick={() => setShowUpload(true)}>
                  <BookUp className="size-4" /> Upload book
                </button>
              )}
            </Card>
          )}
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {books.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                canManage={canManage}
                reextracting={reextract.isPending && reextract.variables === b.id}
                onReextract={() => reextract.mutate(b.id)}
                onDelete={() => setDeleteTarget(b)}
              />
            ))}
          </div>
        </>
      )}

      {showUpload && <UploadBookModal onClose={() => setShowUpload(false)} />}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove contract book?"
        message={
          deleteTarget
            ? `“${deleteTarget.name}” and all ${deleteTarget.clauseCount} extracted clauses will be deleted. Project clause libraries are not affected.`
            : ""
        }
        confirmLabel="Remove book"
        onConfirm={() => {
          if (deleteTarget) deleteBook.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
