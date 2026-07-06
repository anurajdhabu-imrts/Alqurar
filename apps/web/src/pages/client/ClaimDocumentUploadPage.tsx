import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Info } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { UploadedDocsList } from "@/components/client/UploadedDocsList";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { useAssignedProposals } from "@/hooks/useAssignments";
import { useProjectDocuments, useCreateProjectDoc } from "@/hooks/useProjectDocuments";
import { useHasPermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/store/authStore";

/**
 * Claim Document Upload — the client picks one of the proposals assigned to them
 * and uploads their documents into it. Client uploads are stored but NOT analysed:
 * analysis is a staff action, run by an Al Qarar admin from the proposal
 * workspace. (The upload endpoint refuses to analyse client uploads server-side.)
 */
export function ClaimDocumentUploadPage() {
  const canUpload = useHasPermission("client.documents.upload");
  const user = useAuthStore((s) => s.user);
  const { proposals } = useAssignedProposals();
  const createDoc = useCreateProjectDoc();
  const [params, setParams] = useSearchParams();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default the selection to ?project= (if valid) or the first assigned proposal —
  // computed at render (no effect) so it doesn't cause a cascading render.
  const fromParam = params.get("project");
  const effectiveId =
    selectedId ??
    (proposals.length
      ? fromParam && proposals.some((p) => p.id === fromParam)
        ? fromParam
        : proposals[0].id
      : null);

  const selected = useMemo(() => proposals.find((p) => p.id === effectiveId) ?? null, [proposals, effectiveId]);
  const { data: selectedDocs = [] } = useProjectDocuments(selected?.id ?? "");

  function changeProposal(id: string) {
    setSelectedId(id);
    setParams(id ? { project: id } : {}, { replace: true });
  }

  // Upload each file against the selected proposal. Client uploads are stored but
  // not analysed — an admin runs analysis later from the proposal workspace.
  function handleUploaded(file: File) {
    if (!selected) return;
    createDoc.mutate({ file, projectId: selected.id, uploadedBy: user?.name ?? "Client" });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Upload"
        subtitle="Choose a proposal and upload your documents. Your Al Qarar team reviews and analyses them."
      />

      {proposals.length === 0 ? (
        <Card>
          <p className="px-5 py-8 text-center text-sm text-muted">No proposals have been assigned to you yet.</p>
        </Card>
      ) : (
        <>
          {/* Proposal to upload into */}
          <Card>
            <div className="px-5 py-4">
              <label className="label" htmlFor="proposal-select">Upload to proposal</label>
              <select
                id="proposal-select"
                className="input max-w-md"
                value={effectiveId ?? ""}
                onChange={(e) => changeProposal(e.target.value)}
              >
                {proposals.map((p) => (
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
                <CardHeader title="Your uploaded documents" subtitle={`${selectedDocs.length} document(s)`} />
                <UploadedDocsList docs={selectedDocs} />
              </Card>

              <Card>
                <CardHeader
                  title="Upload documents"
                  subtitle="Uploaded to this proposal for your Al Qarar team to review."
                />
                <div className="p-5 space-y-3">
                  <div className="flex items-start gap-2 rounded-lg bg-navy-50/60 px-3 py-2.5 text-xs text-navy-700">
                    <Info className="size-4 shrink-0 mt-px text-navy-500" />
                    <span>Your documents are sent to the Al Qarar team. They'll be reviewed and analysed by an analyst — you don't need to do anything else.</span>
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
                    <p className="text-sm text-muted">
                      You do not have permission to upload documents. Contact your administrator.
                    </p>
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
