import { Fragment } from "react";
import { parseProposalBody, type Run } from "@/lib/proposalMarkup";

/** Render inline runs, honouring **bold** and the cover-letter italic lines. */
function runNodes(runs: Run[]) {
  return runs.map((r, i) => {
    if (r.bold) {
      return (
        <strong key={i} className={`font-semibold text-ink ${r.italic ? "italic" : ""}`}>
          {r.text}
        </strong>
      );
    }
    if (r.italic) return <em key={i}>{r.text}</em>;
    return <Fragment key={i}>{r.text}</Fragment>;
  });
}

/**
 * A generated proposal section body, laid out from its markup: sub-headings,
 * bullet and numbered lists, bold lead-ins and paragraph spacing. Mirrors the PDF
 * export (lib/proposalPdf.ts) so the screen and the downloaded document match.
 */
export function ProposalBody({ body }: { body: string }) {
  const blocks = parseProposalBody(body);

  return (
    <div className="text-[13.5px] leading-[1.75] text-ink/90">
      {blocks.map((b, i) => {
        if (b.kind === "subheading") {
          return (
            <h3
              key={i}
              className="mt-5 first:mt-0 mb-1.5 text-[13px] font-semibold text-navy-700 underline decoration-navy-200 underline-offset-4"
            >
              {b.text}
            </h3>
          );
        }
        if (b.kind === "para") {
          return (
            <p key={i} className={b.spaced ? "mt-3 first:mt-0" : "mt-0.5"}>
              {runNodes(b.runs)}
            </p>
          );
        }
        return (
          <ul key={i} className="mt-2.5 mb-1 space-y-2">
            {b.items.map((it, j) => (
              <li key={j} className="flex gap-2.5" style={{ paddingLeft: it.level * 18 }}>
                {it.marker ? (
                  <span className="shrink-0 min-w-[1.25rem] font-semibold text-navy-700 tabular-nums">
                    {it.marker}
                  </span>
                ) : (
                  <span
                    className={`mt-[9px] size-1.5 shrink-0 rounded-full ${
                      it.level ? "border border-navy-400" : "bg-navy-400"
                    }`}
                  />
                )}
                <span className="min-w-0">{runNodes(it.runs)}</span>
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}
