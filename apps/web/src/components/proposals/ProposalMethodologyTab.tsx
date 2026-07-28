import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Award, Check, Loader2, Lock, Pencil, Route, Save, Scale } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { useMethodology, useSaveMethodology } from "@/hooks/useMethodology";
import { computeSummary, type AvailState, type DirectState } from "@/lib/methodology";
import type { Cell, Factor, Method, MethodologyAssessment } from "@/api/methodology";

const fmt = (n: number) => n.toFixed(2);

/** Short column label for a detailed factor's editable field. */
function shortField(field?: string): string {
  if (!field) return "Avail.";
  if (field.startsWith("Availability")) return "Avail.";
  if (field.startsWith("Purpose")) return "Purpose";
  return field; // "Applicable" | "Suitable"
}

/**
 * Proposal → Methodology & Approach tab. Implements the business's "Delay Analysis
 * Method Selection - Model": either the analyst picks the methodology by hand, or
 * the 4 candidate methods are scored against 17 weighted factors and the highest
 * weighted total is recommended. The whole assessment is loaded, edited locally and
 * saved in one call (like the Cost Sheet / Checklist); the grand summary recomputes
 * live as cells are toggled.
 */
export function ProposalMethodologyTab({ proposalId }: { proposalId: string }) {
  const { data, isLoading, isError, error } = useMethodology(proposalId);
  const save = useSaveMethodology(proposalId);

  const methods: Method[] = useMemo(() => data?.methods ?? [], [data]);
  const methodIds = useMemo(() => methods.map((m) => m.id), [methods]);
  const factors: Factor[] = useMemo(() => data?.factors ?? [], [data]);

  const [know, setKnow] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  const [avail, setAvail] = useState<AvailState>({});
  const [direct, setDirect] = useState<DirectState>({});
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Load the local editable state from a server assessment.
  const hydrate = useCallback((d: MethodologyAssessment) => {
    setKnow(d.knowMethodology);
    setManual(d.manualSelection);
    const a: AvailState = {};
    const dr: DirectState = {};
    for (const f of d.factors) {
      if (f.hasDetail && f.records) {
        a[f.no] = {};
        for (const r of f.records) a[f.no][r.index] = { ...r.availability };
      } else {
        dr[f.no] = {};
        for (const m of d.methods) dr[f.no][m.id] = f.directScores?.[m.id] ?? "";
      }
    }
    setAvail(a);
    setDirect(dr);
  }, []);

  // Hydrate from the server — but never clobber unsaved edits.
  const lastHydrated = useRef<MethodologyAssessment | null>(null);
  useEffect(() => {
    if (!data || dirty || lastHydrated.current === data) return;
    hydrate(data);
    lastHydrated.current = data;
  }, [data, dirty, hydrate]);

  // Start locked (view mode) when an assessment already exists; open straight into
  // edit mode the first time, when nothing has been saved yet.
  const initEdit = useRef(false);
  useEffect(() => {
    if (!data || initEdit.current) return;
    initEdit.current = true;
    setEditing(!data.updatedAt);
  }, [data]);

  const summary = useMemo(
    () => computeSummary(factors, methodIds, avail, direct),
    [factors, methodIds, avail, direct],
  );

  function touch() {
    setDirty(true);
    setSaveError("");
  }
  function toggleCell(fno: number, ridx: number, mid: string, value: Exclude<Cell, "">) {
    setAvail((prev) => {
      const cur = prev[fno]?.[ridx]?.[mid] ?? "";
      const next: AvailState = { ...prev, [fno]: { ...(prev[fno] ?? {}) } };
      next[fno][ridx] = { ...(prev[fno]?.[ridx] ?? {}), [mid]: cur === value ? "" : value };
      return next;
    });
    touch();
  }
  function toggleDirect(fno: number, mid: string, value: Exclude<Cell, "">) {
    setDirect((prev) => {
      const cur = prev[fno]?.[mid] ?? "";
      return { ...prev, [fno]: { ...(prev[fno] ?? {}), [mid]: cur === value ? "" : value } };
    });
    touch();
  }

  async function onSave() {
    setSaveError("");
    try {
      await save.mutateAsync({
        knowMethodology: know,
        manualSelection: manual,
        availability: avail as unknown as Record<string, Record<string, Record<string, Cell>>>,
        directScores: direct as unknown as Record<string, Record<string, Cell>>,
      });
      setDirty(false); // allows the fresh server assessment to re-hydrate
      setEditing(false); // lock back to view mode after a successful save
    } catch (err) {
      setSaveError(apiErrorMessage(err, "Could not save the assessment — is the backend running?"));
    }
  }

  function onCancel() {
    if (data) hydrate(data); // discard edits, restore the last saved state
    setDirty(false);
    setSaveError("");
    setEditing(false);
  }

  if (isLoading) {
    return (
      <div className="text-center py-16 text-sm text-muted inline-flex items-center justify-center gap-2 w-full">
        <Loader2 className="size-4 animate-spin" /> Loading methodology model…
      </div>
    );
  }
  if (isError) {
    return <p className="text-sm text-error bg-error-bg rounded-lg px-3 py-2">{apiErrorMessage(error, "Couldn't load the methodology model.")}</p>;
  }

  const recommendedLabel = summary.recommended
    ? methods.find((m) => m.id === summary.recommended)?.label ?? null
    : null;

  const readOnly = !editing;

  // Edit-mode aware action buttons (used in the header and at the bottom).
  const actions = editing ? (
    <>
      {dirty && <span className="text-[11px] font-medium text-warning bg-warning-bg rounded-full px-2 py-0.5">Unsaved</span>}
      {data?.updatedAt && (
        <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={save.isPending}>
          Cancel
        </button>
      )}
      <button className="btn btn-primary btn-sm" onClick={onSave} disabled={save.isPending || !dirty}>
        {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {save.isPending ? "Saving…" : dirty ? "Save" : "Saved"}
      </button>
    </>
  ) : (
    <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>
      <Pencil className="size-4" /> Edit
    </button>
  );

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">Methodology &amp; Approach</h3>
          <p className="text-xs text-muted mt-0.5 max-w-2xl">
            Choose the delay-analysis methodology directly, or let the weighted scoring model evaluate all four methods
            and recommend the most suitable one for this project.
          </p>
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>

      {readOnly && data?.updatedAt && (
        <div className="flex items-center gap-2 text-xs text-muted bg-navy-50/60 border border-border rounded-lg px-3 py-2">
          <Lock className="size-3.5 text-navy-500" />
          View only — this assessment is saved. Click <span className="font-medium text-ink">Edit</span> to make changes.
        </div>
      )}

      {/* ── Selection question ── */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="size-9 shrink-0 rounded-lg bg-navy-100 text-navy-700 grid place-items-center">
            <Route className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">Methodology Selection</p>
            <p className="text-sm text-muted mt-0.5">Do you already know which methodology to apply for this claim?</p>

            <div className="inline-flex rounded-lg border border-border overflow-hidden mt-3">
              <button
                type="button"
                disabled={readOnly}
                onClick={() => { setKnow(true); touch(); }}
                className={cn("px-4 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed", know ? "bg-navy-900 text-white" : "bg-surface text-muted hover:bg-navy-50")}
              >
                Yes — I'll choose it
              </button>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => { setKnow(false); touch(); }}
                className={cn("px-4 py-1.5 text-sm font-semibold border-l border-border transition-colors disabled:cursor-not-allowed", !know ? "bg-navy-900 text-white" : "bg-surface text-muted hover:bg-navy-50")}
              >
                No — evaluate &amp; recommend
              </button>
            </div>
          </div>
        </div>

        {/* Manual pick — 4 method cards */}
        {know && (
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
            {methods.map((m) => {
              const on = manual === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => { setManual(on ? null : m.id); touch(); }}
                  className={cn(
                    "text-left rounded-xl border p-3.5 transition-all disabled:cursor-not-allowed",
                    on ? "border-navy-500 bg-navy-50 ring-1 ring-navy-500" : "border-border enabled:hover:border-navy-300 enabled:hover:bg-navy-50/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("size-5 rounded-full grid place-items-center border", on ? "bg-navy-600 border-navy-600 text-white" : "border-border text-transparent")}>
                      <Check className="size-3.5" />
                    </span>
                    {on && <span className="text-[10px] font-bold uppercase tracking-wide text-navy-700">Selected</span>}
                  </div>
                  <p className="mt-2 font-semibold text-ink text-sm leading-snug">{m.label}</p>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {saveError && <p className="text-sm text-error bg-error-bg rounded-md px-3 py-2">{saveError}</p>}

      {/* ── Manual mode: confirmation ── */}
      {know && (
        <Card className="p-4 flex items-center gap-3 bg-navy-50/40">
          <Award className="size-5 text-navy-600 shrink-0" />
          <p className="text-sm text-ink">
            {manual
              ? <>Selected methodology: <span className="font-semibold">{methods.find((m) => m.id === manual)?.label}</span></>
              : <span className="text-muted">Pick one of the four methodologies above.</span>}
          </p>
        </Card>
      )}

      {/* ── Assessment mode: recommendation + factor tables + grand summary ── */}
      {!know && (
        <>
          <RecommendationBanner recommendedLabel={recommendedLabel} totals={summary.totals} methods={methods} recommended={summary.recommended} />

          {factors.map((f, i) => {
            const prevGroup = i > 0 ? factors[i - 1].group : null;
            const showGroup = f.group !== prevGroup;
            const suitability = summary.perFactor.find((p) => p.no === f.no)?.suitability ?? {};
            const finalScore = summary.perFactor.find((p) => p.no === f.no)?.finalScore ?? {};
            return (
              <div key={f.no} className="space-y-2">
                {showGroup && (
                  <h4 className="text-xs font-bold uppercase tracking-wide text-navy-700 pt-2">{f.group}</h4>
                )}
                {f.hasDetail ? (
                  <DetailFactorTable
                    factor={f}
                    methods={methods}
                    availForFactor={avail[f.no] ?? {}}
                    suitability={suitability}
                    readOnly={readOnly}
                    onToggle={(ridx, mid, value) => toggleCell(f.no, ridx, mid, value)}
                  />
                ) : (
                  <DirectFactorCard
                    factor={f}
                    methods={methods}
                    directForFactor={direct[f.no] ?? {}}
                    suitability={suitability}
                    finalScore={finalScore}
                    readOnly={readOnly}
                    onToggle={(mid, value) => toggleDirect(f.no, mid, value)}
                  />
                )}
              </div>
            );
          })}

          <GrandSummary factors={factors} methods={methods} summary={summary} />

          <div className="flex justify-end gap-2">{actions}</div>
        </>
      )}
    </div>
  );
}

// ── Recommendation banner ─────────────────────────────────────────────────────
function RecommendationBanner({
  recommendedLabel,
  totals,
  methods,
  recommended,
}: {
  recommendedLabel: string | null;
  totals: Record<string, number>;
  methods: Method[];
  recommended: string | null;
}) {
  return (
    <Card className={cn("p-4", recommended ? "bg-success-bg/50 border-success/30" : "bg-navy-50/40")}>
      <div className="flex items-start gap-3">
        <span className={cn("size-9 shrink-0 rounded-lg grid place-items-center", recommended ? "bg-success text-white" : "bg-navy-100 text-navy-600")}>
          <Award className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          {recommendedLabel ? (
            <>
              <p className="text-sm text-muted">Recommended methodology (highest weighted score)</p>
              <p className="font-bold text-ink text-lg leading-tight">{recommendedLabel}</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-ink">No recommendation yet</p>
              <p className="text-sm text-muted">Fill in the availability data below — the highest-scoring method will be recommended here.</p>
            </>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {methods.map((m) => (
              <span
                key={m.id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
                  m.id === recommended ? "bg-success text-white" : "bg-navy-50 text-muted",
                )}
              >
                {m.label}
                <span className="font-bold">{fmt(totals[m.id] ?? 0)}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Yes/No toggle for a single availability cell ──────────────────────────────
function YesNoToggle({
  value,
  onPick,
  disabled,
}: {
  value: Cell;
  onPick: (v: Exclude<Cell, "">) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn("inline-flex rounded-md border border-border overflow-hidden", disabled && "opacity-90")}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPick("yes")}
        className={cn("px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed", value === "yes" ? "bg-success text-white" : "bg-surface text-muted enabled:hover:bg-navy-50")}
      >
        Yes
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPick("no")}
        className={cn("px-2 py-0.5 text-[11px] font-semibold border-l border-border transition-colors disabled:cursor-not-allowed", value === "no" ? "bg-error text-white" : "bg-surface text-muted enabled:hover:bg-navy-50")}
      >
        No
      </button>
    </div>
  );
}

// ── A detailed factor's sub-table (records × methods) ─────────────────────────
function DetailFactorTable({
  factor,
  methods,
  availForFactor,
  suitability,
  readOnly,
  onToggle,
}: {
  factor: Factor;
  methods: Method[];
  availForFactor: Record<number, Record<string, Cell>>;
  suitability: Record<string, number>;
  readOnly?: boolean;
  onToggle: (ridx: number, mid: string, value: Exclude<Cell, "">) => void;
}) {
  const short = shortField(factor.field);
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <p className="font-semibold text-ink text-sm">
          <span className="text-faint tabular-nums">{factor.no}.</span> {factor.name}
        </p>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-navy-700 bg-navy-50 rounded-full px-2 py-0.5 shrink-0">
          <Scale className="size-3" /> Weight {fmt(factor.weight)}
        </span>
      </div>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full text-sm border-collapse min-w-[980px]">
          <thead>
            <tr className="bg-navy-50/60 text-xs font-semibold text-muted">
              <th rowSpan={2} className="px-3 py-2 text-center w-10 border-r border-border">Sr.</th>
              <th rowSpan={2} className="px-3 py-2 text-left min-w-[220px] border-r border-border">Record</th>
              {methods.map((m) => (
                <th key={m.id} colSpan={3} className="px-2 py-1.5 text-center border-l border-border">{m.label}</th>
              ))}
            </tr>
            <tr className="bg-navy-50/40 text-[10px] font-semibold text-faint uppercase tracking-wide">
              {methods.map((m) => (
                <Fragment key={m.id}>
                  <th className="px-1 py-1 text-center w-12 border-l border-border">Req</th>
                  <th className="px-1 py-1 text-center w-[84px]">{short}</th>
                  <th className="px-1 py-1 text-center w-12">Score</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {factor.records?.map((r) => (
              <tr key={r.index} className="hover:bg-navy-50/30">
                <td className="px-3 py-2 text-center tabular-nums text-muted border-r border-border">{r.index + 1}</td>
                <td className="px-3 py-2 text-ink/90 leading-snug border-r border-border">{r.name}</td>
                {methods.map((m) => {
                  const req = r.requirement[m.id] === "yes";
                  const cell = availForFactor[r.index]?.[m.id] ?? "";
                  const score = req && cell === "yes" ? 1 : 0;
                  return (
                    <Fragment key={m.id}>
                      <td className={cn("px-1 py-2 text-center text-xs font-medium border-l border-border", req ? "text-ink" : "text-faint")}>
                        {req ? "Yes" : "No"}
                      </td>
                      <td className="px-1 py-2 text-center">
                        <YesNoToggle value={cell} disabled={readOnly} onPick={(v) => onToggle(r.index, m.id, v)} />
                      </td>
                      <td className={cn("px-1 py-2 text-center text-xs font-bold tabular-nums", score ? "text-success" : "text-faint")}>
                        {score}
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-navy-50/60 font-semibold text-ink text-xs">
              <td colSpan={2} className="px-3 py-2 text-right border-r border-border">Suitability score</td>
              {methods.map((m) => (
                <td key={m.id} colSpan={3} className="px-2 py-2 text-center tabular-nums border-l border-border">
                  {fmt(suitability[m.id] ?? 0)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

// ── A factor with no sub-table: one Yes/No per method ─────────────────────────
function DirectFactorCard({
  factor,
  methods,
  directForFactor,
  suitability,
  finalScore,
  readOnly,
  onToggle,
}: {
  factor: Factor;
  methods: Method[];
  directForFactor: Record<string, Cell>;
  suitability: Record<string, number>;
  finalScore: Record<string, number>;
  readOnly?: boolean;
  onToggle: (mid: string, value: Exclude<Cell, "">) => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3 mb-1">
        <p className="font-semibold text-ink text-sm">
          <span className="text-faint tabular-nums">{factor.no}.</span> {factor.name}
        </p>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-navy-700 bg-navy-50 rounded-full px-2 py-0.5 shrink-0">
          <Scale className="size-3" /> Weight {fmt(factor.weight)}
        </span>
      </div>
      <p className="text-xs text-muted mb-3">Mark whether each methodology is suitable for this factor.</p>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {methods.map((m) => (
          <div key={m.id} className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium text-muted leading-snug min-h-[2rem]">{m.label}</p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <YesNoToggle value={directForFactor[m.id] ?? ""} disabled={readOnly} onPick={(v) => onToggle(m.id, v)} />
              <span className={cn("text-xs font-bold tabular-nums", suitability[m.id] ? "text-success" : "text-faint")}>
                {suitability[m.id] ? 1 : 0}
              </span>
            </div>
            <p className="text-[11px] text-faint mt-2 text-right tabular-nums">Final {fmt(finalScore[m.id] ?? 0)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Grand summary (all 17 factors × 4 methods) ────────────────────────────────
function GrandSummary({
  factors,
  methods,
  summary,
}: {
  factors: Factor[];
  methods: Method[];
  summary: ReturnType<typeof computeSummary>;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="font-semibold text-ink">Grand Summary — Method Selection</p>
        <p className="text-xs text-muted mt-0.5">Final score = suitability × weight. The method with the highest total is recommended.</p>
      </div>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-navy-50/60 text-xs font-semibold text-muted">
              <th rowSpan={2} className="px-3 py-2 text-center w-10 border-r border-border">Sr.</th>
              <th rowSpan={2} className="px-3 py-2 text-left min-w-[200px] border-r border-border">Selection factor</th>
              <th rowSpan={2} className="px-2 py-2 text-center w-16 border-r border-border">Weight</th>
              {methods.map((m) => (
                <th
                  key={m.id}
                  colSpan={2}
                  className={cn("px-2 py-1.5 text-center border-l border-border", m.id === summary.recommended && "bg-success-bg text-success")}
                >
                  {m.label}
                </th>
              ))}
            </tr>
            <tr className="bg-navy-50/40 text-[10px] font-semibold text-faint uppercase tracking-wide">
              {methods.map((m) => {
                const hl = m.id === summary.recommended;
                return (
                  <Fragment key={m.id}>
                    <th className={cn("px-1 py-1 text-center w-16 border-l border-border", hl && "bg-success-bg/60")}>Suit.</th>
                    <th className={cn("px-1 py-1 text-center w-16", hl && "bg-success-bg/60")}>Final</th>
                  </Fragment>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {factors.map((f) => {
              const p = summary.perFactor.find((x) => x.no === f.no);
              return (
                <tr key={f.no} className="hover:bg-navy-50/30">
                  <td className="px-3 py-2 text-center tabular-nums text-muted border-r border-border">{f.no}</td>
                  <td className="px-3 py-2 text-ink/90 leading-snug border-r border-border">{f.name}</td>
                  <td className="px-2 py-2 text-center tabular-nums text-muted border-r border-border">{fmt(f.weight)}</td>
                  {methods.map((m) => {
                    const hl = m.id === summary.recommended;
                    return (
                      <Fragment key={m.id}>
                        <td className={cn("px-1 py-2 text-center tabular-nums text-muted border-l border-border", hl && "bg-success-bg/30")}>
                          {fmt(p?.suitability[m.id] ?? 0)}
                        </td>
                        <td className={cn("px-1 py-2 text-center tabular-nums font-medium text-ink", hl && "bg-success-bg/30")}>
                          {fmt(p?.finalScore[m.id] ?? 0)}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-navy-100/70 font-bold text-ink">
              <td colSpan={3} className="px-3 py-2.5 text-right border-r border-border">Total Score</td>
              {methods.map((m) => {
                const hl = m.id === summary.recommended;
                return (
                  <Fragment key={m.id}>
                    <td className={cn("border-l border-border", hl && "bg-success text-white")} />
                    <td className={cn("px-1 py-2.5 text-center tabular-nums", hl && "bg-success text-white")}>
                      {fmt(summary.totals[m.id] ?? 0)}
                    </td>
                  </Fragment>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
