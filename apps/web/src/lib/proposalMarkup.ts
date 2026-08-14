/**
 * Parser for the light markup the AI writes proposal section bodies in, shared by
 * the on-screen proposal view and the PDF export so a generated proposal reads the
 * same in both. The markup (pinned down in the backend proposal templates) is:
 *
 *   **Sub-heading** on its own line   → a sub-heading block
 *   - bullet / • bullet               → a bullet list item ("  - " = nested)
 *   1) item / a) item / i) item / o   → a numbered list item (marker preserved)
 *   **bold** inline                   → a bold run
 *   blank line                        → paragraph break
 *
 * Cover-letter lines (M/s …, Kind Attn …, Subject: …) are styled by convention so
 * the letterhead reads correctly without the model having to mark them up.
 */

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export interface ListItem {
  /** Printed marker ("1)", "a)"); empty for a plain bullet. */
  marker: string;
  /** 0 = left margin, 1 = nested one level. */
  level: number;
  runs: Run[];
}

export type Block =
  | { kind: "subheading"; text: string }
  /** `spaced` = a blank line preceded it, so it starts a new paragraph rather
   *  than continuing a run of lines (address lines, sign-off). */
  | { kind: "para"; runs: Run[]; spaced: boolean }
  | { kind: "list"; items: ListItem[] };

const HASH_HEADING = /^#{2,4}\s+(.+?)\s*$/;
const BOLD_HEADING = /^\*\*(.+?)\*\*\s*:?\s*$/;
const BULLET = /^(\s*)[-–—•*]\s+(.+)$/;
/** "1) ", "1. ", "a) ", "iv) " and the Word-style "o " sub-bullet. */
const NUMBERED = /^(\s*)((?:\d{1,2}|[a-zA-Z]|[ivxIVX]{2,4})[.)]|o)\s+(.+)$/;

/** Split a line into runs on inline `**bold**` markers. */
export function inlineRuns(text: string): Run[] {
  const runs: Run[] = [];
  for (const part of text.split(/(\*\*[^*]+\*\*)/g)) {
    if (part === "") continue;
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    runs.push({ text: m ? m[1] : part, bold: !!m });
  }
  return runs.length ? runs : [{ text }];
}

/** Cover-letter-aware styling for a whole line (Subject / Kind Attn / M/s …). */
export function lineRuns(line: string): Run[] {
  const t = line.replace(/\s+$/, "");
  if (/^\s*Subject\s*:/i.test(t)) return [{ text: t.trim(), bold: true }];
  if (/^\s*Kind\s*Attn/i.test(t)) return [{ text: t.trim(), bold: true, italic: true }];
  if (/^\s*M\/s\b/.test(t)) return [{ text: t.trim(), bold: true }];
  return inlineRuns(t);
}

/** Parse a section body into the blocks a renderer lays out. */
export function parseProposalBody(body: string): Block[] {
  const blocks: Block[] = [];
  let items: ListItem[] | null = null;
  // The first line of a section always opens a paragraph.
  let afterBlank = true;

  const flushList = () => {
    if (items) {
      blocks.push({ kind: "list", items });
      items = null;
    }
  };
  const pushItem = (item: ListItem) => {
    if (items) items.push(item);
    else items = [item];
  };

  for (const raw of String(body ?? "").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) {
      flushList();
      afterBlank = true;
      continue;
    }

    const heading = line.trim().match(HASH_HEADING) ?? line.trim().match(BOLD_HEADING);
    if (heading) {
      flushList();
      blocks.push({ kind: "subheading", text: heading[1].trim() });
      afterBlank = true;
      continue;
    }

    const bullet = line.match(BULLET);
    if (bullet) {
      pushItem({ marker: "", level: bullet[1].length >= 2 ? 1 : 0, runs: inlineRuns(bullet[2].trim()) });
      afterBlank = false;
      continue;
    }

    const numbered = line.match(NUMBERED);
    if (numbered) {
      const marker = numbered[2];
      // "o" is Word's nested bullet — render it as a hollow bullet, not a letter.
      const nested = marker === "o" || numbered[1].length >= 2;
      pushItem({
        marker: marker === "o" ? "" : marker,
        level: nested ? 1 : 0,
        runs: inlineRuns(numbered[3].trim()),
      });
      afterBlank = false;
      continue;
    }

    flushList();
    blocks.push({ kind: "para", runs: lineRuns(line.trim()), spaced: afterBlank });
    afterBlank = false;
  }
  flushList();
  return blocks;
}
