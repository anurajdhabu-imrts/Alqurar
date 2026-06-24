import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FolderKanban, Loader2, Paperclip, UploadCloud, X } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { useAllProjects, useCreateProject, type ProjectDetails } from "@/store/projects";
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
const CURRENCIES = ["OMR", "AED", "USD", "SAR", "QAR", "KWD", "BHD"];

const STEP_IDS = ["basics", "contract", "dates", "baseline"] as const;
type StepId = (typeof STEP_IDS)[number];
const STEPS: { id: StepId; n: number; title: string }[] = [
  { id: "basics", n: 1, title: "Basics" },
  { id: "contract", n: 2, title: "Contract" },
  { id: "dates", n: 3, title: "Key dates" },
  { id: "baseline", n: 4, title: "Baseline" },
];

/**
 * Create Project — 4-step wizard run by an Al Qarar admin. Produces the central
 * Project object everything else hangs off (documents, delay events, windows
 * analysis, the EOT claim). The new project becomes assignable to clients and
 * visible in their portal.
 */
export function CreateProjectPage() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const allProjects = useAllProjects();
  const editing = editId ? allProjects.find((p) => p.id === editId) : undefined;
  const isEdit = Boolean(editId);
  const fileRef = useRef<HTMLInputElement>(null);

  // Basics
  const [name, setName] = useState(editing?.name ?? "");
  const [location, setLocation] = useState(editing?.location ?? "");
  const [employer, setEmployer] = useState(editing?.employer ?? "");
  const [engineer, setEngineer] = useState(editing?.engineer ?? "");
  const [contractor, setContractor] = useState(editing?.contractor ?? "");

  // Contract
  const [standard, setStandard] = useState<ContractStandard>((editing?.standard as ContractStandard) ?? "FIDIC Red 2017");
  const [value, setValue] = useState(editing?.value ? String(editing.value) : "");
  const [currency, setCurrency] = useState(editing?.currency ?? "OMR");
  const [loaRef, setLoaRef] = useState(editing?.loaRef ?? "");

  // Key dates
  const [commencementDate, setCommencementDate] = useState(editing?.commencementDate ?? "");
  const [completionDate, setCompletionDate] = useState(editing?.completionDate ?? "");
  const [timeForCompletion, setTimeForCompletion] = useState(editing?.timeForCompletionDays ? String(editing.timeForCompletionDays) : "");
  const [dataDate, setDataDate] = useState(editing?.dataDate ?? "");

  // Baseline
  const [baselineProgramme, setBaselineProgramme] = useState(editing?.baselineProgramme ?? "");

  const [errors, setErrors] = useState<{ name?: string; contractor?: string }>({});
  const [submitError, setSubmitError] = useState("");
  const [tab, setTab] = useState<StepId>("basics");

  const createProject = useCreateProject();

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Project name is required.";
    if (!contractor.trim()) next.contractor = "Contractor is required.";
    setErrors(next);
    if (Object.keys(next).length) {
      setTab("basics");
      return;
    }

    const id = editing?.id ?? `p-${Date.now()}`;
    const code = loaRef.trim() || editing?.code || `PRJ-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
    const project: ProjectDetails = {
      id,
      name: name.trim(),
      code,
      employer: employer.trim(),
      contractor: contractor.trim(),
      standard,
      value: Number(value) || 0,
      currency,
      startDate: commencementDate || "",
      completionDate: completionDate || "",
      status: "Active",
      riskLevel: "Moderate",
      source: "created",
      location: location.trim() || undefined,
      engineer: engineer.trim() || undefined,
      loaRef: loaRef.trim() || undefined,
      commencementDate: commencementDate || undefined,
      timeForCompletionDays: Number(timeForCompletion) || undefined,
      dataDate: dataDate || undefined,
      baselineProgramme: baselineProgramme || undefined,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    setSubmitError("");
    createProject.mutate(project, {
      onSuccess: () => navigate("/projects"),
      onError: (err) => setSubmitError(apiErrorMessage(err, "Could not create project — is the backend running?")),
    });
  }

  return (
    <div>
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy-700 mb-4">
        <ArrowLeft className="size-4" /> Projects
      </Link>

      <div className="mb-6">
        <h1 className="text-[26px] leading-tight font-bold text-ink tracking-tight">{isEdit ? "Edit project" : "New project"}</h1>
        <p className="mt-1.5 text-sm text-muted">
          {isEdit
            ? "Update this project's details."
            : "Set up the project Al Qarar is engaged on. Everything — documents, delay events, windows analysis and the EOT claim — is organised under it."}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <Card className="overflow-hidden">
          {/* Stepper */}
          <div className="px-5 sm:px-6 py-5 border-b border-border">
            <ol className="flex items-center gap-2 sm:gap-4">
              {STEPS.map((s, i) => {
                const isActive = tab === s.id;
                const isComplete = STEP_IDS.indexOf(tab) > i;
                const done = isActive || isComplete;
                return (
                  <li key={s.id} className="flex items-center gap-2 sm:gap-4 flex-1 last:flex-none min-w-0">
                    <button type="button" onClick={() => setTab(s.id)} className="flex items-center gap-3 min-w-0 text-left">
                      <span className={cn("grid place-items-center size-9 rounded-full text-sm font-semibold shrink-0 transition-colors", done ? "bg-navy-900 text-white" : "bg-navy-50 text-faint border border-border")}>
                        {s.n}
                      </span>
                      <span className="min-w-0 hidden sm:block">
                        <span className={cn("block text-[11px] font-bold uppercase tracking-wide", done ? "text-navy-700" : "text-faint")}>Step {s.n}</span>
                        <span className={cn("block text-sm font-medium truncate", isActive ? "text-ink" : "text-muted")}>{s.title}</span>
                      </span>
                    </button>
                    {i < STEPS.length - 1 && <span className={cn("hidden sm:block h-px flex-1 min-w-6", isComplete ? "bg-navy-300" : "bg-border")} />}
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Step 1 — Basics */}
          {tab === "basics" && (
            <>
              <CardHeader title="Project basics" subtitle="The project and the parties" />
              <div className="p-5 space-y-5">
                <div>
                  <label className="label" htmlFor="name">Project name</label>
                  <input id="name" className="input" placeholder="e.g. Yiti Marina Hotel — Balancing Works" value={name} onChange={(e) => setName(e.target.value)} />
                  {errors.name && <p className="mt-1 text-xs text-error">{errors.name}</p>}
                </div>
                <div>
                  <label className="label" htmlFor="location">Location</label>
                  <input id="location" className="input" placeholder="e.g. Yiti, Sultanate of Oman" value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div className="grid sm:grid-cols-3 gap-5">
                  <div>
                    <label className="label" htmlFor="employer">Employer</label>
                    <input id="employer" className="input" placeholder="e.g. SSH" value={employer} onChange={(e) => setEmployer(e.target.value)} />
                  </div>
                  <div>
                    <label className="label" htmlFor="engineer">Engineer</label>
                    <input id="engineer" className="input" placeholder="e.g. GIC" value={engineer} onChange={(e) => setEngineer(e.target.value)} />
                  </div>
                  <div>
                    <label className="label" htmlFor="contractor">Contractor</label>
                    <input id="contractor" className="input" placeholder="e.g. GIC" value={contractor} onChange={(e) => setContractor(e.target.value)} />
                    {errors.contractor && <p className="mt-1 text-xs text-error">{errors.contractor}</p>}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Step 2 — Contract */}
          {tab === "contract" && (
            <>
              <CardHeader title="Contract" subtitle="The contractual basis for the engagement" />
              <div className="p-5 space-y-5">
                <div>
                  <label className="label" htmlFor="standard">Contract standard</label>
                  <select id="standard" className="input" value={standard} onChange={(e) => setStandard(e.target.value as ContractStandard)}>
                    {STANDARDS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="grid sm:grid-cols-3 gap-5">
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor="value">Contract value</label>
                    <input id="value" type="number" min="0" className="input" placeholder="0" value={value} onChange={(e) => setValue(e.target.value)} />
                  </div>
                  <div>
                    <label className="label" htmlFor="currency">Currency</label>
                    <select id="currency" className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="loaRef">LOA / LPO reference</label>
                  <input id="loaRef" className="input" placeholder="e.g. LPO-46 Al Qarar Management Solutions" value={loaRef} onChange={(e) => setLoaRef(e.target.value)} />
                  <p className="mt-1 text-xs text-faint">Used as the project code if provided.</p>
                </div>
              </div>
            </>
          )}

          {/* Step 3 — Key dates */}
          {tab === "dates" && (
            <>
              <CardHeader title="Key dates" subtitle="These anchor the windows / delay analysis" />
              <div className="p-5 space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="label" htmlFor="commencementDate">Commencement date</label>
                    <input id="commencementDate" type="date" className="input" value={commencementDate} onChange={(e) => setCommencementDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="label" htmlFor="completionDate">Baseline completion date</label>
                    <input id="completionDate" type="date" className="input" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="label" htmlFor="timeForCompletion">Time for Completion (days)</label>
                    <input id="timeForCompletion" type="number" min="0" className="input" placeholder="e.g. 730" value={timeForCompletion} onChange={(e) => setTimeForCompletion(e.target.value)} />
                  </div>
                  <div>
                    <label className="label" htmlFor="dataDate">Current data date</label>
                    <input id="dataDate" type="date" className="input" value={dataDate} onChange={(e) => setDataDate(e.target.value)} />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Step 4 — Baseline programme */}
          {tab === "baseline" && (
            <>
              <CardHeader title="Baseline programme" subtitle="The approved baseline used for delay analysis" />
              <div className="p-5 space-y-4">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xer,.xml,.mpp,.pdf"
                  className="hidden"
                  onChange={(e) => setBaselineProgramme(e.target.files?.[0]?.name ?? "")}
                />
                {baselineProgramme ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-navy-50/40 p-3.5">
                    <Paperclip className="size-4 text-navy-600 shrink-0" />
                    <span className="text-sm text-ink flex-1 truncate">{baselineProgramme}</span>
                    <button type="button" className="btn btn-ghost px-2" onClick={() => setBaselineProgramme("")} aria-label="Remove">
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} className="w-full rounded-xl border border-dashed border-border-strong hover:border-navy-300 transition-colors p-8 text-center">
                    <UploadCloud className="size-7 text-faint mx-auto mb-2" />
                    <p className="text-sm font-medium text-ink">Upload approved baseline programme</p>
                    <p className="text-xs text-muted mt-0.5">Primavera P6 .xer / .xml, MS Project .mpp, or PDF</p>
                  </button>
                )}
                <p className="text-xs text-faint">Optional now — you can upload the baseline and approval letters later from the project's Data Room.</p>
              </div>
            </>
          )}
        </Card>

        {submitError && <p className="text-sm text-error bg-error-bg rounded-lg px-3 py-2">{submitError}</p>}

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            {tab !== "basics" && (
              <button type="button" className="btn btn-outline" onClick={() => setTab(STEP_IDS[STEP_IDS.indexOf(tab) - 1])}>Back</button>
            )}
            {tab !== "baseline" && (
              <button type="button" className="btn btn-outline" onClick={() => setTab(STEP_IDS[STEP_IDS.indexOf(tab) + 1])}>Next</button>
            )}
          </div>
          <div className="flex gap-2">
            <Link to="/projects" className="btn btn-outline">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={createProject.isPending}>
              {createProject.isPending
                ? <><Loader2 className="size-4 animate-spin" /> {isEdit ? "Saving…" : "Creating…"}</>
                : <><FolderKanban className="size-4" /> {isEdit ? "Save changes" : "Create project"}</>}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
