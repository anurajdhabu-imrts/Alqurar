import { useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Loader2, MessageSquareText, X } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { useCreateProjectQuery, useUpdateProjectQuery } from "@/hooks/useProjectQueries";
import type { ProjectQuery, QueryStatus } from "@/types";

const STATUSES: QueryStatus[] = ["Open", "Closed"];

/**
 * Add or edit a query / RFI manually. The analyst raises the query (date, the
 * EOT/delay it concerns, the question itself) and records the GIC response and
 * status here — the "Response from GIC" can be filled in now or once received.
 */
export function QueryFormModal({
  projectId,
  query,
  onClose,
}: {
  projectId: string;
  /** When provided, the modal edits this query instead of creating a new one. */
  query?: ProjectQuery;
  onClose: () => void;
}) {
  const isEdit = !!query;
  const create = useCreateProjectQuery(projectId);
  const update = useUpdateProjectQuery(projectId);

  const [dateOfRfi, setDateOfRfi] = useState(query?.dateOfRfi ?? "");
  const [eotDescription, setEotDescription] = useState(query?.eotDescription ?? "");
  const [queryDescription, setQueryDescription] = useState(query?.queryDescription ?? "");
  const [responseFromGic, setResponseFromGic] = useState(query?.responseFromGic ?? "");
  const [dateOfResponse, setDateOfResponse] = useState(query?.dateOfResponse ?? "");
  const [status, setStatus] = useState<QueryStatus>(query?.status ?? "Open");
  const [remarks, setRemarks] = useState(query?.remarks ?? "");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const saving = create.isPending || update.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!queryDescription.trim()) return setError("The description of the query is required.");

    const payload = {
      dateOfRfi,
      eotDescription: eotDescription.trim(),
      queryDescription: queryDescription.trim(),
      responseFromGic: responseFromGic.trim(),
      dateOfResponse,
      status,
      remarks: remarks.trim(),
    };

    try {
      if (isEdit && query) {
        await update.mutateAsync({ id: query.id, patch: payload });
      } else {
        await create.mutateAsync({ projectId, ...payload });
      }
      setDone(true);
      window.setTimeout(onClose, 700);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save the query."));
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={onSubmit} className="relative card w-full max-w-2xl p-6 shadow-lg max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-ink inline-flex items-center gap-2">
              <MessageSquareText className="size-4.5 text-navy-700" /> {isEdit ? "Edit query" : "Add query"}
            </h3>
            <p className="text-xs text-muted mt-0.5">
              {isEdit
                ? "Update this query, record the GIC response, or close it."
                : "Raise a query / RFI to the client (GIC) for this project."}
            </p>
          </div>
          <button type="button" className="btn btn-ghost px-2" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin -mx-1 px-1 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="q-rfi-date">Date of RFI</label>
              <input
                id="q-rfi-date"
                type="date"
                className="input"
                value={dateOfRfi}
                onChange={(e) => setDateOfRfi(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="q-status">Status</label>
              <select id="q-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as QueryStatus)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="q-eot">EOT / Delay description</label>
            <input
              id="q-eot"
              className="input"
              placeholder="e.g. Contract Document"
              value={eotDescription}
              onChange={(e) => setEotDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="q-desc">Description of query</label>
            <textarea
              id="q-desc"
              className="input min-h-[90px]"
              placeholder="e.g. Complete set of Tender / Contract documents (Vol. I to Vol. 6) to be provided…"
              value={queryDescription}
              onChange={(e) => setQueryDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="q-response">Response from GIC</label>
            <textarea
              id="q-response"
              className="input min-h-[90px]"
              placeholder="Record the client's / GIC's response here once received…"
              value={responseFromGic}
              onChange={(e) => setResponseFromGic(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="q-resp-date">Date of response</label>
              <input
                id="q-resp-date"
                type="date"
                className="input"
                value={dateOfResponse}
                onChange={(e) => setDateOfResponse(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="q-remarks">Remarks</label>
            <textarea
              id="q-remarks"
              className="input min-h-[70px]"
              placeholder="Any notes on this query…"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
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
            <CheckCircle2 className="size-4" /> {isEdit ? "Query updated." : "Query added."}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t border-border">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add query"}
          </button>
        </div>
      </form>
    </div>
  );
}
