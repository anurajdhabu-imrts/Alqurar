import type { ClientProposal } from "@/api/clientProposals";
import { formatCurrencyFull } from "@/lib/utils";
import { displayDescription, rowNumbers } from "@/lib/proposalCosting";
import { tocEntries } from "@/lib/proposalToc";
import { ProposalBody } from "@/components/proposals/ProposalBody";

type Content = NonNullable<ClientProposal["content"]>;

/**
 * Presentational render of a generated client proposal (sections + commercial
 * table + payment terms). Shared by the internal proposal tab and the logged-in
 * client's Proposal page so the layout is defined once.
 */
export function ProposalDocumentView({
  content,
  clientLogo,
}: {
  content: Content;
  clientLogo?: string;
}) {
  const showTimeline = content.costing.some((c) => c.timeline?.trim());
  const totalCols = showTimeline ? 4 : 3;
  const numbers = rowNumbers(content.costing);
  // Derived from the document, so the contents can never drift from the headings.
  // On screen an entry scrolls to its section; the PDF prints page numbers instead.
  const toc = tocEntries(content);
  const headingId = (no: number) => `proposal-section-${no}`;
  const goTo = (no: number) =>
    document.getElementById(headingId(no))?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <article className="doc px-6 py-6 sm:px-10 sm:py-8 max-w-3xl mx-auto">
      <header className="border-b border-border pb-4 mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          {clientLogo ? (
            <img src={clientLogo} alt="Client logo" className="h-12 max-w-48 object-contain" />
          ) : (
            <span />
          )}
          <img src="/Al Qarar Logo.png" alt="Al Qarar" className="h-11 object-contain" />
        </div>
        <h1 className="text-xl font-bold text-ink leading-snug">{content.title}</h1>
        {(content.reference || content.date) && (
          <p className="mt-1 text-xs text-muted">
            {[content.reference, content.date].filter(Boolean).join(" · ")}
          </p>
        )}
      </header>

      {toc.length > 1 && (
        <nav aria-label="Table of contents" className="mb-8">
          <h2 className="mb-2.5 pb-1 border-b border-border/70 text-[13px] font-bold uppercase tracking-wide text-maroon">
            Table of Contents
          </h2>
          <ol className="space-y-0.5">
            {toc.map((e) => (
              <li key={e.no}>
                <button
                  type="button"
                  onClick={() => goTo(e.no)}
                  className="w-full text-left text-[13.5px] leading-[1.9] text-ink/90 hover:text-navy-700 hover:underline underline-offset-4"
                >
                  <span className="tabular-nums text-faint mr-2">{e.no}.</span>
                  {e.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Narrative sections, in the order the template defines them — the
          commercial table and payment terms follow the last one (Terms &
          Conditions), matching the issued document. */}
      <div className="space-y-8">
        {content.sections.map((s, i) => (
          <section key={i}>
            <h2
              id={headingId(i + 1)}
              className="mb-2.5 pb-1 border-b border-border/70 text-[13px] font-bold uppercase tracking-wide text-maroon scroll-mt-4"
            >
              {i + 1}. {s.heading}
            </h2>
            <ProposalBody body={s.body} />
          </section>
        ))}
      </div>

      {content.costing.length > 0 && (
        <section className="mt-10">
          <h2
            id={headingId(content.sections.length + 1)}
            className="mb-3 pb-1 border-b border-border/70 text-[13px] font-bold uppercase tracking-wide text-maroon scroll-mt-4"
          >
            {content.sections.length + 1}. Commercial Proposal
          </h2>
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
                    {/* An unfilled timeline is left blank, not dashed — the PDF does the same. */}
                    {showTimeline && <td className="py-2.5 px-3 text-muted whitespace-nowrap">{c.group ? "" : c.timeline || ""}</td>}
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
            <div className="mt-6">
              <h3 className="mb-2 text-[12px] font-semibold text-maroon underline decoration-maroon/30 underline-offset-4">
                Payment Terms
              </h3>
              <ul className="space-y-2">
                {content.paymentTerms.map((t, i) => (
                  <li key={i} className="flex gap-2.5 text-[13.5px] leading-[1.75] text-ink/90">
                    <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-navy-400" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <p className="mt-10 pt-4 border-t border-border text-center text-[10.5px] leading-relaxed text-faint">
        This document is the sole property of Al Qarar Management Solutions. Any unauthorized use,
        reproduction, or distribution of this document is strictly prohibited.
      </p>
    </article>
  );
}
