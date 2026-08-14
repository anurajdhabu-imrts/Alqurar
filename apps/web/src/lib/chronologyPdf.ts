// Branded PDF export for a project's delay-event chronology, built with jsPDF.
//
// Lays out the submission-style write-up the Chronology tab shows on screen —
// for each delay event: Introduction, Delay Event Timeline, Chronology, Cause &
// Effect and Contractual Entitlement — as a claim document: a cover page, a
// running header carrying the project name and the Al Qarar logo, maroon section
// headings, and a confidentiality footer with "Page X of Y".
import { jsPDF } from "jspdf";
import { format, parseISO } from "date-fns";
import type { ChronologyItem, ProjectDelayEvent } from "@/types";

type RGB = [number, number, number];

const MAROON: RGB = [138, 46, 46];
const NAVY: RGB = [31, 56, 100];
const GREY: RGB = [107, 114, 128];
const BODY: RGB = [35, 35, 35];
const RULE: RGB = [217, 220, 227];
const SHADE: RGB = [244, 246, 250];

const CONFIDENTIAL =
  "This document is the sole property of Al Qarar Management Solutions. Any unauthorized use, reproduction, or distribution of this document is strictly prohibited.";

/** Long-form date for claim prose, e.g. "20 April 2025". */
function longDate(iso?: string): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "d MMMM yyyy");
  } catch {
    return iso;
  }
}

export interface ChronologyPdfOpts {
  projectName?: string;
  projectCode?: string;
  standard?: string;
  /** Al Qarar logo as a data URL (see `fetchAsDataUrl` in proposalPdf). */
  alqararLogo?: string;
  /** Filename stem; defaults to the project name. */
  fileName?: string;
}

/**
 * Build the chronology PDF and trigger a download. Pass every delay event for
 * the whole-project export, or a single event for a per-event export.
 */
export function downloadChronologyPdf(events: ProjectDelayEvent[], opts: ChronologyPdfOpts = {}): void {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 58;
  const contentW = W - 2 * M;
  const contentTop = 92;
  const contentBottom = H - 64;
  const projectName = opts.projectName || "Project";
  let y = contentTop;

  const setFont = (b?: boolean, i?: boolean) =>
    pdf.setFont("helvetica", b && i ? "bolditalic" : b ? "bold" : i ? "italic" : "normal");
  const setColor = (c: RGB) => pdf.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: RGB) => pdf.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => pdf.setDrawColor(c[0], c[1], c[2]);

  const ensure = (space: number) => {
    if (y + space > contentBottom) {
      pdf.addPage();
      y = contentTop;
    }
  };

  /** Wrapped body text at `x`, honouring page breaks. */
  function text(
    body: string,
    { size = 10, color = BODY, bold = false, italic = false, indent = 0, gap = 8, lead = 1.5 } = {},
  ) {
    const t = String(body ?? "").trim();
    if (!t) return;
    pdf.setFontSize(size);
    setFont(bold, italic);
    setColor(color);
    const lh = size * lead;
    for (const line of pdf.splitTextToSize(t, contentW - indent) as string[]) {
      ensure(lh);
      // splitTextToSize resets nothing, but a page break can land between calls.
      pdf.setFontSize(size);
      setFont(bold, italic);
      setColor(color);
      pdf.text(line, M + indent, y);
      y += lh;
    }
    y += gap;
  }

  /** Blank-line-separated paragraphs of narrative prose. */
  function paragraphs(body: string, indent = 0) {
    for (const block of String(body ?? "").split(/\n{2,}/)) {
      const t = block.replace(/\s*\n\s*/g, " ").trim();
      if (t) text(t, { indent, gap: 9 });
    }
  }

  /** Maroon, underlined section heading (Introduction, Chronology, …). */
  function sectionHeading(label: string) {
    ensure(46);
    y += 12;
    const size = 11.5;
    pdf.setFontSize(size);
    setFont(true, false);
    setColor(MAROON);
    pdf.text(label, M, y);
    const w = pdf.getTextWidth(label);
    setDraw(MAROON);
    pdf.setLineWidth(0.7);
    pdf.line(M, y + 3, M + w, y + 3);
    y += size * 1.5;
  }

  /** The "DELAY EVENT # 01 – Title" banner that opens each event. */
  function eventBanner(event: ProjectDelayEvent, index: number) {
    const num = (event.ref?.match(/(\d+)\s*$/)?.[1] ?? String(index + 1)).padStart(2, "0");
    const title = `DELAY EVENT # ${num} – ${event.title || "Untitled delay event"}`;
    pdf.setFontSize(13);
    setFont(true, false);
    const lines = pdf.splitTextToSize(title, contentW - 24) as string[];
    const boxH = lines.length * 18 + 18;
    ensure(boxH + 10);
    setFill(SHADE);
    pdf.rect(M, y - 4, contentW, boxH, "F");
    setDraw(MAROON);
    pdf.setLineWidth(2);
    pdf.line(M, y - 4, M, y - 4 + boxH);
    setColor(MAROON);
    let ty = y + 15;
    for (const line of lines) {
      pdf.setFontSize(13);
      setFont(true, false);
      pdf.text(line, M + 12, ty);
      ty += 18;
    }
    y = y - 4 + boxH + 12;
  }

  /** Two-column fact strip under the banner: cause, period, days impact, clause. */
  function eventFacts(event: ProjectDelayEvent) {
    const period =
      event.startDate || event.endDate
        ? `${longDate(event.startDate) || "—"} to ${longDate(event.endDate) || "ongoing"}`
        : "—";
    const facts: [string, string][] = [
      ["Reference", event.ref || "—"],
      ["Category", event.category || "—"],
      ["Responsibility", event.cause || "—"],
      ["Contract clause", event.clause || "—"],
      ["Event period", period],
      [
        "Delay impact",
        `${event.daysImpact || 0} day(s)${event.criticalPath ? " — critical path" : ""}`,
      ],
    ];
    const colW = contentW / 2;
    const rowH = 26;
    for (let i = 0; i < facts.length; i += 2) {
      ensure(rowH);
      const y0 = y;
      // The last row can hold a single fact when the count is odd.
      [facts[i], facts[i + 1]].forEach((fact, c) => {
        if (!fact) return;
        const [label, value] = fact;
        const x = M + c * colW;
        pdf.setFontSize(7.5);
        setFont(true, false);
        setColor(GREY);
        pdf.text(label.toUpperCase(), x, y0 + 8);
        pdf.setFontSize(9.5);
        setFont(false, false);
        setColor(BODY);
        pdf.text(
          (pdf.splitTextToSize(value || "—", colW - 14) as string[])[0],
          x,
          y0 + 20,
        );
      });
      y = y0 + rowH;
    }
    y += 4;
    setDraw(RULE);
    pdf.setLineWidth(0.5);
    ensure(6);
    pdf.line(M, y, M + contentW, y);
    y += 10;
  }

  /** One dated chronology step: date + actor line, prose, then its source. */
  function chronologyEntry(entry: ChronologyItem, sourceName?: string) {
    const stamp = [longDate(entry.date), entry.actor].filter(Boolean).join("  ·  ");
    ensure(34);
    if (stamp) text(stamp, { size: 9, color: NAVY, bold: true, gap: 2, lead: 1.35 });
    if (entry.title) text(entry.title, { size: 10, bold: true, gap: 3, lead: 1.4 });
    if (entry.detail) paragraphs(entry.detail);
    if (sourceName) text(`Source: ${sourceName}`, { size: 8, color: GREY, italic: true, gap: 10 });
    else y += 4;
  }

  // ── Running header + footer, stamped on the content pages at the end ───────
  function drawHeader() {
    const hy = 46;
    pdf.setFontSize(8.5);
    setFont(true, false);
    setColor(NAVY);
    const label = projectName.toUpperCase();
    const maxW = contentW - 120;
    pdf.text((pdf.splitTextToSize(label, maxW) as string[])[0], M, hy);
    pdf.setFontSize(8.5);
    setFont(false, false);
    setColor(GREY);
    const right = "Chronology of Delay Events";
    pdf.text(right, M + contentW - pdf.getTextWidth(right), hy);
    setDraw(RULE);
    pdf.setLineWidth(0.5);
    pdf.line(M, hy + 8, M + contentW, hy + 8);
  }
  function drawFooter(page: number, total: number) {
    const fy = H - 50;
    setDraw(RULE);
    pdf.setLineWidth(0.5);
    pdf.line(M, fy, M + contentW, fy);
    pdf.setFontSize(6.5);
    setFont(false, false);
    setColor(GREY);
    let cy = fy + 10;
    for (const l of pdf.splitTextToSize(CONFIDENTIAL, contentW - 70) as string[]) {
      pdf.text(l, M, cy);
      cy += 7.5;
    }
    pdf.setFontSize(8);
    const s = `Page ${page} of ${total}`;
    pdf.text(s, M + contentW - pdf.getTextWidth(s), fy + 14);
  }

  // ── Cover page ────────────────────────────────────────────────────────────
  function coverLine(t: string, size: number, color: RGB, bold = true, gap = 12, italic = false) {
    if (!t) return;
    pdf.setFontSize(size);
    setFont(bold, italic);
    setColor(color);
    for (const l of pdf.splitTextToSize(t, contentW - 40) as string[]) {
      pdf.text(l, M + (contentW - pdf.getTextWidth(l)) / 2, y);
      y += size * 1.35;
    }
    y += gap;
  }

  y = 150;
  if (opts.alqararLogo) {
    try {
      const p = pdf.getImageProperties(opts.alqararLogo) as {
        width: number;
        height: number;
        fileType?: string;
      };
      const w = 200;
      const h = w / ((p.width || 1) / (p.height || 1));
      pdf.addImage(opts.alqararLogo, p.fileType || "PNG", M + (contentW - w) / 2, y, w, h);
      y += h + 34;
    } catch {
      /* logo is decorative — carry on without it */
    }
  }
  coverLine("CHRONOLOGY OF DELAY EVENTS", 20, MAROON, true, 6);
  setDraw(MAROON);
  pdf.setLineWidth(1);
  pdf.line(M + contentW / 2 - 70, y, M + contentW / 2 + 70, y);
  y += 34;
  coverLine(projectName, 16, NAVY, true, 8);
  coverLine([opts.projectCode, opts.standard].filter(Boolean).join("  ·  "), 11, GREY, false, 26);
  coverLine(
    `${events.length} delay event${events.length === 1 ? "" : "s"}`,
    11,
    BODY,
    false,
    4,
  );
  coverLine(`Issued ${format(new Date(), "d MMMM yyyy")}`, 10, GREY, false, 0, true);

  // ── One section per delay event, each starting on a fresh page ────────────
  events.forEach((event, i) => {
    pdf.addPage();
    y = contentTop;
    eventBanner(event, i);
    eventFacts(event);

    const n = event.chronologyNarrative;
    if (n?.introduction) {
      sectionHeading("Introduction");
      paragraphs(n.introduction);
    }
    if (n?.timeline) {
      sectionHeading("Delay Event Timeline");
      paragraphs(n.timeline);
    }

    const chronology = event.chronology ?? [];
    sectionHeading("Chronology");
    if (chronology.length === 0) {
      text("No chronology has been generated for this delay event.", { color: GREY, italic: true });
    } else {
      const nameOf = (id?: string) => (id ? event.sources?.find((s) => s.id === id)?.name : undefined);
      for (const entry of chronology) chronologyEntry(entry, nameOf(entry.sourceId));
    }

    if (n?.causeEffect) {
      sectionHeading("Cause & Effect");
      paragraphs(n.causeEffect);
    }
    if (n?.entitlement) {
      sectionHeading("Contractual Entitlement");
      paragraphs(n.entitlement);
    }
    // Fall back to the event's own narrative when the AI write-up hasn't been
    // generated yet, so the export is never an empty shell.
    if (!n && event.narrative) {
      sectionHeading("Event Narrative");
      paragraphs(event.narrative);
    }
  });

  // Header + footer on every page after the cover.
  const pageCount = pdf.getNumberOfPages();
  for (let p = 2; p <= pageCount; p++) {
    pdf.setPage(p);
    drawHeader();
    drawFooter(p - 1, pageCount - 1);
  }

  const stem =
    opts.fileName ||
    `${projectName} — Chronology of Delay Events`.replace(/[^\w\-. ]+/g, "").trim() ||
    "Chronology";
  pdf.save(`${stem.slice(0, 90)}.pdf`);
}
