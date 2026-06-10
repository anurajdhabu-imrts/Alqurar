import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Save, ShieldCheck } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { useCreateRole, useRolesQuery, useUpdateRole } from "@/hooks/useRoles";
import { usePermissionsQuery } from "@/hooks/usePermission";
import type { Permission } from "@/types";

const PALETTE = ["#0a2540", "#2563eb", "#18794e", "#e8920c", "#c0392b", "#7c3aed", "#0891b2"];

/** Handles both creating a role (/roles/new) and editing one (/roles/:id/edit). */
export function CreateRolePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data: roles = [] } = useRolesQuery();
  const { data: permissionGroups = [], isLoading: permsLoading } = usePermissionsQuery();
  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();

  const editing = id ? roles.find((r) => r.id === id) : undefined;
  const isEdit = Boolean(id);

  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [color, setColor] = useState(editing?.color ?? PALETTE[0]);
  const [selected, setSelected] = useState<Set<string>>(new Set(editing?.permissionIds ?? []));
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");

  if (isEdit && !editing && roles.length > 0) {
    return (
      <div className="text-center py-20">
        <p className="text-lg font-semibold text-ink">Role not found</p>
        <Link to="/roles" className="btn btn-outline mt-4 inline-flex">Back to roles</Link>
      </div>
    );
  }

  const allPermissionIds = permissionGroups.flatMap((g) => g.perms.map((p) => p.id));

  const toggle = (pid: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });

  const toggleGroup = (perms: Permission[]) => {
    const ids = perms.map((p) => p.id);
    const allOn = ids.every((pid) => selected.has(pid));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((pid) => (allOn ? next.delete(pid) : next.add(pid)));
      return next;
    });
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitError("");
    if (!name.trim()) {
      setError("Role name is required.");
      return;
    }
    setError("");
    const payload = {
      name: name.trim(),
      description: description.trim() || "Custom role.",
      color,
      permissionIds: [...selected],
    };
    if (isEdit && id) {
      updateMutation.mutate(
        { id, patch: payload },
        { onSuccess: () => navigate("/roles"), onError: (err) => setSubmitError(apiErrorMessage(err, "Couldn't save changes.")) },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => navigate("/roles"),
        onError: (err) => setSubmitError(apiErrorMessage(err, "Couldn't create role.")),
      });
    }
  }

  return (
    <div className="max-w-6xl">
      <Link to="/roles" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy-700 mb-4">
        <ArrowLeft className="size-4" /> Roles
      </Link>

      <div className="mb-6">
        <h1 className="text-[26px] leading-tight font-bold text-ink tracking-tight">
          {isEdit ? "Edit role" : "Create a role"}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {isEdit ? "Update the role and adjust exactly what its members can access." : "Name the role and select exactly what its members can access."}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <div className="grid items-start gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="lg:sticky lg:top-6">
          <CardHeader title="Role details" />
          <div className="p-5 space-y-5">
            <div>
              <label className="label" htmlFor="rolename">Role name</label>
              <input id="rolename" className="input" placeholder="e.g. Senior Reviewer" value={name} onChange={(e) => setName(e.target.value)} />
              {error && <p className="mt-1 text-xs text-error">{error}</p>}
            </div>
            <div>
              <label className="label" htmlFor="desc">Description</label>
              <input id="desc" className="input" placeholder="What this role is for…" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <span className="label">Colour</span>
              <div className="flex items-center gap-2.5">
                {PALETTE.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn("size-7 rounded-full transition ring-2 ring-offset-2", color === c ? "ring-navy-900" : "ring-transparent")}
                    style={{ backgroundColor: c }}
                    aria-label={`Colour ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Permissions"
            subtitle={permsLoading ? "Loading permissions…" : `${selected.size} of ${allPermissionIds.length} selected`}
            action={<ShieldCheck className="size-4 text-navy-500" />}
          />
          {permsLoading ? (
            <div className="p-8 text-center text-muted text-sm"><Loader2 className="size-4 animate-spin inline mr-2" /> Loading permissions…</div>
          ) : (
            <div className="divide-y divide-border">
              {permissionGroups.map((g) => {
                const allOn = g.perms.every((p) => selected.has(p.id));
                return (
                  <div key={g.module} className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-ink">{g.module}</p>
                      <button type="button" className="text-xs font-semibold text-navy-600 hover:text-navy-800" onClick={() => toggleGroup(g.perms)}>
                        {allOn ? "Clear all" : "Select all"}
                      </button>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {g.perms.map((p) => (
                        <label
                          key={p.id}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm cursor-pointer transition-colors",
                            selected.has(p.id) ? "border-navy-300 bg-navy-50/60" : "border-border hover:border-navy-200",
                          )}
                        >
                          <input type="checkbox" className="size-4 rounded accent-navy-900" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                          <span className="text-ink">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        </div>

        {submitError && <p className="text-sm text-error bg-error-bg rounded-lg px-3 py-2">{submitError}</p>}

        <div className="flex items-center justify-end gap-2">
          <Link to="/roles" className="btn btn-outline">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? (
              <><Loader2 className="size-4 animate-spin" /> Saving…</>
            ) : isEdit ? (
              <><Save className="size-4" /> Save changes</>
            ) : (
              <><ShieldCheck className="size-4" /> Create role</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
