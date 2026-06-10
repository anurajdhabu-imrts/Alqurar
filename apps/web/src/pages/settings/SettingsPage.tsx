import { KeyRound, Lock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuthStore } from "@/store/authStore";
import type { UserRole } from "@/types";

const ROLES: { role: UserRole; desc: string }[] = [
  { role: "Administrator", desc: "Full access to all projects, users and platform settings." },
  { role: "Claims Manager", desc: "Create and manage EOT claims, delay events and submissions." },
  { role: "Contract Manager", desc: "Manage contracts, clauses, obligations and variations." },
  { role: "Legal Reviewer", desc: "Review and approve AI-generated outputs and submissions." },
  { role: "Client View", desc: "Read-only access to dashboards and claim status." },
];

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-faint uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-ink mt-0.5">{value}</p>
    </div>
  );
}

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <>
      <PageHeader title="Settings" subtitle="Profile, roles and platform security." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader title="Profile" />
            <div className="p-5 flex items-center gap-4">
              <div className="size-14 rounded-full bg-navy-900 text-white grid place-items-center text-lg font-semibold">
                {user?.initials}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 flex-1">
                <Field label="Name" value={user?.name ?? "—"} />
                <Field label="Email" value={user?.email ?? "—"} />
                <Field label="Role" value={user?.role ?? "—"} />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Roles & access control" subtitle="Role-based access — assigned per user" />
            <ul className="divide-y divide-border">
              {ROLES.map((r) => (
                <li key={r.role} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{r.role}</p>
                    <p className="text-xs text-muted mt-0.5">{r.desc}</p>
                  </div>
                  {user?.role === r.role && <Badge tone="navy">You</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Security" />
            <ul className="p-3">
              {[
                { icon: Lock, text: "AES-256 encryption at rest & in transit" },
                { icon: ShieldCheck, text: "Full audit trail on every action & AI output" },
                { icon: KeyRound, text: "SSO / 2FA (Phase 3)" },
              ].map((s) => (
                <li key={s.text} className="flex items-center gap-3 px-2 py-2.5 text-sm text-ink">
                  <span className="size-8 rounded-lg bg-navy-50 text-navy-700 grid place-items-center">
                    <s.icon className="size-4" />
                  </span>
                  {s.text}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
