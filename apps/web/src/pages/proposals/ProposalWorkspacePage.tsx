import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Building2, Calculator, FileSignature, ListChecks, Loader2, Paperclip, Sparkles } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { UploadedDocsList } from "@/components/client/UploadedDocsList";
import { ProposalDelayEventsTab } from "@/components/proposals/ProposalDelayEventsTab";
import { ProposalCostSheetTab } from "@/components/proposals/ProposalCostSheetTab";
import { ProposalCostingTab } from "@/components/proposals/ProposalCostingTab";
import { useProjectDocuments, useCreateProjectDoc, useAnalyzePendingDocs } from "@/hooks/useProjectDocuments";
import { useProjectClients } from "@/hooks/useAssignments";
import { useUsersQuery } from "@/hooks/useUsers";
import { useClientProfiles } from "@/store/clientProfiles";
import { useProjectById, useProjectsQuery } from "@/store/projects";
import { useAuthStore } from "@/store/authStore";

/**
 * Proposal workspace — the 3-step flow for a single proposal:
 *   1. Documents   — upload the client's documents; AI analyses each (same as a
 *                    project's data room).
 *   2. Delay Events — AI identifies the delay events from those documents.
 *   3. Proposal    — AI generates the costed client proposal from the events.
 * A proposal is backed by a project record (kind = "proposal"), so it reuses the
 * exact same document / delay-event pipeline.
 */
export function ProposalWorkspacePage() {
  const { id = "" } = useParams();
  const proposal = useProjectById(id);
  const { isLoading: projectsLoading } = useProjectsQuery();

  const { data: docs = [] } = useProjectDocuments(id);
  const createDoc = useCreateProjectDoc();
  const analyzePending = useAnalyzePendingDocs(id);
  const currentUser = useAuthStore((s) => s.user);
  const unanalysedCount = docs.filter((d) => !d.analysis && d.driveFileId).length;

  // The client(s) linked to this proposal, resolved to display names.
  const { data: clientIds = [] } = useProjectClients(id);
  const { data: users = [] } = useUsersQuery();
  const profiles = useClientProfiles();
  const clientNames = useMemo(
    () =>
      clientIds.map((cid) => {
        const u = users.find((x) => x.id === cid);
        const prof = profiles.find(
          (p) => p.userId === cid || (u && p.email.toLowerCase() === u.email.toLowerCase()),
        );
        return prof?.company ?? u?.name ?? cid;
      }),
    [clientIds, users, profiles],
  );

  const [tab, setTab] = useState("documents");

  if (!proposal) {
    if (projectsLoading) {
      return (
        <div className="text-center py-20 text-sm text-muted inline-flex items-center justify-center gap-2 w-full">
          <Loader2 className="size-4 animate-spin" /> Loading proposal…
        </div>
      );
    }
    return (
      <div className="text-center py-20">
        <p className="text-lg font-semibold text-ink">Proposal not found</p>
        <p className="text-muted mt-1">It may have been deleted.</p>
        <Link to="/proposals" className="btn btn-outline mt-4 inline-flex">Back to proposals</Link>
      </div>
    );
  }

  function handleUploaded(file: File) {
    createDoc.mutate({ file, projectId: id, uploadedBy: currentUser?.name ?? "Al Qarar" });
  }

  return (
    <>
      <Link to="/proposals" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy-700 mb-4">
        <ArrowLeft className="size-4" /> Proposals
      </Link>

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-[26px] leading-tight font-bold text-ink tracking-tight">{proposal.name}</h1>
        <p className="text-sm text-faint mt-1">
          {proposal.code}
          {proposal.standard ? ` · ${proposal.standard}` : ""}
          {proposal.employer ? ` · ${proposal.employer}` : ""}
        </p>
        {clientNames.length > 0 && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted">
            <Building2 className="size-4 text-navy-500" />
            {clientNames.join(", ")}
          </p>
        )}
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "documents", label: "1 · Documents", icon: Paperclip, count: docs.length },
          { id: "events", label: "2 · Delay Events", icon: ListChecks },
          { id: "costing", label: "3 · Costing", icon: Calculator },
          { id: "proposal", label: "4 · Proposal", icon: FileSignature },
        ]}
      />

      <div className="pt-5">
        {/* ── 1 · Documents ── */}
        {tab === "documents" && (
          <div className="space-y-4">
            <Card className="p-5">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-ink">Documents</h3>
                <p className="text-sm text-muted">
                  Upload the client's contract, programme, correspondence and site records. Each file is read by AI,
                  which classifies it and explains how it bears on the claim. The delay events are identified from here.
                </p>
              </div>
              <DocumentsPanel
                seed={[]}
                kind="claim"
                claimContext={{ standard: proposal.standard }}
                onUploaded={handleUploaded}
                autoAnalyze={false}
              />
            </Card>

            <Card>
              <CardHeader
                title="Uploaded documents"
                subtitle={`${docs.length} document(s)`}
                action={
                  unanalysedCount > 0 ? (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => analyzePending.mutate()}
                      disabled={analyzePending.isPending}
                    >
                      {analyzePending.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                      Analyse {unanalysedCount} pending
                    </button>
                  ) : undefined
                }
              />
              <UploadedDocsList docs={docs} />
            </Card>
          </div>
        )}

        {/* ── 2 · Delay Events ── */}
        {tab === "events" && <ProposalDelayEventsTab proposalId={id} />}

        {/* ── 3 · Costing (employee-hours costing sheet; standalone) ── */}
        {tab === "costing" && <ProposalCostSheetTab proposalId={id} />}

        {/* ── 4 · Proposal (existing AI proposal generation — unchanged) ── */}
        {tab === "proposal" && <ProposalCostingTab proposalId={id} />}
      </div>
    </>
  );
}
