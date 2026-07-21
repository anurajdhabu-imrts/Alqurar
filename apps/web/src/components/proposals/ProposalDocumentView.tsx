import { Sparkles } from "lucide-react";
import type { ClientProposal } from "@/api/clientProposals";
import { formatCurrencyFull, formatDate } from "@/lib/utils";
import { displayDescription, rowNumbers } from "@/lib/proposalCosting";

type Content = NonNullable<ClientProposal["content"]>;

/**
 * Presentational render of a generated client proposal (sections + commercial
 * table + payment terms). Shared by the internal proposal tab and the logged-in
 * client's Proposal page so the layout is defined once.
 */
export function ProposalDocumentView({
  content,
  clientLogo,
  updatedAt,
  model,
  draft = false,
}: {
  content: Content;
  clientLogo?: string;
  updatedAt?: string | null;
  model?: string | null;
  /** Internal (staff) view — flags the proposal as an unreviewed AI draft. */
  draft?: boolean;
}) {
  const showTimeline = content.costing.some((c) => c.timeline?.trim());
  const totalCols = showTimeline ? 4 : 3;
  const numbers = rowNumbers(content.costing);

  return (
    <article className="px-6 py-6 sm:px-10 sm:py-8 max-w-3xl mx-auto">
      <header className="border-b border-border pb-4 mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          {clientLogo ? (
            <img src={clientLogo} alt="Client logo" className="h-12 max-w-48 object-contain" />
          ) : (
            <span />
          )}
          <img src="/Al Qarar Logo.png" alt="Al Qarar" className="h-11 object-contain" />
        </div>
        <p className="text-[11px] uppercase tracking-wide text-faint inline-flex items-center gap-1.5">
          <Sparkles className={`size-3.5 ${draft ? "text-amber-500" : "text-emerald-500"}`} />
          {draft ? "AI-generated draft" : "Proposal"}
          {updatedAt ? ` · ${formatDate(updatedAt)}` : ""}
        </p>
        <h1 className="mt-2 text-xl font-bold text-ink leading-snug">{content.title}</h1>
        {(content.reference || content.date) && (
          <p className="mt-1 text-xs text-muted">
            {[content.reference, content.date].filter(Boolean).join(" · ")}
          </p>
        )}
      </header>

      <div className="space-y-6">
        {content.sections.map((s, i) => (
          <section key={i}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-700 mb-1.5">
              {i + 1}. {s.heading}
            </h2>
            <p className="text-sm text-ink/90 leading-relaxed whitespace-pre-wrap">{s.body}</p>
          </section>
        ))}
      </div>

      {content.costing.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-700 mb-3">Commercial Proposal</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-faint">
                  <th className="py-2 pr-3 font-semibold text-right">Sl.No</th>
                  <th className="py-2 px-3 font-semibold">Item</th>
                  <th className="py-2 px-3 font-semibold">Description</th>
                  {showTimeline && <th className="py-2 px-3 font-semibold whitespace-nowrap">Timeline</th>}
                  <th className="py-2 pl-3 font-semibold text-right whitespace-nowrap">Amount</th>
                </tr>
              </thead>
              <tbody>
                {content.costing.map((c, i) => (
                  <tr key={i} className={`border-b border-border/60 align-top ${c.group ? "bg-navy-50/40" : ""}`}>
                    {/* Sub-line numbers (2.1, 2.2…) sit inline before the item name, not in
                        the Sl.No column, which carries only the top-level number. */}
                    <td className="py-2.5 pr-3 text-right tabular-nums text-faint whitespace-nowrap">{c.sub ? "" : numbers[i]}</td>
                    <td className={`py-2.5 px-3 text-ink ${c.group ? "font-semibold" : "font-medium"} ${c.sub ? "pl-6" : ""}`}>
                      {c.sub && <span className="font-bold mr-1.5">{numbers[i]}</span>}
                      {c.item}
                    </td>
                    <td className="py-2.5 px-3 text-muted">{displayDescription(c.description)}</td>
                    {/* A group header is priced by the sub-lines beneath it, so it shows no
                        amount of its own — repeating the subtotal here reads as double-counting. */}
                    {showTimeline && <td className="py-2.5 px-3 text-muted whitespace-nowrap">{c.group ? "" : c.timeline || "—"}</td>}
                    <td className="py-2.5 pl-3 text-right tabular-nums text-ink whitespace-nowrap">
                      {c.group ? "" : formatCurrencyFull(c.amount, content.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={totalCols} className="py-3 pr-3 text-right font-semibold text-ink">Total</td>
                  <td className="py-3 pl-3 text-right font-bold tabular-nums text-ink whitespace-nowrap">
                    {formatCurrencyFull(content.total, content.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {content.paymentTerms && content.paymentTerms.length > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-faint mb-2">Payment Terms</h3>
              <ul className="space-y-1.5">
                {content.paymentTerms.map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink/90">
                    <span className="text-navy-400 mt-1.5 size-1.5 rounded-full bg-navy-300 shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {draft ? (
        <p className="mt-8 pt-4 border-t border-border text-[11px] text-faint">
          AI-generated draft{model ? ` · ${model}` : ""}. Review and verify the scope and figures before issuing to the client.
        </p>
      ) : model ? (
        <p className="mt-8 pt-4 border-t border-border text-[11px] text-faint">
          Prepared by Al Qarar Management Solutions.
        </p>
      ) : null}
    </article>
  );
}
