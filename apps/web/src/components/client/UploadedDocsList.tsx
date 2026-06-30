import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertCircle, ChevronDown, ChevronRight, Download, Eye, FileText, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { useHasPermission } from "@/hooks/usePermission";
import { useAnalyzeProjectDoc, useDeleteProjectDoc } from "@/hooks/useProjectDocuments";
import { downloadProjectDocApi } from "@/api/projectDocuments";
import type { UploadedClaimDocument } from "@/types";

function sizeLabel(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

/** Existing uploaded claim documents for a project (read-only list). */
export function UploadedDocsList({ docs }: { docs: UploadedClaimDocument[] }) {
  // Delete is only available if the admin granted the client this permission.
  const canDelete = useHasPermission("client.documents.delete");
  const del = useDeleteProjectDoc();
  // Viewer route lives under /client for clients and at the top level for staff.
  const pathname = useLocation().pathname;
  const isClient = pathname.startsWith("/client");
  const viewBase = isClient ? "/client/documents" : "/documents";
  // AI analysis is a staff action (model cost) — only offered in the admin workspace.
  const projectId = docs[0]?.projectId ?? "";
  const analyze = useAnalyzeProjectDoc(projectId);
  // Analysis panels are collapsed by default so the list stays compact.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  if (docs.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-muted">
        No claim documents uploaded for this project yet.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {docs.map((d) => {
        // Driven by the polled row status, not the (instant) mutation.
        const analysing = d.analysisStatus === "pending" || d.analysisStatus === "analyzing";
        const failed = d.analysisStatus === "failed";
        const expanded = !!open[d.id];
        return (
          <li key={d.id} className="px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="size-9 shrink-0 grid place-items-center rounded-lg bg-navy-50 text-navy-700">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink truncate">{d.name}</p>
                <p className="text-xs text-muted">
                  {d.type} · {sizeLabel(d.sizeKB)} · {formatDate(d.uploadedAt)} · {d.uploadedBy}
                  {d.claimRef ? ` · ${d.claimRef}` : ""}
                </p>
              </div>
              {d.analysis && !analysing && (
                <button
                  type="button"
                  onClick={() => toggle(d.id)}
                  className="inline-flex items-center gap-1"
                  aria-expanded={expanded}
                  aria-label={expanded ? "Hide AI analysis" : "Show AI analysis"}
                  title={expanded ? "Hide AI analysis" : "Show AI analysis"}
                >
                  <Badge tone={d.analysis.supports_eot ? "success" : "neutral"}>
                    {d.analysis.supports_eot ? "Supports EOT" : "Context"}
                  </Badge>
                  {expanded ? (
                    <ChevronDown className="size-4 text-faint" />
                  ) : (
                    <ChevronRight className="size-4 text-faint" />
                  )}
                </button>
              )}
              {analysing ? (
                <Badge tone="warning">
                  <Loader2 className="size-3 animate-spin" /> Analysing…
                </Badge>
              ) : failed ? (
                <Badge tone="error">Analysis failed</Badge>
              ) : (
                <Badge tone={d.status === "Under Review" ? "warning" : d.analysis ? "success" : "neutral"}>
                  {d.analysis ? "Analysed" : d.status}
                </Badge>
              )}
              {d.driveFileId && (
                <Link
                  to={`${viewBase}/${d.id}`}
                  state={{ name: d.name }}
                  className="btn btn-ghost px-2"
                  aria-label={`View ${d.name}`}
                  title="View"
                >
                  <Eye className="size-4" />
                </Link>
              )}
              {d.driveFileId && (
                <button
                  type="button"
                  onClick={() => downloadProjectDocApi(d.id, d.name)}
                  className="btn btn-ghost px-2"
                  aria-label={`Download ${d.name}`}
                  title="Download"
                >
                  <Download className="size-4" />
                </button>
              )}
              {!isClient && d.driveFileId && (
                <button
                  type="button"
                  onClick={() => analyze.mutate(d.id)}
                  disabled={analysing}
                  className="btn btn-ghost px-2 text-navy-700"
                  aria-label={`Analyse ${d.name} with AI`}
                  title={d.analysis ? "Re-analyse with AI" : "Analyse with AI"}
                >
                  <Sparkles className="size-4" />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => del.mutate({ id: d.id, projectId: d.projectId })}
                  disabled={del.isPending}
                  className="btn btn-ghost px-2 text-error"
                  aria-label={`Delete ${d.name}`}
                >
                  {del.isPending && del.variables?.id === d.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                </button>
              )}
            </div>

            {/* ── AI analysis: what this document is about (collapsible) ── */}
            {d.analysis && expanded && (
              <div className="mt-3 ml-12 rounded-lg border border-border bg-navy-50/40 p-3">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-navy-700">
                    <Sparkles className="size-3.5 text-amber-500" /> {d.analysis.document_type}
                  </span>
                  <span className="text-[11px] text-faint">{d.analysis.confidence}% confidence</span>
                </div>
                <p className="text-xs text-ink leading-relaxed">{d.analysis.summary}</p>
                {d.analysis.relevance_to_claim && (
                  <p className="text-xs text-muted mt-1.5">
                    <span className="font-medium text-ink">Relevance:</span> {d.analysis.relevance_to_claim}
                  </p>
                )}
                {d.analysis.key_dates.length > 0 && (
                  <p className="text-[11px] text-faint mt-1.5">Key dates: {d.analysis.key_dates.join(" · ")}</p>
                )}
              </div>
            )}

            {analysing && (
              <p className="mt-2 ml-12 flex items-center gap-1.5 text-xs text-muted">
                <Sparkles className="size-3.5 text-amber-500" /> Claude is reading the document…
              </p>
            )}
            {failed && (
              <p className="mt-2 ml-12 flex items-center gap-1.5 text-xs text-error">
                <AlertCircle className="size-3.5" /> {d.analysisError || "AI analysis failed."}
                {!isClient && d.driveFileId && (
                  <button type="button" onClick={() => analyze.mutate(d.id)} className="underline ml-1">
                    Retry
                  </button>
                )}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
