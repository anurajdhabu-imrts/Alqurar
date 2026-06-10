import { Link } from "react-router-dom";
import { ArrowUpRight, BellRing, Coins, FileClock, Gavel, Plus, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { claimStatusTone, noticeStatusTone } from "@/lib/status";
import { formatCurrency, formatDate, relativeDays } from "@/lib/utils";
import { eotClaims, notices, obligations } from "@/mock/data";
import type { ClaimStatus } from "@/types";

const ACTIVE: ClaimStatus[] = ["Draft", "In Review", "Submitted", "Under Assessment"];

const STATUS_COLORS: Record<ClaimStatus, string> = {
  Draft: "#94a3b8",
  "In Review": "#2563eb",
  Submitted: "#2c5e94",
  "Under Assessment": "#d97706",
  Granted: "#1e8449",
  Rejected: "#c0392b",
};

export function DashboardPage() {
  const activeClaims = eotClaims.filter((c) => ACTIVE.includes(c.status));
  const daysUnderClaim = activeClaims.reduce((s, c) => s + c.daysClaimed, 0);
  const quantumAtStake = activeClaims.reduce((s, c) => s + c.quantum, 0);
  const noticeCompliance = Math.round(
    (notices.filter((n) => n.status === "Compliant").length / notices.length) * 100,
  );
  const openObligations = obligations.filter((o) => o.status !== "Met").length;

  const statusData = (Object.keys(STATUS_COLORS) as ClaimStatus[])
    .map((status) => ({ status, count: eotClaims.filter((c) => c.status === status).length }))
    .filter((d) => d.count > 0);
  const totalClaims = eotClaims.length;

  // Build the donut as a conic-gradient with hard slice edges.
  let acc = 0;
  const slices = statusData
    .map((d) => {
      const start = (acc / totalClaims) * 100;
      acc += d.count;
      const end = (acc / totalClaims) * 100;
      return `${STATUS_COLORS[d.status]} ${start}% ${end}%`;
    })
    .join(", ");

  const quantumData = [...activeClaims].sort((a, b) => b.quantum - a.quantum);
  const maxQuantum = Math.max(...quantumData.map((c) => c.quantum));

  const recentClaims = [...eotClaims]
    .sort((a, b) => b.updatedDate.localeCompare(a.updatedDate))
    .slice(0, 5);

  const upcomingNotices = [...notices]
    .filter((n) => n.status !== "Compliant")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Portfolio view across active EOT claims, contracts and notice obligations."
        actions={
          <Link to="/claims" className="btn btn-primary">
            <Plus className="size-4" /> New EOT Claim
          </Link>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Active Claims" value={activeClaims.length} sub={`${totalClaims} total in register`} icon={Gavel} tone="navy" delta="+2" deltaDir="up" spark={[3, 4, 4, 5, 4, 5, activeClaims.length]} />
        <StatCard label="Days Under Claim" value={daysUnderClaim} sub="Calendar days, active EOTs" icon={FileClock} tone="amber" delta="+12%" deltaDir="flat" spark={[64, 78, 86, 95, 110, 120, daysUnderClaim]} />
        <StatCard label="Quantum at Stake" value={formatCurrency(quantumAtStake)} sub="Across active claims" icon={Coins} tone="warning" delta="+8%" deltaDir="flat" spark={[6, 7, 7.5, 9, 10, 11, quantumAtStake / 1_000_000]} />
        <StatCard label="Notice Compliance" value={`${noticeCompliance}%`} sub={`${openObligations} open obligations`} icon={BellRing} tone={noticeCompliance >= 75 ? "success" : "error"} delta={noticeCompliance >= 75 ? "+3 pts" : "-6 pts"} deltaDir={noticeCompliance >= 75 ? "up" : "down"} spark={[70, 68, 72, 71, 74, 73, noticeCompliance]} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-4">
        <Card className="lg:col-span-3">
          <CardHeader title="Quantum at stake" subtitle="By active claim (prolongation cost)" />
          <div className="p-5 space-y-3">
            {quantumData.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <Link to={`/claims/${c.ref}`} className="w-16 shrink-0 text-xs font-medium text-navy-600 hover:text-navy-800 tabular-nums">
                  {c.ref.replace("EOT-", "")}
                </Link>
                <div className="flex-1 h-7 rounded-lg bg-navy-50 overflow-hidden">
                  <div
                    className="h-full rounded-lg bg-linear-to-r from-amber-400 to-amber-500 min-w-[2px]"
                    style={{ width: `${(c.quantum / maxQuantum) * 100}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-xs font-semibold text-ink tabular-nums">
                  {formatCurrency(c.quantum)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Claims by status" />
          <div className="p-5 flex flex-col sm:flex-row items-center gap-5">
            <div className="relative size-[150px] shrink-0">
              <div className="size-full rounded-full" style={{ background: `conic-gradient(${slices})` }} />
              <div className="absolute inset-[22%] rounded-full bg-card grid place-items-center">
                <div className="text-center">
                  <p className="text-2xl font-bold font-display text-ink leading-none">{totalClaims}</p>
                  <p className="text-[11px] text-muted mt-0.5">claims</p>
                </div>
              </div>
            </div>
            <ul className="flex-1 space-y-1.5 w-full">
              {statusData.map((d) => (
                <li key={d.status} className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[d.status] }} />
                  <span className="text-muted">{d.status}</span>
                  <span className="ml-auto font-semibold text-ink tabular-nums">{d.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-4">
        <Card className="lg:col-span-3 overflow-hidden">
          <CardHeader
            title="Recent claims"
            action={
              <Link to="/claims" className="text-sm font-semibold text-navy-600 hover:text-navy-800 flex items-center gap-1">
                View all <ArrowUpRight className="size-4" />
              </Link>
            }
          />
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-faint border-b border-border">
                  <th className="font-semibold px-5 py-2.5">Claim</th>
                  <th className="font-semibold px-3 py-2.5">Status</th>
                  <th className="font-semibold px-3 py-2.5 text-right">Days</th>
                  <th className="font-semibold px-5 py-2.5 text-right">Quantum</th>
                </tr>
              </thead>
              <tbody>
                {recentClaims.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-navy-50/50">
                    <td className="px-5 py-3">
                      <Link to={`/claims/${c.ref}`} className="font-semibold text-ink hover:text-navy-700">{c.ref}</Link>
                      <p className="text-xs text-muted truncate max-w-[260px]">{c.project}</p>
                    </td>
                    <td className="px-3 py-3"><Badge tone={claimStatusTone[c.status]} dot>{c.status}</Badge></td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink">{c.daysClaimed}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium text-ink">{formatCurrency(c.quantum)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Upcoming deadlines" subtitle="Notices needing action" action={<ShieldAlert className="size-4 text-warning" />} />
          <ul className="divide-y divide-border">
            {upcomingNotices.map((n) => (
              <li key={n.id} className="px-5 py-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{n.description}</p>
                  <p className="text-xs text-muted mt-0.5">{n.clause} · {n.project}</p>
                </div>
                <div className="text-right shrink-0">
                  <Badge tone={noticeStatusTone[n.status]}>{n.status}</Badge>
                  <p className="text-xs text-faint mt-1">{formatDate(n.dueDate)} · {relativeDays(n.dueDate)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
