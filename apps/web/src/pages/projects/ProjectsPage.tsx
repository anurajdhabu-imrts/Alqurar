import { useMemo, useState, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, FolderKanban, MapPin, Pencil, Plus, Search, Trash2, UserPlus, Users } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { AssignClientsModal } from "@/components/projects/AssignClientsModal";
import { useProjectClients } from "@/hooks/useAssignments";
import { useAllProjects, useDeleteProject, type ProjectDetails } from "@/store/projects";
import { formatCurrency } from "@/lib/utils";
import type { Project } from "@/types";

const statusTone: Record<Project["status"], Tone> = {
  Active: "success",
  Closeout: "warning",
  Completed: "info",
};

/** One project card. Reads its assigned-client count from the backend (the
 * source of truth) so it stays in step with what the client actually sees. */
function ProjectCard({
  project,
  onOpen,
  onAssign,
  onEdit,
  onDelete,
}: {
  project: ProjectDetails;
  onOpen: () => void;
  onAssign: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { data: clientIds } = useProjectClients(project.id);
  const count = clientIds?.length ?? 0;
  const canManage = project.source === "created";
  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <Card className="p-5 card-hover cursor-pointer" onClick={onOpen}>
      <div className="flex items-start justify-between gap-3">
        <span className="size-10 rounded-xl bg-linear-to-br from-navy-700 to-navy-900 text-amber-400 grid place-items-center font-bold shrink-0">
          <FolderKanban className="size-5" />
        </span>
        <div className="flex items-center gap-1">
          <Badge tone={statusTone[project.status]} dot>{project.status}</Badge>
          {canManage && (
            <>
              <button className="btn btn-ghost px-1.5 h-7" onClick={stop(onEdit)} title="Edit project" aria-label="Edit project">
                <Pencil className="size-3.5" />
              </button>
              <button className="btn btn-ghost px-1.5 h-7 text-error hover:bg-error-bg" onClick={stop(onDelete)} title="Delete project" aria-label="Delete project">
                <Trash2 className="size-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
      <h3 className="mt-3 font-semibold text-ink leading-snug">{project.name}</h3>
      <p className="text-xs text-muted mt-0.5">{project.code} · {project.standard}</p>

      <div className="mt-3 space-y-1.5 text-xs text-muted">
        {project.location && (
          <p className="flex items-center gap-1.5"><MapPin className="size-3.5 text-faint" /> {project.location}</p>
        )}
        <p className="flex items-center gap-1.5"><Building2 className="size-3.5 text-faint" /> {project.contractor || "—"}{project.employer ? ` · ${project.employer}` : ""}</p>
      </div>

      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">{project.value ? formatCurrency(project.value) : "—"}</span>
        <span className="text-xs text-faint">{project.currency}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <Users className="size-3.5 text-faint" />
          {count} client{count === 1 ? "" : "s"}
        </span>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm" onClick={stop(onAssign)}>
            <UserPlus className="size-3.5" /> Assign
          </button>
          <button className="btn btn-primary btn-sm" onClick={stop(onOpen)}>
            Open <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const projects = useAllProjects();
  const deleteProject = useDeleteProject();
  const [query, setQuery] = useState("");
  const [assignProject, setAssignProject] = useState<ProjectDetails | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectDetails | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.employer.toLowerCase().includes(q) ||
        p.contractor.toLowerCase().includes(q),
    );
  }, [projects, query]);

  const summary = [
    { label: "Total projects", value: projects.length },
    { label: "Active", value: projects.filter((p) => p.status === "Active").length },
    { label: "Created here", value: projects.filter((p) => p.source === "created").length },
    { label: "Closeout", value: projects.filter((p) => p.status === "Closeout").length },
  ];

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Every engagement Al Qarar runs. A project is the hub for documents, delay events, windows analysis and the EOT claim."
        actions={
          <Link to="/projects/new" className="btn btn-primary">
            <Plus className="size-4" /> New project
          </Link>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {summary.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-xs font-medium text-muted">{s.label}</p>
            <p className="mt-1 text-2xl font-bold font-display text-ink tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
          <input className="input pl-9" placeholder="Search by project, code or party…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <span className="text-sm text-muted ml-auto">{filtered.length} of {projects.length} projects</span>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <div className="px-5 py-16 text-center">
            <FolderKanban className="size-8 text-faint mx-auto mb-3" />
            <p className="text-sm text-muted">
              {projects.length === 0 ? "No projects yet. Click “New project” to set one up." : "No projects match your search."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={() => navigate(`/projects/${p.id}`)}
              onAssign={() => setAssignProject(p)}
              onEdit={() => navigate(`/projects/${p.id}/edit`)}
              onDelete={() => setDeleteTarget(p)}
            />
          ))}
        </div>
      )}

      {assignProject && (
        <AssignClientsModal project={assignProject} onClose={() => setAssignProject(null)} />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete project?"
        message={deleteTarget ? `“${deleteTarget.name}” will be permanently removed. This can't be undone.` : ""}
        confirmLabel="Delete project"
        onConfirm={() => {
          if (deleteTarget) deleteProject.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
