/**
 * The proposal's table of contents, derived from the document itself rather than
 * written by the AI — so it can never disagree with the sections that follow it.
 *
 * The entry list is shared by the on-screen view and the PDF export; only the PDF
 * carries page numbers, which it records as it lays each section out.
 */

interface TocSource {
  sections: { heading: string }[];
  costing?: { item: string }[];
}

export interface TocEntry {
  /** Printed number — matches the numbering the section headings use. */
  no: number;
  title: string;
}

/** The numbered headings of a proposal: its narrative sections, then the
 *  commercial table when the document carries one. */
export function tocEntries(content: TocSource): TocEntry[] {
  const entries = content.sections.map((s, i) => ({ no: i + 1, title: s.heading }));
  if (content.costing?.length) {
    entries.push({ no: entries.length + 1, title: "Commercial Proposal" });
  }
  return entries;
}
