import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Save, UserPlus } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { Card, CardHeader } from "@/components/ui/Card";
import { useCreateUser, useUpdateUser, useUsersQuery } from "@/hooks/useUsers";
import { useRolesQuery } from "@/hooks/useRoles";
import type { UserRole, UserStatus } from "@/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Handles both creating a user (/users/new) and editing one (/users/:id/edit). */
export function CreateUserPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data: users = [] } = useUsersQuery();
  const { data: roles = [] } = useRolesQuery();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  const editing = id ? users.find((u) => u.id === id) : undefined;
  const isEdit = Boolean(id);

  const [name, setName] = useState(editing?.name ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [role, setRole] = useState<UserRole>(editing?.role ?? "Claims Manager");
  const [status, setStatus] = useState<UserStatus>(editing?.status ?? "Invited");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [submitError, setSubmitError] = useState("");

  if (isEdit && !editing && users.length > 0) {
    return (
      <div className="text-center py-20">
        <p className="text-lg font-semibold text-ink">User not found</p>
        <Link to="/users" className="btn btn-outline mt-4 inline-flex">Back to users</Link>
      </div>
    );
  }

  const pending = createMutation.isPending || updateMutation.isPending;

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Full name is required.";
    if (!EMAIL_RE.test(email)) next.email = "Enter a valid email address.";
    setErrors(next);
    setSubmitError("");
    if (Object.keys(next).length) return;

    const payload = { name: name.trim(), email: email.trim().toLowerCase(), role, status };

    if (isEdit && id) {
      updateMutation.mutate(
        { id, patch: payload },
        {
          onSuccess: () => navigate("/users"),
          onError: (err) => setSubmitError(apiErrorMessage(err, "Couldn't save changes.")),
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => navigate("/users"),
        onError: (err) => setSubmitError(apiErrorMessage(err, "Couldn't create user.")),
      });
    }
  }

  return (
    <div className="max-w-2xl">
      <Link to="/users" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy-700 mb-4">
        <ArrowLeft className="size-4" /> Users
      </Link>

      <div className="mb-6">
        <h1 className="text-[26px] leading-tight font-bold text-ink tracking-tight">
          {isEdit ? "Edit user" : "Invite a user"}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {isEdit
            ? "Update this team member's details and access."
            : "Add a team member and assign their role. Invited users receive an email to set a password."}
        </p>
      </div>

      <form onSubmit={submit}>
        <Card>
          <CardHeader title="User details" />
          <div className="p-5 space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="label" htmlFor="name">Full name</label>
                <input id="name" className="input" placeholder="e.g. Sara Khan" value={name} onChange={(e) => setName(e.target.value)} />
                {errors.name && <p className="mt-1 text-xs text-error">{errors.name}</p>}
              </div>
              <div>
                <label className="label" htmlFor="email">Work email</label>
                <input id="email" type="email" className="input" placeholder="name@alqarar.ae" value={email} onChange={(e) => setEmail(e.target.value)} />
                {errors.email && <p className="mt-1 text-xs text-error">{errors.email}</p>}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="role">Role</label>
              <select id="role" className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                {roles.map((r) => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-muted">{roles.find((r) => r.name === role)?.description}</p>
            </div>

            {isEdit ? (
              <div>
                <label className="label" htmlFor="status">Status</label>
                <select id="status" className="input max-w-xs" value={status} onChange={(e) => setStatus(e.target.value as UserStatus)}>
                  {(["Active", "Invited", "Suspended"] as UserStatus[]).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <span className="label">Access on creation</span>
                <div className="grid sm:grid-cols-2 gap-3">
                  {(["Invited", "Active"] as UserStatus[]).map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setStatus(s)}
                      className={
                        "text-left rounded-xl border p-3.5 transition-colors " +
                        (status === s ? "border-navy-500 bg-navy-50 ring-1 ring-navy-500/30" : "border-border-strong hover:border-navy-300")
                      }
                    >
                      <p className="text-sm font-semibold text-ink">{s === "Invited" ? "Send invite" : "Activate now"}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {s === "Invited" ? "User sets their own password via email." : "Account is active immediately."}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {submitError && <p className="text-sm text-error bg-error-bg rounded-lg px-3 py-2">{submitError}</p>}
          </div>
        </Card>

        <div className="flex items-center justify-end gap-2 mt-5">
          <Link to="/users" className="btn btn-outline">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? (
              <><Loader2 className="size-4 animate-spin" /> Saving…</>
            ) : isEdit ? (
              <><Save className="size-4" /> Save changes</>
            ) : (
              <><UserPlus className="size-4" /> {status === "Invited" ? "Send invite" : "Create user"}</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
