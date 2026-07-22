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

type Run = { text: string; bold?: boolean; italic?: boolean };

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

/** Parse inline **bold** markers into styled runs. */
function inlineRuns(text: string): Run[] {
  const runs: Run[] = [];
  for (const p of text.split(/(\*\*[^*]+\*\*)/g)) {
    if (p === "") continue;
    const m = p.match(/^\*\*([^*]+)\*\*$/);
    runs.push({ text: m ? m[1] : p, bold: !!m });
  }
  return runs.length ? runs : [{ text }];
}

/** Cover-letter-aware styling for a single line (Subject / Kind Attn / M/s …). */
function lineRuns(line: string): Run[] {
  const t = line.replace(/\s+$/, "");
  if (/^\s*Subject\s*:/i.test(t)) return [{ text: t.trim(), bold: true }];
  if (/^\s*Kind\s*Attn/i.test(t)) return [{ text: t.trim(), bold: true, italic: true }];
  if (/^\s*M\/s\b/.test(t)) return [{ text: t.trim(), bold: true }];
  return inlineRuns(t);
}

/** A one-line "## Heading" or "**Heading**" block → sub-heading text, else null. */
function subheadingText(block: string): string | null {
  const t = block.trim();
  if (t.includes("\n")) return null;
  let m = t.match(/^#{2,4}\s+(.+)$/);
  if (m) return m[1].trim();
  m = t.match(/^\*\*(.+?)\*\*:?$/);
  return m ? m[1].trim() : null;
}

export interface ProposalPdfOpts {
  clientLogo?: string;
  alqararLogo?: string;
  clientCompany?: string;
  projectName?: string;
  subject?: string;
}

/** Build the branded PDF and trigger a download. */
export function downloadProposalPdf(doc: Content, opts: ProposalPdfOpts): void {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
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
    pdf.setFont("helvetica", b && i ? "bolditalic" : b ? "bold" : i ? "italic" : "normal");
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
  function drawRunLine(line: Run[], x: number, yy: number, size: number, color: RGB) {
    pdf.setFontSize(size);
    let cx = x;
    for (const t of line) {
      setFont(t.bold, t.italic);
      setColor(color);
      pdf.text(t.text, cx, yy);
      cx += pdf.getTextWidth(t.text);
    }
  }
  const ensure = (space: number) => {
    if (y + space > contentBottom) {
      pdf.addPage();
      y = contentTop;
    }
  };

  function para(runs: Run[], size = 10, gap = 6, color: RGB = BODY, indent = 0) {
    const lh = size * 1.5;
    for (const ln of wrap(runs, contentW - indent, size)) {
      ensure(lh);
      drawRunLine(ln, M + indent, y, size, color);
      y += lh;
    }
    y += gap;
  }
  function bullet(runs: Run[]) {
    const size = 10;
    const lh = size * 1.5;
    const lines = wrap(runs, contentW - 22, size);
    ensure(lh);
    setFill(BODY);
    pdf.circle(M + 10, y - 3, 1.3, "F");
    lines.forEach((ln, i) => {
      if (i > 0) ensure(lh);
      drawRunLine(ln, M + 22, y, size, BODY);
      y += lh;
    });
    y += 5;
  }
  function sectionHeading(text: string) {
    ensure(40);
    y += 20;
    const size = 12;
    pdf.setFontSize(size);
    setFont(true, false);
    for (const l of pdf.splitTextToSize(text.toUpperCase(), contentW)) {
      const w = pdf.getTextWidth(l);
      const cx = M + (contentW - w) / 2;
      ensure(size * 1.6);
      setColor(MAROON);
      pdf.text(l, cx, y);
      setDraw(MAROON);
      pdf.setLineWidth(0.7);
      pdf.line(cx, y + 2.5, cx + w, y + 2.5);
      y += size * 1.6;
    }
    y += 12;
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

  function processBody(body: string) {
    for (const block of String(body ?? "").split(/\n{2,}/)) {
      if (!block.trim()) continue;
      const sub = subheadingText(block);
      if (sub) {
        subHeading(sub);
        continue;
      }
      const lines = block.split("\n");
      const nonEmpty = lines.filter((l) => l.trim());
      const bl = lines.filter((l) => /^\s*[-•]\s+/.test(l));
      if (bl.length && bl.length === nonEmpty.length) {
        for (const l of lines) {
          const t = l.replace(/^\s*[-•]\s+/, "").trim();
          if (t) bullet(inlineRuns(t));
        }
        y += 8;
      } else {
        for (const l of nonEmpty) para(lineRuns(l), 10, 4);
        y += 10;
      }
    }
  }

  // ── Commercial table ──────────────────────────────────────────────────────
  function commercial() {
    if (!doc.costing?.length) return;
    pdf.addPage();
    y = contentTop;
    sectionHeading("Commercial Proposal");
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

  y = 170;
  coverText("PROPOSAL SUBMITTED TO", 16, MAROON, true, false, 16);
  coverImg(opts.clientLogo, 130, 80, 14);
  if (opts.clientCompany) coverText(opts.clientCompany, 18, MAROON, true, false, 16);
  coverText("PREPARED BY", 16, MAROON, true, false, 12);
  coverImg(opts.alqararLogo, 220, 70, 10);
  coverText(TAGLINE_1, 13, NAVY, false, true, 2);
  coverText(TAGLINE_2, 11, NAVY, false, true, 18);
  coverText("For", 16, MAROON, true, false, 12);
  coverText(opts.projectName || title, 20, MAROON, true, false, 12);
  if (doc.date) coverText(doc.date, 13, MAROON, true, false, 0);

  // ── Content pages ─────────────────────────────────────────────────────────
  pdf.addPage();
  y = contentTop;
  doc.sections.forEach((s, i) => {
    if (i > 0) {
      // Each numbered section starts on a fresh page (matches the template).
      pdf.addPage();
      y = contentTop;
    }
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
