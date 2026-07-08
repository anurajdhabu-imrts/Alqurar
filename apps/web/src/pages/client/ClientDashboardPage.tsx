import { Link } from "react-router-dom";
import { ArrowRight, FileSignature, FolderKanban, Mail, UserCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { useAuthStore } from "@/store/authStore";
import { useAssignedProjects, useAssignedProposals } from "@/hooks/useAssignments";

export function ClientDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { projects, isLoading: projectsLoading } = useAssignedProjects();
  const { proposals } = useAssignedProposals();

  return (
    <div className="space-y-6 animate-in">
      <PageHeader
        title={`Welcome, ${user?.name ?? "Client"}`}
        subtitle="Your projects and proposal at a glance."
      />

      {/* Client details */}
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
              <dd className="font-medium text-ink"><Badge tone="navy">{user?.role}</Badge></dd>
            </div>
          </div>
        </dl>
      </Card>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Assigned projects" value={projects.length} icon={FolderKanban} tone="emerald" />
        <StatCard label="Proposals" value={proposals.length} icon={FileSignature} tone="gold" />
      </div>

      {/* Assigned projects summary */}
      <Card>
        <CardHeader
          title="Your projects"
          subtitle="Projects Al Qarar has assigned to you"
          action={
            <Link to="/client/projects" className="text-sm font-semibold text-navy-600 hover:text-navy-800 inline-flex items-center gap-1">
              View all <ArrowRight className="size-4" />
            </Link>
          }
        />
        <div className="divide-y divide-border">
          {projectsLoading && <p className="px-5 py-6 text-sm text-muted">Loading your projects…</p>}
          {!projectsLoading && projects.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted">No projects assigned yet.</p>
          )}
          {projects.map((p) => (
            <Link
              key={p.id}
              to="/client/projects"
              className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-navy-50/40 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="size-10 rounded-xl bg-linear-to-br from-navy-700 to-navy-900 text-emerald-300 grid place-items-center shrink-0">
                  <FolderKanban className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{p.name}</p>
                  <p className="text-xs text-muted truncate">
                    {p.code}{p.standard ? ` · ${p.standard}` : ""}{p.employer ? ` · ${p.employer}` : ""}
                  </p>
                </div>
              </div>
              <ArrowRight className="size-4 text-faint shrink-0" />
            </Link>
          ))}
        </div>
      </Card>

      {/* Proposal shortcut */}
      <Card className="p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="size-10 rounded-xl bg-linear-to-br from-gold-400 to-gold-600 text-white grid place-items-center shrink-0">
            <FileSignature className="size-5" />
          </span>
          <div>
            <p className="font-semibold text-ink">Your proposal</p>
            <p className="text-xs text-muted">View the proposal Al Qarar prepared and download the PDF.</p>
          </div>
        </div>
        <Link to="/client/proposals" className="btn btn-primary btn-sm">
          View proposal <ArrowRight className="size-4" />
        </Link>
      </Card>
    </div>
  );
}
