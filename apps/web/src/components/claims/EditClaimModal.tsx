import { useState, type FormEvent } from "react";
import { Loader2, X } from "lucide-react";
import { mutateClaim } from "@/mock/data";
import type { ClaimPriority, ClaimStatus, EOTClaim, NoticeStatus } from "@/types";

const STATUSES: ClaimStatus[] = [
  "Draft",
  "In Review",
  "Submitted",
  "Under Assessment",
  "Granted",
  "Rejected",
];
const NOTICE_STATUSES: NoticeStatus[] = ["Compliant", "Due Soon", "Overdue", "Missed"];
const PRIORITIES: ClaimPriority[] = ["Critical", "High", "Medium", "Low"];

/**
 * Edit a subset of allowed fields on a claim. Persists via the existing
 * mutateClaim() helper (localStorage-backed). The detail/lifecycle fields are
 * intentionally not editable here.
 */
export function EditClaimModal({
  claim,
  onClose,
  onSaved,
}: {
  claim: EOTClaim;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(claim.title);
  const [status, setStatus] = useState<ClaimStatus>(claim.status);
  const [noticeStatus, setNoticeStatus] = useState<NoticeStatus>(claim.noticeStatus);
  const [priority, setPriority] = useState<ClaimPriority | "">(claim.priority ?? "");
  const [daysClaimed, setDaysClaimed] = useState(String(claim.daysClaimed));
  const [daysGranted, setDaysGranted] = useState(
    claim.daysGranted !== undefined ? String(claim.daysGranted) : "",
  );
  const [quantum, setQuantum] = useState(String(claim.quantum));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setBusy(true);
    try {
      mutateClaim(claim.ref, {
        title: title.trim(),
        status,
        noticeStatus,
        priority: priority || undefined,
        daysClaimed: Number(daysClaimed) || 0,
        daysGranted: daysGranted === "" ? undefined : Number(daysGranted),
        quantum: Number(quantum) || 0,
      });
      onSaved();
      onClose();
    } catch {
      setError("Could not save changes. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card w-full max-w-lg p-6 shadow-lg max-h-[90vh] overflow-y-auto scroll-thin">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-bold text-ink">Edit claim</h3>
            <p className="text-xs text-muted mt-0.5">{claim.ref} · {claim.project}</p>
          </div>
          <button className="btn btn-ghost px-2" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="ec-title">Title</label>
            <input id="ec-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ec-status">Status</label>
              <select id="ec-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as ClaimStatus)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ec-notice">Notice status</label>
              <select id="ec-notice" className="input" value={noticeStatus} onChange={(e) => setNoticeStatus(e.target.value as NoticeStatus)}>
                {NOTICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ec-priority">Priority</label>
              <select id="ec-priority" className="input" value={priority} onChange={(e) => setPriority(e.target.value as ClaimPriority | "")}>
                <option value="">—</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ec-quantum">Quantum (AED)</label>
              <input id="ec-quantum" type="number" min="0" className="input" value={quantum} onChange={(e) => setQuantum(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="ec-days">Days claimed</label>
              <input id="ec-days" type="number" min="0" className="input" value={daysClaimed} onChange={(e) => setDaysClaimed(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="ec-granted">Days granted</label>
              <input id="ec-granted" type="number" min="0" className="input" placeholder="—" value={daysGranted} onChange={(e) => setDaysGranted(e.target.value)} />
            </div>
          </div>

          {error && <p className="text-sm text-error bg-error-bg rounded-md px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
