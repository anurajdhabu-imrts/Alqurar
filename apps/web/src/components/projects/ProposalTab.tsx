import { AlertTriangle, FileSignature, Loader2, Printer, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useGenerateProposal, useProposal } from "@/hooks/useProposal";
import { formatDate } from "@/lib/utils";

/**
 * Proposal tab — the AI-generated Extension of Time claim document, assembled
 * from the project's delay events and data-room documents.
 */
export function ProposalTab({ projectId }: { projectId: string }) {
  const { data: proposal, isLoading } = useProposal(projectId);
  const generate = useGenerateProposal(projectId);

  const running = proposal?.status === "running" || generate.isPending;
  const failed = proposal?.status === "failed";
  const doc = proposal?.content ?? null;

  function handleGenerate() {
    if (doc && !window.confirm("Regenerate the EOT claim document? This replaces the current draft.")) return;
    generate.mutate();
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">EOT claim document</h3>
          <p className="text-xs text-muted mt-0.5">
            AI-drafted Extension of Time claim, built from this project's delay events and documents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {doc && !running && (
            <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
              <Printer className="size-4" /> Print / PDF
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
          <span>{proposal?.error || "Failed to generate the EOT claim."}</span>
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
          <h3 className="mt-3 font-semibold text-ink">Drafting the EOT claim with AI…</h3>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            Claude is assembling the claim from the project's delay events and documents. This can take a minute or two.
          </p>
        </Card>
      ) : !doc ? (
        <Card className="p-10 text-center">
          <span className="size-12 mx-auto rounded-xl bg-navy-50 text-navy-600 grid place-items-center">
            <FileSignature className="size-6" />
          </span>
          <h3 className="mt-3 font-semibold text-ink">No EOT claim generated yet</h3>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            Make sure the Data Room documents are analysed and the Delay Events are extracted, then
            generate the consolidated Extension of Time claim document here.
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

            <p className="mt-8 pt-4 border-t border-border text-[11px] text-faint">
              AI-generated draft{proposal?.model ? ` · ${proposal.model}` : ""}. Review and verify against the
              contract and source documents before submission.
            </p>
          </article>
        </Card>
      )}
    </div>
  );
}
