import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { riskTone } from "@/lib/status";
import { formatCurrency } from "@/lib/utils";
import { contracts } from "@/mock/data";

export function ContractsPage() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contracts;
    return contracts.filter(
      (c) =>
        c.ref.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.project.toLowerCase().includes(q) ||
        c.employer.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <>
      <PageHeader
        title="Contracts"
        subtitle="Central repository of construction contracts with AI-extracted clauses, risk scoring and obligations."
        actions={
          <button className="btn btn-primary">
            <Plus className="size-4" /> Add Contract
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
          <input
            className="input pl-9"
            placeholder="Search contracts, projects, employers…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="text-sm text-muted ml-auto">{filtered.length} contracts</span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-faint border-b border-border bg-navy-50/40">
                <th className="font-semibold px-5 py-3">Contract</th>
                <th className="font-semibold px-3 py-3">Standard</th>
                <th className="font-semibold px-3 py-3 text-right">Value</th>
                <th className="font-semibold px-3 py-3">Risk</th>
                <th className="font-semibold px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-navy-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <Link to={`/contracts/${c.ref}`} className="font-semibold text-ink hover:text-navy-700">{c.ref}</Link>
                    <p className="text-xs text-muted truncate max-w-[280px]">{c.title}</p>
                    <p className="text-xs text-faint truncate max-w-[280px]">{c.employer}</p>
                  </td>
                  <td className="px-3 py-3 text-muted whitespace-nowrap">{c.standard}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium text-ink whitespace-nowrap">{formatCurrency(c.value, c.currency)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums font-semibold text-ink">{c.riskScore}</span>
                      <Badge tone={riskTone[c.riskLevel]}>{c.riskLevel}</Badge>
                    </div>
                  </td>
                  <td className="px-5 py-3"><Badge tone={c.status === "Active" ? "info" : "neutral"}>{c.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
