import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Building2, CheckCircle2, Loader2, Search, UserPlus, X } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { useUsersQuery } from "@/hooks/useUsers";
import { useAssignClients, useProjectClients, useUnassignClient } from "@/hooks/useAssignments";
import { useClientProfiles, useUpsertClientProfile } from "@/store/clientProfiles";
import { CLIENT_ROLE } from "@/lib/roles";
import type { ManagedUser, Project } from "@/types";

/**
 * Assign already-registered clients to a project. Opened from the Projects page
 * (i.e. after a project exists). Reads Client-role users, shows which are
 * already assigned, and on save diffs the selection against the current
 * assignments — calling the /assignments API and keeping each client's profile
 * project pointer in sync so it shows on the Clients page.
 */
export function AssignClientsModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const { data: users, isLoading: usersLoading } = useUsersQuery();
  const { data: assignedIds, isLoading: assignedLoading } = useProjectClients(project.id);
  const profiles = useClientProfiles();
  const upsertProfile = useUpsertClientProfile();
  const assign = useAssignClients();
  const unassign = useUnassignClient();

  const clientUsers = useMemo(
    () => (users ?? []).filter((u) => u.role === CLIENT_ROLE) as ManagedUser[],
    [users],
  );
  const companyOf = useCallback(
    (u: ManagedUser) =>
      profiles.find((p) => p.userId === u.id || p.email.toLowerCase() === u.email.toLowerCase())?.company,
    [profiles],
  );

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Seed the selection from the project's current assignments once they load.
  // Done during render (not in an effect) so it doesn't cause a cascading render.
  const idsKey = assignedIds ? [...assignedIds].sort().join(",") : null;
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (assignedIds && seededFor !== idsKey) {
    setSeededFor(idsKey);
    setSelected(new Set(assignedIds));
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clientUsers;
    return clientUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (companyOf(u) ?? "").toLowerCase().includes(q),
    );
  }, [clientUsers, query, companyOf]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const original = useMemo(() => new Set(assignedIds ?? []), [assignedIds]);
  const busy = assign.isPending || unassign.isPending;
  const loading = usersLoading || assignedLoading;

  async function onSave() {
    setError("");
    const toAdd = [...selected].filter((id) => !original.has(id));
    const toRemove = [...original].filter((id) => !selected.has(id));
    try {
      if (toAdd.length) await assign.mutateAsync({ projectId: project.id, clientUserIds: toAdd });
      for (const id of toRemove) {
        await unassign.mutateAsync({ projectId: project.id, clientUserId: id });
      }
      // Keep each client's profile project pointer in sync (display source on the
      // Clients page). Match by userId, falling back to email so a profile saved
      // under a previous backend user id still updates.
      const profileFor = (userId: string) => {
        const u = clientUsers.find((x) => x.id === userId);
        return profiles.find(
          (p) => p.userId === userId || (u != null && p.email.toLowerCase() === u.email.toLowerCase()),
        );
      };
      for (const id of toAdd) {
        const p = profileFor(id);
        if (p) await upsertProfile.mutateAsync({ ...p, projectId: project.id });
      }
      for (const id of toRemove) {
        const p = profileFor(id);
        if (p && p.projectId === project.id) await upsertProfile.mutateAsync({ ...p, projectId: undefined });
      }
      setDone(true);
      window.setTimeout(onClose, 850);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not update assignments — is the backend running?"));
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card w-full max-w-md p-6 shadow-lg max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-ink inline-flex items-center gap-2">
              <Building2 className="size-4.5 text-navy-700" /> Assign clients
            </h3>
            <p className="text-xs text-muted mt-0.5">{project.name} · {project.code}</p>
          </div>
          <button className="btn btn-ghost px-2" onClick={onClose} aria-label="Close"><X className="size-4" /></button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
          <input className="input pl-9" placeholder="Search by company, contact or email…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {/* Register a brand-new client (who isn't in the list yet) — goes to the
            client registration page. The new client can be assigned afterwards. */}
        <Link
          to="/clients/new"
          onClick={onClose}
          className="btn btn-outline btn-sm w-full mb-3 justify-center border-dashed"
        >
          <UserPlus className="size-4" /> Register new client
        </Link>

        <div className="flex-1 overflow-y-auto scroll-thin -mx-1 px-1 min-h-[140px]">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted inline-flex items-center gap-2 justify-center w-full">
              <Loader2 className="size-4 animate-spin" /> Loading clients…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted">
              {clientUsers.length === 0
                ? "No registered clients yet — use “Register new client” above."
                : "No clients match your search."}
            </div>
          ) : (
            <ul className="space-y-1">
              {filtered.map((u) => {
                const checked = selected.has(u.id);
                const company = companyOf(u);
                return (
                  <li key={u.id}>
                    <label className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-navy-50 cursor-pointer">
                      <input type="checkbox" className="size-4 accent-navy-700" checked={checked} onChange={() => toggle(u.id)} />
                      <span className="size-8 shrink-0 rounded-full bg-navy-100 text-navy-800 grid place-items-center text-xs font-semibold">
                        {(company ?? u.name).slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink truncate">{company ?? u.name}</span>
                        <span className="block text-xs text-muted truncate">{u.name} · {u.email}</span>
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
            <CheckCircle2 className="size-4" /> Assignments updated.
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
      </div>
    </div>
  );
}
