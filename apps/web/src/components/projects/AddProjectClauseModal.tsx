import { useState, type FormEvent } from "react";
import { AlertTriangle, BookText, CheckCircle2, Loader2, X } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { useCreateProjectClause, useUpdateProjectClause } from "@/hooks/useProjectClauses";
import { clauseBooks } from "@/mock/clauses";
import type { ClauseRef } from "@/types";

/** Split a free-text tags field ("#EOT, #delay notice") into clean tags. */
function parseTags(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(/[,\s]+/)) {
    const t = raw.trim().replace(/^#+/, "").trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/**
 * Add or edit a clause in a SINGLE project's clause library. Same fields as the
 * old global modal, but saves against /projects/{projectId}/clauses. The
 * contract-standard field defaults to the project's own standard when adding.
 */
export function AddProjectClauseModal({
  projectId,
  projectStandard,
  clause,
  onClose,
  onSaved,
}: {
  projectId: string;
  /** The project's contract standard, used as the default when adding. */
  projectStandard?: string;
  /** When provided, the modal edits this clause instead of creating a new one. */
  clause?: ClauseRef;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const isEdit = !!clause;
  const create = useCreateProjectClause(projectId);
  const update = useUpdateProjectClause(projectId);

  const [standard, setStandard] = useState<string>(clause?.book ?? projectStandard ?? clauseBooks[0]);
  const [number, setNumber] = useState(clause?.clause ?? "");
  const [title, setTitle] = useState(clause?.title ?? "");
  const [description, setDescription] = useState(clause?.summary ?? "");
  const [tags, setTags] = useState((clause?.tags ?? []).join(", "));
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const saving = create.isPending || update.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!standard.trim()) return setError("Contract standard is required.");
    if (!number.trim()) return setError("Clause number is required.");
    if (!title.trim()) return setError("Clause title is required.");

    const payload = {
      contract_standard: standard.trim(),
      clause_number: number.trim(),
      clause_title: title.trim(),
      clause_description: description.trim(),
      tags: parseTags(tags),
    };

    try {
      if (isEdit && clause) {
        await update.mutateAsync({ id: clause.id, patch: payload });
      } else {
        await create.mutateAsync(payload);
      }
      setDone(true);
      onSaved?.();
      window.setTimeout(onClose, 800);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save the clause."));
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={onSubmit}
        className="relative card w-full max-w-lg p-6 shadow-lg max-h-[90vh] flex flex-col"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-ink inline-flex items-center gap-2">
              <BookText className="size-4.5 text-navy-700" /> {isEdit ? "Edit clause" : "Add clause"}
            </h3>
            <p className="text-xs text-muted mt-0.5">
              {isEdit ? "Update this clause in the project's library." : "Add a clause to this project's library."}
            </p>
          </div>
          <button type="button" className="btn btn-ghost px-2" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin -mx-1 px-1 space-y-4">
          <div>
            <label className="label" htmlFor="pclause-standard">Contract standard / book</label>
            <input
              id="pclause-standard"
              className="input"
              list="pclause-books"
              placeholder="e.g. FIDIC Red 2017"
              value={standard}
              onChange={(e) => setStandard(e.target.value)}
            />
            <datalist id="pclause-books">
              {clauseBooks.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="label" htmlFor="pclause-number">Clause number</label>
            <input
              id="pclause-number"
              className="input"
              placeholder="e.g. 8.5, 20.2.1"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="pclause-title">Clause title</label>
            <input
              id="pclause-title"
              className="input"
              placeholder="e.g. Extension of Time for Completion"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="pclause-desc">Clause description</label>
            <textarea
              id="pclause-desc"
              className="input min-h-[96px]"
              placeholder="What this clause provides — the entitlement / notice rule it sets out…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="pclause-tags">Tags</label>
            <input
              id="pclause-tags"
              className="input"
              placeholder="e.g. #EOT, #delay, #notice, #cost"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
            <p className="mt-1 text-xs text-faint">Separate tags with commas or spaces. The “#” is optional.</p>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-sm text-error bg-error-bg rounded-md px-3 py-2 inline-flex items-center gap-2">
            <AlertTriangle className="size-4" /> {error}
          </p>
        )}
        {done && (
          <p className="mt-3 text-sm text-success bg-success-bg rounded-md px-3 py-2 inline-flex items-center gap-2">
            <CheckCircle2 className="size-4" /> {isEdit ? "Clause updated." : "Clause added."}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t border-border">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add clause"}
          </button>
        </div>
      </form>
    </div>
  );
}
