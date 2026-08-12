import { AlertTriangle, Check, FileText, GanttChartSquare, ListChecks, Loader2, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useProjectDocuments } from "@/hooks/useProjectDocuments";
import { useDelayEvents, useDelayEventsExtractor } from "@/hooks/useDelayEvents";
import { useChronologyGenerator } from "@/hooks/useChronology";
import { cn } from "@/lib/utils";

type StepState = "waiting" | "running" | "done" | "failed";

/**
 * The three AI stages a Chronology Gantt session runs through, and the thing that
 * actually drives them.
 *
 * Uploading a document only queues that document's own analysis. The two stages
 * after it — identifying the delay events, then writing each event's chronology —
 * are separate background jobs. Both `useDelayEventsExtractor` and
 * `useChronologyGenerator` auto-start their job as soon as the stage before it has
 * produced something, so mounting this component next to the tabs (rather than
 * inside one of them) is what makes the pipeline run all the way through whether
 * the user is watching the Documents tab or the Chronology tab.
 */
export function ChronologyPipelineStatus({ projectId }: { projectId: string }) {
  const { data: docs = [] } = useProjectDocuments(projectId);
  const { data: events = [], isLoading: eventsLoading } = useDelayEvents(projectId);

  const chronologyCount = events.reduce((sum, e) => sum + (e.chronology?.length ?? 0), 0);

  const extractor = useDelayEventsExtractor(projectId, !eventsLoading, events.length);
  const gen = useChronologyGenerator(projectId, !eventsLoading, events.length, chronologyCount);

  // ── Stage 1: each uploaded document is read and classified by AI ──
  const analysing = docs.filter(
    (d) => d.analysisStatus === "pending" || d.analysisStatus === "analyzing",
  ).length;
  const analysed = docs.filter((d) => !!d.analysis).length;
  const docsState: StepState =
    docs.length === 0 ? "waiting" : analysing > 0 ? "running" : analysed > 0 ? "done" : "waiting";

  // ── Stage 2: the delay events are extracted from those documents ──
  const eventsState: StepState = extractor.isRunning
    ? "running"
    : extractor.error
      ? "failed"
      : events.length > 0
        ? "done"
        : "waiting";

  // ── Stage 3: a dated chronology is written for each delay event ──
  const chronologyState: StepState = gen.isRunning
    ? "running"
    : gen.error
      ? "failed"
      : chronologyCount > 0
        ? "done"
        : "waiting";

  const errors = [extractor.error, gen.error].filter(Boolean);

  return (
    <Card className="p-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Step
          icon={FileText}
          state={docsState}
          label="Documents read"
          detail={
            docs.length === 0
              ? "Upload documents to begin"
              : analysing > 0
                ? `Claude is reading ${analysing} of ${docs.length}…`
                : `${analysed} of ${docs.length} analysed`
          }
        />
        <Step
          icon={ListChecks}
          state={eventsState}
          label="Delay events identified"
          detail={
            eventsState === "running"
              ? "Claude is identifying the delay events…"
              : events.length > 0
                ? `${events.length} delay event${events.length === 1 ? "" : "s"} found`
                : "Runs once the documents are analysed"
          }
        />
        <Step
          icon={GanttChartSquare}
          state={chronologyState}
          label="Chronology written"
          detail={
            chronologyState === "running"
              ? gen.progress
                ? `Writing event ${gen.progress.done} of ${gen.progress.total}…`
                : "Claude is writing the chronology…"
              : chronologyCount > 0
                ? `${chronologyCount} dated entr${chronologyCount === 1 ? "y" : "ies"}`
                : "Runs once the delay events exist"
          }
        />
      </div>

      {errors.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {errors.map((e) => (
            <p key={e} className="flex items-start gap-2 rounded-lg bg-error-bg/60 px-3 py-2 text-xs text-error">
              <AlertTriangle className="size-4 shrink-0 mt-px" />
              <span>{e}</span>
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}

const stateTint: Record<StepState, string> = {
  waiting: "bg-navy-50 text-faint",
  running: "bg-amber-100 text-amber-700",
  done: "bg-success-bg text-success",
  failed: "bg-error-bg text-error",
};

function Step({
  icon: Icon,
  state,
  label,
  detail,
}: {
  icon: LucideIcon;
  state: StepState;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className={cn("size-9 shrink-0 rounded-lg grid place-items-center", stateTint[state])}>
        {state === "running" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : state === "done" ? (
          <Check className="size-4" />
        ) : state === "failed" ? (
          <AlertTriangle className="size-4" />
        ) : (
          <Icon className="size-4" />
        )}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink truncate">{label}</p>
        <p className="text-xs text-muted truncate">{detail}</p>
      </div>
    </div>
  );
}
