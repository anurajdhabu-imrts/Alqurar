import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ClipboardCheck, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProposalChecklistTab } from "@/components/proposals/ProposalChecklistTab";
import { useAssignedProposals } from "@/hooks/useAssignments";
import { useHasPermission } from "@/hooks/usePermission";

/**
 * Client → Document Checklist. The same EOT standard-documentation checklist the
 * Al Qarar analyst sees in the proposal workspace: the client answers each item
 * and uploads the document against it. Anything they attach here goes through the
 * ordinary upload pipeline, so it also lands in the proposal's Documents tab for
 * the team to review and analyse.
 */
export function ClientChecklistPage() {
  const canUpload = useHasPermission("client.documents.upload");
  const { proposals, isLoading } = useAssignedProposals();
  const [params, setParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default to ?project= (if valid) or the first assigned proposal — computed at
  // render (no effect) so it doesn't cause a cascading render.
  const fromParam = params.get("project");
  const effectiveId =
    selectedId ??
    (proposals.length
      ? fromParam && proposals.some((p) => p.id === fromParam)
        ? fromParam
        : proposals[0].id
      : null);

  const selected = useMemo(
    () => proposals.find((p) => p.id === effectiveId) ?? null,
    [proposals, effectiveId],
  );

  function changeProposal(id: string) {
    setSelectedId(id);
    setParams(id ? { project: id } : {}, { replace: true });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Checklist"
        subtitle="Tell us which standard EOT documents you have, and upload each one against its item."
      />

      {isLoading ? (
        <Card className="p-10 text-center text-sm text-muted">Loading…</Card>
      ) : proposals.length === 0 ? (
        <Card>
          <div className="px-5 py-16 text-center">
            <ClipboardCheck className="size-8 text-faint mx-auto mb-3" />
            <p className="text-sm text-muted">No proposals have been assigned to you yet.</p>
          </div>
        </Card>
      ) : (
        <>
          {proposals.length > 1 && (
            <Card>
              <div className="px-5 py-4">
                <label className="label" htmlFor="checklist-proposal-select">Proposal</label>
                <select
                  id="checklist-proposal-select"
                  className="input max-w-md"
                  value={effectiveId ?? ""}
                  onChange={(e) => changeProposal(e.target.value)}
                >
                  {proposals.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {p.code}</option>
                  ))}
                </select>
              </div>
            </Card>
          )}

          <div className="flex items-start gap-2 rounded-lg bg-navy-50/60 px-3 py-2.5 text-xs text-navy-700">
            <Info className="size-4 shrink-0 mt-px text-navy-500" />
            <span>
              Files you attach here are sent straight to your Al Qarar team for review — you don't need to upload them
              anywhere else.
            </span>
          </div>

          {selected && (
            <ProposalChecklistTab key={selected.id} proposalId={selected.id} canUpload={canUpload} />
          )}
        </>
      )}
    </div>
  );
}
