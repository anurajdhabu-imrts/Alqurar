import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileStack,
  FileText,
  Files,
  Loader2,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useDelayEvents, useDelayEventsExtractor } from "@/hooks/useDelayEvents";
import { cn, formatDate } from "@/lib/utils";
import type {
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

const reviewTone: Record<DelayReviewStatus, Tone> = {
  Pending: "warning",
  Confirmed: "success",
  Edited: "info",
  Merged: "navy",
  Rejected: "error",
};

/** A document together with the delay events that reference it. */
interface DocGroup {
  /** Stable key for the group (source.id, or the unlinked sentinel). */
  key: string;
  name: string;
  ref?: string;
  type?: string;
  date?: string;
  events: ProjectDelayEvent[];
}

const UNLINKED_KEY = "__unlinked__";

export function EventsByDocumentTab({ projectId }: { projectId: string }) {
  const { data: events = [], isLoading } = useDelayEvents(projectId);
  // Same auto-extraction as the Delay Events tab — opening this tab after the
  // documents are analysed populates the grouping from AI on its own.
  const extract = useDelayEventsExtractor(projectId, !isLoading, events.length);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const groups = useMemo<DocGroup[]>(() => {
    const map = new Map<string, DocGroup>();
    for (const event of events) {
      if (event.sources.length === 0) {
        const g = map.get(UNLINKED_KEY) ?? {
          key: UNLINKED_KEY,
          name: "Events with no linked document",
          events: [],
        };
        g.events.push(event);
        map.set(UNLINKED_KEY, g);
        continue;
      }
      for (const s of event.sources) {
        // Group by document name + ref so the same physical document collapses
        // together even when its DelayEventSource id differs across events.
        const key = `${s.name}::${s.ref ?? ""}`;
        const g = map.get(key) ?? {
          key,
          name: s.name,
          ref: s.ref,
          type: s.type,
          date: s.date,
          events: [],
        };
        g.events.push(event);
        map.set(key, g);
      }
    }
    const list = Array.from(map.values());
    // Real documents first (most events first), the "unlinked" bucket last.
    list.sort((a, b) => {
      if (a.key === UNLINKED_KEY) return 1;
      if (b.key === UNLINKED_KEY) return -1;
      return b.events.length - a.events.length;
    });
    return list;
  }, [events]);

  const isOpen = (key: string) => open[key] ?? true;
  const toggle = (key: string) =>
    setOpen((o) => ({ ...o, [key]: !isOpen(key) }));

  return (
    <div className="space-y-4">
      {/* ── Header row ── */}
      <div>
        <h3 className="text-base font-semibold text-ink">Events by document</h3>
        <p className="text-xs text-muted mt-0.5">
          Every delay event grouped under the source documents it was extracted from.
        </p>
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <SummaryStat icon={Files} label="Source documents" value={groups.filter((g) => g.key !== UNLINKED_KEY).length} tone="navy" />
        <SummaryStat icon={FileStack} label="Events linked" value={events.length} tone="info" />
        <SummaryStat
          icon={FileText}
          label="Unlinked events"
          value={groups.find((g) => g.key === UNLINKED_KEY)?.events.length ?? 0}
          tone="warning"
        />
      </div>

      {isLoading ? (
        <Card className="p-10 text-center text-sm text-muted inline-flex items-center justify-center gap-2 w-full">
          <Loader2 className="size-4 animate-spin" /> Loading events…
        </Card>
      ) : events.length === 0 && extract.isRunning ? (
        <Card className="p-10 text-center">
          <span className="size-12 mx-auto rounded-xl bg-navy-50 text-navy-600 grid place-items-center">
            <Loader2 className="size-6 animate-spin" />
          </span>
          <h3 className="mt-3 font-semibold text-ink">Extracting events with AI…</h3>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            Claude is reading the project's analysed documents. The events will appear here grouped by source.
          </p>
        </Card>
      ) : events.length === 0 ? (
        <Card className="p-10 text-center">
          <span className="size-12 mx-auto rounded-xl bg-navy-50 text-navy-600 grid place-items-center">
            <FileStack className="size-6" />
          </span>
          <h3 className="mt-3 font-semibold text-ink">No events yet</h3>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            Upload and analyse documents in the Data Room — AI extracts the delay events and they appear
            here grouped by their source documents. You can also extract manually from the Delay Events tab.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const unlinked = g.key === UNLINKED_KEY;
            const expanded = isOpen(g.key);
            return (
              <Card key={g.key} className="overflow-hidden">
                <button
                  onClick={() => toggle(g.key)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-navy-50/40 transition-colors"
                >
                  <span
                    className={cn(
                      "size-9 shrink-0 rounded-lg grid place-items-center",
                      unlinked ? "bg-warning-bg text-warning" : "bg-navy-50 text-navy-600",
                    )}
                  >
                    <FileText className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink truncate">{g.name}</p>
                    {!unlinked && (
                      <p className="text-xs text-muted truncate">
                        {g.ref ? `${g.ref} · ` : ""}{g.type}{g.date ? ` · ${formatDate(g.date)}` : ""}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-navy-100 text-navy-800 shrink-0">
                    {g.events.length} {g.events.length === 1 ? "event" : "events"}
                  </span>
                  {expanded ? (
                    <ChevronDown className="size-4 text-faint shrink-0" />
                  ) : (
                    <ChevronRight className="size-4 text-faint shrink-0" />
                  )}
                </button>

                {expanded && (
                  <div className="border-t border-border divide-y divide-border">
                    {g.events.map((e) => (
                      <div key={e.id} className="px-5 py-3 flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-faint tabular-nums">{e.ref}</span>
                            <span className="text-faint">·</span>
                            <span className="text-xs font-medium text-muted">{e.category}</span>
                          </div>
                          <p className="mt-0.5 text-sm font-medium text-ink leading-snug">{e.title}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Badge tone={causeTone[e.cause]}>{e.cause}</Badge>
                            <Badge tone={reviewTone[e.reviewStatus]} dot>{e.reviewStatus}</Badge>
                            {e.criticalPath && <Badge tone="error">Critical path</Badge>}
                          </div>
                        </div>
                        <span className="text-xs text-muted tabular-nums font-medium shrink-0 pt-0.5">
                          {e.daysImpact} days
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
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
  icon: typeof FileStack;
  label: string;
  value: number;
  tone: "navy" | "info" | "warning";
}) {
  const toneBg: Record<string, string> = {
    navy: "bg-navy-100 text-navy-700",
    info: "bg-info-bg text-info",
    warning: "bg-warning-bg text-warning",
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
