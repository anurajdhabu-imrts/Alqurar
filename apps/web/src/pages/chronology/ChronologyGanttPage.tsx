import { useMemo, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, FileText, GanttChartSquare, History, ListChecks, Plus, Search, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewChronologyModal } from "@/components/chronology/NewChronologyModal";
import { useProjectDocuments } from "@/hooks/useProjectDocuments";
import { useDelayEvents } from "@/hooks/useDelayEvents";
import { useChronologySessions, useDeleteProject, type ProjectDetails } from "@/store/projects";
import { formatDate } from "@/lib/utils";

/** One session card. Reads its own document / event counts so the card shows how
 *  far the AI pipeline has got without opening the session. */
function SessionCard({
  session,
  onOpen,
  onDelete,
}: {
  session: ProjectDetails;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { data: docs = [] } = useProjectDocuments(session.id);
  const { data: events = [] } = useDelayEvents(session.id);
  const chronologyCount = events.reduce((sum, e) => sum + (e.chronology?.length ?? 0), 0);

  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <Card className="p-5 card-hover cursor-pointer" onClick={onOpen}>
      <div className="flex items-start justify-between gap-3">
        <span className="size-10 rounded-xl bg-linear-to-br from-navy-700 to-navy-900 text-amber-400 grid place-items-center shrink-0">
          <GanttChartSquare className="size-5" />
        </span>
        <button
          className="btn btn-ghost px-1.5 h-7 text-error hover:bg-error-bg"
          onClick={stop(onDelete)}
          title="Delete chronology"
          aria-label="Delete chronology"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <h3 className="mt-3 font-semibold text-ink leading-snug">{session.name}</h3>
      <p className="text-xs text-muted mt-0.5">
        {session.code} · {session.standard}
        {session.createdAt ? ` · ${formatDate(session.createdAt)}` : ""}
      </p>

      <div className="mt-4 pt-3 border-t border-border grid grid-cols-3 gap-2">
        <Stat icon={FileText} value={docs.length} label="Documents" />
        <Stat icon={ListChecks} value={events.length} label="Events" />
        <Stat icon={History} value={chronologyCount} label="Entries" />
      </div>

      <div className="mt-3 flex justify-end">
        <button className="btn btn-primary btn-sm" onClick={stop(onOpen)}>
          Open <ArrowRight className="size-3.5" />
        </button>
      </div>
    </Card>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof FileText; value: number; label: string }) {
  return (
    <div className="min-w-0">
      <p className="text-lg font-bold font-display tabular-nums text-ink leading-none">{value}</p>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted truncate">
        <Icon className="size-3 text-faint shrink-0" /> {label}
      </p>
    </div>
  );
}

/**
 * Chronology Gantt Chart — the standalone version of the project workspace's
 * Chronology tab. Each session holds its own uploaded documents and the delay
 * events + chronology the AI derives from them, without needing a full project.
 */
export function ChronologyGanttPage() {
  const navigate = useNavigate();
  const sessions = useChronologySessions();
  const deleteSession = useDeleteProject();
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectDetails | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
    );
  }, [sessions, query]);

  return (
    <>
      <PageHeader
        title="Chronology Gantt Chart"
        subtitle="Upload a set of documents and let AI build the delay-event chronology and plot each event's timeline of key events — without setting up a full project."
        actions={
          <button className="btn btn-primary" onClick={() => setNewOpen(true)}>
            <Plus className="size-4" /> New chronology
          </button>
        }
      />

      {sessions.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
            <input
              className="input pl-9"
              placeholder="Search by name or code…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <span className="text-sm text-muted ml-auto">
            {filtered.length} of {sessions.length} chronolog{sessions.length === 1 ? "y" : "ies"}
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <div className="px-5 py-16 text-center">
            <span className="size-12 mx-auto rounded-xl bg-navy-50 text-navy-600 grid place-items-center">
              <GanttChartSquare className="size-6" />
            </span>
            {sessions.length === 0 ? (
              <>
                <h3 className="mt-3 font-semibold text-ink">No chronologies yet</h3>
                <p className="mt-1 text-sm text-muted max-w-md mx-auto">
                  Create one, upload the correspondence, minutes and notices, and AI will identify the delay events and
                  draw the Gantt timeline for each.
                </p>
                <button className="btn btn-primary mt-4" onClick={() => setNewOpen(true)}>
                  <Plus className="size-4" /> New chronology
                </button>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted">No chronologies match your search.</p>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onOpen={() => navigate(`/chronology-gantt/${s.id}`)}
              onDelete={() => setDeleteTarget(s)}
            />
          ))}
        </div>
      )}

      {newOpen && <NewChronologyModal onClose={() => setNewOpen(false)} />}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete chronology?"
        message={
          deleteTarget
            ? `“${deleteTarget.name}” will be removed from this list and you will lose access to its documents, delay events and chronology. This can't be undone.`
            : ""
        }
        confirmLabel="Delete chronology"
        onConfirm={() => {
          if (deleteTarget) deleteSession.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
