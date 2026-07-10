import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { bookDownloadUrl, type BookClause } from "@/api/knowledge";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { BookStatusBadge } from "@/components/knowledge/BookStatusBadge";
import { useBookClausesQuery, useBookQuery, useReextractBook } from "@/hooks/useKnowledge";
import { useHasPermission } from "@/hooks/usePermission";
import { formatDate } from "@/lib/utils";

/** One clause: number, title, verbatim text and the AI's plain-language summary.
 * Collapsed to the summary by default — a book has hundreds of clauses, and the
 * verbatim text is long. */
function ClauseRow({ clause, expanded, onToggle }: {
  clause: BookClause;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <button
        className="w-full text-left px-5 py-4 hover:bg-navy-50/50 transition-colors"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3">
          <span className="font-mono text-sm font-semibold text-navy-800 shrink-0 mt-0.5 min-w-[3.5rem]">
            {clause.clause_number}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">{clause.clause_title}</p>
            {!expanded && clause.summary && (
              <p className="text-sm text-muted mt-1 line-clamp-2">{clause.summary}</p>
            )}
          </div>
          <ChevronDown
            className={`size-4 text-faint shrink-0 mt-1 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
          {clause.summary && (
            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-4 py-3">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide inline-flex items-center gap-1.5 mb-1.5">
                <Sparkles className="size-3.5" /> Plain-language summary
              </p>
              <p className="text-sm text-ink leading-relaxed">{clause.summary}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              Clause text
            </p>
            <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap font-serif">
              {clause.clause_text || "No verbatim text was captured for this clause."}
            </p>
          </div>

          {clause.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {clause.tags.map((t) => (
                <Badge key={t} tone="neutral">{t}</Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function BookDetailPage() {
  const { bookId = "" } = useParams();
  const book = useBookQuery(bookId);
  const clauses = useBookClausesQuery(bookId);
  const reextract = useReextractBook();
  const canManage = useHasPermission("contracts.manage");

  const [keywords, setKeywords] = useState("");
  const [clauseNumber, setClauseNumber] = useState("");
  const [title, setTitle] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Filtering happens client-side: a book's clauses are already loaded, so this
  // stays instant as you type instead of round-tripping per keystroke.
  const filtered = useMemo(() => {
    const rows = clauses.data ?? [];
    const q = keywords.trim().toLowerCase();
    const num = clauseNumber.trim().toLowerCase();
    const ttl = title.trim().toLowerCase();
    if (!q && !num && !ttl) return rows;
    return rows.filter((c) => {
      if (num && !c.clause_number.toLowerCase().startsWith(num)) return false;
      if (ttl && !c.clause_title.toLowerCase().includes(ttl)) return false;
      if (q) {
        const hay = `${c.clause_number} ${c.clause_title} ${c.clause_text} ${c.summary} ${c.tags.join(" ")}`;
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [clauses.data, keywords, clauseNumber, title]);

  const filtering = Boolean(keywords.trim() || clauseNumber.trim() || title.trim());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (book.isError) {
    return (
      <p className="text-sm text-error bg-error-bg rounded-lg px-3 py-2">
        {apiErrorMessage(book.error, "Couldn't load this book.")}
      </p>
    );
  }

  if (!book.data) {
    return (
      <Card className="p-12 text-center text-muted">
        <Loader2 className="size-4 animate-spin inline mr-2" /> Loading book…
      </Card>
    );
  }

  const b = book.data;
  const busy = b.status === "pending" || b.status === "processing";

  return (
    <>
      <Link
        to="/knowledge"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-navy-700 transition-colors mb-4"
      >
        <ArrowLeft className="size-4" /> Knowledge Center
      </Link>

      <PageHeader
        title={b.name}
        subtitle={[
          b.edition ? `${b.edition} edition` : null,
          b.publisher,
          `Uploaded ${formatDate(b.uploadedAt)}`,
          b.status === "done" ? `${b.clauseCount} clauses` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <a className="btn btn-outline" href={bookDownloadUrl(b.id)}>
              <Download className="size-4" /> Original
            </a>
            {canManage && (
              <button
                className="btn btn-outline"
                onClick={() => reextract.mutate(b.id)}
                disabled={busy || reextract.isPending}
              >
                {reextract.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Re-extract
              </button>
            )}
          </>
        }
      />

      <div className="flex items-center gap-2 mb-5">
        <BookStatusBadge status={b.status} />
        {busy && b.totalChunks > 0 && (
          <span className="text-sm text-muted">
            Reading section {Math.min(b.processedChunks + 1, b.totalChunks)} of {b.totalChunks} — clauses
            will appear when it finishes.
          </span>
        )}
        {busy && b.totalChunks === 0 && <span className="text-sm text-muted">Preparing the book…</span>}
      </div>

      {b.status === "failed" && b.error && (
        <p className="mb-5 text-sm text-error bg-error-bg rounded-lg px-3 py-2">{b.error}</p>
      )}

      {b.status === "done" && (
        <>
          <Card className="p-4 mb-5">
            <div className="grid sm:grid-cols-[2fr_1fr_1.5fr] gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
                <input
                  className="input pl-9"
                  placeholder="Search keywords in this book…"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
              </div>
              <input
                className="input"
                placeholder="Clause no. e.g. 4.12"
                value={clauseNumber}
                onChange={(e) => setClauseNumber(e.target.value)}
                aria-label="Filter by clause number"
              />
              <input
                className="input"
                placeholder="Clause title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-label="Filter by clause title"
              />
            </div>
            {filtering && (
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
                <span className="text-sm text-muted">
                  {filtered.length} of {clauses.data?.length ?? 0} clauses
                </span>
                <button
                  className="btn btn-ghost btn-sm ml-auto"
                  onClick={() => {
                    setKeywords("");
                    setClauseNumber("");
                    setTitle("");
                  }}
                >
                  <X className="size-3.5" /> Clear filters
                </button>
              </div>
            )}
          </Card>

          {clauses.isLoading && (
            <Card className="p-12 text-center text-muted">
              <Loader2 className="size-4 animate-spin inline mr-2" /> Loading clauses…
            </Card>
          )}

          <div className="space-y-2">
            {filtered.map((c) => (
              <ClauseRow
                key={c.id}
                clause={c}
                expanded={expanded.has(c.id)}
                onToggle={() => toggle(c.id)}
              />
            ))}
          </div>

          {!clauses.isLoading && filtered.length === 0 && (
            <Card className="p-12 text-center">
              <FileText className="size-8 mx-auto text-faint mb-3" />
              <p className="text-muted">
                {filtering ? "No clauses match these filters." : "No clauses were extracted from this book."}
              </p>
            </Card>
          )}
        </>
      )}
    </>
  );
}
