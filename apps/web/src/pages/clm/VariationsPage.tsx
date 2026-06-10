import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { variationTone } from "@/lib/status";
import { formatCurrencyFull, formatDate } from "@/lib/utils";
import { contracts } from "@/mock/data";
import type { Variation } from "@/types";

type Row = Variation & { contractRef: string; project: string; currency: string };

const STATUSES: (Variation["status"] | "All")[] = ["All", "Notified", "Under Assessment", "Agreed", "Disputed"];

const rows: Row[] = contracts.flatMap((c) =>
  c.variations.map((v) => ({ ...v, contractRef: c.ref, project: c.project, currency: c.currency })),
);

export function VariationsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Variation["status"] | "All">("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => status === "All" || r.status === status)
      .filter((r) => !q || r.ref.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) || r.project.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [query, status]);

  const count = (s: Variation["status"]) => rows.filter((r) => r.status === s).length;

  return (
    <>
      <PageHeader
        title="Variations & Change Orders"
        subtitle="Every contract variation across the portfolio, with status tracking from notification to agreement."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {(["Notified", "Under Assessment", "Agreed", "Disputed"] as Variation["status"][]).map((s) => (
          <Card key={s} className="p-5">
            <Badge tone={variationTone[s]} dot>{s}</Badge>
            <p className="mt-3 text-3xl font-bold font-display text-ink tabular-nums">{count(s)}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
          <input className="input pl-9" placeholder="Search variations…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted" />
          <select className="input w-auto pr-8" value={status} onChange={(e) => setStatus(e.target.value as Variation["status"] | "All")}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>
            ))}
          </select>
        </div>
        <span className="text-sm text-muted ml-auto">{filtered.length} variations</span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-faint border-b border-border bg-navy-50/40">
                <th className="font-semibold px-5 py-3">Variation</th>
                <th className="font-semibold px-3 py-3">Contract</th>
                <th className="font-semibold px-3 py-3 text-right">Value</th>
                <th className="font-semibold px-3 py-3">Date</th>
                <th className="font-semibold px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={`${r.contractRef}-${r.id}`} className="border-b border-border last:border-0 hover:bg-navy-50/50">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-ink">{r.ref} · {r.title}</p>
                    <p className="text-xs text-faint truncate max-w-[280px]">{r.project}</p>
                  </td>
                  <td className="px-3 py-3">
                    <Link to={`/contracts/${r.contractRef}`} className="text-navy-600 hover:text-navy-800 whitespace-nowrap">{r.contractRef}</Link>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium text-ink whitespace-nowrap">{formatCurrencyFull(r.value, r.currency)}</td>
                  <td className="px-3 py-3 text-muted whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="px-5 py-3"><Badge tone={variationTone[r.status]} dot>{r.status}</Badge></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-muted">No variations match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
