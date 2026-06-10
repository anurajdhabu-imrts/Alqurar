import { useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { obligationTone } from "@/lib/status";
import { formatDate, relativeDays } from "@/lib/utils";
import { obligations } from "@/mock/data";
import type { Obligation } from "@/types";

const STATUSES: (Obligation["status"] | "All")[] = ["All", "Open", "In Progress", "Met", "Overdue"];

export function ObligationsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Obligation["status"] | "All">("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...obligations]
      .filter((o) => (status === "All" || o.status === status))
      .filter((o) => !q || o.description.toLowerCase().includes(q) || o.contractRef.toLowerCase().includes(q))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [query, status]);

  return (
    <>
      <PageHeader
        title="Obligation Register"
        subtitle="Contractual obligations extracted across all projects — each linked to a responsible party, due date and clause."
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
          <input className="input pl-9" placeholder="Search obligations…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted" />
          <select className="input w-auto pr-8" value={status} onChange={(e) => setStatus(e.target.value as Obligation["status"] | "All")}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>
            ))}
          </select>
        </div>
        <span className="text-sm text-muted ml-auto">{filtered.length} obligations</span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-faint border-b border-border bg-navy-50/40">
                <th className="font-semibold px-5 py-3">Obligation</th>
                <th className="font-semibold px-3 py-3">Responsible</th>
                <th className="font-semibold px-3 py-3">Contract</th>
                <th className="font-semibold px-3 py-3">Due</th>
                <th className="font-semibold px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0 hover:bg-navy-50/50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-ink">{o.description}</p>
                    <p className="text-xs text-faint">Clause {o.reference}</p>
                  </td>
                  <td className="px-3 py-3 text-muted">{o.responsibleParty}</td>
                  <td className="px-3 py-3 text-muted whitespace-nowrap">{o.contractRef}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="text-ink">{formatDate(o.dueDate)}</span>
                    <span className="block text-xs text-faint">{relativeDays(o.dueDate)}</span>
                  </td>
                  <td className="px-5 py-3"><Badge tone={obligationTone[o.status]} dot>{o.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
