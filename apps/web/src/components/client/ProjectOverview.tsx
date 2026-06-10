import { CalendarClock, Coins, Gavel, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { claimStatusTone, noticeStatusTone, riskTone } from "@/lib/status";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Project } from "@/types";
import { claimsForProject, noticesForProject } from "@/mock/clientData";

/** Read-only project overview — no edit controls (client cannot edit projects). */
export function ProjectOverview({ project }: { project: Project }) {
  const claims = claimsForProject(project.name);
  const notices = noticesForProject(project.name);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Contract value"
          value={formatCurrency(project.value, project.currency)}
          icon={Coins}
          tone="navy"
          sub={`${project.standard}`}
        />
        <StatCard
          label="Completion"
          value={formatDate(project.completionDate)}
          icon={CalendarClock}
          tone="amber"
          sub={`Started ${formatDate(project.startDate)}`}
        />
        <StatCard label="Active claims" value={claims.length} icon={Gavel} tone="warning" sub="Linked to this project" />
        <StatCard label="Risk level" value={project.riskLevel} icon={ShieldAlert} tone="error" sub={`Status: ${project.status}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Project details */}
        <Card>
          <CardHeader title="Project details" subtitle="Read-only" />
          <dl className="px-5 py-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-faint">Project code</dt>
              <dd className="font-medium text-ink">{project.code}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Contract standard</dt>
              <dd className="font-medium text-ink">{project.standard}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Employer</dt>
              <dd className="font-medium text-ink">{project.employer}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Contractor</dt>
              <dd className="font-medium text-ink">{project.contractor}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Status</dt>
              <dd>
                <Badge tone={project.status === "Active" ? "info" : "neutral"}>{project.status}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Risk</dt>
              <dd>
                <Badge tone={riskTone[project.riskLevel]}>{project.riskLevel}</Badge>
              </dd>
            </div>
          </dl>
        </Card>

        {/* Claims summary (read-only) */}
        <Card>
          <CardHeader title="Claims & notices" subtitle="Summary for this project" />
          <div className="px-5 py-4 space-y-2.5">
            {claims.length === 0 && notices.length === 0 && (
              <p className="text-sm text-muted">No claims or notices recorded for this project.</p>
            )}
            {claims.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-ink truncate">{c.ref}</p>
                  <p className="text-xs text-muted truncate">{c.title}</p>
                </div>
                <Badge tone={claimStatusTone[c.status]}>{c.status}</Badge>
              </div>
            ))}
            {notices.map((n) => (
              <div key={n.id} className="flex items-center justify-between gap-3 text-sm border-t border-border pt-2.5">
                <div className="min-w-0">
                  <p className="font-medium text-ink truncate">{n.clause}</p>
                  <p className="text-xs text-muted truncate">Due {formatDate(n.dueDate)}</p>
                </div>
                <Badge tone={noticeStatusTone[n.status]}>{n.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
