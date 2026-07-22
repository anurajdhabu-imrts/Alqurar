import { useMemo, useState } from "react";
import {
  CircleDot,
  Loader2,
  MessageSquareText,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { QueryFormModal } from "@/components/projects/QueryFormModal";
import { useDeleteProjectQuery, useProjectQueries } from "@/hooks/useProjectQueries";
import { formatDate } from "@/lib/utils";
import type { ProjectQuery, QueryStatus } from "@/types";

const statusTone: Record<QueryStatus, Tone> = {
  Open: "warning",
  Closed: "success",
};

/** Show an ISO date nicely, or a dash when empty. */
function dateOrDash(value?: string) {
  return value ? formatDate(value) : "—";
}

export function QueriesTab({ projectId }: { projectId: string }) {
  const { data: queries = [], isLoading } = useProjectQueries(projectId);
  const deleteM = useDeleteProjectQuery(projectId);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectQuery | null>(null);

  const stats = useMemo(() => {
    const open = queries.filter((q) => q.status === "Open").length;
    return { total: queries.length, open, closed: queries.length - open };
  }, [queries]);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function handleEdit(query: ProjectQuery) {
    setEditing(query);
    setFormOpen(true);
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this query? This cannot be undone.")) return;
    deleteM.mutate(id);
  }

  return (
    <div className="space-y-4">
      {/* ── Header row ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">Queries / RFI register</h3>
          <p className="text-xs text-muted mt-0.5">
            Questions raised to the client (GIC) about EOT / delay matters, with the response received and its status.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <Plus className="size-4" /> Add query
        </button>
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryStat icon={MessageSquareText} label="Total queries" value={stats.total} tone="navy" />
        <SummaryStat icon={CircleDot} label="Open" value={stats.open} tone="warning" />
        <SummaryStat icon={CircleDot} label="Closed" value={stats.closed} tone="success" />
      </div>

      {isLoading ? (
        <Card className="p-10 text-center text-sm text-muted inline-flex items-center justify-center gap-2 w-full">
          <Loader2 className="size-4 animate-spin" /> Loading queries…
        </Card>
      ) : queries.length === 0 ? (
        <Card className="p-10 text-center">
          <span className="size-12 mx-auto rounded-xl bg-navy-50 text-navy-600 grid place-items-center">
            <MessageSquareText className="size-6" />
          </span>
          <h3 className="mt-3 font-semibold text-ink">No queries yet</h3>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            Raise a query / RFI to the client for missing information or clarifications. Record the GIC response and
            close the query once it's answered.
          </p>
          <button className="btn btn-primary btn-sm mt-4 inline-flex" onClick={openAdd}>
            <Plus className="size-4" /> Add query
          </button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm border-collapse min-w-[1040px]">
              <thead>
                <tr className="bg-navy-50/60 text-left text-xs font-semibold text-muted uppercase tracking-wide">
                  <Th className="w-12 text-center">Sl.</Th>
                  <Th className="w-28">Date of RFI</Th>
                  <Th className="w-48">EOT / Delay description</Th>
                  <Th className="min-w-[240px]">Description of query</Th>
                  <Th className="min-w-[240px]">Response from GIC</Th>
                  <Th className="w-32">Date of response</Th>
                  <Th className="w-24">Status</Th>
                  <Th className="min-w-[140px]">Remarks</Th>
                  <Th className="w-24 text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queries.map((q, i) => (
                  <tr key={q.id} className="align-top hover:bg-navy-50/30 transition-colors">
                    <Td className="text-center tabular-nums text-muted font-medium">{i + 1}</Td>
                    <Td className="whitespace-nowrap tabular-nums">{dateOrDash(q.dateOfRfi)}</Td>
                    <Td className="font-medium text-ink">{q.eotDescription || "—"}</Td>
                    <Td className="text-ink/90 whitespace-pre-wrap leading-snug">{q.queryDescription || "—"}</Td>
                    <Td className="text-ink/90 whitespace-pre-wrap leading-snug">
                      {q.responseFromGic || <span className="text-faint italic">Awaiting response</span>}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">{dateOrDash(q.dateOfResponse)}</Td>
                    <Td>
                      <Badge tone={statusTone[q.status] ?? "neutral"} dot>{q.status}</Badge>
                    </Td>
                    <Td className="text-muted whitespace-pre-wrap leading-snug">{q.remarks || "—"}</Td>
                    <Td className="text-right whitespace-nowrap">
                      <button
                        className="btn btn-ghost btn-sm px-2"
                        onClick={() => handleEdit(q)}
                        aria-label="Edit query"
                        title="Edit"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm px-2 text-error"
                        onClick={() => handleDelete(q.id)}
                        aria-label="Delete query"
                        title="Delete"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {formOpen && (
        <QueryFormModal
          projectId={projectId}
          query={editing ?? undefined}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof MessageSquareText;
  label: string;
  value: number;
  tone: "navy" | "warning" | "success";
}) {
  const toneBg: Record<string, string> = {
    navy: "bg-navy-100 text-navy-700",
    warning: "bg-warning-bg text-warning",
    success: "bg-success-bg text-success",
  };
  return (
    <Card className="p-4 flex items-center gap-3">
      <span className={`size-10 shrink-0 rounded-lg grid place-items-center ${toneBg[tone]}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold font-display tabular-nums text-ink leading-none">{value}</p>
        <p className="text-xs text-muted mt-1 truncate">{label}</p>
      </div>
    </Card>
  );
}
