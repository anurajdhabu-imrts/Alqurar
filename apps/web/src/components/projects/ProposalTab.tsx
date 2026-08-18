import { jsPDF } from "jspdf";
import { AlertTriangle, Download, FileSignature, Info, Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useGenerateProposal, useProposal } from "@/hooks/useProposal";
import type { ClaimBlock, ClaimContent, ClaimSection } from "@/api/proposals";
import { formatDate } from "@/lib/utils";

// ── PDF export ─────────────────────────────────────────────────────────────
// Built in two passes: the first lays the body out on a throwaway document to
// learn which page each section starts on, the second builds the real file with
// a cover page and a contents page in front. Body layout doesn't depend on what
// precedes it, so the recorded page numbers stay valid once shifted by the
// number of front-matter pages.

const MARGIN = 48;
const BODY_SIZE = 9.5;
const TABLE_SIZE = 8;

type TocEntry = { number: string; heading: string; page: number; sub: boolean };

/** Lays out title + body content, recording where each heading landed. */
function renderBody(pdf: jsPDF, doc: ClaimContent): TocEntry[] {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const maxW = pageW - MARGIN * 2;
  const toc: TocEntry[] = [];
  let y = MARGIN;

  const ensure = (space: number) => {
    if (y + space > pageH - MARGIN) {
      pdf.addPage();
      y = MARGIN;
    }
  };

  const write = (
    text: string,
    size: number,
    style: "bold" | "normal",
    gapAfter: number,
    color: [number, number, number] = [17, 24, 39],
  ) => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    const lineH = size * 1.45;
    for (const raw of text.split("\n")) {
      if (raw.trim() === "") {
        y += lineH * 0.5;
        continue;
      }
      for (const line of pdf.splitTextToSize(raw, maxW) as string[]) {
        ensure(lineH);
        pdf.text(line, MARGIN, y);
        y += lineH;
      }
    }
    y += gapAfter;
  };

  /** Proportional column widths, weighted by the longest cell in each column. */
  const columnWidths = (columns: string[], rows: string[][]) => {
    const weights = columns.map((c, i) => {
      const longest = rows.reduce((m, r) => Math.max(m, (r[i] ?? "").length), c.length);
      return Math.min(Math.max(longest, 6), 60);
    });
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    return weights.map((w) => (w / total) * maxW);
  };

  const drawTable = (caption: string, columns: string[], rows: string[][]) => {
    if (!columns.length) return;
    if (caption) write(caption, 8.5, "bold", 2, [55, 65, 81]);

    const widths = columnWidths(columns, rows);
    const pad = 4;
    const lineH = TABLE_SIZE * 1.35;

    const drawRow = (cells: string[], bold: boolean) => {
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      pdf.setFontSize(TABLE_SIZE);
      // Wrap every cell first so the row height fits the tallest one.
      const wrapped = cells.map((c, i) =>
        pdf.splitTextToSize(String(c ?? ""), widths[i] - pad * 2) as string[],
      );
      const rowH = Math.max(...wrapped.map((w) => w.length)) * lineH + pad * 2;
      ensure(rowH);

      if (bold) {
        pdf.setFillColor(241, 245, 249);
        pdf.rect(MARGIN, y, maxW, rowH, "F");
      }
      pdf.setDrawColor(203, 213, 225);
      pdf.rect(MARGIN, y, maxW, rowH);

      let x = MARGIN;
      pdf.setTextColor(17, 24, 39);
      wrapped.forEach((lines, i) => {
        if (i > 0) pdf.line(x, y, x, y + rowH);
        lines.forEach((line, li) => {
          pdf.text(line, x + pad, y + pad + (li + 1) * lineH - lineH * 0.25);
        });
        x += widths[i];
      });
      y += rowH;
    };

    drawRow(columns, true);
    rows.forEach((r) => drawRow(r, false));
    y += 10;
  };

  const drawBlocks = (blocks: ClaimBlock[]) => {
    for (const b of blocks ?? []) {
      if (b.type === "paragraph") {
        if (b.text) write(b.text, BODY_SIZE, "normal", 8);
      } else if (b.type === "note") {
        if (b.text) write(b.text, BODY_SIZE, "normal", 8, [146, 64, 14]);
      } else if (b.type === "bullets") {
        for (const item of b.items ?? []) write(`•  ${item}`, BODY_SIZE, "normal", 2);
        y += 6;
      } else if (b.type === "table") {
        drawTable(b.caption ?? "", b.columns ?? [], b.rows ?? []);
      }
    }
  };

  for (const s of doc.sections ?? []) {
    ensure(60);
    toc.push({ number: s.number, heading: s.heading, page: pdf.getNumberOfPages(), sub: false });
    write(`${s.number}.  ${s.heading}`, 13, "bold", 8, [15, 42, 76]);
    drawBlocks(s.blocks);

    for (const sub of s.subsections ?? []) {
      ensure(40);
      toc.push({ number: sub.number, heading: sub.heading, page: pdf.getNumberOfPages(), sub: true });
      write(`${sub.number}  ${sub.heading}`, 10.5, "bold", 6, [30, 58, 95]);
      drawBlocks(sub.blocks);
    }
  }

  return toc;
}

/** Cover page + contents, then the body. */
function downloadClaimPdf(doc: ClaimContent, generatedAt?: string | null) {
  // Pass 1 — measure where each heading falls.
  const probe = new jsPDF({ unit: "pt", format: "a4" });
  const entries = renderBody(probe, doc);

  const pageH = probe.internal.pageSize.getHeight();
  const tocRowH = 15;
  const tocRowsPerPage = Math.floor((pageH - MARGIN * 2 - 40) / tocRowH);
  const tocPages = Math.max(1, Math.ceil(entries.length / tocRowsPerPage));
  const offset = 1 + tocPages; // cover + contents pages precede the body

  // Pass 2 — the real document.
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const maxW = pageW - MARGIN * 2;

  // Cover.
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(15, 42, 76);
  const titleLines = pdf.splitTextToSize(doc.title || "Extension of Time Claim", maxW) as string[];
  let cy = 220;
  titleLines.forEach((l) => {
    pdf.text(l, MARGIN, cy);
    cy += 28;
  });
  if (doc.reference) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    pdf.setTextColor(71, 85, 105);
    pdf.text(doc.reference, MARGIN, cy + 8);
    cy += 30;
  }
  pdf.setDrawColor(15, 42, 76);
  pdf.setLineWidth(2);
  pdf.line(MARGIN, cy + 14, MARGIN + 120, cy + 14);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    `AI-generated draft${generatedAt ? ` · ${formatDate(generatedAt)}` : ""}`,
    MARGIN,
    cy + 42,
  );
  pdf.text(
    "Review and verify against the contract and source documents before submission.",
    MARGIN,
    cy + 58,
  );

  // Contents.
  pdf.addPage();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(15, 42, 76);
  pdf.text("CONTENTS", MARGIN, MARGIN + 10);
  let ty = MARGIN + 38;
  entries.forEach((e, i) => {
    if (i > 0 && i % tocRowsPerPage === 0) {
      pdf.addPage();
      ty = MARGIN + 10;
    }
    pdf.setFont("helvetica", e.sub ? "normal" : "bold");
    pdf.setFontSize(e.sub ? 9 : 9.5);
    pdf.setTextColor(e.sub ? 71 : 17, e.sub ? 85 : 24, e.sub ? 105 : 39);
    const label = `${e.number}${e.sub ? "" : "."}  ${e.heading}`;
    pdf.text(label, MARGIN + (e.sub ? 18 : 0), ty, { maxWidth: maxW - 40 });
    pdf.text(String(e.page + offset), pageW - MARGIN, ty, { align: "right" });
    ty += tocRowH;
  });

  // Body.
  pdf.addPage();
  renderBody(pdf, doc);

  const safe =
    (doc.title || "EOT Claim").replace(/[^\w\-. ]+/g, "").trim().slice(0, 80) || "EOT Claim";
  pdf.save(`${safe}.pdf`);
}

// ── On-screen rendering ────────────────────────────────────────────────────

function BlockView({ block }: { block: ClaimBlock }) {
  if (block.type === "paragraph") {
    return <p className="text-sm text-ink/90 leading-relaxed whitespace-pre-wrap">{block.text}</p>;
  }
  if (block.type === "note") {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-warning-bg/60 px-3 py-2.5 text-xs text-warning">
        <Info className="size-4 shrink-0 mt-px" />
        <span className="leading-relaxed">{block.text}</span>
      </div>
    );
  }
  if (block.type === "bullets") {
    return (
      <ul className="list-disc pl-5 space-y-1">
        {(block.items ?? []).map((it, i) => (
          <li key={i} className="text-sm text-ink/90 leading-relaxed">
            {it}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <figure className="space-y-1.5">
      {block.caption && (
        <figcaption className="text-xs font-semibold text-navy-700">{block.caption}</figcaption>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-navy-50/70">
              {(block.columns ?? []).map((c, i) => (
                <th
                  key={i}
                  className="text-left font-semibold text-navy-800 px-2.5 py-2 border-b border-border align-top"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(block.rows ?? []).map((row, ri) => (
              <tr key={ri} className="even:bg-navy-50/25">
                {(block.columns ?? []).map((_, ci) => (
                  <td key={ci} className="px-2.5 py-1.5 border-b border-border align-top text-ink/90">
                    {row[ci] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function SectionView({ section }: { section: ClaimSection }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-navy-800 pb-1.5 border-b border-border">
        {section.number}. {section.heading}
      </h2>
      {(section.blocks ?? []).map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
      {(section.subsections ?? []).map((sub, i) => (
        <div key={i} className="space-y-2 pt-1">
          <h3 className="text-[13px] font-semibold text-navy-700">
            {sub.number} {sub.heading}
          </h3>
          {(sub.blocks ?? []).map((b, bi) => (
            <BlockView key={bi} block={b} />
          ))}
        </div>
      ))}
    </section>
  );
}

/**
 * EOT Report tab — the AI-drafted Extension of Time claim, assembled from every
 * project module: delay events, the Clause Library, admissibility, methodology,
 * queries and the data room.
 */
export function ProposalTab({ projectId }: { projectId: string }) {
  const { data: proposal, isLoading } = useProposal(projectId);
  const generate = useGenerateProposal(projectId);

  const running = proposal?.status === "running" || generate.isPending;
  const failed = proposal?.status === "failed";
  const doc = proposal?.content ?? null;

  function handleGenerate() {
    if (doc && !window.confirm("Regenerate the EOT report? This replaces the current draft.")) return;
    generate.mutate();
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">EOT report</h3>
          <p className="text-xs text-muted mt-0.5">
            Drafted from this project's delay events, clause library, admissibility, methodology,
            queries and data room.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {doc && !running && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => downloadClaimPdf(doc, proposal?.updatedAt)}
            >
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
          <span>{proposal?.error || "Failed to generate the EOT report."}</span>
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
          <h3 className="mt-3 font-semibold text-ink">Drafting the EOT report with AI…</h3>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            Claude is working through the delay events, clauses, admissibility and queries. A full
            report takes a few minutes.
          </p>
        </Card>
      ) : !doc ? (
        <Card className="p-10 text-center">
          <span className="size-12 mx-auto rounded-xl bg-navy-50 text-navy-600 grid place-items-center">
            <FileSignature className="size-6" />
          </span>
          <h3 className="mt-3 font-semibold text-ink">No EOT report generated yet</h3>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            The report is only as complete as the tabs behind it — analyse the Data Room, extract the
            Delay Events, load the Clause Library and run Admissibility first, then generate here.
          </p>
          <button className="btn btn-primary btn-sm mt-4 inline-flex" onClick={handleGenerate} disabled={running}>
            <Sparkles className="size-4" /> Generate with AI
          </button>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <article className="px-6 py-6 sm:px-10 sm:py-8 max-w-4xl mx-auto">
            <header className="border-b border-border pb-4 mb-6">
              <p className="text-[11px] uppercase tracking-wide text-faint inline-flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-amber-500" /> AI-generated draft
                {proposal?.updatedAt ? ` · ${formatDate(proposal.updatedAt)}` : ""}
              </p>
              <h1 className="mt-2 text-xl font-bold text-ink leading-snug">{doc.title}</h1>
              {doc.reference && <p className="mt-1 text-sm text-muted">{doc.reference}</p>}
            </header>

            <div className="space-y-8">
              {(doc.sections ?? []).map((s, i) => (
                <SectionView key={i} section={s} />
              ))}
            </div>

            <p className="mt-8 pt-4 border-t border-border text-[11px] text-faint">
              AI-generated draft{proposal?.model ? ` · ${proposal.model}` : ""}. Review and verify
              against the contract and source documents before submission.
            </p>
          </article>
        </Card>
      )}
    </div>
  );
}
