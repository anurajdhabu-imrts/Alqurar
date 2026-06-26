import { useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, ListChecks, Loader2, X } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { useCreateDelayEvent, useUpdateDelayEvent } from "@/hooks/useDelayEvents";
import type {
  AdmissibilityStatus,
  DelayCause,
  ProjectDelayEvent,
} from "@/types";

const CAUSES: DelayCause[] = ["Employer", "Contractor", "Concurrent", "Force Majeure", "Neutral"];
const ADMISSIBILITY: AdmissibilityStatus[] = [
  "Likely admissible",
  "At risk",
  "Inadmissible",
  "Not assessed",
];

/**
 * Add or edit a delay event manually. This is the no-AI path described in the
 * spec: the analyst types in the information an AI would otherwise extract, and
 * it's saved to the database. Chronology and linked documents are preserved on
 * edit but not authored here (kept simple for now).
 */
export function DelayEventFormModal({
  projectId,
  event,
  onClose,
}: {
  projectId: string;
  /** When provided, the modal edits this event instead of creating a new one. */
  event?: ProjectDelayEvent;
  onClose: () => void;
}) {
  const isEdit = !!event;
  const create = useCreateDelayEvent(projectId);
  const update = useUpdateDelayEvent(projectId);

  const [title, setTitle] = useState(event?.title ?? "");
  const [category, setCategory] = useState(event?.category ?? "");
  const [cause, setCause] = useState<DelayCause>(event?.cause ?? "Employer");
  const [clause, setClause] = useState(event?.clause ?? "Sub-Clause 8.5");
  const [startDate, setStartDate] = useState(event?.startDate ?? "");
  const [endDate, setEndDate] = useState(event?.endDate ?? "");
  const [daysImpact, setDaysImpact] = useState(String(event?.daysImpact ?? 0));
  const [criticalPath, setCriticalPath] = useState(event?.criticalPath ?? false);
  const [admissibility, setAdmissibility] = useState<AdmissibilityStatus>(
    event?.admissibility ?? "Not assessed",
  );
  const [narrative, setNarrative] = useState(event?.narrative ?? "");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const saving = create.isPending || update.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) return setError("Title is required.");

    const payload = {
      title: title.trim(),
      category: category.trim(),
      cause,
      clause: clause.trim(),
      startDate,
      endDate,
      daysImpact: Math.max(0, Math.round(Number(daysImpact) || 0)),
      criticalPath,
      admissibility,
      narrative: narrative.trim(),
    };

    try {
      if (isEdit && event) {
        await update.mutateAsync({ id: event.id, patch: payload });
      } else {
        await create.mutateAsync({ projectId, ...payload });
      }
      setDone(true);
      window.setTimeout(onClose, 700);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save the delay event."));
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={onSubmit} className="relative card w-full max-w-2xl p-6 shadow-lg max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-ink inline-flex items-center gap-2">
              <ListChecks className="size-4.5 text-navy-700" /> {isEdit ? "Edit delay event" : "Add delay event"}
            </h3>
            <p className="text-xs text-muted mt-0.5">
              {isEdit ? "Update this event's details." : "Manually record a delay event for this project."}
            </p>
          </div>
          <button type="button" className="btn btn-ghost px-2" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin -mx-1 px-1 space-y-4">
          <div>
            <label className="label" htmlFor="de-title">Title</label>
            <input
              id="de-title"
              className="input"
              placeholder="e.g. Late release of IFC drawings — L3 transfer slab"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="de-category">Category</label>
              <input
                id="de-category"
                className="input"
                placeholder="e.g. Bus duct delay"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="de-cause">Cause</label>
              <select id="de-cause" className="input" value={cause} onChange={(e) => setCause(e.target.value as DelayCause)}>
                {CAUSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="de-clause">FIDIC clause</label>
              <input
                id="de-clause"
                className="input"
                placeholder="e.g. Sub-Clause 8.5"
                value={clause}
                onChange={(e) => setClause(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="de-admiss">Admissibility</label>
              <select id="de-admiss" className="input" value={admissibility} onChange={(e) => setAdmissibility(e.target.value as AdmissibilityStatus)}>
                {ADMISSIBILITY.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="label" htmlFor="de-start">Start date</label>
              <input id="de-start" type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="de-end">End date</label>
              <input id="de-end" type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="de-days">Days impact</label>
              <input id="de-days" type="number" min={0} className="input" value={daysImpact} onChange={(e) => setDaysImpact(e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-ink cursor-pointer">
            <input type="checkbox" className="size-4 accent-navy-700" checked={criticalPath} onChange={(e) => setCriticalPath(e.target.checked)} />
            On the critical path
          </label>

          <div>
            <label className="label" htmlFor="de-narrative">Narrative</label>
            <textarea
              id="de-narrative"
              className="input min-h-[110px]"
              placeholder="Describe what happened, the impact on the works, and the link to the programme…"
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-sm text-error bg-error-bg rounded-md px-3 py-2 inline-flex items-center gap-2">
            <AlertTriangle className="size-4" /> {error}
          </p>
        )}
        {done && (
          <p className="mt-3 text-sm text-success bg-success-bg rounded-md px-3 py-2 inline-flex items-center gap-2">
            <CheckCircle2 className="size-4" /> {isEdit ? "Event updated." : "Event added."}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t border-border">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add event"}
          </button>
        </div>
      </form>
    </div>
  );
}
