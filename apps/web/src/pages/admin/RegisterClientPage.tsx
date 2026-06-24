import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { Card, CardHeader } from "@/components/ui/Card";
import { useCreateUser, useUsersQuery } from "@/hooks/useUsers";
import { CLIENT_ROLE } from "@/lib/roles";
import { clientProfileStore } from "@/store/clientProfiles";
import type { ManagedUser } from "@/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES_ON_PROJECT = ["Contractor", "Subcontractor", "Consultant", "Employer"];

/** Readable auto-generated password (omits ambiguous characters). */
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * Register Client — admin-side onboarding form. The admin (already logged in)
 * captures the client company's full details, creates the Client-role login
 * account, optionally assigns them to a project, and is shown the temporary
 * password to share. The client then signs in at /login and is routed to the
 * separate /client portal.
 */
export function RegisterClientPage() {
  const navigate = useNavigate();
  const createUser = useCreateUser();
  const { data: users = [] } = useUsersQuery();

  // ── Company ──
  const [company, setCompany] = useState("");
  const [crNo, setCrNo] = useState("");
  const [country, setCountry] = useState("");
  const [roleOnProject, setRoleOnProject] = useState("Contractor");

  // ── Primary contact + login ──
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // ── Password ──
  const [autoGen, setAutoGen] = useState(true);
  const [genPassword, setGenPassword] = useState(() => generatePassword());
  const [manualPassword, setManualPassword] = useState("");

  const [errors, setErrors] = useState<{ company?: string; contactName?: string; email?: string }>({});
  const [submitError, setSubmitError] = useState("");
  const [copied, setCopied] = useState(false);

  // Success state — keeps the temp password visible so the admin can share it.
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null);

  const pending = createUser.isPending;

  function resetForm() {
    setCompany("");
    setCrNo("");
    setCountry("");
    setRoleOnProject("Contractor");
    setContactName("");
    setEmail("");
    setPhone("");
    setAutoGen(true);
    setGenPassword(generatePassword());
    setManualPassword("");
    setErrors({});
    setSubmitError("");
    setCreated(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!company.trim()) next.company = "Company name is required.";
    if (!contactName.trim()) next.contactName = "Contact name is required.";
    if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address.";
    setErrors(next);
    setSubmitError("");
    if (Object.keys(next).length) return;

    const cleanEmail = email.trim().toLowerCase();
    const password = autoGen ? genPassword : manualPassword.trim();
    if (!autoGen && !password) {
      setSubmitError("Enter a password or switch to auto-generate.");
      return;
    }

    // Guard against an email that already belongs to an internal (non-client) user.
    const clash = (users as ManagedUser[]).find((u) => u.email.toLowerCase() === cleanEmail);
    if (clash && clash.role !== CLIENT_ROLE) {
      setSubmitError("That email already belongs to an internal user.");
      return;
    }

    try {
      const user = await createUser.mutateAsync({
        name: contactName.trim(),
        email: cleanEmail,
        password,
        role: CLIENT_ROLE,
        status: "Active",
        phone: phone.trim() || undefined,
      });

      clientProfileStore.add({
        userId: user.id,
        company: company.trim(),
        crNo: crNo.trim() || undefined,
        country: country.trim() || undefined,
        roleOnProject,
        contactName: contactName.trim(),
        email: cleanEmail,
        phone: phone.trim() || undefined,
        createdAt: new Date().toISOString(),
      });

      setCreated({ name: contactName.trim(), email: cleanEmail, password });
    } catch (err) {
      setSubmitError(apiErrorMessage(err, "Could not register the client — is the backend running?"));
    }
  }

  function copyPassword() {
    if (!created) return;
    navigator.clipboard?.writeText(created.password).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  // ── Success view ──
  if (created) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-[26px] leading-tight font-bold text-ink tracking-tight">Client registered</h1>
          <p className="mt-1.5 text-sm text-muted">
            The login account is active. Share these credentials with the client — they sign in at the
            login page and are taken to their client portal.
          </p>
        </div>

        <Card>
          <CardHeader title={created.name} subtitle={company.trim() || undefined} />
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm text-success bg-success-bg rounded-lg px-3 py-2">
              <CheckCircle2 className="size-4" /> Account created. Assign this client to a project from the Projects page.
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-faint uppercase tracking-wide">Login email</p>
                <p className="text-sm font-medium text-ink mt-0.5">{created.email}</p>
              </div>
              <div>
                <p className="text-xs text-faint uppercase tracking-wide">Temporary password</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-sm font-mono font-semibold text-ink bg-navy-50 rounded px-2 py-1">{created.password}</code>
                  <button type="button" className="btn btn-outline px-2 h-8" onClick={copyPassword} title="Copy password">
                    {copied ? <CheckCircle2 className="size-4 text-success" /> : <Copy className="size-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button className="btn btn-outline" onClick={resetForm}>
            <UserPlus className="size-4" /> Register another
          </button>
          <button className="btn btn-primary" onClick={() => navigate("/clients")}>
            Go to Clients
          </button>
        </div>
      </div>
    );
  }

  // ── Form view ──
  return (
    <div>
      <Link to="/clients" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy-700 mb-4">
        <ArrowLeft className="size-4" /> Clients
      </Link>

      <div className="mb-6">
        <h1 className="text-[26px] leading-tight font-bold text-ink tracking-tight">Register a client</h1>
        <p className="mt-1.5 text-sm text-muted">
          Capture the client company's details and create their login. They sign in to the separate
          client portal to upload documents — they never see this admin area.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        {/* Company */}
        <Card>
          <CardHeader title="Company details" subtitle="The client (contractor) organisation" />
          <div className="p-5 space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="label" htmlFor="company">Company name</label>
                <input id="company" className="input" placeholder="e.g. Gulf International Contracting" value={company} onChange={(e) => setCompany(e.target.value)} />
                {errors.company && <p className="mt-1 text-xs text-error">{errors.company}</p>}
              </div>
              <div>
                <label className="label" htmlFor="crNo">Commercial registration (CR) no.</label>
                <input id="crNo" className="input" placeholder="e.g. 1234567" value={crNo} onChange={(e) => setCrNo(e.target.value)} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="label" htmlFor="country">Country</label>
                <input id="country" className="input" placeholder="e.g. Sultanate of Oman" value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="roleOnProject">Role on project</label>
                <select id="roleOnProject" className="input" value={roleOnProject} onChange={(e) => setRoleOnProject(e.target.value)}>
                  {ROLES_ON_PROJECT.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Primary contact + login */}
        <Card>
          <CardHeader title="Primary contact & login" subtitle="Who signs in for the client" />
          <div className="p-5 space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="label" htmlFor="contactName">Contact full name</label>
                <input id="contactName" className="input" placeholder="e.g. Syed Sharfaraz" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                {errors.contactName && <p className="mt-1 text-xs text-error">{errors.contactName}</p>}
              </div>
              <div>
                <label className="label" htmlFor="email">Work email (login)</label>
                <input id="email" type="email" className="input" placeholder="client@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                {errors.email && <p className="mt-1 text-xs text-error">{errors.email}</p>}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="phone">Phone <span className="text-faint">(optional)</span></label>
              <input id="phone" className="input max-w-xs" placeholder="+968 0000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Temporary password</label>
                <label className="inline-flex items-center gap-1.5 text-xs text-muted cursor-pointer">
                  <input type="checkbox" className="size-3.5 accent-navy-700" checked={autoGen} onChange={(e) => setAutoGen(e.target.checked)} />
                  Auto-generate
                </label>
              </div>
              {autoGen ? (
                <div className="flex gap-2 max-w-sm">
                  <input className="input font-mono" value={genPassword} readOnly />
                  <button type="button" className="btn btn-outline px-2" title="Regenerate" onClick={() => setGenPassword(generatePassword())}>
                    <RefreshCw className="size-4" />
                  </button>
                </div>
              ) : (
                <input className="input max-w-sm" type="text" placeholder="Set a password" value={manualPassword} onChange={(e) => setManualPassword(e.target.value)} />
              )}
              <p className="text-xs text-faint mt-1">Shared with the client to sign in. They can change it later.</p>
            </div>
          </div>
        </Card>

        {submitError && <p className="text-sm text-error bg-error-bg rounded-lg px-3 py-2">{submitError}</p>}

        <div className="flex items-center justify-end gap-2">
          <Link to="/clients" className="btn btn-outline">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? <><Loader2 className="size-4 animate-spin" /> Registering…</> : <><Building2 className="size-4" /> Register client</>}
          </button>
        </div>
      </form>
    </div>
  );
}
