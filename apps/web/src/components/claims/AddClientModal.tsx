import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { useCreateUser, useUsersQuery } from "@/hooks/useUsers";
import { useAssignClients, useProjectClients, useUnassignClient } from "@/hooks/useAssignments";
import { useHasPermission } from "@/hooks/usePermission";
import { CLIENT_ROLE } from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { EOTClaim, ManagedUser, Project } from "@/types";

type Tab = "existing" | "create";

/** Readable auto-generated password (omits ambiguous chars). */
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Assign one or more client users to the project behind a claim. Reuses the
 * users API (filtered to the Client role) and the /assignments backend. The
 * assignment makes the project visible in that client's dashboard.
 *
 * Two modes via tabs:
 *  - Select existing — the original multi-select assignment flow (unchanged).
 *  - Create new client — create a Client-role user and assign them to this
 *    project in one step. Only shown to users who may create accounts.
 */
export function AddClientModal({
  claim,
  project,
  onClose,
}: {
  claim: EOTClaim;
  project: Project;
  onClose: () => void;
}) {
  const { data: users, isLoading: usersLoading } = useUsersQuery();
  const { data: assignedIds, isLoading: assignedLoading } = useProjectClients(project.id);
  const assign = useAssignClients();
  const unassign = useUnassignClient();
  const createUser = useCreateUser();

  // Creating an account hits POST /users/ which requires admin.users; only
  // surface the "Create new client" tab to users who actually hold it.
  const canCreate = useHasPermission("admin.users");

  const clientUsers = useMemo(
    () => (users ?? []).filter((u) => u.role === CLIENT_ROLE),
    [users],
  );

  const [tab, setTab] = useState<Tab>("existing");

  // ── Existing-client assignment state (unchanged) ──────────────────────────
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Seed the selection with the project's current clients once loaded.
  useEffect(() => {
    if (assignedIds) setSelected(new Set(assignedIds));
  }, [assignedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clientUsers;
    return clientUsers.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [clientUsers, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const busy = assign.isPending || unassign.isPending;
  const original = useMemo(() => new Set(assignedIds ?? []), [assignedIds]);

  async function onSave() {
    setError("");
    const toAdd = [...selected].filter((id) => !original.has(id));
    const toRemove = [...original].filter((id) => !selected.has(id));
    try {
      if (toAdd.length) await assign.mutateAsync({ projectId: project.id, clientUserIds: toAdd });
      for (const id of toRemove) {
        await unassign.mutateAsync({ projectId: project.id, clientUserId: id });
      }
      setDone(true);
      window.setTimeout(onClose, 900);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not update assignments."));
    }
  }

  const loading = usersLoading || assignedLoading;

  // ── Create-new-client state ───────────────────────────────────────────────
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [autoGen, setAutoGen] = useState(true);
  const [cPassword, setCPassword] = useState("");
  const [genPassword, setGenPassword] = useState(() => generatePassword());
  const [createError, setCreateError] = useState("");
  const [createDone, setCreateDone] = useState(false);
  // When the email already belongs to a client, offer to assign them instead.
  const [emailMatch, setEmailMatch] = useState<ManagedUser | null>(null);

  const creating = createUser.isPending || assign.isPending;

  function resetCreateForm() {
    setCName("");
    setCEmail("");
    setCPhone("");
    setAutoGen(true);
    setCPassword("");
    setGenPassword(generatePassword());
    setEmailMatch(null);
  }

  async function onCreate() {
    setCreateError("");
    setEmailMatch(null);

    const name = cName.trim();
    const email = cEmail.trim().toLowerCase();
    const password = autoGen ? genPassword : cPassword;

    if (!name) return setCreateError("Full name is required.");
    if (!email) return setCreateError("Email is required.");
    if (!EMAIL_RE.test(email)) return setCreateError("Enter a valid email address.");
    if (!autoGen && !cPassword.trim())
      return setCreateError("Enter a password or use auto-generate.");

    try {
      const created = await createUser.mutateAsync({
        name,
        email,
        password,
        role: CLIENT_ROLE,
        status: "Active",
        phone: cPhone.trim() || undefined,
      });
      // Auto-assign the new client to this project.
      await assign.mutateAsync({ projectId: project.id, clientUserIds: [created.id] });
      setCreateDone(true);
      // Refresh + show the new client checked in the existing-client list.
      window.setTimeout(() => {
        setCreateDone(false);
        resetCreateForm();
        setTab("existing");
      }, 1200);
    } catch (err) {
      // Duplicate email → offer to assign the existing client instead of
      // creating a second account.
      const match = clientUsers.find((u) => u.email.toLowerCase() === email);
      const anyUser = (users ?? []).find((u) => u.email.toLowerCase() === email);
      if (match) {
        setEmailMatch(match);
        setCreateError("A client with that email already exists. Assign them instead?");
      } else if (anyUser) {
        setCreateError("That email belongs to an internal (non-client) user.");
      } else {
        setCreateError(apiErrorMessage(err, "Could not create client."));
      }
    }
  }

  async function assignExisting() {
    if (!emailMatch) return;
    setCreateError("");
    try {
      await assign.mutateAsync({ projectId: project.id, clientUserIds: [emailMatch.id] });
      setCreateDone(true);
      window.setTimeout(() => {
        setCreateDone(false);
        resetCreateForm();
        setTab("existing");
      }, 1200);
    } catch (err) {
      setCreateError(apiErrorMessage(err, "Could not assign client."));
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card w-full max-w-md p-6 shadow-lg max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-ink inline-flex items-center gap-2">
              <UserPlus className="size-4.5 text-navy-700" /> Add client
            </h3>
            <p className="text-xs text-muted mt-0.5">{project.name} · {claim.ref}</p>
          </div>
          <button className="btn btn-ghost px-2" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        {/* Tabs — only show the toggle when account creation is permitted. */}
        {canCreate && (
          <div className="flex gap-1 p-1 rounded-lg bg-navy-50 mb-4">
            <button
              type="button"
              onClick={() => setTab("existing")}
              className={cn(
                "flex-1 text-sm font-medium px-3 py-1.5 rounded-md transition-colors",
                tab === "existing" ? "bg-white text-navy-900 shadow-sm" : "text-muted hover:text-navy-900",
              )}
            >
              Select existing
            </button>
            <button
              type="button"
              onClick={() => setTab("create")}
              className={cn(
                "flex-1 text-sm font-medium px-3 py-1.5 rounded-md transition-colors",
                tab === "create" ? "bg-white text-navy-900 shadow-sm" : "text-muted hover:text-navy-900",
              )}
            >
              Create new client
            </button>
          </div>
        )}

        {tab === "existing" ? (
          <>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
              <input
                className="input pl-9"
                placeholder="Search client users…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="flex-1 overflow-y-auto scroll-thin -mx-1 px-1 min-h-[120px]">
              {loading ? (
                <div className="py-10 text-center text-sm text-muted inline-flex items-center gap-2 justify-center w-full">
                  <Loader2 className="size-4 animate-spin" /> Loading client users…
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted">
                  {clientUsers.length === 0 ? "No client users exist yet." : "No clients match your search."}
                </div>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((u) => {
                    const checked = selected.has(u.id);
                    return (
                      <li key={u.id}>
                        <label className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-navy-50 cursor-pointer">
                          <input type="checkbox" className="size-4 accent-navy-700" checked={checked} onChange={() => toggle(u.id)} />
                          <span className="size-8 shrink-0 rounded-full bg-navy-100 text-navy-800 grid place-items-center text-xs font-semibold">
                            {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-ink truncate">{u.name}</span>
                            <span className="block text-xs text-muted truncate">{u.email}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {error && (
              <p className="mt-3 text-sm text-error bg-error-bg rounded-md px-3 py-2 inline-flex items-center gap-2">
                <AlertTriangle className="size-4" /> {error}
              </p>
            )}
            {done && (
              <p className="mt-3 text-sm text-success bg-success-bg rounded-md px-3 py-2 inline-flex items-center gap-2">
                <CheckCircle2 className="size-4" /> Assignment updated.
              </p>
            )}

            <div className="flex items-center justify-between gap-2 pt-4 mt-2 border-t border-border">
              <span className="text-xs text-muted">{selected.size} selected</span>
              <div className="flex gap-2">
                <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
                <button className="btn btn-primary" onClick={onSave} disabled={busy || loading}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {busy ? "Saving…" : "Save assignment"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto scroll-thin -mx-1 px-1 space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Full name</label>
                <input
                  className="input"
                  placeholder="e.g. James Whitfield"
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Email</label>
                <input
                  className="input"
                  type="email"
                  placeholder="client@company.com"
                  value={cEmail}
                  onChange={(e) => {
                    setCEmail(e.target.value);
                    if (emailMatch) setEmailMatch(null);
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  Phone number <span className="text-faint">(optional)</span>
                </label>
                <input
                  className="input"
                  placeholder="+971 50 000 0000"
                  value={cPhone}
                  onChange={(e) => setCPhone(e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-muted">Password</label>
                  <label className="inline-flex items-center gap-1.5 text-xs text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      className="size-3.5 accent-navy-700"
                      checked={autoGen}
                      onChange={(e) => setAutoGen(e.target.checked)}
                    />
                    Auto-generate
                  </label>
                </div>
                {autoGen ? (
                  <div className="flex gap-2">
                    <input className="input font-mono" value={genPassword} readOnly />
                    <button
                      type="button"
                      className="btn btn-outline px-2"
                      title="Regenerate password"
                      onClick={() => setGenPassword(generatePassword())}
                    >
                      <RefreshCw className="size-4" />
                    </button>
                  </div>
                ) : (
                  <input
                    className="input"
                    type="text"
                    placeholder="Set a password"
                    value={cPassword}
                    onChange={(e) => setCPassword(e.target.value)}
                  />
                )}
                {autoGen && (
                  <p className="text-xs text-faint mt-1">Share this password with the client to sign in.</p>
                )}
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <div>
                  <span className="block text-xs font-medium text-muted mb-1">Role</span>
                  <span className="inline-flex items-center text-sm font-medium text-navy-900 bg-navy-50 rounded-md px-2.5 py-1">
                    {CLIENT_ROLE}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-muted mb-1">Status</span>
                  <span className="inline-flex items-center text-sm font-medium text-success bg-success-bg rounded-md px-2.5 py-1">
                    Active
                  </span>
                </div>
              </div>
            </div>

            {createError && (
              <div className="mt-3 text-sm text-error bg-error-bg rounded-md px-3 py-2">
                <p className="inline-flex items-center gap-2">
                  <AlertTriangle className="size-4" /> {createError}
                </p>
                {emailMatch && (
                  <button
                    type="button"
                    className="btn btn-outline mt-2 w-full"
                    onClick={assignExisting}
                    disabled={creating}
                  >
                    {creating && <Loader2 className="size-4 animate-spin" />}
                    Assign “{emailMatch.name}” to this project
                  </button>
                )}
              </div>
            )}
            {createDone && (
              <p className="mt-3 text-sm text-success bg-success-bg rounded-md px-3 py-2 inline-flex items-center gap-2">
                <CheckCircle2 className="size-4" /> Client created and assigned.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t border-border">
              <button className="btn btn-outline" onClick={onClose} disabled={creating}>Cancel</button>
              <button className="btn btn-primary" onClick={onCreate} disabled={creating}>
                {creating && <Loader2 className="size-4 animate-spin" />}
                {creating ? "Creating…" : "Create & assign"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
