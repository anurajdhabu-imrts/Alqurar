import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useDeleteRole, useRolesQuery } from "@/hooks/useRoles";
import { useUsersQuery } from "@/hooks/useUsers";
import { usePermissionsQuery } from "@/hooks/usePermission";
import type { Role } from "@/types";

export function RolesPage() {
  const { data: roles = [], isLoading, isError, error: queryError } = useRolesQuery();
  const { data: users = [] } = useUsersQuery();
  const { data: permissionGroups = [] } = usePermissionsQuery();
  const deleteMutation = useDeleteRole();

  const [confirmRole, setConfirmRole] = useState<Role | null>(null);
  const [actionError, setActionError] = useState("");

  const memberCount = (name: string) => users.filter((u) => u.role === name).length;
  const total = permissionGroups.reduce((s, g) => s + g.perms.length, 0);

  function removeRole(id: string) {
    setActionError("");
    deleteMutation.mutate(id, {
      onError: (err) => setActionError(apiErrorMessage(err, "Couldn't delete role.")),
    });
  }

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Define what each role can see and do. Built-in roles cover common workflows; create custom roles for bespoke access."
        actions={
          <Link to="/roles/new" className="btn btn-primary">
            <Plus className="size-4" /> Create role
          </Link>
        }
      />

      {(isError || actionError) && (
        <p className="mb-4 text-sm text-error bg-error-bg rounded-lg px-3 py-2">
          {actionError || apiErrorMessage(queryError, "Couldn't load roles — is the backend running?")}
        </p>
      )}

      {isLoading && roles.length === 0 ? (
        <div className="card p-12 text-center text-muted">
          <Loader2 className="size-4 animate-spin inline mr-2" /> Loading roles…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((r) => (
            <div key={r.id} className="card card-hover overflow-hidden flex flex-col">
              <div className="h-1.5" style={{ backgroundColor: r.color }} />
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="size-9 rounded-xl grid place-items-center" style={{ backgroundColor: `${r.color}1a`, color: r.color }}>
                      <ShieldCheck className="size-5" strokeWidth={2} />
                    </span>
                    <div>
                      <p className="font-semibold font-display text-ink leading-tight">{r.name}</p>
                      <p className="text-[11px] text-faint">{r.system ? "Built-in role" : "Custom role"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 -mr-1">
                    <Link to={`/roles/${r.id}/edit`} className="btn btn-ghost px-2 h-8 text-faint hover:text-navy-700" aria-label={`Edit ${r.name}`}>
                      <Pencil className="size-4" />
                    </Link>
                    <button
                      className="btn btn-ghost px-2 h-8 text-faint hover:text-error"
                      onClick={() => setConfirmRole(r)}
                      aria-label={`Delete ${r.name}`}
                      disabled={r.system}
                      title={r.system ? "Built-in roles cannot be deleted" : undefined}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                <p className="mt-3 text-sm text-muted flex-1">{r.description}</p>

                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <Users className="size-4 text-faint" />
                    <b className="text-ink font-semibold">{memberCount(r.name)}</b> members
                  </span>
                  <span className="text-muted">
                    <b className="text-ink font-semibold tabular-nums">{r.permissionIds.length}</b>
                    {total > 0 && <span className="text-faint">/{total}</span>} permissions
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmRole !== null}
        title="Delete role?"
        message={
          confirmRole
            ? `${memberCount(confirmRole.name)} member(s) have the “${confirmRole.name}” role and will lose its access.`
            : ""
        }
        confirmLabel="Delete role"
        onConfirm={() => {
          if (confirmRole) removeRole(confirmRole.id);
          setConfirmRole(null);
        }}
        onCancel={() => setConfirmRole(null)}
      />
    </>
  );
}
