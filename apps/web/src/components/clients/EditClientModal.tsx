import { useState } from "react";
import { Building2, Loader2, X } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { useUpdateUser } from "@/hooks/useUsers";
import { useUpsertClientProfile, type ClientProfile } from "@/store/clientProfiles";
import type { ManagedUser } from "@/types";

const ROLES_ON_PROJECT = ["Contractor", "Subcontractor", "Consultant", "Employer"];
const CLIENT_TYPES = ["Temporary", "Permanent"] as const;

/**
 * Edit a registered client. The login account (name) is updated via the users
 * API; the company details live in the client profile store. Email (the login)
 * is shown read-only.
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
  const [error, setError] = useState("");

  async function onSave() {
    setError("");
    if (!contactName.trim()) return setError("Contact name is required.");
    if (!company.trim()) return setError("Company name is required.");
    try {
      if (contactName.trim() !== user.name) {
        await updateUser.mutateAsync({ id: user.id, patch: { name: contactName.trim() } });
      }
      await upsertProfile.mutateAsync({
        userId: user.id,
        company: company.trim(),
        crNo: crNo.trim() || undefined,
        country: country.trim() || undefined,
        roleOnProject,
        clientType,
        contactName: contactName.trim(),
        email: user.email,
        phone: phone.trim() || undefined,
        projectId: profile?.projectId,
        createdAt: profile?.createdAt ?? new Date().toISOString(),
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save changes — is the backend running?"));
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card w-full max-w-md p-6 shadow-lg max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-ink inline-flex items-center gap-2">
              <Building2 className="size-4.5 text-navy-700" /> Edit client
            </h3>
            <p className="text-xs text-muted mt-0.5">{user.email}</p>
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
        </div>

        {error && <p className="mt-3 text-sm text-error bg-error-bg rounded-md px-3 py-2">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t border-border">
          <button className="btn btn-outline" onClick={onClose} disabled={updateUser.isPending}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={updateUser.isPending}>
            {updateUser.isPending && <Loader2 className="size-4 animate-spin" />}
            {updateUser.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
