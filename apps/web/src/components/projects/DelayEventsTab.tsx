import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  FileText,
  GitMerge,
  HardHat,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Scale,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DelayEventFormModal } from "@/components/projects/DelayEventFormModal";
import {
  useDelayEvents,
  useDelayEventsExtractor,
  useDeleteDelayEvent,
  useSetDelayEventStatus,
} from "@/hooks/useDelayEvents";
import { cn, formatDate } from "@/lib/utils";
import type {
  AdmissibilityStatus,
  ChronologyItem,
  DelayCause,
  DelayReviewStatus,
  ProjectDelayEvent,
} from "@/types";

const causeTone: Record<DelayCause, Tone> = {
  Employer: "info",
  Contractor: "error",
  Concurrent: "warning",
  "Force Majeure": "navy",
  Neutral: "neutral",
};

const admissibilityTone: Record<AdmissibilityStatus, Tone> = {
  "Likely admissible": "success",
  "At risk": "warning",
  Inadmissible: "error",
  "Not assessed": "neutral",
};

const reviewTone: Record<DelayReviewStatus, Tone> = {
  Pending: "warning",
  Confirmed: "success",
  Edited: "info",
  Merged: "navy",
  Rejected: "error",
};

const actorMeta: Record<ChronologyItem["actor"], { tone: string; icon: typeof Building2 }> = {
  Contractor: { tone: "bg-navy-100 text-navy-700", icon: HardHat },
  Engineer: { tone: "bg-info-bg text-info", icon: Scale },
  Employer: { tone: "bg-amber-100 text-amber-700", icon: Building2 },
  System: { tone: "bg-navy-50 text-muted", icon: Sparkles },
};

type Filter = "all" | "pending" | "critical";

export function DelayEventsTab({ projectId }: { projectId: string }) {
  const { data: events = [], isLoading } = useDelayEvents(projectId);
  const setStatusM = useSetDelayEventStatus(projectId);
  const deleteM = useDeleteDelayEvent(projectId);
  // Auto-extracts from the data room once documents are analysed (when empty),
  // and also backs the manual "Extract with AI" button below.
  const extract = useDelayEventsExtractor(projectId, !isLoading, events.length);

  const [selectedId, setSelectedId] = useState<string>("");
  const [filter, setFilter] = useState<Filter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectDelayEvent | null>(null);

  function handleExtract() {
    if (
      events.length > 0 &&
      !window.confirm(
        "Re-extract delay events from the data room with AI? This replaces the current events for this project.",
      )
    )
      return;
    setSelectedId("");
    extract.start();
  }

  const filtered = useMemo(() => {
    if (filter === "pending") return events.filter((e) => e.reviewStatus === "Pending");
    if (filter === "critical") return events.filter((e) => e.criticalPath);
    return events;
  }, [events, filter]);

  const selected = events.find((e) => e.id === selectedId) ?? filtered[0];

  const stats = useMemo(() => {
    const confirmed = events.filter((e) => e.reviewStatus === "Confirmed").length;
    const pending = events.filter((e) => e.reviewStatus === "Pending").length;
    const criticalDays = events
      .filter((e) => e.criticalPath && e.cause === "Employer")
      .reduce((sum, e) => sum + e.daysImpact, 0);
    return { total: events.length, confirmed, pending, criticalDays };
  }, [events]);

  function setStatus(id: string, reviewStatus: DelayReviewStatus) {
    setStatusM.mutate({ id, reviewStatus });
  }

  function handleEdit(event: ProjectDelayEvent) {
    setEditing(event);
    setFormOpen(true);
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this delay event? This cannot be undone.")) return;
    deleteM.mutate(id);
    if (selectedId === id) setSelectedId("");
  }

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  return (
    <div className="space-y-4">
      {/* ── Header row ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">Delay events</h3>
          <p className="text-xs text-muted mt-0.5">
            Extract events from the data room with AI, or add them manually — all saved to the database.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-primary btn-sm" onClick={handleExtract} disabled={extract.isRunning}>
            {extract.isRunning ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {extract.isRunning ? "Extracting…" : "Extract with AI"}
          </button>
          <button className="btn btn-outline btn-sm" onClick={openAdd}>
            <Plus className="size-4" /> Add event
          </button>
        </div>
      </div>

      {extract.isRunning && (
        <div className="flex items-start gap-2 rounded-lg bg-navy-50/60 px-3 py-2.5 text-xs text-navy-700">
          <Sparkles className="size-4 shrink-0 mt-px text-amber-500" />
          <span>Claude is reading the project's documents and drafting the delay-event register. This can take a minute or two.</span>
        </div>
      )}
      {extract.error && (
        <div className="flex items-start gap-2 rounded-lg bg-error-bg/60 px-3 py-2.5 text-xs text-error">
          <AlertTriangle className="size-4 shrink-0 mt-px" />
          <span>{extract.error}</span>
        </div>
      )}

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryStat icon={ListChecks} label="Events identified" value={stats.total} tone="navy" />
        <SummaryStat icon={CheckCircle2} label="Confirmed" value={stats.confirmed} tone="success" />
        <SummaryStat icon={CircleDot} label="Pending review" value={stats.pending} tone="warning" />
        <SummaryStat icon={TrendingUp} label="Employer critical days" value={stats.criticalDays} tone="info" />
      </div>

      {isLoading ? (
        <Card className="p-10 text-center text-sm text-muted inline-flex items-center justify-center gap-2 w-full">
          <Loader2 className="size-4 animate-spin" /> Loading delay events…
        </Card>
      ) : events.length === 0 && extract.isRunning ? (
        <Card className="p-10 text-center">
          <span className="size-12 mx-auto rounded-xl bg-navy-50 text-navy-600 grid place-items-center">
            <Loader2 className="size-6 animate-spin" />
          </span>
          <h3 className="mt-3 font-semibold text-ink">Extracting delay events with AI…</h3>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            Claude is reading the project's analysed documents and drafting the delay-event register.
          </p>
        </Card>
      ) : events.length === 0 ? (
        <Card className="p-10 text-center">
          <span className="size-12 mx-auto rounded-xl bg-navy-50 text-navy-600 grid place-items-center">
            <ListChecks className="size-6" />
          </span>
          <h3 className="mt-3 font-semibold text-ink">No delay events yet</h3>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            Upload the contract, programme and correspondence in the Data Room, then let AI extract
            the delay events — or add them manually. Each event is saved and can be reviewed, edited or deleted.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button className="btn btn-primary btn-sm inline-flex" onClick={handleExtract} disabled={extract.isRunning}>
              {extract.isRunning ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {extract.isRunning ? "Extracting…" : "Extract with AI"}
            </button>
            <button className="btn btn-outline btn-sm inline-flex" onClick={openAdd}>
              <Plus className="size-4" /> Add event
            </button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
          {/* ── Event list ── */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center gap-1.5">
              {([
                ["all", "All"],
                ["pending", "Pending"],
                ["critical", "Critical path"],
              ] as [Filter, string][]).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                    filter === id ? "bg-navy-900 text-white" : "bg-navy-50 text-muted hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-2.5">
              {filtered.length === 0 && (
                <Card className="p-6 text-center text-sm text-muted">No events match this filter.</Card>
              )}
              {filtered.map((e) => {
                const on = selected?.id === e.id;
                return (
                  <button
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                    className={cn(
                      "w-full text-left rounded-xl border p-3.5 transition-colors",
                      on ? "border-navy-400 bg-navy-50/60 ring-1 ring-navy-200" : "border-border bg-white hover:border-navy-200",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-faint tabular-nums">{e.ref}</span>
                      <Badge tone={reviewTone[e.reviewStatus]} dot>{e.reviewStatus}</Badge>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-ink leading-snug">{e.title}</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={causeTone[e.cause]}>{e.cause}</Badge>
                      {e.criticalPath && <Badge tone="error">Critical path</Badge>}
                      <span className="text-xs text-muted ml-auto tabular-nums font-medium">{e.daysImpact} days</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Detail panel ── */}
          <div className="lg:col-span-3">
            {selected ? (
              <EventDetail
                key={selected.id}
                event={selected}
                onStatus={setStatus}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ) : (
              <Card className="p-10 text-center text-sm text-muted">Select an event to review its detail.</Card>
            )}
          </div>
        </div>
      )}

      {formOpen && (
        <DelayEventFormModal
          projectId={projectId}
          event={editing ?? undefined}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ListChecks;
  label: string;
  value: number;
  tone: "navy" | "success" | "warning" | "info";
}) {
  const toneBg: Record<string, string> = {
    navy: "bg-navy-100 text-navy-700",
    success: "bg-success-bg text-success",
    warning: "bg-warning-bg text-warning",
    info: "bg-info-bg text-info",
  };
  return (
    <Card className="p-4 flex items-center gap-3">
      <span className={cn("size-10 shrink-0 rounded-lg grid place-items-center", toneBg[tone])}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold font-display tabular-nums text-ink leading-none">{value}</p>
        <p className="text-xs text-muted mt-1 truncate">{label}</p>
      </div>
    </Card>
  );
}

function EventDetail({
  event,
  onStatus,
  onEdit,
  onDelete,
}: {
  event: ProjectDelayEvent;
  onStatus: (id: string, status: DelayReviewStatus) => void;
  onEdit: (event: ProjectDelayEvent) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-faint tabular-nums">{event.ref}</span>
              <span className="text-faint">·</span>
              <span className="text-xs font-medium text-muted">{event.category}</span>
            </div>
            <h3 className="mt-1 text-lg font-semibold text-ink leading-snug">{event.title}</h3>
          </div>
          <Badge tone={reviewTone[event.reviewStatus]} dot>{event.reviewStatus}</Badge>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge tone={causeTone[event.cause]}>{event.cause}</Badge>
          <Badge tone="navy">{event.clause}</Badge>
          <Badge tone={admissibilityTone[event.admissibility]}>{event.admissibility}</Badge>
          {event.criticalPath && <Badge tone="error">Critical path</Badge>}
          <span className="inline-flex items-center gap-1 text-xs text-muted ml-auto">
            <Sparkles className="size-3.5 text-navy-500" /> {event.aiConfidence}% AI confidence
          </span>
        </div>
      </div>

      {/* Key metrics */}
      <div className="px-5 py-4 grid grid-cols-3 gap-4 border-b border-border">
        <Metric label="Period" value={`${formatDate(event.startDate)} → ${formatDate(event.endDate)}`} />
        <Metric label="Days impact" value={`${event.daysImpact} days`} />
        <Metric label="Cause" value={event.cause} />
      </div>

      {/* Narrative */}
      <div className="px-5 py-4 border-b border-border">
        <SectionLabel>Narrative</SectionLabel>
        <p className="mt-2 text-sm text-ink/90 leading-relaxed">{event.narrative}</p>
      </div>

      {/* Chronology */}
      <div className="px-5 py-4 border-b border-border">
        <SectionLabel>Chronology</SectionLabel>
        <ol className="mt-3 space-y-0">
          {event.chronology.map((c, i) => {
            const meta = actorMeta[c.actor];
            const ActorIcon = meta.icon;
            const last = i === event.chronology.length - 1;
            return (
              <li key={c.id} className="relative flex gap-3 pb-4 last:pb-0">
                {!last && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />}
                <span className={cn("size-8 shrink-0 rounded-full grid place-items-center", meta.tone)}>
                  <ActorIcon className="size-4" />
                </span>
                <div className="min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-ink">{c.actor}</span>
                    <span className="text-xs text-faint tabular-nums">{formatDate(c.date)}</span>
                  </div>
                  <p className="text-sm font-medium text-ink mt-0.5">{c.title}</p>
                  {c.detail && <p className="text-xs text-muted mt-0.5 leading-relaxed">{c.detail}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Linked source documents */}
      <div className="px-5 py-4 border-b border-border">
        <SectionLabel>Linked documents <span className="text-faint font-normal">({event.sources.length})</span></SectionLabel>
        <div className="mt-3 space-y-2">
          {event.sources.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 hover:border-navy-200 transition-colors">
              <span className="size-9 shrink-0 rounded-lg bg-navy-50 text-navy-600 grid place-items-center">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink truncate">{s.name}</p>
                <p className="text-xs text-muted">
                  {s.ref ? `${s.ref} · ` : ""}{s.type}{s.date ? ` · ${formatDate(s.date)}` : ""}
                </p>
              </div>
              <ChevronRight className="size-4 text-faint shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Review actions */}
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn btn-primary btn-sm"
            disabled={event.reviewStatus === "Confirmed"}
            onClick={() => onStatus(event.id, "Confirmed")}
          >
            <Check className="size-4" /> Accept event
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => onEdit(event)}>
            <Pencil className="size-4" /> Edit
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => onStatus(event.id, "Merged")}>
            <GitMerge className="size-4" /> Merge
          </button>
          <button
            className="btn btn-ghost btn-sm text-error"
            onClick={() => onStatus(event.id, "Rejected")}
          >
            <X className="size-4" /> Reject
          </button>
          <button
            className="btn btn-ghost btn-sm text-error ml-auto"
            onClick={() => onDelete(event.id)}
            aria-label="Delete event"
          >
            <Trash2 className="size-4" /> Delete
          </button>
        </div>
        {event.admissibility === "At risk" && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-warning-bg/60 px-3 py-2.5 text-xs text-warning">
            <AlertTriangle className="size-4 shrink-0 mt-px" />
            <span>Notice timing or causation needs checking before this event is confirmed — review the admissibility checklist (SC 20.2).</span>
          </div>
        )}
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-faint uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-ink mt-0.5">{value}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-faint">{children}</p>;
}
