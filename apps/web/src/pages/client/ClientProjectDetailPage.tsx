import { useMemo } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAssignedProjects } from "@/hooks/useAssignments";
import { ProjectOverview } from "@/components/client/ProjectOverview";
import { UploadedDocsList } from "@/components/client/UploadedDocsList";
import { getProjectById, useClaimDocuments } from "@/mock/clientData";

export function ClientProjectDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const allDocs = useClaimDocuments();
  const { projects: assignedProjects, isLoading } = useAssignedProjects();

  const project = getProjectById(id);
  const assigned = assignedProjects.some((p) => p.id === id);

  const docs = useMemo(() => allDocs.filter((d) => d.projectId === id), [allDocs, id]);

  // Wait for the assignment list before deciding access (avoids a flash redirect).
  if (isLoading) {
    return <div className="py-16 text-center text-sm text-muted">Loading…</div>;
  }

  // A client may only view projects assigned to them.
  if (!project || !assigned) {
    const fallback = assignedProjects[0];
    return <Navigate to={fallback ? `/client/projects/${fallback.id}` : "/client/projects"} replace />;
  }

  return (
    <div className="space-y-6">
      <button
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
        onClick={() => navigate("/client/projects")}
      >
        <ArrowLeft className="size-4" /> Back to projects
      </button>

      <PageHeader
        title={project.name}
        subtitle={`${project.code} · ${project.employer}`}
      />

      <ProjectOverview project={project} />

      <Card>
        <CardHeader title="Uploaded claim documents" subtitle={`${docs.length} document(s)`} />
        <UploadedDocsList docs={docs} />
      </Card>
    </div>
  );
}
