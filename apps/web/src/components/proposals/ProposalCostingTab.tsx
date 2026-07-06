import { jsPDF } from "jspdf";
import { AlertTriangle, Download, FileSignature, Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useClientProposal, useGenerateClientProposal } from "@/hooks/useClientProposal";
import type { ClientProposal } from "@/api/clientProposals";
import { formatCurrencyFull, formatDate } from "@/lib/utils";

type ProposalContent = NonNullable<ClientProposal["content"]>;

/** Build a text-based (selectable) PDF from the client proposal and download it. */
function downloadProposalPdf(doc: ProposalContent) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensure = (space: number) => {
    if (y + space > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  const write = (text: string, size: number, style: "bold" | "normal", gapAfter: number) => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    const lineH = size * 1.4;
    for (const raw of text.split("\n")) {
      if (raw.trim() === "") {
        y += lineH * 0.5;
        continue;
      }
      for (const line of pdf.splitTextToSize(raw, maxW) as string[]) {
        ensure(lineH);
        pdf.text(line, margin, y);
        y += lineH;
      }
    }
    y += gapAfter;
  };

  write(doc.title, 17, "bold", 14);
  doc.sections.forEach((s, i) => {
    ensure(40);
    write(`${i + 1}. ${s.heading}`, 12, "bold", 4);
    write(s.body, 10.5, "normal", 12);
  });

  // Costing table
  if (doc.costing.length) {
    ensure(40);
    write("Costing", 12, "bold", 6);
    doc.costing.forEach((c) => {
      const amount = formatCurrencyFull(c.amount, doc.currency);
      write(`${c.item} — ${amount}`, 10.5, "bold", 2);
      if (c.description) write(c.description, 10, "normal", 6);
    });
    write(`Total: ${formatCurrencyFull(doc.total, doc.currency)}`, 12, "bold", 8);
  }

  const safe = (doc.title || "Proposal").replace(/[^\w\-. ]+/g, "").trim().slice(0, 80) || "Proposal";
  pdf.save(`${safe}.pdf`);
}

/**
 * Proposal tab — the AI-generated, costed client proposal, assembled from the
 * proposal's identified delay events and documents. Distinct from a project's
 * EOT claim: this is the commercial offer to the client, with a fee breakdown.
 */
export function ProposalCostingTab({ proposalId }: { proposalId: string }) {
  const { data: proposal, isLoading } = useClientProposal(proposalId);
  const generate = useGenerateClientProposal(proposalId);

  const running = proposal?.status === "running" || generate.isPending;
  const failed = proposal?.status === "failed";
  const doc = proposal?.content ?? null;

  function handleGenerate() {
    if (doc && !window.confirm("Regenerate the client proposal? This replaces the current draft.")) return;
    generate.mutate();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">Client proposal</h3>
          <p className="text-xs text-muted mt-0.5">
            AI-drafted proposal with a costing breakdown, built from this proposal's delay events and documents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {doc && !running && (
            <button className="btn btn-outline btn-sm" onClick={() => downloadProposalPdf(doc)}>
              <Download className="size-4" /> Download PDF
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={running}>
            {running ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {running ? "Generating…" : doc ? "Regenerate" : "Generate with AI"}
          </button>
        </div>
      </div>

      {failed && !running && (
        <div className="flex items-start gap-2 rounded-lg bg-error-bg/60 px-3 py-2.5 text-xs text-error">
          <AlertTriangle className="size-4 shrink-0 mt-px" />
          <span>{proposal?.error || "Failed to generate the proposal."}</span>
        </div>
      )}

      {isLoading ? (
        <Card className="p-10 text-center text-sm text-muted inline-flex items-center justify-center gap-2 w-full">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </Card>
      ) : running && !doc ? (
        <Card className="p-10 text-center">
          <span className="size-12 mx-auto rounded-xl bg-navy-50 text-navy-600 grid place-items-center">
            <Loader2 className="size-6 animate-spin" />
          </span>
          <h3 className="mt-3 font-semibold text-ink">Drafting the client proposal with AI…</h3>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            Claude is assembling the proposal and costing from the delay events and documents. This can take a minute or two.
          </p>
        </Card>
      ) : !doc ? (
        <Card className="p-10 text-center">
          <span className="size-12 mx-auto rounded-xl bg-navy-50 text-navy-600 grid place-items-center">
            <FileSignature className="size-6" />
          </span>
          <h3 className="mt-3 font-semibold text-ink">No proposal generated yet</h3>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            Upload the documents, identify the delay events, then generate the costed client proposal here.
          </p>
          <button className="btn btn-primary btn-sm mt-4 inline-flex" onClick={handleGenerate} disabled={running}>
            <Sparkles className="size-4" /> Generate with AI
          </button>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <article className="px-6 py-6 sm:px-10 sm:py-8 max-w-3xl mx-auto">
            <header className="border-b border-border pb-4 mb-6">
              <p className="text-[11px] uppercase tracking-wide text-faint inline-flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-amber-500" /> AI-generated draft
                {proposal?.updatedAt ? ` · ${formatDate(proposal.updatedAt)}` : ""}
              </p>
              <h1 className="mt-2 text-xl font-bold text-ink leading-snug">{doc.title}</h1>
            </header>

            <div className="space-y-6">
              {doc.sections.map((s, i) => (
                <section key={i}>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-700 mb-1.5">
                    {i + 1}. {s.heading}
                  </h2>
                  <p className="text-sm text-ink/90 leading-relaxed whitespace-pre-wrap">{s.body}</p>
                </section>
              ))}
            </div>

            {/* Costing table */}
            {doc.costing.length > 0 && (
              <section className="mt-8">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-700 mb-3">Costing</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-faint">
                        <th className="py-2 pr-3 font-semibold">Item</th>
                        <th className="py-2 px-3 font-semibold">Description</th>
                        <th className="py-2 pl-3 font-semibold text-right whitespace-nowrap">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doc.costing.map((c, i) => (
                        <tr key={i} className="border-b border-border/60 align-top">
                          <td className="py-2.5 pr-3 font-medium text-ink">{c.item}</td>
                          <td className="py-2.5 px-3 text-muted">{c.description}</td>
                          <td className="py-2.5 pl-3 text-right tabular-nums text-ink whitespace-nowrap">
                            {formatCurrencyFull(c.amount, doc.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} className="py-3 pr-3 text-right font-semibold text-ink">Total</td>
                        <td className="py-3 pl-3 text-right font-bold tabular-nums text-ink whitespace-nowrap">
                          {formatCurrencyFull(doc.total, doc.currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            )}

            <p className="mt-8 pt-4 border-t border-border text-[11px] text-faint">
              AI-generated draft{proposal?.model ? ` · ${proposal.model}` : ""}. Review and verify the scope and
              figures before issuing to the client.
            </p>
          </article>
        </Card>
      )}
    </div>
  );
}
