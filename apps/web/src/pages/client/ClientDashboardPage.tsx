import { useMemo } from "react";
import { FileText, FolderKanban, Gavel, Mail, UserCircle2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { claimStatusTone } from "@/lib/status";
import { formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useAssignedProjects } from "@/hooks/useAssignments";
import { claimsForProject, useClaimDocuments } from "@/mock/clientData";

export function ClientDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const allDocs = useClaimDocuments();

  // Projects back the claim/document data but are no longer surfaced as UI.
  const { projects } = useAssignedProjects();
  const projectIds = useMemo(() => new Set(projects.map((p) => p.id)), [projects]);

  const claims = useMemo(() => projects.flatMap((p) => claimsForProject(p.name)), [projects]);
  const myDocCount = useMemo(() => allDocs.filter((d) => projectIds.has(d.projectId)).length, [allDocs, projectIds]);

  const recentClaims = useMemo(
    () => [...claims].sort((a, b) => b.updatedDate.localeCompare(a.updatedDate)).slice(0, 5),
    [claims],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${user?.name ?? "Client"}`}
        subtitle="Your claim status and uploaded documents."
      />

      {/* Client basic details */}
      <Card>
        <CardHeader title="Your details" />
        <dl className="px-5 py-4 grid gap-4 sm:grid-cols-3 text-sm">
          <div className="flex items-center gap-3">
            <span className="size-9 grid place-items-center rounded-lg bg-navy-50 text-navy-700">
              <UserCircle2 className="size-4" />
            </span>
            <div>
              <dt className="text-xs text-faint">Name</dt>
              <dd className="font-medium text-ink">{user?.name}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="size-9 grid place-items-center rounded-lg bg-navy-50 text-navy-700">
              <Mail className="size-4" />
            </span>
            <div className="min-w-0">
              <dt className="text-xs text-faint">Email</dt>
              <dd className="font-medium text-ink truncate">{user?.email}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="size-9 grid place-items-center rounded-lg bg-navy-50 text-navy-700">
              <FolderKanban className="size-4" />
            </span>
            <div>
              <dt className="text-xs text-faint">Role</dt>
              <dd className="font-medium text-ink">
                <Badge tone="navy">{user?.role}</Badge>
              </dd>
            </div>
          </div>
        </dl>
      </Card>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Total claims" value={claims.length} icon={Gavel} tone="amber" />
        <StatCard label="Uploaded documents" value={myDocCount} icon={FileText} tone="success" />
      </div>

      {/* Claim summary */}
      <Card>
        <CardHeader title="Recent claim activity" subtitle="Across your assigned projects" />
        <div className="px-5 py-4 space-y-2.5">
          {recentClaims.length === 0 && <p className="text-sm text-muted">No claims to show.</p>}
          {recentClaims.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-ink truncate">
                  {c.ref} · <span className="text-muted font-normal">{c.project}</span>
                </p>
                <p className="text-xs text-muted truncate">
                  {c.title} · updated {formatDate(c.updatedDate)}
                </p>
              </div>
              <Badge tone={claimStatusTone[c.status]}>{c.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
