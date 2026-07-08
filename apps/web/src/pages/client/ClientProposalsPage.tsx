import { useState } from "react";
import { Download, FileSignature, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProposalDocumentView } from "@/components/proposals/ProposalDocumentView";
import { useAssignedProposals } from "@/hooks/useAssignments";
import { useClientProposal } from "@/hooks/useClientProposal";
import type { ProjectDetails } from "@/store/projects";

/** One assigned proposal — shown only once Al Qarar has sent it to the client. */
function ClientProposalCard({ proposal }: { proposal: ProjectDetails }) {
  const { data, isLoading } = useClientProposal(proposal.id);
  const [downloading, setDownloading] = useState(false);

  const content = data?.content ?? null;
  // The client only ever sees a proposal that's been generated AND sent to them.
  const visible = data?.sentToClient === true && !!content;

  async function handleDownload() {
    if (!content) return;
    setDownloading(true);
    try {
      const { downloadProposalPdf, fetchAsDataUrl } = await import("@/lib/proposalPdf");
      const alqararLogo = await fetchAsDataUrl("/Al Qarar Logo.png");
      downloadProposalPdf(content, {
        clientLogo: data?.inputs?.logo,
        alqararLogo,
        clientCompany: data?.inputs?.clientCompany || proposal.employer,
        projectName: proposal.name,
        subject: data?.inputs?.subject,
      });
    } finally {
      setDownloading(false);
    }
  }

  if (isLoading) {
    return (
      <Card className="p-8 text-center text-sm text-muted inline-flex items-center justify-center gap-2 w-full">
        <Loader2 className="size-4 animate-spin" /> Loading proposal…
      </Card>
    );
  }
  if (!visible || !content) {
    return (
      <Card className="p-8 text-center">
        <FileSignature className="size-7 text-faint mx-auto mb-2" />
        <p className="font-semibold text-ink">{proposal.name}</p>
        <p className="mt-1 text-sm text-muted">Your proposal is being prepared — it will appear here once Al Qarar shares it.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border bg-navy-50/40">
        <div className="min-w-0">
          <p className="font-semibold text-ink truncate">{proposal.name}</p>
          <p className="text-xs text-muted truncate">{proposal.code}{proposal.standard ? ` · ${proposal.standard}` : ""}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleDownload} disabled={downloading}>
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Download Proposal
        </button>
      </div>
      <ProposalDocumentView content={content} clientLogo={data?.inputs?.logo} updatedAt={data?.updatedAt} model={data?.model} />
    </Card>
  );
}

/** Client Proposal page — view the proposal Al Qarar shared and download the PDF. */
export function ClientProposalsPage() {
  const { proposals, isLoading } = useAssignedProposals();

  return (
    <div className="space-y-6">
      <PageHeader title="Proposal" subtitle="The proposal Al Qarar has prepared for you — review it and download the PDF." />

      {isLoading ? (
        <Card className="p-10 text-center text-sm text-muted inline-flex items-center justify-center gap-2 w-full">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </Card>
      ) : proposals.length === 0 ? (
        <Card>
          <div className="px-5 py-16 text-center">
            <FileSignature className="size-8 text-faint mx-auto mb-3" />
            <p className="text-sm text-muted">No proposal has been shared with you yet.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {proposals.map((p) => (
            <ClientProposalCard key={p.id} proposal={p} />
          ))}
        </div>
      )}
    </div>
  );
}
