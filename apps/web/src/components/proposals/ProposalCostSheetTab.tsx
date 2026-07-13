import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, Save, Trash2, UserCog } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { Card } from "@/components/ui/Card";
import { useCostingQuery, useSaveCosting } from "@/hooks/useCosting";
import { useEmployeesQuery } from "@/hooks/useEmployees";
import { useProjectById } from "@/store/projects";
import { computeSummary, DEFAULT_SETTINGS } from "@/lib/costing";
import { formatCurrencyFull } from "@/lib/utils";
import type { CostingSettings, CostingSheet } from "@/api/costing";

// ── Local editable model (strings so inputs can be cleared mid-typing) ───────
interface LocalEntry {
  key: string;
  role: string;
  employeeId: string;
  employeeName: string;
  hours: string;
  rate: string;
}
interface LocalActivity {
  key: string;
  description: string;
  entries: LocalEntry[];
}

const num = (s: string): number => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Proposal → Costing tab. A dynamic, editable costing sheet driven by the
 * Employee master data, with a live Cost Summary that reproduces the business's
 * Excel waterfall. Standalone: it does not touch the AI proposal tab or PDF export.
 */
export function ProposalCostSheetTab({ proposalId }: { proposalId: string }) {
  const proposal = useProjectById(proposalId);
  const currency = proposal?.currency ?? "OMR";

  const { data: sheet, isLoading, isError, error } = useCostingQuery(proposalId);
  const { data: employees = [] } = useEmployeesQuery();
  const save = useSaveCosting(proposalId);

  const [activities, setActivities] = useState<LocalActivity[]>([]);
  const [settings, setSettings] = useState<CostingSettings>(DEFAULT_SETTINGS);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState("");
  const keySeq = useRef(0);
  const nextKey = () => `k${keySeq.current++}`;

  // Hydrate local state from the server sheet — but never clobber unsaved edits.
  const lastHydrated = useRef<CostingSheet | null>(null);
  useEffect(() => {
    if (!sheet || dirty || lastHydrated.current === sheet) return;
    setActivities(
      sheet.activities.map((a) => ({
        key: nextKey(),
        description: a.description,
        entries: a.entries.map((e) => ({
          key: nextKey(),
          role: e.role,
          employeeId: e.employeeId ?? "",
          employeeName: e.employeeName ?? "",
          hours: String(e.hours ?? 0),
          rate: String(e.rate ?? 0),
        })),
      })),
    );
    setSettings({
      contingencyPct: sheet.settings.contingencyPct,
      overheadsPct: sheet.settings.overheadsPct,
      profitPct: sheet.settings.profitPct,
      incomeTaxPct: sheet.settings.incomeTaxPct,
      vatPct: sheet.settings.vatPct,
    });
    lastHydrated.current = sheet;
  }, [sheet, dirty]);

  // Active employees drive the dropdowns; distinct designations are the roles.
  const activeEmployees = useMemo(() => employees.filter((e) => e.status === "Active"), [employees]);
  const roles = useMemo(
    () => Array.from(new Set(activeEmployees.map((e) => e.designation))).sort(),
    [activeEmployees],
  );

  // Live summary — recomputed on every keystroke, identical to the backend.
  const summary = useMemo(
    () => computeSummary(activities.map((a) => ({ entries: a.entries.map((e) => ({ hours: num(e.hours), rate: num(e.rate) })) })), settings),
    [activities, settings],
  );

  // ── Mutators ───────────────────────────────────────────────────────────
  function touch() {
    setDirty(true);
    setSaveError("");
  }
  function addActivity() {
    setActivities((prev) => [...prev, { key: nextKey(), description: "", entries: [blankEntry()] }]);
    touch();
  }
  function blankEntry(): LocalEntry {
    return { key: nextKey(), role: roles[0] ?? "", employeeId: "", employeeName: "", hours: "", rate: roleRate(roles[0] ?? "") };
  }
  function removeActivity(ak: string) {
    setActivities((prev) => prev.filter((a) => a.key !== ak));
    touch();
  }
  function setActivityDesc(ak: string, description: string) {
    setActivities((prev) => prev.map((a) => (a.key === ak ? { ...a, description } : a)));
    touch();
  }
  function addRow(ak: string) {
    setActivities((prev) => prev.map((a) => (a.key === ak ? { ...a, entries: [...a.entries, blankEntry()] } : a)));
    touch();
  }
  function removeRow(ak: string, ek: string) {
    setActivities((prev) => prev.map((a) => (a.key === ak ? { ...a, entries: a.entries.filter((e) => e.key !== ek) } : a)));
    touch();
  }
  function patchRow(ak: string, ek: string, patch: Partial<LocalEntry>) {
    setActivities((prev) =>
      prev.map((a) =>
        a.key === ak ? { ...a, entries: a.entries.map((e) => (e.key === ek ? { ...e, ...patch } : e)) } : a,
      ),
    );
    touch();
  }
  /** Representative rate for a role = the rate of the first active employee with
   * that designation. Auto-filled on role change, but stays editable. */
  function roleRate(role: string): string {
    const emp = activeEmployees.find((e) => e.designation === role);
    return emp ? String(emp.hourlyRate) : "";
  }
  function onRoleChange(ak: string, ek: string, role: string) {
    // Changing the role clears any specific employee and refills the rate.
    patchRow(ak, ek, { role, employeeId: "", employeeName: "", rate: roleRate(role) });
  }
  function setPct(key: keyof CostingSettings, value: string) {
    setSettings((prev) => ({ ...prev, [key]: num(value) }));
    touch();
  }

  async function onSave() {
    setSaveError("");
    try {
      await save.mutateAsync({
        activities: activities.map((a) => ({
          description: a.description,
          entries: a.entries.map((e) => ({
            role: e.role,
            employeeId: e.employeeId || null,
            employeeName: e.employeeName || null,
            hours: num(e.hours),
            rate: num(e.rate),
          })),
        })),
        settings,
      });
      setDirty(false); // allows the fresh server sheet to re-hydrate
    } catch (err) {
      setSaveError(apiErrorMessage(err, "Could not save the costing — is the backend running?"));
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-16 text-sm text-muted inline-flex items-center justify-center gap-2 w-full">
        <Loader2 className="size-4 animate-spin" /> Loading costing…
      </div>
    );
  }
  if (isError) {
    return <p className="text-sm text-error bg-error-bg rounded-lg px-3 py-2">{apiErrorMessage(error, "Couldn't load the costing.")}</p>;
  }

  const money = (n: number) => formatCurrencyFull(Math.round(n * 1000) / 1000, currency);

  return (
    <div className="grid xl:grid-cols-[1fr_360px] gap-5 items-start">
      {/* ── Activities ─────────────────────────────────────────────────── */}
      <div className="space-y-4 min-w-0">
        {roles.length === 0 && (
          <Card className="p-4 flex items-start gap-3 bg-warning-bg/40 border-warning/30">
            <UserCog className="size-5 text-warning shrink-0 mt-0.5" />
            <p className="text-sm text-muted">
              No active employees yet. Add your team in{" "}
              <Link to="/employees" className="text-navy-700 font-medium hover:underline">Employees</Link>{" "}
              so their roles and rates appear in the dropdowns below.
            </p>
          </Card>
        )}

        {activities.map((a, ai) => {
          const activityTotal = a.entries.reduce((s, e) => s + num(e.hours) * num(e.rate), 0);
          return (
            <Card key={a.key} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="size-6 shrink-0 rounded-md bg-navy-100 text-navy-800 grid place-items-center text-xs font-bold">
                  {ai + 1}
                </span>
                <input
                  className="input flex-1 font-medium"
                  placeholder="Activity name (e.g. Programme Preparation)"
                  value={a.description}
                  onChange={(e) => setActivityDesc(a.key, e.target.value)}
                />
                <button
                  className="btn btn-ghost px-2 h-9 text-error hover:bg-error-bg"
                  onClick={() => removeActivity(a.key)}
                  title="Remove activity"
                  aria-label="Remove activity"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <div className="overflow-x-auto scroll-thin">
                <table className="w-full text-sm min-w-[620px]">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-faint border-b border-border">
                      <th className="font-semibold py-2 pr-2">Role</th>
                      <th className="font-semibold py-2 px-2 text-right w-24">Hours</th>
                      <th className="font-semibold py-2 px-2 text-right w-28">Rate/hr</th>
                      <th className="font-semibold py-2 px-2 text-right w-32">Total</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {a.entries.map((e) => (
                        <tr key={e.key} className="border-b border-border last:border-0">
                          <td className="py-1.5 pr-2">
                            <select
                              className="input h-9"
                              value={e.role}
                              onChange={(ev) => onRoleChange(a.key, e.key, ev.target.value)}
                            >
                              {/* Preserve a snapshotted role even if it's no longer an active designation. */}
                              {e.role && !roles.includes(e.role) && <option value={e.role}>{e.role}</option>}
                              {roles.length === 0 && <option value="">No roles</option>}
                              {roles.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              className="input h-9 text-right tabular-nums"
                              type="number"
                              min="0"
                              step="0.5"
                              value={e.hours}
                              onChange={(ev) => patchRow(a.key, e.key, { hours: ev.target.value })}
                              placeholder="0"
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              className="input h-9 text-right tabular-nums"
                              type="number"
                              min="0"
                              step="0.01"
                              value={e.rate}
                              onChange={(ev) => patchRow(a.key, e.key, { rate: ev.target.value })}
                              placeholder="0"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-right tabular-nums font-medium text-ink whitespace-nowrap">
                            {money(num(e.hours) * num(e.rate))}
                          </td>
                          <td className="py-1.5">
                            <button
                              className="btn btn-ghost px-1.5 h-8 text-faint hover:text-error hover:bg-error-bg"
                              onClick={() => removeRow(a.key, e.key)}
                              title="Remove row"
                              aria-label="Remove row"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="py-2 pr-2">
                        <button className="btn btn-ghost btn-sm text-navy-700" onClick={() => addRow(a.key)}>
                          <Plus className="size-3.5" /> Add role
                        </button>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums font-semibold text-ink whitespace-nowrap">
                        {money(activityTotal)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          );
        })}

        <button className="btn btn-outline w-full" onClick={addActivity}>
          <Plus className="size-4" /> Add activity
        </button>
      </div>

      {/* ── Cost Summary (sticky on desktop) ───────────────────────────── */}
      <div className="xl:sticky xl:top-4 space-y-3">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-ink">Cost Summary</h3>
            {dirty && <span className="text-[11px] font-medium text-warning bg-warning-bg rounded-full px-2 py-0.5">Unsaved</span>}
          </div>

          <SummaryLine label="Total Cost" value={money(summary.totalCost)} strong />

          <div className="space-y-2.5 mt-3 pt-3 border-t border-border">
            <PctRow label="Contingency" pctKey="contingencyPct" settings={settings} onChange={setPct} amount={money(summary.contingencyAmount)} />
            <SummaryLine label="Subtotal" value={money(summary.subtotalAfterContingency)} subtle />

            <PctRow label="Overheads" pctKey="overheadsPct" settings={settings} onChange={setPct} amount={money(summary.overheadsAmount)} />
            <SummaryLine label="Subtotal" value={money(summary.subtotalAfterOverheads)} subtle />

            <PctRow label="Profit" pctKey="profitPct" settings={settings} onChange={setPct} amount={money(summary.profitAmount)} />
            <SummaryLine label="Subtotal" value={money(summary.subtotalAfterProfit)} subtle />

            <PctRow label="Income Tax" pctKey="incomeTaxPct" settings={settings} onChange={setPct} amount={money(summary.incomeTaxAmount)} />
            <SummaryLine label="Subtotal" value={money(summary.subtotalAfterIncomeTax)} subtle />

            <PctRow label="VAT" pctKey="vatPct" settings={settings} onChange={setPct} amount={money(summary.vatAmount)} />
          </div>

          <div className="mt-3 pt-3 border-t-2 border-navy-200 flex items-baseline justify-between">
            <span className="font-semibold text-navy-900">Suggested Pricing</span>
            <span className="text-lg font-bold font-display text-navy-900 tabular-nums">{money(summary.suggestedPricing)}</span>
          </div>
        </Card>

        {saveError && <p className="text-sm text-error bg-error-bg rounded-md px-3 py-2">{saveError}</p>}

        <button className="btn btn-primary w-full" onClick={onSave} disabled={save.isPending || !dirty}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {save.isPending ? "Saving…" : dirty ? "Save costing" : "Saved"}
        </button>
        <p className="text-[11px] text-faint text-center px-2">
          Rates are captured from the Employee master when you save. Later rate changes won't affect this proposal.
        </p>
      </div>
    </div>
  );
}

function SummaryLine({ label, value, strong, subtle }: { label: string; value: string; strong?: boolean; subtle?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={subtle ? "text-xs text-faint" : strong ? "font-semibold text-ink" : "text-sm text-muted"}>{label}</span>
      <span className={`tabular-nums ${subtle ? "text-xs text-muted" : strong ? "font-semibold text-ink" : "text-sm text-ink"}`}>{value}</span>
    </div>
  );
}

function PctRow({
  label,
  pctKey,
  settings,
  onChange,
  amount,
}: {
  label: string;
  pctKey: keyof CostingSettings;
  settings: CostingSettings;
  onChange: (key: keyof CostingSettings, value: string) => void;
  amount: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-muted flex items-center gap-1.5">
        {label}
        <span className="relative inline-flex items-center">
          <input
            className="input h-7 w-16 pr-5 text-right tabular-nums text-xs"
            type="number"
            min="0"
            step="0.5"
            value={settings[pctKey]}
            onChange={(e) => onChange(pctKey, e.target.value)}
            aria-label={`${label} percentage`}
          />
          <span className="absolute right-2 text-xs text-faint pointer-events-none">%</span>
        </span>
      </span>
      <span className="tabular-nums text-sm text-ink">{amount}</span>
    </div>
  );
}
