import { useState, type FormEvent } from "react";
import { AlertTriangle, BookText, CheckCircle2, Loader2, X } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { useCreateClause, useUpdateClause } from "@/hooks/useClauses";
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
 * Add or edit a clause in the Clause Reference Library. Mirrors the fields of
 * the static clause cards: contract standard, clause number, title, description
 * and tags. Saving hits the /clauses backend; the library refetches on success.
 */
export function AddClauseModal({
  clause,
  onClose,
  onSaved,
}: {
  /** When provided, the modal edits this clause instead of creating a new one. */
  clause?: ClauseRef;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const isEdit = !!clause;
  const create = useCreateClause();
  const update = useUpdateClause();

  const [standard, setStandard] = useState<string>(clause?.book ?? clauseBooks[0]);
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
              <BookText className="size-4.5 text-navy-700" /> {isEdit ? "Edit clause" : "Add new clause"}
            </h3>
            <p className="text-xs text-muted mt-0.5">
              {isEdit ? "Update this clause in the reference library." : "Add a clause to the reference library."}
            </p>
          </div>
          <button type="button" className="btn btn-ghost px-2" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin -mx-1 px-1 space-y-4">
          <div>
            <label className="label" htmlFor="clause-standard">Contract standard / category</label>
            <select
              id="clause-standard"
              className="input"
              value={standard}
              onChange={(e) => setStandard(e.target.value)}
            >
              {clauseBooks.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="clause-number">Clause number</label>
            <input
              id="clause-number"
              className="input"
              placeholder="e.g. 8.4, 20.1, 8.5"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="clause-title">Clause title</label>
            <input
              id="clause-title"
              className="input"
              placeholder="e.g. Extension of Time for Completion"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="clause-desc">Clause description</label>
            <textarea
              id="clause-desc"
              className="input min-h-[96px]"
              placeholder="e.g. Contractor entitled to EOT for variations, adverse climatic conditions, Employer delays…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="clause-tags">Tags</label>
            <input
              id="clause-tags"
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
