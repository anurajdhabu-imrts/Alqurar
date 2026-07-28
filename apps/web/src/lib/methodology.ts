import type { Cell, Factor, MethodologySummary } from "@/api/methodology";

/** Local editable state, kept outside the canonical factor list so it can be
 * hydrated once and edited without mutating the query cache. */
export type AvailState = Record<number, Record<number, Record<string, Cell>>>;
export type DirectState = Record<number, Record<string, Cell>>;

/**
 * Recompute the whole method-selection summary from the current edits — a faithful
 * mirror of methodology_service.compute_summary on the backend, so the grand summary
 * and recommendation update live as the analyst toggles cells (before saving).
 *
 *   score(record, method) = 1 if Requirement=Yes AND Availability=Yes else 0
 *   suitability           = ΣScore / Σ(Requirement=Yes)   (0 when denominator 0)
 *                         = 1 if Yes else 0 for factors with no sub-table
 *   final                 = suitability × weight
 *   total                 = Σ final over all factors
 *   recommended           = method with the greatest total (null if all zero)
 */
export function computeSummary(
  factors: Factor[],
  methodIds: string[],
  avail: AvailState,
  direct: DirectState,
): MethodologySummary {
  const perFactor = [];
  const totals: Record<string, number> = Object.fromEntries(methodIds.map((m) => [m, 0]));

  for (const f of factors) {
    const suitability: Record<string, number> = {};
    for (const mid of methodIds) {
      if (f.hasDetail && f.records) {
        let reqCount = 0;
        let scoreSum = 0;
        for (const r of f.records) {
          if (r.requirement[mid] === "yes") {
            reqCount++;
            if (avail[f.no]?.[r.index]?.[mid] === "yes") scoreSum++;
          }
        }
        suitability[mid] = reqCount ? scoreSum / reqCount : 0;
      } else {
        suitability[mid] = direct[f.no]?.[mid] === "yes" ? 1 : 0;
      }
    }

    const finalScore: Record<string, number> = {};
    for (const mid of methodIds) {
      finalScore[mid] = suitability[mid] * f.weight;
      totals[mid] += finalScore[mid];
    }
    perFactor.push({ no: f.no, suitability, finalScore });
  }

  let recommended: string | null = null;
  let best = 0;
  for (const mid of methodIds) {
    if (totals[mid] > best) {
      best = totals[mid];
      recommended = mid;
    }
  }

  return { perFactor, totals, recommended };
}
