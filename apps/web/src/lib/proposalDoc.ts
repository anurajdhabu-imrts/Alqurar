// Branded Word (.docx) export for a generated client proposal, built with the
// `docx` library so images (client + Al Qarar logos) embed as real media parts.
// Styled to match Al Qarar's proposal template: a cover page with maroon
// "PROPOSAL SUBMITTED TO / PREPARED BY / For" labels and centred logos, a
// light-blue bordered running header (client logo · title · Al Qarar logo), a
// confidentiality footer with "Page X of Y", maroon underlined section headings
// and justified body text.
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type { ClientProposal } from "@/api/clientProposals";
import { formatCurrencyFull } from "@/lib/utils";
import { rowNumbers } from "@/lib/proposalCosting";

type Content = NonNullable<ClientProposal["content"]>;

const MAROON = "8A2E2E"; // headings + cover labels
const NAVY = "1F3864"; // header title + tagline
const GREY = "6B7280"; // footer + muted
const BODY = "232323"; // body text
const HB_COLOR = "C4D3E8"; // light-blue header border
const TAGLINE_1 = "A Project Management Excellence built on Core Values";
const TAGLINE_2 = "Respect | Trust | Continual Improvement | Service";
const CONFIDENTIAL =
  "This document is the sole property of Al Qarar Management Solutions. Any unauthorized use, reproduction, or distribution of this document is strictly prohibited.";

const CELL_B = { style: BorderStyle.SINGLE, size: 4, color: "C7CCD6" };
const HB = { style: BorderStyle.SINGLE, size: 4, color: HB_COLOR };
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE };

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

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function imageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = dataUrl;
  });
}

type ImgType = "png" | "jpg" | "gif" | "bmp";

/** ImageRun scaled to fit within maxW×maxH (px), preserving aspect ratio. */
async function imageRun(dataUrl?: string, maxW = 200, maxH = 80): Promise<ImageRun | null> {
  if (!dataUrl || !dataUrl.startsWith("data:")) return null;
  const m = dataUrl.match(/^data:image\/(\w+);base64,(.*)$/s);
  if (!m) return null;
  const raw = m[1].toLowerCase();
  const type: ImgType = raw === "jpeg" || raw === "jpg" ? "jpg" : raw === "gif" ? "gif" : raw === "bmp" ? "bmp" : "png";
  const bytes = b64ToBytes(m[2]);
  const { width, height } = await imageDimensions(dataUrl);
  const ratio = width / height || 1;
  let w = maxW;
  let h = maxW / ratio;
  if (h > maxH) {
    h = maxH;
    w = maxH * ratio;
  }
  return new ImageRun({ data: bytes, type, transformation: { width: Math.round(w), height: Math.round(h) } });
}

/** Maroon, underlined, left-aligned section heading. */
function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 260, after: 110 },
    children: [new TextRun({ text, bold: true, color: MAROON, size: 25, underline: {} })],
  });
}

/** Section body → paragraphs (justified), honoring blank-line paragraphs and "- " bullets. */
function bodyParagraphs(body: string): Paragraph[] {
  const out: Paragraph[] = [];
  const blocks = String(body ?? "").split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n");
    const nonEmpty = lines.filter((l) => l.trim());
    const bullets = lines.filter((l) => /^\s*[-•]\s+/.test(l));
    if (bullets.length && bullets.length === nonEmpty.length) {
      for (const l of lines) {
        const t = l.replace(/^\s*[-•]\s+/, "").trim();
        if (t) out.push(new Paragraph({ children: [new TextRun({ text: t, size: 21, color: BODY })], bullet: { level: 0 }, spacing: { after: 50 } }));
      }
    } else {
      const runs: TextRun[] = [];
      lines.forEach((l, i) => {
        if (i > 0) runs.push(new TextRun({ break: 1 }));
        runs.push(new TextRun({ text: l, size: 21, color: BODY }));
      });
      out.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 130 }, children: runs }));
    }
  }
  return out.length ? out : [new Paragraph({ text: "" })];
}

function commercialTable(doc: Content): (Paragraph | Table)[] {
  if (!doc.costing?.length) return [];
  const showTimeline = doc.costing.some((c) => (c.timeline ?? "").trim());
  const numbers = rowNumbers(doc.costing);
  const th = (t: string, align?: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
    new TableCell({
      shading: { type: ShadingType.CLEAR, fill: "EEF1F6", color: "auto" },
      children: [new Paragraph({ alignment: align, children: [new TextRun({ text: t, bold: true, color: NAVY, size: 20 })] })],
    });
  const td = (runs: TextRun[], align?: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
    new TableCell({ children: [new Paragraph({ alignment: align, children: runs })] });

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        th("Sl.No", AlignmentType.CENTER),
        th("Description"),
        ...(showTimeline ? [th("Timeline")] : []),
        th(`Amount (${doc.currency})`, AlignmentType.RIGHT),
      ],
    }),
    ...doc.costing.map(
      (c, i) =>
        new TableRow({
          children: [
            td([new TextRun({ text: numbers[i], size: 20 })], AlignmentType.CENTER),
            new TableCell({
              // Nested delay-event lines sit indented under their group header.
              children: [
                new Paragraph({
                  indent: c.sub ? { left: 240 } : undefined,
                  children: [
                    new TextRun({ text: c.item, bold: true, size: 21, color: c.group ? NAVY : undefined }),
                    ...(c.description ? [new TextRun({ break: 1, text: c.description, size: 19, color: GREY })] : []),
                  ],
                }),
              ],
            }),
            ...(showTimeline ? [td([new TextRun({ text: c.group ? "" : c.timeline ?? "", size: 20 })])] : []),
            // A group header is priced by its sub-lines — printing the subtotal here
            // too would read as double-counting against the total.
            td([new TextRun({ text: c.group ? "" : formatCurrencyFull(c.amount, doc.currency), size: 21 })], AlignmentType.RIGHT),
          ],
        }),
    ),
    new TableRow({
      children: [
        new TableCell({
          columnSpan: showTimeline ? 3 : 2,
          shading: { type: ShadingType.CLEAR, fill: "F6F8FB", color: "auto" },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Total", bold: true, size: 21 })] })],
        }),
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: "F6F8FB", color: "auto" },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatCurrencyFull(doc.total, doc.currency), bold: true, size: 21 })] })],
        }),
      ],
    }),
  ];

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: CELL_B, bottom: CELL_B, left: CELL_B, right: CELL_B, insideHorizontal: CELL_B, insideVertical: CELL_B },
    rows,
  });

  const out: (Paragraph | Table)[] = [heading("Commercial Proposal"), table];
  if (doc.paymentTerms?.length) {
    out.push(new Paragraph({ spacing: { before: 160, after: 50 }, children: [new TextRun({ text: "Payment Terms", bold: true, color: MAROON, size: 22, underline: {} })] }));
    for (const t of doc.paymentTerms) out.push(new Paragraph({ children: [new TextRun({ text: t, size: 21, color: BODY })], bullet: { level: 0 }, spacing: { after: 50 } }));
  }
  return out;
}

export interface ProposalDocOpts {
  clientLogo?: string;
  alqararLogo?: string;
  clientCompany?: string;
  projectName?: string;
  subject?: string;
}

/** Build the branded .docx and trigger a download. */
export async function downloadProposalDoc(doc: Content, opts: ProposalDocOpts): Promise<void> {
  const title = doc.title || "Proposal for Claims Support Services";
  const headerTitle = (opts.projectName || title).toUpperCase();

  const [clientHdr, aqHdr, clientCover, aqCover] = await Promise.all([
    imageRun(opts.clientLogo, 95, 34),
    imageRun(opts.alqararLogo, 120, 34),
    imageRun(opts.clientLogo, 120, 90),
    imageRun(opts.alqararLogo, 240, 90),
  ]);

  // Running header: [client logo] [uppercase navy title] [Al Qarar logo], boxed light-blue.
  const header = new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: HB, bottom: HB, left: HB, right: HB, insideHorizontal: HB, insideVertical: HB },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 24, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: clientHdr ? [clientHdr] : [new TextRun({ text: opts.clientCompany || "", size: 14, color: GREY })] })],
              }),
              new TableCell({
                width: { size: 52, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: headerTitle, bold: true, color: NAVY, size: 18 })] })],
              }),
              new TableCell({
                width: { size: 24, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: aqHdr ? [aqHdr] : [new TextRun({ text: "AL QARAR", bold: true, color: NAVY })] })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Footer: confidentiality (centred, top rule) + "Page X of Y" (right).
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: "D9DCE3" } },
        spacing: { before: 60 },
        children: [new TextRun({ text: CONFIDENTIAL, size: 13, color: GREY })],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 15, color: GREY })],
      }),
    ],
  });

  const label = (text: string, spacingAfter = 120) =>
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: spacingAfter }, children: [new TextRun({ text, bold: true, color: MAROON, size: 32, characterSpacing: 30 })] });
  const centerImg = (img: ImageRun | null, fallback: string, spacingAfter = 100) =>
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: spacingAfter }, children: img ? [img] : [new TextRun({ text: fallback, bold: true, color: NAVY, size: 36 })] });

  // Cover page.
  const cover: Paragraph[] = [
    new Paragraph({ spacing: { before: 700 } }),
    label("PROPOSAL SUBMITTED TO", 140),
    centerImg(clientCover, opts.clientCompany || "", 60),
    ...(opts.clientCompany ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 140 }, children: [new TextRun({ text: opts.clientCompany, bold: true, color: MAROON, size: 34 })] })] : []),
    label("PREPARED BY", 100),
    centerImg(aqCover, "AL QARAR", 40),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: TAGLINE_1, italics: true, color: NAVY, size: 24 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: TAGLINE_2, italics: true, color: NAVY, size: 20 })] }),
    label("For", 120),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 180 }, children: [new TextRun({ text: opts.projectName || title, bold: true, color: MAROON, size: 36 })] }),
    ...(doc.date ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: doc.date, bold: true, color: MAROON, size: 26 })] })] : []),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // Reference (left) + date (right) row, above the first section.
  const refRow: (Paragraph | Table)[] =
    doc.reference || doc.date
      ? [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ borders: NO_BORDERS, width: { size: 60, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: doc.reference || "", bold: true, size: 20, color: BODY })] })] }),
                  new TableCell({ borders: NO_BORDERS, width: { size: 40, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: doc.date || "", bold: true, size: 20, color: BODY })] })] }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: "" }),
        ]
      : [];

  const sections: Paragraph[] = [];
  doc.sections.forEach((s, i) => {
    sections.push(heading(`${i + 1}. ${s.heading}`));
    sections.push(...bodyParagraphs(s.body));
  });

  const docFile = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 21, color: BODY } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1720, right: 1080, bottom: 1180, left: 1080, header: 640, footer: 520 },
          },
        },
        headers: { default: header },
        footers: { default: footer },
        children: [...cover, ...(refRow as Paragraph[]), ...sections, ...(commercialTable(doc) as Paragraph[])],
      },
    ],
  });

  const blob = await Packer.toBlob(docFile);
  const url = URL.createObjectURL(blob);
  const safe = (title || "Proposal").replace(/[^\w\-. ]+/g, "").trim().slice(0, 80) || "Proposal";
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safe}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
