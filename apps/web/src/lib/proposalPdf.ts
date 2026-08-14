// Branded PDF export for a generated client proposal, built with jsPDF (images
// embed reliably as raster data, unlike an HTML/Word .doc). Styled to match Al
// Qarar's proposal template: a clean cover page with centred logos and maroon
// labels, a light-blue bordered running header (client logo · title · Al Qarar
// logo) on inner pages, a confidentiality footer with "Page X of Y", centred
// UPPERCASE maroon section headings, navy sub-headings, bold-lead bullets and a
// commercial table.
import { jsPDF } from "jspdf";
import type { ClientProposal } from "@/api/clientProposals";
import { formatCurrencyFull } from "@/lib/utils";
import { displayDescription, rowNumbers } from "@/lib/proposalCosting";
import { inlineRuns, parseProposalBody, type ListItem, type Run } from "@/lib/proposalMarkup";
import { tocEntries } from "@/lib/proposalToc";

type Content = NonNullable<ClientProposal["content"]>;
type RGB = [number, number, number];

const MAROON: RGB = [138, 46, 46];
const NAVY: RGB = [31, 56, 100];
const GREY: RGB = [107, 114, 128];
const BODY: RGB = [35, 35, 35];
const HB: RGB = [196, 211, 232];
const RULE: RGB = [217, 220, 227];
const HEADSHADE: RGB = [238, 241, 246];
const TOTSHADE: RGB = [246, 248, 251];
const CELLBORDER: RGB = [199, 204, 214];

const TAGLINE_1 = "A Project Management Excellence built on Core Values";
const TAGLINE_2 = "Respect | Trust | Continual Improvement | Service";
const CONFIDENTIAL =
  "This document is the sole property of Al Qarar Management Solutions. Any unauthorized use, reproduction, or distribution of this document is strictly prohibited.";

/** Fetch a same-origin asset (e.g. the logo in /public) as a base64 data URL. */
export async function fetchAsDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(encodeURI(url));
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => resolve("");
      r.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

/** The document face: Poppins Light for body copy, SemiBold for emphasis. */
const POPPINS = "Poppins";
const POPPINS_FILES: [string, "normal" | "bold" | "italic" | "bolditalic"][] = [
  ["Poppins-Light", "normal"],
  ["Poppins-SemiBold", "bold"],
  ["Poppins-LightItalic", "italic"],
  ["Poppins-SemiBoldItalic", "bolditalic"],
];

/** Embed Poppins into the document and return the family to draw with. jsPDF only
 *  ships the 14 standard PDF faces, so the TTFs are fetched from /public and added
 *  to its virtual file system; if any fetch fails the export falls back to
 *  Helvetica rather than producing a broken PDF. */
async function embedPoppins(pdf: jsPDF): Promise<string> {
  try {
    const files = await Promise.all(
      POPPINS_FILES.map(([name]) => fetchAsDataUrl(`/fonts/${name}.ttf`)),
    );
    if (files.some((d) => !d.includes(","))) return "helvetica";
    files.forEach((data, i) => {
      const [name, style] = POPPINS_FILES[i];
      pdf.addFileToVFS(`${name}.ttf`, data.slice(data.indexOf(",") + 1));
      pdf.addFont(`${name}.ttf`, POPPINS, style);
    });
    return POPPINS;
  } catch {
    return "helvetica";
  }
}

export interface ProposalPdfOpts {
  clientLogo?: string;
  alqararLogo?: string;
  clientCompany?: string;
  projectName?: string;
  subject?: string;
}

/** Build the branded PDF and trigger a download. */
export async function downloadProposalPdf(doc: Content, opts: ProposalPdfOpts): Promise<void> {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const family = await embedPoppins(pdf);
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 64;
  const contentW = W - 2 * M;
  const contentTop = 108;
  const contentBottom = H - 66;
  const title = doc.title || "Proposal for Claims Support Services";
  const headerTitle = (opts.projectName || title).toUpperCase();
  let y = contentTop;

  const setFont = (b?: boolean, i?: boolean) =>
    pdf.setFont(family, b && i ? "bolditalic" : b ? "bold" : i ? "italic" : "normal");
  const setColor = (c: RGB) => pdf.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: RGB) => pdf.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => pdf.setDrawColor(c[0], c[1], c[2]);

  const fit = (data: string, maxW: number, maxH: number): { w: number; h: number; fmt: string } | null => {
    try {
      const p = pdf.getImageProperties(data) as { width: number; height: number; fileType?: string };
      const ratio = (p.width || 1) / (p.height || 1);
      let w = maxW;
      let h = maxW / ratio;
      if (h > maxH) {
        h = maxH;
        w = maxH * ratio;
      }
      return { w, h, fmt: p.fileType || "PNG" };
    } catch {
      return null;
    }
  };
  const addImg = (data: string | undefined, x: number, yy: number, w: number, h: number, fmt: string) => {
    if (!data) return;
    try {
      pdf.addImage(data, fmt, x, yy, w, h);
    } catch {
      /* ignore */
    }
  };

  // ── Text flow with **bold** runs and word wrapping ────────────────────────
  function wrap(runs: Run[], maxW: number, size: number): Run[][] {
    pdf.setFontSize(size);
    const lines: Run[][] = [];
    let cur: Run[] = [];
    let curW = 0;
    for (const run of runs) {
      for (const word of run.text.split(/\s+/).filter(Boolean)) {
        setFont(run.bold, run.italic);
        const wW = pdf.getTextWidth(word);
        const spW = cur.length ? pdf.getTextWidth(" ") : 0;
        if (curW + spW + wW > maxW && cur.length) {
          lines.push(cur);
          cur = [{ text: word, bold: run.bold, italic: run.italic }];
          curW = wW;
        } else {
          if (cur.length) {
            cur.push({ text: " ", bold: run.bold, italic: run.italic });
            curW += spW;
          }
          cur.push({ text: word, bold: run.bold, italic: run.italic });
          curW += wW;
        }
      }
    }
    if (cur.length) lines.push(cur);
    return lines.length ? lines : [[]];
  }
  /** `stretch` widens each inter-word space, which is how a line gets justified —
   *  the runs are drawn one at a time anyway, so the extra is simply added to the
   *  pen position as each space is passed. */
  function drawRunLine(line: Run[], x: number, yy: number, size: number, color: RGB, stretch = 0) {
    pdf.setFontSize(size);
    let cx = x;
    for (const t of line) {
      setFont(t.bold, t.italic);
      setColor(color);
      pdf.text(t.text, cx, yy);
      cx += pdf.getTextWidth(t.text) + (t.text === " " ? stretch : 0);
    }
  }
  /** Natural drawn width of a wrapped line. */
  function lineWidth(line: Run[], size: number): number {
    pdf.setFontSize(size);
    let w = 0;
    for (const t of line) {
      setFont(t.bold, t.italic);
      w += pdf.getTextWidth(t.text);
    }
    return w;
  }
  /** Extra width to add to each space so the line fills `maxW`. Capped so a
   *  sparsely filled line (one long unbreakable word) never blows apart. */
  function justifyStretch(line: Run[], maxW: number, size: number): number {
    const spaces = line.filter((t) => t.text === " ").length;
    if (!spaces) return 0;
    pdf.setFontSize(size);
    setFont(false, false);
    const slack = maxW - lineWidth(line, size);
    if (slack <= 0) return 0;
    return Math.min(slack / spaces, pdf.getTextWidth(" ") * 2.2);
  }
  const ensure = (space: number) => {
    if (y + space > contentBottom) {
      pdf.addPage();
      y = contentTop;
    }
  };

  /** Body paragraph, justified to both margins — the last line of the paragraph is
   *  left as-is, as in any typeset document. */
  function para(runs: Run[], size = 10, gap = 6, color: RGB = BODY, indent = 0) {
    const lh = size * 1.55;
    const maxW = contentW - indent;
    const lines = wrap(runs, maxW, size);
    lines.forEach((ln, i) => {
      ensure(lh);
      const stretch = i < lines.length - 1 ? justifyStretch(ln, maxW, size) : 0;
      drawRunLine(ln, M + indent, y, size, color, stretch);
      y += lh;
    });
    y += gap;
  }
  /** One list row: a filled bullet at the margin, a hollow one when nested, or the
   *  written marker ("1)", "a)") for a numbered point. */
  function listRow(it: ListItem) {
    const size = 10;
    const lh = size * 1.55;
    const x = M + 10 + it.level * 18;
    pdf.setFontSize(size);
    setFont(it.marker ? true : false, false);
    const gap = it.marker ? Math.max(pdf.getTextWidth(it.marker) + 6, 15) : 13;
    const textW = contentW - (x - M) - gap;
    const lines = wrap(it.runs, textW, size);
    ensure(lh);
    if (it.marker) {
      pdf.setFontSize(size);
      setFont(true, false);
      setColor(NAVY);
      pdf.text(it.marker, x, y);
    } else if (it.level > 0) {
      setDraw(BODY);
      pdf.setLineWidth(0.7);
      pdf.circle(x + 2.5, y - 3, 1.4, "S");
    } else {
      setFill(BODY);
      pdf.circle(x + 2.5, y - 3, 1.4, "F");
    }
    lines.forEach((ln, i) => {
      if (i > 0) ensure(lh);
      const stretch = i < lines.length - 1 ? justifyStretch(ln, textW, size) : 0;
      drawRunLine(ln, x + gap, y, size, BODY, stretch);
      y += lh;
    });
    y += 4;
  }
  function bullet(runs: Run[]) {
    listRow({ marker: "", level: 0, runs });
  }
  /** Numbered section heading — maroon, bold, uppercase, on a full-width rule, as
   *  in the printed AQMS template. */
  function sectionHeading(text: string) {
    ensure(46);
    y += 6;
    const size = 11.5;
    pdf.setFontSize(size);
    setFont(true, false);
    for (const l of pdf.splitTextToSize(text.toUpperCase(), contentW)) {
      ensure(size * 1.55);
      setColor(MAROON);
      pdf.text(l, M, y);
      y += size * 1.55;
    }
    setDraw(MAROON);
    pdf.setLineWidth(0.8);
    pdf.line(M, y - 10, M + contentW, y - 10);
    y += 8;
  }
  function subHeading(text: string, color: RGB = NAVY) {
    ensure(26);
    y += 10;
    const size = 10.5;
    pdf.setFontSize(size);
    setFont(true, false);
    for (const l of pdf.splitTextToSize(text, contentW)) {
      ensure(size * 1.5);
      setColor(color);
      pdf.text(l, M, y);
      const w = pdf.getTextWidth(l);
      setDraw(color);
      pdf.setLineWidth(0.5);
      pdf.line(M, y + 1.5, M + w, y + 1.5);
      y += size * 1.5;
    }
    y += 5;
  }

  /** Lay out a section body from its markup — sub-headings, bullet and numbered
   *  lists, bold lead-ins and paragraph spacing (see lib/proposalMarkup.ts). */
  function processBody(body: string) {
    parseProposalBody(body).forEach((block, i) => {
      if (block.kind === "subheading") {
        subHeading(block.text);
        return;
      }
      if (block.kind === "para") {
        // A blank line before the paragraph opens a new one; consecutive lines
        // (an address block, a sign-off) stay tight together.
        if (block.spaced && i > 0) y += 6;
        para(block.runs, 10, 2);
        return;
      }
      y += 3;
      for (const it of block.items) listRow(it);
      y += 6;
    });
  }

  // ── Table of contents ─────────────────────────────────────────────────────
  // The TOC page is reserved before the sections are laid out, then filled in at
  // the end once each heading's real page is known. `startPages` collects them in
  // entry order as the document is written.
  const startPages: number[] = [];
  /** The number printed in the footer for a PDF page — the cover is unnumbered. */
  const printedPage = (pdfPage: number) => pdfPage - 1;

  function tableOfContents(tocPage: number) {
    if (!startPages.length) return;
    pdf.setPage(tocPage);

    // Centred title, then one navy row per heading with a dot leader running out
    // to its page number.
    y = 168;
    const tSize = 17;
    pdf.setFontSize(tSize);
    setFont(true, false);
    setColor(NAVY);
    const t = "Table of Contents";
    pdf.text(t, M + (contentW - pdf.getTextWidth(t)) / 2, y);
    y += 44;

    const size = 10;
    const rowH = 26;
    const numColW = 26;
    tocEntries(doc).forEach((e, i) => {
      const page = startPages[i];
      if (!page) return;
      const num = String(printedPage(page));
      pdf.setFontSize(size);
      setFont(false, false);
      setColor(NAVY);
      // Long headings are trimmed rather than wrapped so the rows stay even.
      const maxLabelW = contentW - numColW - 24;
      let label = `${e.no}. ${e.title}`.toUpperCase();
      while (pdf.getTextWidth(label) > maxLabelW && label.length > 4) {
        label = label.slice(0, -2) + "…";
      }
      pdf.text(label, M, y);
      const labelW = pdf.getTextWidth(label);
      const numW = pdf.getTextWidth(num);
      pdf.text(num, M + contentW - numW, y);
      const from = M + labelW + 5;
      const to = M + contentW - numW - 5;
      if (to > from) {
        setDraw(NAVY);
        pdf.setLineWidth(0.5);
        pdf.setLineDashPattern([0.6, 2.6], 0);
        pdf.line(from, y - 2.5, to, y - 2.5);
        pdf.setLineDashPattern([], 0);
      }
      y += rowH;
    });
  }

  // ── Commercial table ──────────────────────────────────────────────────────
  function commercial() {
    if (!doc.costing?.length) return;
    pdf.addPage();
    y = contentTop;
    startPages.push(pdf.getNumberOfPages());
    sectionHeading(`${doc.sections.length + 1}. Commercial Proposal`);
    const showTL = doc.costing.some((c) => (c.timeline ?? "").trim());
    const noW = 34;
    const amtW = 96;
    const tlW = showTL ? 58 : 0;
    const descW = contentW - noW - tlW - amtW;
    const size = 9.5;
    const pad = 7;
    const lh = size * 1.4;
    const center = (text: string, x: number, w: number, yy: number) => {
      const tw = pdf.getTextWidth(text);
      pdf.text(text, x + (w - tw) / 2, yy);
    };
    const right = (text: string, xr: number, yy: number) => {
      const tw = pdf.getTextWidth(text);
      pdf.text(text, xr - tw, yy);
    };
    const borders = (y0: number, rowH: number) => {
      setDraw(CELLBORDER);
      pdf.setLineWidth(0.5);
      pdf.rect(M, y0, contentW, rowH);
      const ws = showTL ? [noW, descW, tlW, amtW] : [noW, descW, amtW];
      let vx = M;
      for (let i = 0; i < ws.length - 1; i++) {
        vx += ws[i];
        pdf.line(vx, y0, vx, y0 + rowH);
      }
    };

    // Header row
    {
      const rowH = 22;
      ensure(rowH);
      const y0 = y;
      setFill(HEADSHADE);
      pdf.rect(M, y0, contentW, rowH, "F");
      borders(y0, rowH);
      pdf.setFontSize(size);
      setFont(true, false);
      setColor(NAVY);
      const cy = y0 + rowH / 2 + size / 3;
      center("Sl.No", M, noW, cy);
      pdf.text("Description", M + noW + pad, cy);
      if (showTL) pdf.text("Timeline", M + noW + descW + pad, cy);
      right(`Amount (${doc.currency})`, M + contentW - pad, cy);
      y = y0 + rowH;
    }
    // Data rows
    const numbers = rowNumbers(doc.costing);
    doc.costing.forEach((c, i) => {
      pdf.setFontSize(size);
      // Nested delay-event lines are indented under their group header, and their
      // number (2.1, 2.2…) is prefixed to the item name rather than shown in the
      // Sl.No column, which carries only the top-level number.
      const indent = c.sub ? 12 : 0;
      const textX = M + noW + pad + indent;
      const textW = descW - 2 * pad - indent;
      const itemText = c.sub ? `${numbers[i]} ${c.item}` : c.item;
      const itemLines = wrap([{ text: itemText, bold: true }], textW, size);
      const desc = displayDescription(c.description);
      const descLines = desc ? wrap([{ text: desc }], textW, size - 1) : [];
      const rowH = Math.max((itemLines.length + descLines.length) * lh + 2 * pad, 30);
      ensure(rowH);
      const y0 = y;
      borders(y0, rowH);
      setFont(false, false);
      setColor(BODY);
      center(c.sub ? "" : numbers[i], M, noW, y0 + rowH / 2 + size / 3);
      let dy = y0 + pad + size * 0.9;
      itemLines.forEach((ln) => {
        drawRunLine(ln, textX, dy, size, c.group ? NAVY : BODY);
        dy += lh;
      });
      descLines.forEach((ln) => {
        drawRunLine(ln, textX, dy, size - 1, GREY);
        dy += (size - 1) * 1.3;
      });
      if (showTL) {
        setFont(false, false);
        setColor(BODY);
        pdf.setFontSize(size);
        pdf.text(c.group ? "" : c.timeline || "", M + noW + descW + pad, y0 + rowH / 2 + size / 3);
      }
      // A group header is priced by its sub-lines — printing the subtotal here too
      // would read as double-counting against the total.
      if (!c.group) {
        setFont(false, false);
        setColor(BODY);
        pdf.setFontSize(size);
        right(formatCurrencyFull(c.amount, doc.currency), M + contentW - pad, y0 + rowH / 2 + size / 3);
      }
      y = y0 + rowH;
    });
    // Total row
    {
      const rowH = 22;
      ensure(rowH);
      const y0 = y;
      setFill(TOTSHADE);
      pdf.rect(M, y0, contentW, rowH, "F");
      borders(y0, rowH);
      pdf.setFontSize(size);
      setFont(true, false);
      setColor(BODY);
      const cy = y0 + rowH / 2 + size / 3;
      right("Total", M + noW + descW + tlW - pad, cy);
      right(formatCurrencyFull(doc.total, doc.currency), M + contentW - pad, cy);
      y = y0 + rowH;
    }

    if (doc.paymentTerms?.length) {
      y += 6;
      subHeading("Payment Terms", MAROON);
      for (const t of doc.paymentTerms) bullet(inlineRuns(t));
    }
  }

  // ── Running header band + footer (drawn on inner pages at the end) ─────────
  function drawBand() {
    const bx = M;
    const by = 30;
    const bw = contentW;
    const bh = 46;
    setDraw(HB);
    pdf.setLineWidth(0.9);
    pdf.rect(bx, by, bw, bh);
    const lw = bw * 0.24;
    const rw = bw * 0.24;
    pdf.line(bx + lw, by, bx + lw, by + bh);
    pdf.line(bx + bw - rw, by, bx + bw - rw, by + bh);
    if (opts.clientLogo) {
      const f = fit(opts.clientLogo, lw - 16, bh - 14);
      if (f) addImg(opts.clientLogo, bx + (lw - f.w) / 2, by + (bh - f.h) / 2, f.w, f.h, f.fmt);
    }
    pdf.setFontSize(9);
    setFont(true, false);
    setColor(NAVY);
    const mid = bx + lw;
    const midW = bw - lw - rw;
    const lines = pdf.splitTextToSize(headerTitle, midW - 12) as string[];
    let ty = by + (bh - lines.length * 10) / 2 + 8;
    for (const l of lines) {
      const w = pdf.getTextWidth(l);
      pdf.text(l, mid + (midW - w) / 2, ty);
      ty += 10;
    }
    if (opts.alqararLogo) {
      const f = fit(opts.alqararLogo, rw - 16, bh - 14);
      if (f) addImg(opts.alqararLogo, bx + bw - rw + (rw - f.w) / 2, by + (bh - f.h) / 2, f.w, f.h, f.fmt);
    }
  }
  function drawFooter(n: number, total: number) {
    const fy = H - 56;
    setDraw(RULE);
    pdf.setLineWidth(0.5);
    pdf.line(M, fy, M + contentW, fy);
    pdf.setFontSize(7);
    setFont(false, false);
    setColor(GREY);
    const lines = pdf.splitTextToSize(CONFIDENTIAL, contentW) as string[];
    let cy = fy + 9;
    for (const l of lines) {
      const w = pdf.getTextWidth(l);
      pdf.text(l, M + (contentW - w) / 2, cy);
      cy += 8;
    }
    pdf.setFontSize(8);
    const s = `Page ${n} of ${total}`;
    pdf.text(s, M + contentW - pdf.getTextWidth(s), cy + 3);
  }

  // ── Cover page (page 1 — no band/footer) ──────────────────────────────────
  function coverText(text: string, size: number, color: RGB, bold = true, italic = false, gap = 10) {
    pdf.setFontSize(size);
    setFont(bold, italic);
    setColor(color);
    for (const l of pdf.splitTextToSize(text, contentW - 60) as string[]) {
      const w = pdf.getTextWidth(l);
      pdf.text(l, M + (contentW - w) / 2, y);
      y += size * 1.35;
    }
    y += gap;
  }
  function coverImg(data: string | undefined, maxW: number, maxH: number, gap = 14) {
    if (!data) return;
    const f = fit(data, maxW, maxH);
    if (!f) return;
    addImg(data, M + (contentW - f.w) / 2, y, f.w, f.h, f.fmt);
    y += f.h + gap;
  }

  // Both marks are given a generous box so they read at a comparable weight; the
  // block starts higher to keep the project name and date clear of the page edge.
  // Every label is tied to its content — a heading with nothing beneath it reads
  // as a gap in the document, so it is dropped along with the missing field.
  y = 165;
  if (opts.clientLogo || opts.clientCompany) {
    coverText("PROPOSAL SUBMITTED TO", 16, MAROON, true, false, 16);
    coverImg(opts.clientLogo, 125, 72, 14);
    if (opts.clientCompany) coverText(opts.clientCompany, 18, MAROON, true, false, 16);
  }
  coverText("PREPARED BY", 16, MAROON, true, false, 12);
  coverImg(opts.alqararLogo, 175, 60, 10);
  coverText(TAGLINE_1, 13, NAVY, false, true, 2);
  coverText(TAGLINE_2, 11, NAVY, false, true, 18);
  if (opts.projectName) {
    coverText("For", 16, MAROON, true, false, 12);
    coverText(opts.projectName, 20, MAROON, true, false, 12);
  }
  if (doc.date) coverText(doc.date, 13, MAROON, true, false, 0);

  // ── Content pages ─────────────────────────────────────────────────────────
  // Page 2 is reserved for the table of contents and written last, once every
  // section's real starting page is known.
  pdf.addPage();
  const tocPage = pdf.getNumberOfPages();
  doc.sections.forEach((s, i) => {
    // Each numbered section starts on a fresh page (matches the template).
    pdf.addPage();
    y = contentTop;
    startPages.push(pdf.getNumberOfPages());
    sectionHeading(`${i + 1}. ${s.heading}`);
    if (i === 0 && (doc.reference || doc.date)) {
      ensure(16);
      pdf.setFontSize(9.5);
      setFont(true, false);
      setColor(BODY);
      if (doc.reference) pdf.text(doc.reference, M, y);
      if (doc.date) pdf.text(doc.date, M + contentW - pdf.getTextWidth(doc.date), y);
      y += 16;
    }
    processBody(s.body);
  });
  commercial();
  tableOfContents(tocPage);

  // Stamp the band + footer on every content page (page 2 onward).
  const pageCount = pdf.getNumberOfPages();
  for (let p = 2; p <= pageCount; p++) {
    pdf.setPage(p);
    drawBand();
    drawFooter(p - 1, pageCount - 1);
  }

  const safe = (title || "Proposal").replace(/[^\w\-. ]+/g, "").trim().slice(0, 80) || "Proposal";
  pdf.save(`${safe}.pdf`);
}
