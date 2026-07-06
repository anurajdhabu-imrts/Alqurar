import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, FileSignature, Loader2, UserPlus } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { Card, CardHeader } from "@/components/ui/Card";
import { useCreateProject, type ProjectDetails } from "@/store/projects";
import { useUsersQuery } from "@/hooks/useUsers";
import { useAssignClients } from "@/hooks/useAssignments";
import { useClientProfiles } from "@/store/clientProfiles";
import { CLIENT_ROLE } from "@/lib/roles";
import type { ContractStandard, ManagedUser } from "@/types";

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

/**
 * New Proposal — captures the minimum needed to start a proposal, then opens its
 * 3-step workspace (Documents → Delay Events → Proposal). The proposal is stored
 * as a project record flagged kind = "proposal", so it reuses the same document
 * and delay-event pipeline while living in the Proposals area.
 */
export function NewProposalPage() {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const assignClients = useAssignClients();

  // Existing clients (registered Client-role users) available to attach.
  const { data: users, isLoading: usersLoading } = useUsersQuery();
  const profiles = useClientProfiles();
  const clientUsers = useMemo(
    () => (users ?? []).filter((u) => u.role === CLIENT_ROLE) as ManagedUser[],
    [users],
  );
  const companyOf = (u: ManagedUser) =>
    profiles.find((p) => p.userId === u.id || p.email.toLowerCase() === u.email.toLowerCase())?.company;
  const labelFor = (u: ManagedUser) => {
    const company = companyOf(u);
    return company ? `${company} — ${u.name}` : `${u.name} (${u.email})`;
  };

  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [client, setClient] = useState("");
  const [standard, setStandard] = useState<ContractStandard>("FIDIC Red 2017");
  const [currency, setCurrency] = useState("OMR");
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");

  // Picking an existing client auto-fills the Client/Employer field with their
  // company (still editable), and links them to the proposal on creation.
  function onSelectClient(id: string) {
    setClientId(id);
    const u = clientUsers.find((x) => x.id === id);
    if (u) setClient(companyOf(u) ?? u.name);
  }

  const busy = createProject.isPending || assignClients.isPending;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Proposal name is required.");
      return;
    }
    setError("");
    setSubmitError("");

    const id = `pr-${Date.now()}`;
    const proposal: ProjectDetails = {
      id,
      name: name.trim(),
      code: `PROP-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      employer: client.trim(),
      contractor: "",
      standard,
      value: 0,
      currency,
      startDate: "",
      completionDate: "",
      status: "Active",
      riskLevel: "Moderate",
      source: "created",
      kind: "proposal",
      createdAt: new Date().toISOString(),
    };

    createProject.mutate(proposal, {
      onSuccess: async () => {
        // Link the selected existing client to the proposal, if one was chosen.
        if (clientId) {
          try {
            await assignClients.mutateAsync({ projectId: id, clientUserIds: [clientId] });
          } catch {
            // Non-fatal — the proposal exists; the client can be added later.
          }
        }
        navigate(`/proposals/${id}`);
      },
      onError: (err) => setSubmitError(apiErrorMessage(err, "Could not create proposal — is the backend running?")),
    });
  }

  return (
    <div>
      <Link to="/proposals" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy-700 mb-4">
        <ArrowLeft className="size-4" /> Proposals
      </Link>

      <div className="mb-6">
        <h1 className="text-[26px] leading-tight font-bold text-ink tracking-tight">New proposal</h1>
        <p className="mt-1.5 text-sm text-muted">
          Name the proposal to begin. You'll then upload the client's documents, let AI identify the delay events,
          and generate a costed proposal — all in one place.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5 max-w-2xl">
        <Card>
          <CardHeader title="Proposal details" subtitle="The essentials — the rest is captured in the workspace" />
          <div className="p-5 space-y-5">
            <div>
              <label className="label" htmlFor="name">Proposal name</label>
              <input
                id="name"
                className="input"
                placeholder="e.g. Yiti Marina Hotel — Delay Claim Proposal"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {error && <p className="mt-1 text-xs text-error">{error}</p>}
            </div>
            <div>
              <label className="label" htmlFor="clientId">Add client</label>
              <div className="flex items-center gap-2">
                <select
                  id="clientId"
                  className="input"
                  value={clientId}
                  onChange={(e) => onSelectClient(e.target.value)}
                  disabled={usersLoading}
                >
                  <option value="">
                    {usersLoading
                      ? "Loading clients…"
                      : clientUsers.length === 0
                        ? "No registered clients yet"
                        : "Select an existing client…"}
                  </option>
                  {clientUsers.map((u) => (
                    <option key={u.id} value={u.id}>{labelFor(u)}</option>
                  ))}
                </select>
                <Link to="/clients/new" className="btn btn-outline shrink-0" title="Register a new client">
                  <UserPlus className="size-4" /> New
                </Link>
              </div>
              <p className="mt-1 text-xs text-faint">Optional — link an existing client to this proposal.</p>
            </div>

            <div>
              <label className="label" htmlFor="client">Client / Employer</label>
              <input
                id="client"
                className="input"
                placeholder="e.g. SSH"
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
            </div>
            <div className="grid sm:grid-cols-3 gap-5">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="standard">Contract standard</label>
                <select id="standard" className="input" value={standard} onChange={(e) => setStandard(e.target.value as ContractStandard)}>
                  {STANDARDS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="currency">Currency</label>
                <select id="currency" className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>
        </Card>

        {submitError && <p className="text-sm text-error bg-error-bg rounded-lg px-3 py-2">{submitError}</p>}

        <div className="flex items-center justify-end gap-2">
          <Link to="/proposals" className="btn btn-outline">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy
              ? <><Loader2 className="size-4 animate-spin" /> Creating…</>
              : <><FileSignature className="size-4" /> Create & continue</>}
          </button>
        </div>
      </form>
    </div>
  );
}
