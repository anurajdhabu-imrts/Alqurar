import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  GanttChartSquare,
  HardHat,
  History,
  ListChecks,
  Loader2,
  Scale,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { useDelayEvents } from "@/hooks/useDelayEvents";
import { useChronologyGenerator } from "@/hooks/useChronology";
import { cn, formatDate } from "@/lib/utils";
import { buildGanttModel, eventNumber } from "@/lib/chronologyGantt";
import { ChronologyGantt, GanttEmpty } from "@/components/projects/ChronologyGantt";
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

type PdfOpts = { projectName?: string; projectCode?: string; standard?: string; fileName?: string };

/** Load the Al Qarar logo and hand the events to the narrative PDF builder. */
async function exportNarrativePdf(events: ProjectDelayEvent[], opts: PdfOpts) {
  const [{ downloadChronologyPdf }, { fetchAsDataUrl }] = await Promise.all([
    import("@/lib/chronologyPdf"),
    import("@/lib/proposalPdf"),
  ]);
  const alqararLogo = await fetchAsDataUrl("/Al Qarar Logo.png");
  downloadChronologyPdf(events, { ...opts, alqararLogo });
}

/** Export the landscape Gantt sheets; returns how many events could be plotted. */
async function exportGanttPdf(events: ProjectDelayEvent[], opts: PdfOpts): Promise<number> {
  const { downloadChronologyGanttPdf } = await import("@/lib/chronologyGanttPdf");
  return downloadChronologyGanttPdf(events, opts);
}

export function ChronologyTab({
  projectId,
  projectName,
  projectCode,
  projectStandard,
  noEventsHint = "The chronology is built for each delay event. Extract or add delay events in the Delay Events tab first, then generate their chronology here.",
}: {
  projectId: string;
  projectName?: string;
  projectCode?: string;
  projectStandard?: string;
  /** Shown when the project has no delay events yet. Override where this tab is
   *  reused outside the project workspace and there is no Delay Events tab to
   *  point the user at (e.g. the standalone Chronology Gantt page). */
  noEventsHint?: string;
}) {
  const { data: events = [], isLoading } = useDelayEvents(projectId);
  const [view, setView] = useState<"narrative" | "gantt">("narrative");
  const [exporting, setExporting] = useState(false);

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

  const pdfOpts: PdfOpts = { projectName, projectCode, standard: projectStandard };

  async function handleExportAll() {
    setExporting(true);
    try {
      if (view === "narrative") {
        await exportNarrativePdf(events, pdfOpts);
      } else {
        const sheets = await exportGanttPdf(events, pdfOpts);
        if (sheets === 0)
          window.alert(
            "No delay event has a dated chronology yet, so there is nothing to plot. Generate the chronology with AI first.",
          );
      }
    } finally {
      setExporting(false);
    }
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
        <div className="flex items-center gap-2 shrink-0">
          <button
            className="btn btn-outline btn-sm"
            onClick={handleExportAll}
            disabled={exporting || events.length === 0}
            title={
              view === "narrative"
                ? "Download the full chronology as a PDF"
                : "Download the timeline of key events for every delay event as a landscape PDF"
            }
          >
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {view === "narrative" ? "Export PDF" : "Export Gantt PDF"}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleGenerate}
            disabled={gen.isRunning || events.length === 0}
          >
            {gen.isRunning ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {gen.isRunning ? "Generating…" : "Generate with AI"}
          </button>
        </div>
      </div>

      {gen.isRunning && (
        <div className="flex items-start gap-2 rounded-lg bg-navy-50/60 px-3 py-2.5 text-xs text-navy-700">
          <Sparkles className="size-4 shrink-0 mt-px text-amber-500" />
          <span>
            Claude is reading the project's documents and writing the full chronology for each delay event —
            introduction, timeline, dated correspondence, cause &amp; effect and contractual entitlement.
            {gen.progress ? ` ${gen.progress.done} of ${gen.progress.total} events written.` : ""} This can take a few
            minutes.
          </span>
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

      {/* ── Narrative / Gantt sub-tabs ── */}
      <Tabs
        tabs={[
          { id: "narrative", label: "Narrative", icon: ScrollText },
          { id: "gantt", label: "Timeline (Gantt)", icon: GanttChartSquare },
        ]}
        active={view}
        onChange={(id) => setView(id as "narrative" | "gantt")}
      />

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
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">{noEventsHint}</p>
        </Card>
      ) : chronologyCount === 0 && gen.isRunning ? (
        <Card className="p-10 text-center">
          <span className="size-12 mx-auto rounded-xl bg-navy-50 text-navy-600 grid place-items-center">
            <Loader2 className="size-6 animate-spin" />
          </span>
          <h3 className="mt-3 font-semibold text-ink">Building the chronology with AI…</h3>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            Claude is reconstructing the sequence of events for each delay from the project's documents.
          </p>
        </Card>
      ) : view === "narrative" ? (
        <div className="space-y-4">
          {events.map((e, i) => (
            <EventChronology
              key={e.id}
              event={e}
              index={i}
              onExport={() =>
                exportNarrativePdf([e], {
                  ...pdfOpts,
                  fileName: `Delay Event ${eventNumber(e, i)} — Chronology`.replace(/[^\w\-. ]+/g, "").trim(),
                })
              }
            />
          ))}
        </div>
      ) : (
        <GanttView events={events} pdfOpts={pdfOpts} />
      )}
    </div>
  );
}

/** The Gantt sub-tab: pick a delay event, see its timeline of key events. */
function GanttView({ events, pdfOpts }: { events: ProjectDelayEvent[]; pdfOpts: PdfOpts }) {
  const [selectedId, setSelectedId] = useState(events[0]?.id ?? "");
  const [exporting, setExporting] = useState(false);

  const selected = events.find((e) => e.id === selectedId) ?? events[0];
  const selectedIndex = events.findIndex((e) => e.id === selected?.id);
  const model = useMemo(() => (selected ? buildGanttModel(selected) : null), [selected]);

  async function handleExport() {
    if (!selected) return;
    setExporting(true);
    try {
      const sheets = await exportGanttPdf([selected], {
        ...pdfOpts,
        fileName: `Delay Event ${eventNumber(selected, selectedIndex)} — Timeline of Key Events`
          .replace(/[^\w\-. ]+/g, "")
          .trim(),
      });
      if (sheets === 0)
        window.alert("This delay event has no dated chronology yet, so there is nothing to plot.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Event selector — one chart at a time keeps the wide axis readable */}
      <div className="flex flex-wrap items-center gap-2">
        {events.map((e, i) => {
          const on = e.id === selected?.id;
          const steps = e.chronology?.length ?? 0;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => setSelectedId(e.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                on
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-border text-muted hover:text-ink hover:bg-navy-50/60",
              )}
              title={e.title}
            >
              DE-{eventNumber(e, i)}
              <span className={cn("ml-1.5 tabular-nums", on ? "text-navy-200" : "text-faint")}>{steps}</span>
            </button>
          );
        })}
      </div>

      {!selected ? null : (
        <Card className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-faint">DELAY EVENT # {eventNumber(selected, selectedIndex)}</p>
              <p className="text-sm font-semibold text-ink leading-snug mt-0.5">{selected.title}</p>
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || !model}
              className="btn btn-outline btn-sm shrink-0"
              title="Download this timeline as a landscape PDF"
            >
              {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              PDF
            </button>
          </div>

          {model ? (
            <ChronologyGantt
              model={model}
              title={`${selected.category ? selected.category + " — " : ""}${selected.title}`}
            />
          ) : (
            <GanttEmpty
              message={
                (selected.chronology?.length ?? 0) === 0
                  ? "No chronology for this delay event yet. Use Generate with AI to build it from the documents."
                  : "This event's chronology has no usable dates, so there is nothing to plot on a timeline."
              }
            />
          )}
        </Card>
      )}
    </div>
  );
}

function EventChronology({
  event,
  index,
  onExport,
}: {
  event: ProjectDelayEvent;
  index: number;
  onExport: () => Promise<void>;
}) {
  // Each event's write-up is collapsed by default — the header always shows,
  // the narrative and timeline expand on click.
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Resolve a chronology row's sourceId back to its document name for display.
  const sourceName = (sourceId?: string) =>
    sourceId ? event.sources.find((s) => s.id === sourceId)?.name : undefined;

  const chronology = event.chronology ?? [];
  const narrative = event.chronologyNarrative;

  async function handleExport(e: React.MouseEvent) {
    e.stopPropagation();
    setExporting(true);
    try {
      await onExport();
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      {/* Event header — click to expand/collapse the write-up */}
      <div className="flex items-start gap-2 pr-3 hover:bg-navy-50/40 transition-colors">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex-1 min-w-0 text-left pl-5 py-3.5 flex items-start justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-faint tabular-nums">
                DELAY EVENT # {eventNumber(event, index)}
              </span>
              {event.category && (
                <>
                  <span className="text-faint">·</span>
                  <span className="text-xs font-medium text-muted">{event.category}</span>
                </>
              )}
            </div>
            <p className="mt-0.5 text-sm font-semibold text-ink leading-snug">{event.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge tone={causeTone[event.cause]}>{event.cause}</Badge>
              {event.criticalPath && <Badge tone="error">Critical path</Badge>}
              {event.clause && <Badge tone="neutral">{event.clause}</Badge>}
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
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          title="Download this delay event's chronology as a PDF"
          className="mt-3.5 shrink-0 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted hover:text-ink hover:bg-white disabled:opacity-50"
        >
          {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          PDF
        </button>
      </div>

      {open && (
        <div className="px-5 py-4 border-t border-border space-y-5">
          {/* Facts strip — the header numbers a claim reader looks for first */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Fact label="Event period" value={`${formatDate(event.startDate)} → ${event.endDate ? formatDate(event.endDate) : "Ongoing"}`} />
            <Fact label="Delay impact" value={`${event.daysImpact || 0} day(s)`} />
            <Fact label="Responsibility" value={event.cause} />
            <Fact label="Admissibility" value={event.admissibility} />
          </div>

          {narrative?.introduction && (
            <Section title="Introduction" body={narrative.introduction} />
          )}
          {narrative?.timeline && (
            <Section title="Delay Event Timeline" body={narrative.timeline} />
          )}

          <div>
            <SectionTitle>Chronology</SectionTitle>
            {chronology.length === 0 ? (
              <p className="text-sm text-muted">
                No chronology for this event yet. Use <span className="font-medium text-ink">Generate with AI</span> to
                build it from the documents.
              </p>
            ) : (
              <ol className="space-y-0">
                {chronology.map((c, i) => {
                  const meta = actorMeta[c.actor];
                  const ActorIcon = meta.icon;
                  const last = i === chronology.length - 1;
                  const doc = sourceName(c.sourceId);
                  return (
                    <li key={c.id} className="relative flex gap-3 pb-5 last:pb-0">
                      {!last && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />}
                      <span className={cn("size-8 shrink-0 rounded-full grid place-items-center", meta.tone)}>
                        <ActorIcon className="size-4" />
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-ink">{c.actor}</span>
                          {c.date && (
                            <span className="text-xs text-faint tabular-nums">
                              {formatDate(c.date)}
                              {c.endDate && c.endDate !== c.date ? ` → ${formatDate(c.endDate)}` : ""}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-ink mt-0.5">{c.title}</p>
                        {c.detail && <Prose text={c.detail} className="mt-1" />}
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

          {narrative?.causeEffect && <Section title="Cause & Effect" body={narrative.causeEffect} />}
          {narrative?.entitlement && <Section title="Contractual Entitlement" body={narrative.entitlement} />}
          {/* Nothing generated yet — fall back to the event's own narrative. */}
          {!narrative && event.narrative && <Section title="Event Narrative" body={event.narrative} />}
        </div>
      )}
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-bold uppercase tracking-wide text-navy-700 border-b border-border pb-1.5 mb-3">
      {children}
    </h4>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <Prose text={body} />
    </div>
  );
}

/** Blank-line-separated paragraphs of claim prose. */
function Prose({ text, className }: { text: string; className?: string }) {
  const paras = String(text ?? "")
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
  if (paras.length === 0) return null;
  return (
    <div className={cn("space-y-2", className)}>
      {paras.map((p, i) => (
        <p key={i} className="text-sm text-muted leading-relaxed text-justify">
          {p}
        </p>
      ))}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-navy-50/60 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">{label}</p>
      <p className="text-xs font-medium text-ink mt-0.5">{value || "—"}</p>
    </div>
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
