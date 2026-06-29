import { clsx, type ClassValue } from "clsx";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

/** Merge conditional class names. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/** "12 Mar 2026" */
export function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return iso;
  }
}

/** Compact currency, e.g. "AED 1.4M". */
export function formatCurrency(amount: number, currency = "AED"): string {
  const compact = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
  return `${currency} ${compact}`;
}

/** Full currency, e.g. "AED 1,420,000". */
export function formatCurrencyFull(amount: number, currency = "AED"): string {
  return `${currency} ${new Intl.NumberFormat("en-US").format(amount)}`;
}

/** Add calendar days to an ISO date, returning an ISO date ("2026-05-10"). */
export function addCalendarDays(iso: string, days: number): string {
  try {
    return format(addDays(parseISO(iso), days), "yyyy-MM-dd");
  } catch {
    return "";
  }
}

/** Signed day count to a date relative to today. Negative = overdue. */
export function daysUntil(iso: string): number {
  try {
    return differenceInCalendarDays(parseISO(iso), new Date());
  } catch {
    return 0;
  }
}

/** "in 4 days" / "2 days ago" / "today" */
export function relativeDays(iso: string): string {
  const d = daysUntil(iso);
  if (d === 0) return "today";
  if (d > 0) return `in ${d} day${d === 1 ? "" : "s"}`;
  return `${Math.abs(d)} day${d === -1 ? "" : "s"} ago`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
