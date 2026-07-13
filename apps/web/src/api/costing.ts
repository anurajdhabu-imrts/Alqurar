import { api } from "./client";

/** One employee line within a costing activity. `rate` is the hourly rate
 * snapshotted from the Employee master when the row was added. */
export interface CostingEntry {
  role: string;
  employeeId?: string | null;
  employeeName?: string | null;
  hours: number;
  rate: number;
}

export interface CostingEntryOut extends CostingEntry {
  id: string;
  activityId: string;
  projectId: string;
  sortIndex: number;
  total: number;
}

export interface CostingActivityOut {
  id: string;
  projectId: string;
  description: string;
  sortIndex: number;
  entries: CostingEntryOut[];
  total: number;
}

export interface CostingSettings {
  contingencyPct: number;
  overheadsPct: number;
  profitPct: number;
  incomeTaxPct: number;
  vatPct: number;
}

export interface CostingSettingsOut extends CostingSettings {
  projectId: string;
  updatedAt?: string | null;
}

/** The Cost Summary waterfall, computed server-side (Excel-parity). The UI also
 * computes this locally for instant recalculation while editing. */
export interface CostingSummary {
  totalCost: number;
  contingencyPct: number;
  contingencyAmount: number;
  subtotalAfterContingency: number;
  overheadsPct: number;
  overheadsAmount: number;
  subtotalAfterOverheads: number;
  profitPct: number;
  profitAmount: number;
  subtotalAfterProfit: number;
  incomeTaxPct: number;
  incomeTaxAmount: number;
  subtotalAfterIncomeTax: number;
  vatPct: number;
  vatAmount: number;
  suggestedPricing: number;
}

export interface CostingSheet {
  projectId: string;
  activities: CostingActivityOut[];
  settings: CostingSettingsOut;
  summary: CostingSummary;
}

/** Payload to replace the whole sheet in one save. */
export interface CostingActivityIn {
  description: string;
  entries: CostingEntry[];
}

export interface CostingSheetIn {
  activities: CostingActivityIn[];
  settings: CostingSettings;
}

export async function getCostingApi(projectId: string): Promise<CostingSheet> {
  const { data } = await api.get<CostingSheet>(`/costing/project/${projectId}`);
  return data;
}

export async function saveCostingApi(projectId: string, sheet: CostingSheetIn): Promise<CostingSheet> {
  const { data } = await api.put<CostingSheet>(`/costing/project/${projectId}`, sheet);
  return data;
}
