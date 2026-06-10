import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProjectCard } from "@/components/client/ProjectCard";
import { useAssignedProjects } from "@/hooks/useAssignments";
import { useClaimDocuments } from "@/mock/clientData";

export function ClientProjectsPage() {
  const navigate = useNavigate();
  const allDocs = useClaimDocuments();

  const { projects } = useAssignedProjects();
  const docCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of allDocs) map.set(d.projectId, (map.get(d.projectId) ?? 0) + 1);
    return map;
  }, [allDocs]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        subtitle="Projects assigned to you. You have read-only access to project details."
      />

      {projects.length === 0 ? (
        <Card>
          <p className="px-5 py-8 text-center text-sm text-muted">No projects have been assigned to you yet.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              docCount={docCount.get(p.id) ?? 0}
              onClick={() => navigate(`/client/projects/${p.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
