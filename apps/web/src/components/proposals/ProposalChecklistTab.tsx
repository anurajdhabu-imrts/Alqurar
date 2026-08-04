import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Loader2,
  Lock,
  MinusCircle,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { downloadProjectDocApi } from "@/api/projectDocuments";
import { Card } from "@/components/ui/Card";
import { cn, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import {
  useAddChecklistItem,
  useDetachChecklistDoc,
  useProposalChecklist,
  useRemoveChecklistItem,
  useSaveChecklist,
  useUploadChecklistDoc,
} from "@/hooks/useProposalChecklist";
import {
  ADDITIONAL_ITEM_NO,
  type ChecklistItem,
  type ChecklistStatus,
  type ProposalChecklist,
} from "@/api/proposalChecklist";

// The three answers, in the order shown on the segmented control.
const STATUS_OPTIONS: { value: Exclude<ChecklistStatus, "">; label: string; on: string }[] = [
  { value: "yes", label: "Yes", on: "bg-success text-white border-success" },
  { value: "no", label: "No", on: "bg-error text-white border-error" },
  { value: "na", label: "N/A", on: "bg-navy-600 text-white border-navy-600" },
];

/** Which row the files picked from the shared file input belong to. */
type UploadTarget = { no: number };

/**
 * Proposal → Checklist tab. The business's "EOT claims related Standard
 * Documentation Check List": for every standard document, mark whether it is
 * available (Yes), not available (No) or Not applicable (N/A), attach the file
 * itself, and add any remarks.
 *
 * Items 1–26 are the fixed standard documents. Anything beyond them is added with
 * a name and a file: the first lands on item 27 ("Any additional documents…") and
 * every further one gets its own numbered row — 28, 29, … — under that name.
 *
 * Used by both the analyst (proposal workspace) and the client (client portal),
 * hence the `canUpload` prop. Uploads go through the normal project-document
 * pipeline, so every file attached here also appears in the Documents tab.
 *
 * The answers are edited locally and saved in one call (like the Cost Sheet), but
 * file attach/detach happen immediately — they don't need edit mode.
 */
export function ProposalChecklistTab({
  proposalId,
  canUpload = true,
}: {
  proposalId: string;
  canUpload?: boolean;
}) {
  const { data, isLoading, isError, error } = useProposalChecklist(proposalId);
  const save = useSaveChecklist(proposalId);
  const upload = useUploadChecklistDoc(proposalId);
  const detach = useDetachChecklistDoc(proposalId);
  const addItem = useAddChecklistItem(proposalId);
  const removeItem = useRemoveChecklistItem(proposalId);
  const currentUser = useAuthStore((s) => s.user);

  const [rows, setRows] = useState<ChecklistItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fileError, setFileError] = useState("");
  const [busyNo, setBusyNo] = useState<number | null>(null);

  const hydrate = useCallback((d: ProposalChecklist) => {
    setRows(d.items.map((i) => ({ ...i })));
  }, []);

  /** Take the server's rows (documents, new rows) but keep any unsaved answers. */
  const mergeServer = useCallback((d: ProposalChecklist) => {
    setRows((prev) => {
      const local = new Map(prev.map((r) => [r.no, r]));
      return d.items.map((s) => {
        const mine = local.get(s.no);
        return mine ? { ...s, status: mine.status, remarks: mine.remarks, item: mine.item || s.item } : { ...s };
      });
    });
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
    const s = { yes: 0, no: 0, na: 0, pending: 0, files: 0 };
    for (const r of rows) {
      if (r.status === "yes") s.yes++;
      else if (r.status === "no") s.no++;
      else if (r.status === "na") s.na++;
      else s.pending++;
      s.files += r.documents.length;
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
        rows.map((r) => ({ no: r.no, status: r.status, remarks: r.remarks, item: r.item })),
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

  // ── File attachments (immediate — independent of the edit/save cycle) ──────
  const uploadedBy = currentUser?.name ?? "Al Qarar";
  const fileInput = useRef<HTMLInputElement>(null);
  const target = useRef<UploadTarget | null>(null);

  function pickFiles(t: UploadTarget) {
    if (!canUpload) return;
    target.current = t;
    fileInput.current?.click();
  }

  async function onFilesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // let the same file be picked again later
    const t = target.current;
    target.current = null;
    if (!t || files.length === 0) return;

    setFileError("");
    setBusyNo(t.no);
    // Sequentially — each attach is a read-modify-write of the same checklist row.
    for (const file of files) {
      try {
        mergeServer(await upload.mutateAsync({ file, uploadedBy, no: t.no }));
      } catch (err) {
        setFileError(apiErrorMessage(err, `Could not upload "${file.name}".`));
        break;
      }
    }
    setBusyNo(null);
  }

  // ── Additional documents (27, then 28, 29, …): a name plus its file ────────
  const extraInput = useRef<HTMLInputElement>(null);
  const [extraName, setExtraName] = useState("");
  const [extraFile, setExtraFile] = useState<File | null>(null);
  const addingExtra = upload.isPending || addItem.isPending;

  async function onAddAdditional() {
    const name = extraName.trim();
    if (!extraFile && !name) return;

    setFileError("");
    try {
      // The server decides whether that's item 27 or a fresh row below it.
      if (extraFile) {
        mergeServer(await upload.mutateAsync({ file: extraFile, uploadedBy, newRow: true, name }));
      } else {
        mergeServer((await addItem.mutateAsync(name)).checklist);
      }
      setExtraName("");
      setExtraFile(null);
    } catch (err) {
      setFileError(apiErrorMessage(err, "Could not add that document."));
    }
  }

  async function onDetach(no: number, documentId: string) {
    setFileError("");
    setBusyNo(no);
    try {
      mergeServer(await detach.mutateAsync({ no, documentId }));
    } catch (err) {
      setFileError(apiErrorMessage(err, "Could not remove that file from the item."));
    } finally {
      setBusyNo(null);
    }
  }

  async function onRemoveRow(no: number) {
    setFileError("");
    setBusyNo(no);
    try {
      mergeServer(await removeItem.mutateAsync(no));
    } catch (err) {
      setFileError(apiErrorMessage(err, "Could not remove that row."));
    } finally {
      setBusyNo(null);
    }
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
      {/* One shared picker for every row — `target` says where the files go. */}
      <input ref={fileInput} type="file" multiple className="hidden" onChange={onFilesChosen} />

      {/* ── Header row ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">EOT claims — standard documentation checklist</h3>
          <p className="text-xs text-muted mt-0.5 max-w-2xl">
            For each standard EOT document, mark whether it is available (Yes), not available (No) or Not applicable
            (N/A), attach the file itself, and add any remarks. Uploaded files are saved straight away and also appear
            in the Documents tab.
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
          Answers are locked — click <span className="font-medium text-ink">Edit</span> to change them. You can still
          attach files at any time.
        </div>
      )}

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <SummaryStat icon={CheckCircle2} label="Available" value={stats.yes} tone="success" />
        <SummaryStat icon={XCircle} label="Not available" value={stats.no} tone="error" />
        <SummaryStat icon={MinusCircle} label="Not applicable" value={stats.na} tone="navy" />
        <SummaryStat icon={ClipboardList} label="Pending" value={stats.pending} tone="warning" />
        <SummaryStat icon={Paperclip} label="Files attached" value={stats.files} tone="info" />
      </div>

      {saveError && <p className="text-sm text-error bg-error-bg rounded-md px-3 py-2">{saveError}</p>}
      {fileError && <p className="text-sm text-error bg-error-bg rounded-md px-3 py-2">{fileError}</p>}

      {/* ── Checklist table ── */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm border-collapse min-w-[1040px]">
            <thead>
              <tr className="bg-navy-50/60 text-left text-xs font-semibold text-muted uppercase tracking-wide">
                <Th className="w-12 text-center">Sl.</Th>
                <Th className="min-w-[300px]">Item</Th>
                <Th className="w-[190px] text-center">Details available</Th>
                <Th className="min-w-[260px]">Document</Th>
                <Th className="min-w-[190px]">Remarks</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                // 27 and below it are the additional documents — the user names those.
                const nameable = r.no >= ADDITIONAL_ITEM_NO;
                const extra = r.no > ADDITIONAL_ITEM_NO;
                return (
                  <tr key={r.no} className="align-top hover:bg-navy-50/30 transition-colors">
                    <Td className="text-center tabular-nums text-muted font-medium">{r.no}</Td>
                    <Td className="text-ink/90 leading-snug">
                      {nameable && editing ? (
                        <input
                          className="input h-9"
                          value={r.item}
                          onChange={(e) => patch(r.no, { item: e.target.value })}
                          placeholder="Name this document…"
                          aria-label={`Name for item ${r.no}`}
                        />
                      ) : (
                        r.item
                      )}
                    </Td>
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
                      <ItemDocuments
                        row={r}
                        canUpload={canUpload}
                        busy={busyNo === r.no}
                        onUpload={() => pickFiles({ no: r.no })}
                        onDetach={(docId) => onDetach(r.no, docId)}
                      />
                    </Td>
                    <Td>
                      <div className="flex items-start gap-1.5">
                        <input
                          className="input h-9 disabled:opacity-70 disabled:cursor-not-allowed"
                          value={r.remarks}
                          disabled={readOnly}
                          onChange={(e) => patch(r.no, { remarks: e.target.value })}
                          placeholder={readOnly ? "—" : "Add a remark…"}
                          aria-label={`Remarks for item ${r.no}`}
                        />
                        {extra && editing && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm px-2 text-error"
                            onClick={() => onRemoveRow(r.no)}
                            disabled={busyNo === r.no}
                            title="Remove this row (attached files stay in Documents)"
                            aria-label={`Remove row ${r.no}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add an additional document — a name and its file. The first goes to
            item 27, then 28, 29, … */}
        {canUpload && (
          <div className="border-t border-border bg-navy-50/30 px-4 py-3">
            <p className="text-xs font-semibold text-ink">Add an additional document</p>
            <p className="text-xs text-muted mt-0.5">
              Anything beyond the standard list — name it and attach the file. It becomes item{" "}
              {ADDITIONAL_ITEM_NO}, then {ADDITIONAL_ITEM_NO + 1}, {ADDITIONAL_ITEM_NO + 2}, and so on.
            </p>

            <input
              ref={extraInput}
              type="file"
              className="hidden"
              onChange={(e) => {
                setExtraFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <input
                className="input h-9 w-full sm:w-72"
                value={extraName}
                onChange={(e) => setExtraName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onAddAdditional();
                }}
                placeholder="Document name (e.g. Site diary extract)"
                aria-label="Additional document name"
              />
              <button className="btn btn-outline btn-sm" onClick={() => extraInput.current?.click()}>
                <Paperclip className="size-4" />
                {extraFile ? "Change file" : "Choose file"}
              </button>
              {extraFile && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink max-w-64">
                  <FileText className="size-3.5 shrink-0 text-navy-500" />
                  <span className="truncate" title={extraFile.name}>{extraFile.name}</span>
                  <button
                    type="button"
                    className="shrink-0 text-muted hover:text-error"
                    onClick={() => setExtraFile(null)}
                    aria-label="Clear the chosen file"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              )}
              <button
                className="btn btn-primary btn-sm"
                onClick={onAddAdditional}
                disabled={addingExtra || (!extraFile && !extraName.trim())}
              >
                {addingExtra ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {addingExtra ? "Adding…" : "Add document"}
              </button>
            </div>
          </div>
        )}
      </Card>

      <div className="flex justify-end gap-2">{actions}</div>
    </div>
  );
}

/** The files attached to one checklist row, plus its upload button. */
function ItemDocuments({
  row,
  canUpload,
  busy,
  onUpload,
  onDetach,
}: {
  row: ChecklistItem;
  canUpload: boolean;
  busy: boolean;
  onUpload: () => void;
  onDetach: (documentId: string) => void;
}) {
  const [downloading, setDownloading] = useState("");

  async function download(id: string, name: string) {
    setDownloading(id);
    try {
      await downloadProjectDocApi(id, name);
    } finally {
      setDownloading("");
    }
  }

  return (
    <div className="space-y-1.5">
      {row.documents.map((d) => (
        <div
          key={d.id}
          className="group flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5"
        >
          <FileText className="size-3.5 shrink-0 text-navy-500" />
          <span className="min-w-0 flex-1 truncate text-xs text-ink" title={d.name}>
            {d.name}
          </span>
          <button
            type="button"
            className="shrink-0 text-muted hover:text-navy-700 disabled:opacity-50"
            onClick={() => download(d.id, d.name)}
            disabled={downloading === d.id}
            title="Download"
            aria-label={`Download ${d.name}`}
          >
            {downloading === d.id ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          </button>
          {canUpload && (
            <button
              type="button"
              className="shrink-0 text-muted hover:text-error"
              onClick={() => onDetach(d.id)}
              title="Remove from this item (the file stays in Documents)"
              aria-label={`Remove ${d.name} from item ${row.no}`}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      ))}

      {canUpload ? (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:border-navy-400 hover:text-navy-700 disabled:opacity-60"
          onClick={onUpload}
          disabled={busy}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          {busy ? "Uploading…" : row.documents.length ? "Add file" : "Upload file"}
        </button>
      ) : (
        row.documents.length === 0 && <span className="text-xs text-faint">—</span>
      )}
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
  tone: "success" | "error" | "navy" | "warning" | "info";
}) {
  const toneBg: Record<string, string> = {
    success: "bg-success-bg text-success",
    error: "bg-error-bg text-error",
    navy: "bg-navy-100 text-navy-700",
    warning: "bg-warning-bg text-warning",
    info: "bg-navy-50 text-navy-600",
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
