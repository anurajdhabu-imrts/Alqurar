import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { Card, CardHeader } from "@/components/ui/Card";
import { useCreateUser, useUsersQuery } from "@/hooks/useUsers";
import { CLIENT_ROLE } from "@/lib/roles";
import { useUpsertClientProfile } from "@/store/clientProfiles";
import type { ManagedUser } from "@/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES_ON_PROJECT = ["Contractor", "Subcontractor", "Consultant", "Employer"];
const CLIENT_TYPES = ["Temporary", "Permanent"] as const;

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
  const upsertProfile = useUpsertClientProfile();
  const { data: users = [] } = useUsersQuery();

  // ── Company ──
  const [company, setCompany] = useState("");
  const [crNo, setCrNo] = useState("");
  const [country, setCountry] = useState("");
  const [roleOnProject, setRoleOnProject] = useState("Contractor");
  // New clients start as Temporary; an admin can promote to Permanent here or later.
  const [clientType, setClientType] = useState<(typeof CLIENT_TYPES)[number]>("Temporary");

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
  const [linkCopied, setLinkCopied] = useState(false);

  // Success state — keeps the upload link (and temp password) visible to share.
  const [created, setCreated] = useState<{ name: string; email: string; password: string; link: string } | null>(null);

  const pending = createUser.isPending;

  function resetForm() {
    setCompany("");
    setCrNo("");
    setCountry("");
    setRoleOnProject("Contractor");
    setClientType("Temporary");
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

      const profile = await upsertProfile.mutateAsync({
        userId: user.id,
        company: company.trim(),
        crNo: crNo.trim() || undefined,
        country: country.trim() || undefined,
        roleOnProject,
        clientType,
        contactName: contactName.trim(),
        email: cleanEmail,
        phone: phone.trim() || undefined,
        createdAt: new Date().toISOString(),
      });

      // The full link is built server-side (from FRONTEND_URL) — use it as-is.
      setCreated({ name: contactName.trim(), email: cleanEmail, password, link: profile.portalLink ?? "" });
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

  function copyLink() {
    if (!created?.link) return;
    navigator.clipboard?.writeText(created.link).then(
      () => {
        setLinkCopied(true);
        window.setTimeout(() => setLinkCopied(false), 1500);
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
            Share the upload link below with the client. They open it — no login needed — and upload their
            documents straight into the project.
          </p>
        </div>

        <Card>
          <CardHeader title={created.name} subtitle={company.trim() || undefined} />
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-2 text-sm text-success bg-success-bg rounded-lg px-3 py-2">
              <CheckCircle2 className="size-4" /> Client created. Assign them to a project from the Projects page so they can upload.
            </div>

            {/* ── Upload link (primary — passwordless access) ── */}
            <div>
              <p className="text-xs text-faint uppercase tracking-wide flex items-center gap-1.5">
                <Link2 className="size-3.5" /> Client upload link
              </p>
              {created.link ? (
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 min-w-0 truncate text-sm font-mono text-navy-800 bg-navy-50 rounded-lg px-3 py-2">
                    {created.link}
                  </code>
                  <button type="button" className="btn btn-primary px-3 h-9 shrink-0" onClick={copyLink} title="Copy link">
                    {linkCopied ? <><CheckCircle2 className="size-4" /> Copied</> : <><Copy className="size-4" /> Copy link</>}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted mt-1">Link unavailable — reopen the client from the Clients page to copy it.</p>
              )}
              <p className="text-xs text-faint mt-1.5">
                Send this to <span className="font-medium text-muted">{created.email}</span>. Anyone with the link can upload, so share it only with the client.
              </p>
            </div>

            {/* ── Optional login (kept for clients who prefer to sign in) ── */}
            <details className="rounded-lg border border-border px-3 py-2">
              <summary className="text-xs font-medium text-muted cursor-pointer">Optional login credentials</summary>
              <div className="grid sm:grid-cols-2 gap-4 mt-3">
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
            </details>
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
            <div>
              <label className="label" htmlFor="clientType">Client type</label>
              <select
                id="clientType"
                className="input max-w-xs"
                value={clientType}
                onChange={(e) => setClientType(e.target.value as (typeof CLIENT_TYPES)[number])}
              >
                {CLIENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <p className="text-xs text-faint mt-1">
                New clients are <span className="font-medium text-muted">Temporary</span> (document upload only).
                Promote to <span className="font-medium text-muted">Permanent</span> later to unlock the full portal.
              </p>
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
