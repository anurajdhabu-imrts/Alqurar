import { api } from "./client";

/** A yes/no/unanswered availability cell. */
export type Cell = "yes" | "no" | "";

/** One of the 4 candidate delay-analysis methodologies. */
export interface Method {
  id: string;
  label: string;
}

/** A record within a detailed factor: fixed per-method Requirement + editable
 * per-method Availability. */
export interface FactorRecord {
  index: number;
  name: string;
  requirement: Record<string, "yes" | "no">;
  availability: Record<string, Cell>;
}

/** A selection factor. Detailed factors carry `records` + a `field` label; others
 * carry `directScores` — a single Yes/No per method (no sub-checklist). */
export interface Factor {
  no: number;
  group: string;
  name: string;
  weight: number;
  hasDetail: boolean;
  field?: string;
  records?: FactorRecord[];
  directScores?: Record<string, Cell>;
}

export interface FactorScore {
  no: number;
  suitability: Record<string, number>;
  finalScore: Record<string, number>;
}

export interface MethodologySummary {
  perFactor: FactorScore[];
  totals: Record<string, number>;
  recommended: string | null;
}

export interface MethodologyAssessment {
  projectId: string;
  /** true → analyst picks the method by hand; false → use the scoring model. */
  knowMethodology: boolean;
  manualSelection: string | null;
  methods: Method[];
  factors: Factor[];
  summary: MethodologySummary;
  updatedAt: string | null;
}

/** State-only payload sent on save (canonical factors/weights owned by server). */
export interface MethodologyStateIn {
  knowMethodology: boolean;
  manualSelection: string | null;
  /** factorNo → recordIndex → methodId → "yes"/"no"/"" */
  availability: Record<string, Record<string, Record<string, Cell>>>;
  /** factorNo → methodId → "yes"/"no" (single Yes/No for no-sub-table factors) */
  directScores: Record<string, Record<string, Cell>>;
}

export async function getMethodologyApi(projectId: string): Promise<MethodologyAssessment> {
  const { data } = await api.get<MethodologyAssessment>(`/methodology/project/${projectId}`);
  return data;
}

export async function saveMethodologyApi(
  projectId: string,
  state: MethodologyStateIn,
): Promise<MethodologyAssessment> {
  const { data } = await api.put<MethodologyAssessment>(`/methodology/project/${projectId}`, state);
  return data;
}
