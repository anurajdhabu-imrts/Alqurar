import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { noticeStatusTone } from "@/lib/status";
import { formatDate, relativeDays } from "@/lib/utils";
import { notices } from "@/mock/data";
import type { NoticeStatus } from "@/types";

const SUMMARY: { status: NoticeStatus; label: string }[] = [
  { status: "Compliant", label: "Compliant" },
  { status: "Due Soon", label: "Due soon" },
  { status: "Overdue", label: "Overdue" },
  { status: "Missed", label: "Missed" },
];

export function NoticesPage() {
  const sorted = [...notices].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const count = (s: NoticeStatus) => notices.filter((n) => n.status === s).length;

  return (
    <>
      <PageHeader
        title="Notice Timeline"
        subtitle="Contractual notice obligations (FIDIC 20.2, NEC Early Warning and others) mapped against actual notices issued."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {SUMMARY.map((s) => (
          <Card key={s.status} className="p-5">
            <Badge tone={noticeStatusTone[s.status]} dot>{s.label}</Badge>
            <p className="mt-3 text-3xl font-bold font-display text-ink tabular-nums">{count(s.status)}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-faint border-b border-border bg-navy-50/40">
                <th className="font-semibold px-5 py-3">Notice</th>
                <th className="font-semibold px-3 py-3">Clause</th>
                <th className="font-semibold px-3 py-3">Project</th>
                <th className="font-semibold px-3 py-3">Due</th>
                <th className="font-semibold px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((n) => (
                <tr key={n.id} className="border-b border-border last:border-0 hover:bg-navy-50/50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-ink">{n.description}</p>
                    {n.claimRef && (
                      <Link to={`/claims/${n.claimRef}`} className="text-xs text-navy-600 hover:text-navy-800">{n.claimRef}</Link>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted whitespace-nowrap">{n.clause}</td>
                  <td className="px-3 py-3 text-muted truncate max-w-[220px]">{n.project}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="text-ink">{formatDate(n.dueDate)}</span>
                    <span className="block text-xs text-faint">{relativeDays(n.dueDate)}</span>
                  </td>
                  <td className="px-5 py-3"><Badge tone={noticeStatusTone[n.status]} dot>{n.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
