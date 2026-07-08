import { useMemo, useState } from "react";
import { FolderKanban, Info } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { UploadedDocsList } from "@/components/client/UploadedDocsList";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { useAssignedProjects } from "@/hooks/useAssignments";
import { useProjectDocuments, useCreateProjectDoc } from "@/hooks/useProjectDocuments";
import { useHasPermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/store/authStore";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Project } from "@/types";

const statusTone: Record<Project["status"], Tone> = {
  Active: "success",
  Closeout: "warning",
  Completed: "info",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-faint uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-ink mt-0.5">{value || "—"}</p>
    </div>
  );
}

/** Client Projects page — overview of the client's assigned projects, and upload
 *  documents into the selected one (reuses the existing upload panel). */
export function ClientProjectsPage() {
  const canUpload = useHasPermission("client.documents.upload");
  const user = useAuthStore((s) => s.user);
  const { projects, isLoading } = useAssignedProjects();
  const createDoc = useCreateProjectDoc();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const effectiveId = selectedId ?? (projects.length ? projects[0].id : null);
  const selected = useMemo(
    () => projects.find((p) => p.id === effectiveId) ?? null,
    [projects, effectiveId],
  );
  const { data: docs = [] } = useProjectDocuments(selected?.id ?? "");

  function handleUploaded(file: File) {
    if (!selected) return;
    createDoc.mutate({ file, projectId: selected.id, uploadedBy: user?.name ?? "Client" });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Projects" subtitle="Your assigned projects — review the overview and upload documents." />

      {isLoading ? (
        <Card className="p-10 text-center text-sm text-muted">Loading your projects…</Card>
      ) : projects.length === 0 ? (
        <Card>
          <div className="px-5 py-16 text-center">
            <FolderKanban className="size-8 text-faint mx-auto mb-3" />
            <p className="text-sm text-muted">No projects have been assigned to you yet.</p>
          </div>
        </Card>
      ) : (
        <>
          {projects.length > 1 && (
            <Card>
              <div className="px-5 py-4">
                <label className="label" htmlFor="project-select">Project</label>
                <select
                  id="project-select"
                  className="input max-w-md"
                  value={effectiveId ?? ""}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {p.code}</option>
                  ))}
                </select>
              </div>
            </Card>
          )}

          {selected && (
            <>
              {/* Overview */}
              <Card>
                <CardHeader
                  title={selected.name}
                  subtitle={`${selected.code}${selected.standard ? ` · ${selected.standard}` : ""}`}
                  action={<Badge tone={statusTone[selected.status]} dot>{selected.status}</Badge>}
                />
                <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-5">
                  <Field label="Employer" value={selected.employer} />
                  <Field label="Contractor" value={selected.contractor} />
                  <Field label="Contract" value={selected.standard} />
                  <Field label="Value" value={selected.value ? `${formatCurrency(selected.value)} ${selected.currency}` : ""} />
                  <Field label="Start date" value={selected.startDate ? formatDate(selected.startDate) : ""} />
                  <Field label="Completion" value={selected.completionDate ? formatDate(selected.completionDate) : ""} />
                </div>
              </Card>

              {/* Uploaded documents */}
              <Card>
                <CardHeader title="Your uploaded documents" subtitle={`${docs.length} document(s)`} />
                <UploadedDocsList docs={docs} />
              </Card>

              {/* Upload */}
              <Card>
                <CardHeader title="Upload documents" subtitle="Uploaded to this project for your Al Qarar team." />
                <div className="p-5 space-y-3">
                  <div className="flex items-start gap-2 rounded-lg bg-navy-50/60 px-3 py-2.5 text-xs text-navy-700">
                    <Info className="size-4 shrink-0 mt-px text-navy-500" />
                    <span>Your documents are sent to the Al Qarar team for review — you don't need to do anything else.</span>
                  </div>
                  {canUpload ? (
                    <DocumentsPanel
                      key={selected.id}
                      seed={[]}
                      kind="claim"
                      claimContext={{ standard: selected.standard }}
                      onUploaded={handleUploaded}
                      autoAnalyze={false}
                    />
                  ) : (
                    <p className="text-sm text-muted">You do not have permission to upload documents. Contact your administrator.</p>
                  )}
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
