import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, GanttChartSquare, Loader2, X } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { useCreateProject, type ProjectDetails } from "@/store/projects";
import type { ContractStandard } from "@/types";

const STANDARDS: ContractStandard[] = [
  "FIDIC Red 2017",
  "FIDIC Red 1999",
  "FIDIC Yellow 2017",
  "FIDIC Silver 2017",
  "NEC4",
  "CPWD",
  "Bespoke",
];

/**
 * Start a new Chronology Gantt session. A session is stored as a project record
 * flagged kind = "chronology", so it reuses the same document → delay-event →
 * chronology pipeline while staying out of the Projects and Proposals areas.
 */
export function NewChronologyModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const createProject = useCreateProject();

  const [name, setName] = useState("");
  const [standard, setStandard] = useState<ContractStandard>("FIDIC Red 2017");
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("A name is required.");
      return;
    }
    setError("");
    setSubmitError("");

    const id = `chr-${Date.now()}`;
    const session: ProjectDetails = {
      id,
      name: name.trim(),
      code: `CHR-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      employer: "",
      contractor: "",
      standard,
      value: 0,
      currency: "OMR",
      startDate: "",
      completionDate: "",
      status: "Active",
      riskLevel: "Moderate",
      source: "created",
      kind: "chronology",
      createdAt: new Date().toISOString(),
    };

    createProject.mutate(session, {
      onSuccess: () => navigate(`/chronology-gantt/${id}`),
      onError: (err) =>
        setSubmitError(apiErrorMessage(err, "Could not create the chronology — is the backend running?")),
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative card w-full max-w-lg p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-ink inline-flex items-center gap-2">
              <GanttChartSquare className="size-4.5 text-navy-700" /> New chronology
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Name it, then upload the documents. AI identifies the delay events and plots each one's timeline.
            </p>
          </div>
          <button type="button" className="btn btn-ghost px-2" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="chr-name">Name</label>
            <input
              id="chr-name"
              className="input"
              autoFocus
              placeholder="e.g. Villa 12 — EOT chronology"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {error && <p className="mt-1.5 text-xs text-error">{error}</p>}
          </div>

          <div>
            <label className="label" htmlFor="chr-standard">Contract standard</label>
            <select
              id="chr-standard"
              className="input"
              value={standard}
              onChange={(e) => setStandard(e.target.value as ContractStandard)}
            >
              {STANDARDS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-faint">
              Grounds the AI's reading of entitlement and notice clauses.
            </p>
          </div>
        </div>

        {submitError && (
          <p className="mt-3 text-sm text-error bg-error-bg rounded-md px-3 py-2 inline-flex items-center gap-2">
            <AlertTriangle className="size-4" /> {submitError}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t border-border">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={createProject.isPending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={createProject.isPending}>
            {createProject.isPending && <Loader2 className="size-4 animate-spin" />}
            {createProject.isPending ? "Creating…" : "Create & upload documents"}
          </button>
        </div>
      </form>
    </div>
  );
}
