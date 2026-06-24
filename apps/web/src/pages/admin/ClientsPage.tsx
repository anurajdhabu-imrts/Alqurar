import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Loader2, Pencil, Search, Trash2, UserPlus } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { EditClientModal } from "@/components/clients/EditClientModal";
import { useDeleteUser, useUsersQuery } from "@/hooks/useUsers";
import { useClientProfiles, useDeleteClientProfile, type ClientProfile } from "@/store/clientProfiles";
import { useAllProjects } from "@/store/projects";
import { CLIENT_ROLE } from "@/lib/roles";
import { formatDate, initials } from "@/lib/utils";
import type { ManagedUser, UserStatus } from "@/types";

const statusTone: Record<UserStatus, Tone> = {
  Active: "success",
  Invited: "info",
  Suspended: "error",
};

/** A client user joined with its captured company profile (if any). */
interface ClientRow {
  user: ManagedUser;
  profile?: ClientProfile;
  company: string;
  country?: string;
  roleOnProject?: string;
  phone?: string;
  projectName?: string;
  createdAt?: string;
}

export function ClientsPage() {
  const { data: users = [], isLoading, isError, error } = useUsersQuery();
  const profiles = useClientProfiles();
  const allProjects = useAllProjects();
  const deleteUser = useDeleteUser();
  const deleteProfile = useDeleteClientProfile();
  const [query, setQuery] = useState("");
  const [editTarget, setEditTarget] = useState<ClientRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null);

  const rows = useMemo<ClientRow[]>(() => {
    const clientUsers = (users as ManagedUser[]).filter((u) => u.role === CLIENT_ROLE);
    return clientUsers.map((user) => {
      const p = profiles.find((x) => x.userId === user.id || x.email.toLowerCase() === user.email.toLowerCase());
      const project = p?.projectId ? allProjects.find((pr) => pr.id === p.projectId) : undefined;
      return {
        user,
        profile: p,
        company: p?.company ?? "—",
        country: p?.country,
        roleOnProject: p?.roleOnProject,
        phone: p?.phone ?? user.phone,
        projectName: project?.name,
        createdAt: p?.createdAt,
      };
    });
  }, [users, profiles, allProjects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.company.toLowerCase().includes(q) ||
        r.user.name.toLowerCase().includes(q) ||
        r.user.email.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const summary = [
    { label: "Total clients", value: rows.length },
    { label: "Active", value: rows.filter((r) => r.user.status === "Active").length },
    { label: "Assigned to a project", value: rows.filter((r) => r.projectName).length },
    { label: "Unassigned", value: rows.filter((r) => !r.projectName).length },
  ];

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Contractor companies engaging Al Qarar. Register a client to create their portal login."
        actions={
          <Link to="/clients/new" className="btn btn-primary">
            <UserPlus className="size-4" /> Register client
          </Link>
        }
      />

      {isError && (
        <p className="mb-4 text-sm text-error bg-error-bg rounded-lg px-3 py-2">
          {apiErrorMessage(error, "Couldn't load clients — is the backend running?")}
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
          <input className="input pl-9" placeholder="Search company, contact or email…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <span className="text-sm text-muted ml-auto">{filtered.length} of {rows.length} clients</span>
      </div>

      <Card>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-faint border-b border-border bg-navy-50/40">
                <th className="font-semibold px-5 py-3">Company / Contact</th>
                <th className="font-semibold px-3 py-3">Email</th>
                <th className="font-semibold px-3 py-3">Project</th>
                <th className="font-semibold px-3 py-3">Status</th>
                <th className="font-semibold px-3 py-3">Registered</th>
                <th className="font-semibold px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted">
                    <Loader2 className="size-4 animate-spin inline mr-2" /> Loading clients…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.map((r) => (
                <tr key={r.user.id} className="border-b border-border last:border-0 hover:bg-navy-50/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="size-9 shrink-0 rounded-full bg-linear-to-br from-navy-700 to-navy-900 text-white grid place-items-center text-xs font-semibold">
                        {r.company !== "—" ? r.company.slice(0, 2).toUpperCase() : initials(r.user.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-ink truncate flex items-center gap-1.5">
                          <Building2 className="size-3.5 text-faint shrink-0" /> {r.company}
                        </p>
                        <p className="text-xs text-muted truncate">
                          {r.user.name}{r.roleOnProject ? ` · ${r.roleOnProject}` : ""}{r.country ? ` · ${r.country}` : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted truncate">{r.user.email}</td>
                  <td className="px-3 py-3">
                    {r.projectName ? (
                      <span className="text-ink">{r.projectName}</span>
                    ) : (
                      <span className="text-faint">Unassigned</span>
                    )}
                  </td>
                  <td className="px-3 py-3"><Badge tone={statusTone[r.user.status]} dot>{r.user.status}</Badge></td>
                  <td className="px-3 py-3 text-muted whitespace-nowrap">{r.createdAt ? formatDate(r.createdAt) : "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button className="btn btn-ghost px-2 h-8" onClick={() => setEditTarget(r)} title="Edit client" aria-label="Edit client">
                        <Pencil className="size-4 text-muted" />
                      </button>
                      <button className="btn btn-ghost px-2 h-8 text-error hover:bg-error-bg" onClick={() => setDeleteTarget(r)} title="Remove client" aria-label="Remove client">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted">
                    {rows.length === 0 ? "No clients registered yet. Click “Register client” to add one." : "No clients match your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {editTarget && (
        <EditClientModal
          user={editTarget.user}
          profile={editTarget.profile}
          onClose={() => setEditTarget(null)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove client?"
        message={deleteTarget ? `${deleteTarget.company !== "—" ? deleteTarget.company : deleteTarget.user.name} and their login will be removed. This can't be undone.` : ""}
        confirmLabel="Remove client"
        onConfirm={() => {
          if (deleteTarget) {
            deleteUser.mutate(deleteTarget.user.id);
            deleteProfile.mutate(deleteTarget.user.id);
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
