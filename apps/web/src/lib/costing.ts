import type { CostingSettings, CostingSummary } from "@/api/costing";

/**
 * Cost Summary calculation — the SINGLE source of truth for the live UI recalc.
 * Mirrors app/services/costing_service.compute_summary on the backend EXACTLY so
 * what the user sees while editing equals what gets stored and returned.
 *
 * This reproduces the business's Excel sheet ("Costing sheet - GDS.xlsx"):
 *
 *   Total Cost   = Σ(hours × rate)
 *   Contingency  = Total × contingency%
 *   Overheads    = (Total + Contingency) × overheads%
 *   Profit       = (Total + Contingency + Overheads) × profit%
 *   Income Tax   = Profit × incomeTax%                 // on the profit AMOUNT only
 *   VAT          = (Total+Cont+OH+Profit+Tax) × vat%   // Excel blank → default 0%
 *   Suggested    = Total + Contingency + Overheads + Profit + Income Tax + VAT
 *
 * Verified: Programme (Total 1032) → 1680.8055; Retainership (Total 480) → 781.77.
 */

export interface CalcEntry {
  hours: number;
  rate: number;
}
export interface CalcActivity {
  entries: CalcEntry[];
}

export const DEFAULT_SETTINGS: CostingSettings = {
  contingencyPct: 10,
  overheadsPct: 15,
  profitPct: 25,
  incomeTaxPct: 15,
  vatPct: 0,
};

/** Cost of a single row. Non-finite inputs collapse to 0 so the summary is never NaN. */
export function entryTotal(hours: number, rate: number): number {
  const h = Number.isFinite(hours) ? hours : 0;
  const r = Number.isFinite(rate) ? rate : 0;
  return h * r;
}

export function computeSummary(activities: CalcActivity[], settings: CostingSettings): CostingSummary {
  const total = activities.reduce(
    (sum, a) => sum + a.entries.reduce((s, e) => s + entryTotal(e.hours, e.rate), 0),
    0,
  );

  const c = (settings.contingencyPct || 0) / 100;
  const o = (settings.overheadsPct || 0) / 100;
  const p = (settings.profitPct || 0) / 100;
  const it = (settings.incomeTaxPct || 0) / 100;
  const v = (settings.vatPct || 0) / 100;

  const contingencyAmount = total * c;
  const subtotalAfterContingency = total + contingencyAmount;

  const overheadsAmount = subtotalAfterContingency * o;
  const subtotalAfterOverheads = subtotalAfterContingency + overheadsAmount;

  const profitAmount = subtotalAfterOverheads * p;
  const subtotalAfterProfit = subtotalAfterOverheads + profitAmount;

  // Excel quirk kept deliberately: income tax is a % of the PROFIT amount.
  const incomeTaxAmount = profitAmount * it;
  const subtotalAfterIncomeTax = subtotalAfterProfit + incomeTaxAmount;

  const vatAmount = subtotalAfterIncomeTax * v;
  const suggestedPricing = subtotalAfterIncomeTax + vatAmount;

  return {
    totalCost: total,
    contingencyPct: settings.contingencyPct,
    contingencyAmount,
    subtotalAfterContingency,
    overheadsPct: settings.overheadsPct,
    overheadsAmount,
    subtotalAfterOverheads,
    profitPct: settings.profitPct,
    profitAmount,
    subtotalAfterProfit,
    incomeTaxPct: settings.incomeTaxPct,
    incomeTaxAmount,
    subtotalAfterIncomeTax,
    vatPct: settings.vatPct,
    vatAmount,
    suggestedPricing,
  };
}
