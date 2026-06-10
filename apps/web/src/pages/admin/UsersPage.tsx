import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Ban,
  CheckCircle2,
  Filter,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { useDeleteUser, useUpdateUser, useUsersQuery } from "@/hooks/useUsers";
import { useRolesQuery } from "@/hooks/useRoles";
import { formatDate, initials, relativeDays } from "@/lib/utils";
import type { ManagedUser, UserRole, UserStatus } from "@/types";

const statusTone: Record<UserStatus, Tone> = {
  Active: "success",
  Invited: "info",
  Suspended: "error",
};

export function UsersPage() {
  const { data: users = [], isLoading, isError, error: queryError } = useUsersQuery();
  const { data: roles = [] } = useRolesQuery();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "All">("All");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<ManagedUser | null>(null);
  const [actionError, setActionError] = useState("");

  const roleColor = (name: string) => roles.find((r) => r.name === name)?.color ?? "#5a6878";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const matchesRole = roleFilter === "All" || u.role === roleFilter;
      const matchesQuery = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      return matchesRole && matchesQuery;
    });
  }, [users, query, roleFilter]);

  const summary = [
    { label: "Total users", value: users.length },
    { label: "Active", value: users.filter((u) => u.status === "Active").length },
    { label: "Invited", value: users.filter((u) => u.status === "Invited").length },
    { label: "Suspended", value: users.filter((u) => u.status === "Suspended").length },
  ];

  function changeStatus(id: string, status: UserStatus) {
    setActionError("");
    updateMutation.mutate(
      { id, patch: { status } },
      { onError: (e) => setActionError(apiErrorMessage(e, "Couldn't update user.")) },
    );
  }

  function removeUser(id: string) {
    setActionError("");
    deleteMutation.mutate(id, {
      onError: (e) => setActionError(apiErrorMessage(e, "Couldn't remove user.")),
    });
  }

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Manage team members and their access across the platform."
        actions={
          <Link to="/users/new" className="btn btn-primary">
            <UserPlus className="size-4" /> Invite user
          </Link>
        }
      />

      {(isError || actionError) && (
        <p className="mb-4 text-sm text-error bg-error-bg rounded-lg px-3 py-2">
          {actionError || apiErrorMessage(queryError, "Couldn't load users — is the backend running?")}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {summary.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-xs font-medium text-muted">{s.label}</p>
            <p className="mt-1 text-2xl font-bold font-display text-ink tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
          <input className="input pl-9" placeholder="Search by name or email…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted" />
          <select className="input w-auto pr-8" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as UserRole | "All")}>
            <option value="All">All roles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.name}>{r.name}</option>
            ))}
          </select>
        </div>
        <span className="text-sm text-muted ml-auto">{filtered.length} of {users.length} users</span>
      </div>

      <Card className="overflow-visible">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-faint border-b border-border bg-navy-50/40">
                <th className="font-semibold px-5 py-3">User</th>
                <th className="font-semibold px-3 py-3">Role</th>
                <th className="font-semibold px-3 py-3">Status</th>
                <th className="font-semibold px-3 py-3">Last active</th>
                <th className="font-semibold px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-muted">
                    <Loader2 className="size-4 animate-spin inline mr-2" /> Loading users…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-navy-50/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="size-9 shrink-0 rounded-full bg-linear-to-br from-navy-700 to-navy-900 text-white grid place-items-center text-xs font-semibold">
                        {initials(u.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-ink truncate">{u.name}</p>
                        <p className="text-xs text-muted truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm text-ink">
                      <span className="size-2 rounded-full" style={{ backgroundColor: roleColor(u.role) }} />
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-3"><Badge tone={statusTone[u.status]} dot>{u.status}</Badge></td>
                  <td className="px-3 py-3 text-muted whitespace-nowrap">
                    {u.lastActive ? `${formatDate(u.lastActive)} · ${relativeDays(u.lastActive)}` : "Never"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="relative inline-block">
                      <button className="btn btn-ghost px-2 h-8" onClick={() => setMenuId((id) => (id === u.id ? null : u.id))} aria-label="Row actions">
                        <MoreHorizontal className="size-4" />
                      </button>
                      {menuId === u.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                          <div className="absolute right-0 mt-1 w-44 z-20 card p-1.5 shadow-lg text-left">
                            <Link to={`/users/${u.id}/edit`} onClick={() => setMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink hover:bg-navy-50">
                              <Pencil className="size-4 text-muted" /> Edit
                            </Link>
                            {u.status === "Suspended" ? (
                              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink hover:bg-navy-50" onClick={() => { changeStatus(u.id, "Active"); setMenuId(null); }}>
                                <CheckCircle2 className="size-4 text-success" /> Activate
                              </button>
                            ) : (
                              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink hover:bg-navy-50" onClick={() => { changeStatus(u.id, "Suspended"); setMenuId(null); }}>
                                <Ban className="size-4 text-warning" /> Suspend
                              </button>
                            )}
                            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-error hover:bg-error-bg" onClick={() => { setConfirmUser(u); setMenuId(null); }}>
                              <Trash2 className="size-4" /> Remove
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-muted">No users match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmUser !== null}
        title="Remove user?"
        message={confirmUser ? `${confirmUser.name} will lose access immediately. This can't be undone.` : ""}
        confirmLabel="Remove user"
        onConfirm={() => {
          if (confirmUser) removeUser(confirmUser.id);
          setConfirmUser(null);
        }}
        onCancel={() => setConfirmUser(null)}
      />
    </>
  );
}
