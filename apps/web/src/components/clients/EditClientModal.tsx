import { useState } from "react";
import { Building2, Eye, EyeOff, Loader2, X } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { useUpdateUser } from "@/hooks/useUsers";
import { useUpsertClientProfile, type ClientProfile } from "@/store/clientProfiles";
import type { ManagedUser } from "@/types";

const ROLES_ON_PROJECT = ["Contractor", "Subcontractor", "Consultant", "Employer"];
const CLIENT_TYPES = ["Temporary", "Permanent"] as const;

/**
 * Edit a registered client. The login account (name, email, password) is
 * updated via the users API; the company details live in the client profile
 * store. Email is now editable (uniqueness is validated server-side).
 * Password fields are optional — leave blank to keep the existing password.
 */
export function EditClientModal({
  user,
  profile,
  onClose,
}: {
  user: ManagedUser;
  profile?: ClientProfile;
  onClose: () => void;
}) {
  const updateUser = useUpdateUser();
  const upsertProfile = useUpsertClientProfile();

  const [contactName, setContactName] = useState(profile?.contactName ?? user.name);
  const [company, setCompany] = useState(profile?.company ?? "");
  const [crNo, setCrNo] = useState(profile?.crNo ?? "");
  const [country, setCountry] = useState(profile?.country ?? "");
  const [roleOnProject, setRoleOnProject] = useState(profile?.roleOnProject ?? "Contractor");
  const [clientType, setClientType] = useState<(typeof CLIENT_TYPES)[number]>(profile?.clientType ?? "Temporary");
  const [phone, setPhone] = useState(profile?.phone ?? user.phone ?? "");
  const [email, setEmail] = useState(user.email);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");

  async function onSave() {
    setError("");
    if (!contactName.trim()) return setError("Contact name is required.");
    if (!company.trim()) return setError("Company name is required.");
    if (!email.trim()) return setError("Email is required.");

    // Basic email format check
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email.trim())) return setError("Please enter a valid email address.");

    // Password validation (only when a new password is provided)
    if (newPassword || confirmPassword) {
      if (newPassword.length < 6) return setError("Password must be at least 6 characters.");
      if (newPassword !== confirmPassword) return setError("Passwords do not match.");
    }

    try {
      // Build user patch — only include fields that changed
      const userPatch: Record<string, string> = {};
      if (contactName.trim() !== user.name) userPatch.name = contactName.trim();
      if (email.trim().toLowerCase() !== user.email.toLowerCase()) userPatch.email = email.trim();
      if (newPassword) userPatch.password = newPassword;

      if (Object.keys(userPatch).length > 0) {
        await updateUser.mutateAsync({ id: user.id, patch: userPatch });
      }

      await upsertProfile.mutateAsync({
        userId: user.id,
        company: company.trim(),
        crNo: crNo.trim() || undefined,
        country: country.trim() || undefined,
        roleOnProject,
        clientType,
        contactName: contactName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        projectId: profile?.projectId,
        createdAt: profile?.createdAt ?? new Date().toISOString(),
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save changes — is the backend running?"));
    }
  }

  const isSaving = updateUser.isPending;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card w-full max-w-md p-6 shadow-lg max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-ink inline-flex items-center gap-2">
              <Building2 className="size-4.5 text-navy-700" /> Edit client
            </h3>
          </div>
          <button className="btn btn-ghost px-2" onClick={onClose} aria-label="Close"><X className="size-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin -mx-1 px-1 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Company name</label>
            <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">CR no.</label>
              <input className="input" value={crNo} onChange={(e) => setCrNo(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Country</label>
              <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Role on project</label>
              <select className="input" value={roleOnProject} onChange={(e) => setRoleOnProject(e.target.value)}>
                {ROLES_ON_PROJECT.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Phone</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Contact full name</label>
            <input className="input" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Client type</label>
            <select className="input" value={clientType} onChange={(e) => setClientType(e.target.value as (typeof CLIENT_TYPES)[number])}>
              {CLIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <p className="text-xs text-faint mt-1">Promote to Permanent to unlock the full portal (beyond document upload).</p>
          </div>

          {/* ── Login credentials ─────────────────────────────────── */}
          <div className="border-t border-border pt-3 mt-1">
            <p className="text-xs font-semibold text-ink mb-2 uppercase tracking-wide">Login credentials</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Email</label>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@example.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">New password</label>
                  <div className="relative">
                    <input
                      className="input pr-9"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Leave blank to keep"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-muted transition-colors"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      tabIndex={-1}
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Confirm password</label>
                  <div className="relative">
                    <input
                      className="input pr-9"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-muted transition-colors"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-faint">Leave password fields blank to keep the current password.</p>
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-error bg-error-bg rounded-md px-3 py-2">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t border-border">
          <button className="btn btn-outline" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={isSaving}>
            {isSaving && <Loader2 className="size-4 animate-spin" />}
            {isSaving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
