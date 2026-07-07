import { Link } from "react-router-dom";
import { AlertTriangle, Building2, FileSignature, FolderKanban, ListChecks, Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { apiErrorMessage } from "@/api/client";
import { useDashboardSummary } from "@/hooks/useDashboard";

// Presentation-only colour maps (Al Qarar brand). Unknown statuses fall back to grey.
const PROJECT_STATUS_COLORS: Record<string, string> = {
  Active: "#1f4a7d", // navy
  Closeout: "#a97c2f", // gold
  Completed: "#1fa462", // emerald
};
const DELAY_STATUS_COLORS: Record<string, string> = {
  Pending: "#c2933f", // gold
  Confirmed: "#1fa462", // emerald
  Edited: "#2563eb",
  Merged: "#1f4a7d", // navy
  Rejected: "#c0392b",
};
const FALLBACK_COLOR = "#94a3b8";

const colorFor = (map: Record<string, string>, key: string) => map[key] ?? FALLBACK_COLOR;

/** Sorted, non-zero [status, count] entries. */
function entriesOf(data: Record<string, number>): [string, number][] {
  return Object.entries(data)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
}

function EmptyState({ label }: { label: string }) {
  return <div className="p-8 text-center text-sm text-muted">{label}</div>;
}

/** Donut + legend for a status breakdown (reusable across any status map). */
function StatusDonut({
  data,
  colors,
  unit,
}: {
  data: Record<string, number>;
  colors: Record<string, string>;
  unit: string;
}) {
  const entries = entriesOf(data);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  if (!total) return <EmptyState label={`No ${unit} yet`} />;

  // Build hard-edged conic-gradient slices without mutating an outer accumulator.
  const slices = entries
    .reduce<{ acc: number; parts: string[] }>(
      (state, [k, n]) => {
        const start = (state.acc / total) * 100;
        const acc = state.acc + n;
        const end = (acc / total) * 100;
        return { acc, parts: [...state.parts, `${colorFor(colors, k)} ${start}% ${end}%`] };
      },
      { acc: 0, parts: [] },
    )
    .parts.join(", ");

  return (
    <div className="p-5 flex flex-col sm:flex-row items-center gap-5">
      <div className="relative size-[150px] shrink-0">
        <div className="size-full rounded-full" style={{ background: `conic-gradient(${slices})` }} />
        <div className="absolute inset-[22%] rounded-full bg-card grid place-items-center">
          <div className="text-center">
            <p className="text-2xl font-bold font-display text-ink leading-none">{total}</p>
            <p className="text-[11px] text-muted mt-0.5">{unit}</p>
          </div>
        </div>
      </div>
      <ul className="flex-1 space-y-1.5 w-full">
        {entries.map(([k, n]) => (
          <li key={k} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: colorFor(colors, k) }} />
            <span className="text-muted">{k}</span>
            <span className="ml-auto font-semibold text-ink tabular-nums">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars for a status breakdown (reusable). */
function StatusBars({
  data,
  colors,
  unit,
}: {
  data: Record<string, number>;
  colors: Record<string, string>;
  unit: string;
}) {
  const entries = entriesOf(data);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  if (!total) return <EmptyState label={`No ${unit} yet`} />;
  const max = Math.max(...entries.map(([, n]) => n));

  return (
    <div className="p-5 space-y-3">
      {entries.map(([k, n]) => (
        <div key={k} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs font-medium text-muted truncate">{k}</span>
          <div className="flex-1 h-7 rounded-lg bg-navy-50 overflow-hidden">
            <div
              className="h-full rounded-lg min-w-[2px]"
              style={{ width: `${(n / max) * 100}%`, backgroundColor: colorFor(colors, k) }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-xs font-semibold text-ink tabular-nums">{n}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { data, isLoading, isError, error } = useDashboardSummary();

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Live portfolio view across clients, projects, proposals and delay events."
        actions={
          <Link to="/proposals/new" className="btn btn-primary">
            <Plus className="size-4" /> New proposal
          </Link>
        }
      />

      {isLoading ? (
        <DashboardSkeleton />
      ) : isError || !data ? (
        <Card className="p-10 text-center">
          <span className="size-12 mx-auto rounded-xl bg-error-bg text-error grid place-items-center">
            <AlertTriangle className="size-6" />
          </span>
          <h3 className="mt-3 font-semibold text-ink">Couldn't load the dashboard</h3>
          <p className="mt-1 text-sm text-muted">{apiErrorMessage(error, "Please try again.")}</p>
        </Card>
      ) : (
        <div className="space-y-4 animate-in">
          {/* KPI row — live counts from the existing modules */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="Clients" value={data.clients} sub="Registered clients" icon={Building2} tone="navy" />
            <StatCard label="Projects" value={data.projects} sub="Active engagements" icon={FolderKanban} tone="emerald" />
            <StatCard label="Proposals" value={data.proposals} sub="In the proposal stage" icon={FileSignature} tone="gold" />
            <StatCard label="Delay Events" value={data.delayEvents} sub="Across all projects" icon={ListChecks} tone="amber" />
          </div>

          {/* Status breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="card-hover">
              <CardHeader title="Projects by status" />
              <StatusDonut data={data.projectsByStatus} colors={PROJECT_STATUS_COLORS} unit="projects" />
            </Card>
            <Card className="card-hover">
              <CardHeader title="Delay events by status" />
              <StatusBars data={data.delayEventsByStatus} colors={DELAY_STATUS_COLORS} unit="delay events" />
            </Card>
            <Card className="card-hover">
              <CardHeader title="Proposals by status" />
              <StatusDonut data={data.proposalsByStatus} colors={PROJECT_STATUS_COLORS} unit="proposals" />
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

/** Skeleton placeholders shown while the summary loads. */
function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="skeleton size-11 rounded-xl" />
            <div className="skeleton h-3.5 w-24 mt-4 rounded" />
            <div className="skeleton h-7 w-16 mt-2 rounded" />
            <div className="skeleton h-3 w-28 mt-3 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="skeleton h-4 w-32 rounded" />
            <div className="skeleton h-[150px] w-full mt-5 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
