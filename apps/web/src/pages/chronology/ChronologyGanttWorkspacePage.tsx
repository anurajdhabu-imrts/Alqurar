import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, GanttChartSquare, Loader2, Paperclip, RotateCw, Sparkles, X } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { UploadedDocsList } from "@/components/client/UploadedDocsList";
import { ChronologyTab } from "@/components/projects/ChronologyTab";
import { ChronologyPipelineStatus } from "@/components/chronology/ChronologyPipelineStatus";
import { useProjectDocuments, useAnalyzePendingDocs } from "@/hooks/useProjectDocuments";
import { useDocumentUploadQueue } from "@/hooks/useDocumentUploadQueue";
import { useProjectById, useProjectsQuery } from "@/store/projects";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

/**
 * A single Chronology Gantt session: upload the documents (tab 1), then read the
 * chronology and its Gantt timelines (tab 2) — the same Chronology tab the project
 * workspace uses, generated from the documents uploaded here.
 */
export function ChronologyGanttWorkspacePage() {
  const { id = "" } = useParams();
  const session = useProjectById(id);
  const { isLoading: projectsLoading } = useProjectsQuery();

  const { data: docs = [] } = useProjectDocuments(id);
  const uploads = useDocumentUploadQueue();
  const analyzePending = useAnalyzePendingDocs(id);
  const currentUser = useAuthStore((s) => s.user);
  const unanalysedCount = docs.filter((d) => !d.analysis && d.driveFileId).length;

  const [tab, setTab] = useState("documents");

  // The session may simply not be in the cache yet on a hard refresh.
  if (!session) {
    return (
      <div>
        <BackLink />
        {projectsLoading ? (
          <div className="text-center py-20 text-sm text-muted inline-flex items-center justify-center gap-2 w-full">
            <Loader2 className="size-4 animate-spin" /> Loading chronology…
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-lg font-semibold text-ink">Chronology not found</p>
            <p className="text-muted mt-1">It may have been deleted.</p>
            <Link to="/chronology-gantt" className="btn btn-outline mt-4 inline-flex">
              Back to Chronology Gantt
            </Link>
          </div>
        )}
      </div>
    );
  }

  function handleUploaded(file: File) {
    uploads.enqueue([file], id, currentUser?.name ?? "Al Qarar");
  }

  return (
    <>
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[26px] leading-tight font-bold text-ink tracking-tight">{session.name}</h1>
          <p className="text-sm text-faint mt-1">
            {session.code} · {session.standard}
          </p>
        </div>
      </div>

      {/* Mounted outside the tabs: this is what drives the AI pipeline through
          all three stages regardless of which tab is open. */}
      <div className="mb-5">
        <ChronologyPipelineStatus projectId={id} />
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "documents", label: "1 · Documents", icon: Paperclip, count: docs.length },
          { id: "chronology", label: "2 · Chronology", icon: GanttChartSquare },
        ]}
      />

      <div className="pt-5">
        {tab === "documents" && (
          <div className="space-y-4">
            <Card className="p-5">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-ink">Upload documents</h3>
                <p className="text-sm text-muted">
                  Upload the correspondence, site minutes, notices, programmes and contract for this chronology. Each
                  file is read by AI, which classifies it and extracts its dates — the delay events and their chronology
                  are then built from exactly these documents.
                </p>
              </div>
              <DocumentsPanel
                seed={[]}
                kind="claim"
                claimContext={{ standard: session.standard }}
                onUploaded={handleUploaded}
                autoAnalyze={false}
              />

              {uploads.items.length > 0 && (
                <div className="mt-4 border-t border-border pt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                    Transferring {uploads.inFlight.length > 0 ? `· ${uploads.inFlight.length} to go` : ""}
                  </p>
                  {uploads.items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      {it.status === "failed" ? (
                        <AlertTriangle className="size-4 shrink-0 text-error" />
                      ) : (
                        <Loader2 className="size-4 shrink-0 animate-spin text-navy-600" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink truncate">{it.name}</p>
                        <p className={cn("text-xs truncate", it.status === "failed" ? "text-error" : "text-muted")}>
                          {it.status === "failed"
                            ? it.error
                            : it.status === "uploading"
                              ? "Uploading…"
                              : "Waiting…"}
                        </p>
                      </div>
                      {it.status === "failed" && (
                        <>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm shrink-0"
                            onClick={() => uploads.retry(it.id)}
                          >
                            <RotateCw className="size-3.5" /> Retry
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost px-2 shrink-0"
                            onClick={() => uploads.dismiss(it.id)}
                            aria-label={`Dismiss ${it.name}`}
                          >
                            <X className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Uploaded documents"
                subtitle={`${docs.length} document(s) in this chronology`}
                action={
                  unanalysedCount > 0 ? (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => analyzePending.mutate()}
                      disabled={analyzePending.isPending}
                    >
                      {analyzePending.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="size-3.5" />
                      )}
                      Analyse {unanalysedCount} pending
                    </button>
                  ) : undefined
                }
              />
              <UploadedDocsList docs={docs} />
            </Card>

            {docs.length > 0 && (
              <div className="flex justify-end">
                <button className="btn btn-primary" onClick={() => setTab("chronology")}>
                  Continue to Chronology <ArrowRight className="size-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "chronology" && (
          <ChronologyTab
            projectId={id}
            projectName={session.name}
            projectCode={session.code}
            projectStandard={session.standard}
            noEventsHint="The chronology is built for each delay event. Upload documents in the Documents tab — AI reads them, identifies the delay events, then writes and plots each one's chronology here."
          />
        )}
      </div>
    </>
  );
}

function BackLink() {
  return (
    <Link
      to="/chronology-gantt"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy-700 mb-4"
    >
      <ArrowLeft className="size-4" /> Chronology Gantt
    </Link>
  );
}
