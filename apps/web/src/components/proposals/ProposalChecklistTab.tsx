import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ClipboardList, Loader2, Lock, MinusCircle, Pencil, Save, XCircle } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { Card } from "@/components/ui/Card";
import { cn, formatDate } from "@/lib/utils";
import { useProposalChecklist, useSaveChecklist } from "@/hooks/useProposalChecklist";
import type { ChecklistItem, ChecklistStatus, ProposalChecklist } from "@/api/proposalChecklist";

// The three answers, in the order shown on the segmented control.
const STATUS_OPTIONS: { value: Exclude<ChecklistStatus, "">; label: string; on: string }[] = [
  { value: "yes", label: "Yes", on: "bg-success text-white border-success" },
  { value: "no", label: "No", on: "bg-error text-white border-error" },
  { value: "na", label: "N/A", on: "bg-navy-600 text-white border-navy-600" },
];

/**
 * Proposal → Checklist tab. The business's 27-item "EOT claims related Standard
 * Documentation Check List": for every standard document the client marks whether
 * it is available (Yes), not available (No) or Not applicable (N/A), the date the
 * information was provided, and any remarks. Standalone and persistent — the whole
 * checklist is loaded, edited locally, then saved in one call (like the Cost Sheet).
 */
export function ProposalChecklistTab({ proposalId }: { proposalId: string }) {
  const { data, isLoading, isError, error } = useProposalChecklist(proposalId);
  const save = useSaveChecklist(proposalId);

  const [rows, setRows] = useState<ChecklistItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saveError, setSaveError] = useState("");

  const hydrate = useCallback((d: ProposalChecklist) => {
    setRows(d.items.map((i) => ({ ...i })));
  }, []);

  // Hydrate local state from the server — but never clobber unsaved edits.
  const lastHydrated = useRef<ProposalChecklist | null>(null);
  useEffect(() => {
    if (!data || dirty || lastHydrated.current === data) return;
    hydrate(data);
    lastHydrated.current = data;
  }, [data, dirty, hydrate]);

  // Start locked (view mode) when a checklist already exists; open in edit mode the
  // first time, when nothing has been saved yet.
  const initEdit = useRef(false);
  useEffect(() => {
    if (!data || initEdit.current) return;
    initEdit.current = true;
    setEditing(!data.updatedAt);
  }, [data]);

  const stats = useMemo(() => {
    const s = { yes: 0, no: 0, na: 0, pending: 0 };
    for (const r of rows) {
      if (r.status === "yes") s.yes++;
      else if (r.status === "no") s.no++;
      else if (r.status === "na") s.na++;
      else s.pending++;
    }
    return s;
  }, [rows]);

  function touch() {
    setDirty(true);
    setSaveError("");
  }
  function patch(no: number, p: Partial<ChecklistItem>) {
    setRows((prev) => prev.map((r) => (r.no === no ? { ...r, ...p } : r)));
    touch();
  }
  // Clicking the active status again clears it back to "unanswered".
  function setStatus(no: number, value: Exclude<ChecklistStatus, "">) {
    setRows((prev) =>
      prev.map((r) => (r.no === no ? { ...r, status: r.status === value ? "" : value } : r)),
    );
    touch();
  }

  async function onSave() {
    setSaveError("");
    try {
      await save.mutateAsync(
        rows.map((r) => ({ no: r.no, status: r.status, date: r.date, remarks: r.remarks })),
      );
      setDirty(false); // allows the fresh server checklist to re-hydrate
      setEditing(false); // lock back to view mode after a successful save
    } catch (err) {
      setSaveError(apiErrorMessage(err, "Could not save the checklist — is the backend running?"));
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
        <Loader2 className="size-4 animate-spin" /> Loading checklist…
      </div>
    );
  }
  if (isError) {
    return <p className="text-sm text-error bg-error-bg rounded-lg px-3 py-2">{apiErrorMessage(error, "Couldn't load the checklist.")}</p>;
  }

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
        {save.isPending ? "Saving…" : dirty ? "Save checklist" : "Saved"}
      </button>
    </>
  ) : (
    <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>
      <Pencil className="size-4" /> Edit
    </button>
  );

  return (
    <div className="space-y-4">
      {/* ── Header row ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">EOT claims — standard documentation checklist</h3>
          <p className="text-xs text-muted mt-0.5 max-w-2xl">
            For each standard EOT document, mark whether it is available (Yes), not available (No) or Not applicable (N/A),
            the date the information was provided, and any remarks.
          </p>
          {data?.updatedAt && (
            <p className="text-[11px] text-faint mt-1">Last saved {formatDate(data.updatedAt)}</p>
          )}
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>

      {readOnly && data?.updatedAt && (
        <div className="flex items-center gap-2 text-xs text-muted bg-navy-50/60 border border-border rounded-lg px-3 py-2">
          <Lock className="size-3.5 text-navy-500" />
          View only — this checklist is saved. Click <span className="font-medium text-ink">Edit</span> to make changes.
        </div>
      )}

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryStat icon={CheckCircle2} label="Available" value={stats.yes} tone="success" />
        <SummaryStat icon={XCircle} label="Not available" value={stats.no} tone="error" />
        <SummaryStat icon={MinusCircle} label="Not applicable" value={stats.na} tone="navy" />
        <SummaryStat icon={ClipboardList} label="Pending" value={stats.pending} tone="warning" />
      </div>

      {saveError && <p className="text-sm text-error bg-error-bg rounded-md px-3 py-2">{saveError}</p>}

      {/* ── Checklist table ── */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm border-collapse min-w-[860px]">
            <thead>
              <tr className="bg-navy-50/60 text-left text-xs font-semibold text-muted uppercase tracking-wide">
                <Th className="w-12 text-center">Sl.</Th>
                <Th className="min-w-[320px]">Item</Th>
                <Th className="w-[190px] text-center">Details available</Th>
                <Th className="w-40">Date provided</Th>
                <Th className="min-w-[200px]">Remarks</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.no} className="align-top hover:bg-navy-50/30 transition-colors">
                  <Td className="text-center tabular-nums text-muted font-medium">{r.no}</Td>
                  <Td className="text-ink/90 leading-snug">{r.item}</Td>
                  <Td>
                    <div className="inline-flex rounded-lg border border-border overflow-hidden">
                      {STATUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={readOnly}
                          onClick={() => setStatus(r.no, opt.value)}
                          className={cn(
                            "px-2.5 py-1 text-xs font-semibold border-l first:border-l-0 border-border transition-colors disabled:cursor-not-allowed",
                            r.status === opt.value ? opt.on : "bg-surface text-muted enabled:hover:bg-navy-50",
                          )}
                          aria-pressed={r.status === opt.value}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    <input
                      type="date"
                      className="input h-9 disabled:opacity-70 disabled:cursor-not-allowed"
                      value={r.date}
                      disabled={readOnly}
                      onChange={(e) => patch(r.no, { date: e.target.value })}
                      aria-label={`Date provided for item ${r.no}`}
                    />
                  </Td>
                  <Td>
                    <input
                      className="input h-9 disabled:opacity-70 disabled:cursor-not-allowed"
                      value={r.remarks}
                      disabled={readOnly}
                      onChange={(e) => patch(r.no, { remarks: e.target.value })}
                      placeholder={readOnly ? "—" : "Add a remark…"}
                      aria-label={`Remarks for item ${r.no}`}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex justify-end gap-2">{actions}</div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: number;
  tone: "success" | "error" | "navy" | "warning";
}) {
  const toneBg: Record<string, string> = {
    success: "bg-success-bg text-success",
    error: "bg-error-bg text-error",
    navy: "bg-navy-100 text-navy-700",
    warning: "bg-warning-bg text-warning",
  };
  return (
    <Card className="p-4 flex items-center gap-3">
      <span className={`size-10 shrink-0 rounded-lg grid place-items-center ${toneBg[tone]}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold font-display tabular-nums text-ink leading-none">{value}</p>
        <p className="text-xs text-muted mt-1 truncate">{label}</p>
      </div>
    </Card>
  );
}
