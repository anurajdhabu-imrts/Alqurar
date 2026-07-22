import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronRight,
  FileText,
  HardHat,
  History,
  ListChecks,
  Loader2,
  Scale,
  Sparkles,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useDelayEvents } from "@/hooks/useDelayEvents";
import { useChronologyGenerator } from "@/hooks/useChronology";
import { cn, formatDate } from "@/lib/utils";
import type { ChronologyItem, DelayCause, ProjectDelayEvent } from "@/types";

const causeTone: Record<DelayCause, Tone> = {
  Employer: "info",
  Contractor: "error",
  Concurrent: "warning",
  "Force Majeure": "navy",
  Neutral: "neutral",
};

const actorMeta: Record<ChronologyItem["actor"], { tone: string; icon: typeof Building2 }> = {
  Contractor: { tone: "bg-navy-100 text-navy-700", icon: HardHat },
  Engineer: { tone: "bg-info-bg text-info", icon: Scale },
  Employer: { tone: "bg-amber-100 text-amber-700", icon: Building2 },
  System: { tone: "bg-navy-50 text-muted", icon: Sparkles },
};

export function ChronologyTab({ projectId }: { projectId: string }) {
  const { data: events = [], isLoading } = useDelayEvents(projectId);

  const chronologyCount = useMemo(
    () => events.reduce((sum, e) => sum + (e.chronology?.length ?? 0), 0),
    [events],
  );
  const eventsWithChronology = useMemo(
    () => events.filter((e) => (e.chronology?.length ?? 0) > 0).length,
    [events],
  );

  // Generates a document-grounded chronology per event with AI, and auto-runs
  // once when events exist but none has a chronology yet.
  const gen = useChronologyGenerator(projectId, !isLoading, events.length, chronologyCount);

  function handleGenerate() {
    if (
      chronologyCount > 0 &&
      !window.confirm(
        "Regenerate the chronology for every delay event with AI? This replaces the current chronology.",
      )
    )
      return;
    gen.start();
  }

  return (
    <div className="space-y-4">
      {/* ── Header row ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">Chronology</h3>
          <p className="text-xs text-muted mt-0.5">
            A dated chronology for each delay event, built by AI from the project's documents and delay events.
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleGenerate}
          disabled={gen.isRunning || events.length === 0}
        >
          {gen.isRunning ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {gen.isRunning ? "Generating…" : "Generate with AI"}
        </button>
      </div>

      {gen.isRunning && (
        <div className="flex items-start gap-2 rounded-lg bg-navy-50/60 px-3 py-2.5 text-xs text-navy-700">
          <Sparkles className="size-4 shrink-0 mt-px text-amber-500" />
          <span>Claude is reading the project's documents and reconstructing the chronology for each delay event. This can take a minute or two.</span>
        </div>
      )}
      {gen.error && (
        <div className="flex items-start gap-2 rounded-lg bg-error-bg/60 px-3 py-2.5 text-xs text-error">
          <AlertTriangle className="size-4 shrink-0 mt-px" />
          <span>{gen.error}</span>
        </div>
      )}

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryStat icon={ListChecks} label="Delay events" value={events.length} tone="navy" />
        <SummaryStat icon={History} label="Chronology entries" value={chronologyCount} tone="info" />
        <SummaryStat icon={FileText} label="Events with chronology" value={eventsWithChronology} tone="success" />
      </div>

      {isLoading ? (
        <Card className="p-10 text-center text-sm text-muted inline-flex items-center justify-center gap-2 w-full">
          <Loader2 className="size-4 animate-spin" /> Loading chronology…
        </Card>
      ) : events.length === 0 ? (
        <Card className="p-10 text-center">
          <span className="size-12 mx-auto rounded-xl bg-navy-50 text-navy-600 grid place-items-center">
            <History className="size-6" />
          </span>
          <h3 className="mt-3 font-semibold text-ink">No delay events yet</h3>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            The chronology is built for each delay event. Extract or add delay events in the Delay Events tab first,
            then generate their chronology here.
          </p>
        </Card>
      ) : events.length > 0 && chronologyCount === 0 && gen.isRunning ? (
        <Card className="p-10 text-center">
          <span className="size-12 mx-auto rounded-xl bg-navy-50 text-navy-600 grid place-items-center">
            <Loader2 className="size-6 animate-spin" />
          </span>
          <h3 className="mt-3 font-semibold text-ink">Building the chronology with AI…</h3>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            Claude is reconstructing the sequence of events for each delay from the project's documents.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map((e) => (
            <EventChronology key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventChronology({ event }: { event: ProjectDelayEvent }) {
  // Each event's chronology is collapsed by default — the header always shows,
  // the timeline expands on click.
  const [open, setOpen] = useState(false);

  // Resolve a chronology row's sourceId back to its document name for display.
  const sourceName = (sourceId?: string) =>
    sourceId ? event.sources.find((s) => s.id === sourceId)?.name : undefined;

  const chronology = event.chronology ?? [];

  return (
    <Card className="overflow-hidden">
      {/* Event header — click to expand/collapse the chronology */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-5 py-3.5 flex items-start justify-between gap-3 hover:bg-navy-50/40 transition-colors"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-faint tabular-nums">{event.ref}</span>
            {event.category && <><span className="text-faint">·</span><span className="text-xs font-medium text-muted">{event.category}</span></>}
          </div>
          <p className="mt-0.5 text-sm font-semibold text-ink leading-snug">{event.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={causeTone[event.cause]}>{event.cause}</Badge>
            {event.criticalPath && <Badge tone="error">Critical path</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-navy-100 text-navy-800">
            {chronology.length} {chronology.length === 1 ? "step" : "steps"}
          </span>
          {open ? (
            <ChevronDown className="size-4 text-faint" />
          ) : (
            <ChevronRight className="size-4 text-faint" />
          )}
        </div>
      </button>

      {/* Timeline */}
      {open && (
      <div className="px-5 py-4 border-t border-border">
        {chronology.length === 0 ? (
          <p className="text-sm text-muted">
            No chronology for this event yet. Use <span className="font-medium text-ink">Generate with AI</span> to build it from the documents.
          </p>
        ) : (
          <ol className="space-y-0">
            {chronology.map((c, i) => {
              const meta = actorMeta[c.actor];
              const ActorIcon = meta.icon;
              const last = i === chronology.length - 1;
              const doc = sourceName(c.sourceId);
              return (
                <li key={c.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {!last && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />}
                  <span className={cn("size-8 shrink-0 rounded-full grid place-items-center", meta.tone)}>
                    <ActorIcon className="size-4" />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-ink">{c.actor}</span>
                      {c.date && <span className="text-xs text-faint tabular-nums">{formatDate(c.date)}</span>}
                    </div>
                    <p className="text-sm font-medium text-ink mt-0.5">{c.title}</p>
                    {c.detail && <p className="text-xs text-muted mt-0.5 leading-relaxed">{c.detail}</p>}
                    {doc && (
                      <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-navy-700 bg-navy-50 rounded px-1.5 py-0.5">
                        <FileText className="size-3" /> {doc}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      )}
    </Card>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof History;
  label: string;
  value: number;
  tone: "navy" | "info" | "success";
}) {
  const toneBg: Record<string, string> = {
    navy: "bg-navy-100 text-navy-700",
    info: "bg-info-bg text-info",
    success: "bg-success-bg text-success",
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
