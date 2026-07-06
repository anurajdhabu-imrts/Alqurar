import { api } from "./client";

/** Live dashboard counts, aggregated server-side from the existing modules. */
export interface DashboardSummary {
  clients: number;
  projects: number;
  proposals: number;
  delayEvents: number;
  /** Project count keyed by project status (e.g. Active / Closeout / Completed). */
  projectsByStatus: Record<string, number>;
  /** Proposal count keyed by status. */
  proposalsByStatus: Record<string, number>;
  /** Delay-event count keyed by review status (Pending / Confirmed / …). */
  delayEventsByStatus: Record<string, number>;
}

export async function getDashboardSummaryApi(): Promise<DashboardSummary> {
  const { data } = await api.get<DashboardSummary>("/dashboard/summary");
  return data;
}
