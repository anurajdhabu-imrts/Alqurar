import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { UploadedDocsList } from "@/components/client/UploadedDocsList";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { GeneratedClaimDocument } from "@/components/client/GeneratedClaimDocument";
import { useAssignedProjects } from "@/hooks/useAssignments";
import { useHasPermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/store/authStore";
import { claimDocStore, docTypeFromName, useClaimDocuments } from "@/mock/clientData";
import type { DocumentAnalysisResult } from "@/api/documents";

/**
 * Claim Document Upload — the client picks one of their assigned projects from a
 * dropdown, then uploads a claim document into it. Each upload is sent for AI
 * analysis (reusing the same `DocumentsPanel` / `/documents/analyze` flow as the
 * Claim Registration module) and turned into a generated claim-document draft.
 */
export function ClaimDocumentUploadPage() {
  const canUpload = useHasPermission("client.documents.upload");
  const user = useAuthStore((s) => s.user);
  const allDocs = useClaimDocuments();
  const { projects } = useAssignedProjects();
  const [params, setParams] = useSearchParams();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<DocumentAnalysisResult[]>([]);

  // Default the selection to ?project= (if valid) or the first assigned project,
  // once the (async) assignment list has loaded.
  useEffect(() => {
    if (selectedId || projects.length === 0) return;
    const fromParam = params.get("project");
    setSelectedId(fromParam && projects.some((p) => p.id === fromParam) ? fromParam : projects[0].id);
  }, [projects, params, selectedId]);

  const selected = useMemo(() => projects.find((p) => p.id === selectedId) ?? null, [projects, selectedId]);
  const selectedDocs = useMemo(
    () => (selected ? allDocs.filter((d) => d.projectId === selected.id) : []),
    [allDocs, selected],
  );

  function changeProject(id: string) {
    setSelectedId(id);
    setAnalyses([]);
    setParams(id ? { project: id } : {}, { replace: true });
  }

  function handleAnalyzed(_filename: string, analysis: DocumentAnalysisResult) {
    setAnalyses((prev) => [analysis, ...prev.filter((a) => a.filename !== analysis.filename)]);
  }

  // Persist each upload against the selected project so it only ever shows there.
  function handleUploaded(file: File) {
    if (!selected) return;
    claimDocStore.add({
      id: `doc-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      projectId: selected.id,
      name: file.name,
      type: docTypeFromName(file.name),
      sizeKB: Math.max(1, Math.round(file.size / 1024)),
      uploadedAt: new Date().toISOString(),
      uploadedBy: user?.name ?? "Client",
      status: "Uploaded",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Claim Document Upload"
        subtitle="Choose a project, upload a claim document, and it's analysed by AI automatically."
      />

      {projects.length === 0 ? (
        <Card>
          <p className="px-5 py-8 text-center text-sm text-muted">No projects have been assigned to you yet.</p>
        </Card>
      ) : (
        <>
          {/* Project to upload into */}
          <Card>
            <div className="px-5 py-4">
              <label className="label" htmlFor="project-select">Upload to project</label>
              <select
                id="project-select"
                className="input max-w-md"
                value={selectedId ?? ""}
                onChange={(e) => changeProject(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.code}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          {selected && (
            <>
              <Card>
                <CardHeader title="Existing claim documents" subtitle={`${selectedDocs.length} document(s)`} />
                <UploadedDocsList docs={selectedDocs} />
              </Card>

              <Card>
                <CardHeader
                  title="Upload a claim document"
                  subtitle="Uploaded to this project and analysed by AI automatically."
                />
                <div className="p-5">
                  {canUpload ? (
                    <DocumentsPanel
                      key={selected.id}
                      seed={[]}
                      kind="claim"
                      claimContext={{ standard: selected.standard }}
                      onAnalyzed={handleAnalyzed}
                      onUploaded={handleUploaded}
                    />
                  ) : (
                    <p className="text-sm text-muted">
                      You do not have permission to upload documents. Contact your administrator.
                    </p>
                  )}
                </div>
              </Card>

              {analyses.length > 0 && (
                <Card>
                  <CardHeader
                    title="Claim Document"
                    subtitle="Generated from the AI analysis of your uploaded documents."
                  />
                  <div className="p-5 space-y-4">
                    {analyses.map((a) => (
                      <GeneratedClaimDocument key={a.filename} analysis={a} />
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
