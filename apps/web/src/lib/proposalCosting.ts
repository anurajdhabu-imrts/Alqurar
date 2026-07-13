/** Shape of the costing rows the numbering works on (form lines or generated lines). */
interface Row {
  /** A group header (e.g. "Delay Analysis"); its amount is the subtotal of its children. */
  group?: boolean;
  /** A child of the group header above it. */
  sub?: boolean;
}

/** The fixed group header the identified delay events are nested under. */
export const DELAY_GROUP_ITEM = "Delay Analysis";

export const DELAY_GROUP_DESC =
  "Event-by-event entitlement analysis of the delay events identified on the project, priced individually below.";

/** Sl.No labels — top-level rows are "1", "2", …; nested rows are "2.1", "2.2", …. */
export function rowNumbers(rows: Row[]): string[] {
  let top = 0;
  let child = 0;
  return rows.map((r) => {
    if (r.sub && top > 0) {
      child += 1;
      return `${top}.${child}`;
    }
    top += 1;
    child = 0;
    return String(top);
  });
}

/** Sum of a group header's children — the rows nested directly beneath it. */
export function groupSubtotal<T extends Row>(rows: T[], groupIndex: number, amount: (row: T) => number): number {
  let sum = 0;
  for (let i = groupIndex + 1; i < rows.length && rows[i].sub; i++) sum += amount(rows[i]);
  return sum;
}
