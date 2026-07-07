import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, FileSearch, Gavel, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { useAuthStore } from "@/store/authStore";

const features = [
  { icon: Gavel, text: "Delay events extracted from your documents with AI, clause-cited" },
  { icon: FileSearch, text: "Each project's contract clauses mapped to its entitlement basis" },
  { icon: ShieldCheck, text: "Every AI output traceable to source — arbitration-ready" },
];

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState("claims@alqarar.ae");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, "Sign in failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-linear-to-br from-navy-800 via-navy-900 to-navy-950 text-white p-12 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute bottom-0 -left-20 size-80 rounded-full bg-gold-500/15 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="size-11 rounded-xl bg-linear-to-br from-navy-600 to-navy-800 ring-1 ring-inset ring-gold-400/40 grid place-items-center font-extrabold font-display text-lg">
            <span className="bg-linear-to-br from-emerald-300 to-white bg-clip-text text-transparent">AQ</span>
          </div>
          <div>
            <p className="font-bold font-display text-lg leading-tight">Al Qarar</p>
            <p className="text-sm text-emerald-300/80">Analyse. Advise. Achieve.</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold font-display leading-snug">
            AI-powered intelligence for construction claims &amp; disputes.
          </h2>
          <p className="mt-4 text-navy-200">
            Purpose-built for FIDIC &amp; NEC contracts — from delay-event extraction and
            clause libraries to costed client proposals.
          </p>
          <ul className="mt-8 space-y-4">
            {features.map((f) => (
              <li key={f.text} className="flex items-start gap-3">
                <span className="size-9 shrink-0 rounded-lg bg-white/10 ring-1 ring-white/15 grid place-items-center backdrop-blur-sm">
                  <f.icon className="size-[18px] text-emerald-400" strokeWidth={2} />
                </span>
                <span className="text-sm text-navy-100 pt-1.5">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-navy-400">
          Confidential · Al Qarar Management Solutions LLC
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="size-10 rounded-xl bg-linear-to-br from-navy-700 to-navy-900 ring-1 ring-inset ring-gold-400/40 text-emerald-300 grid place-items-center font-extrabold font-display">
              AQ
            </div>
            <p className="font-bold font-display text-lg">Al Qarar</p>
          </div>

          <h1 className="text-2xl font-bold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Welcome back. Access your claims workspace.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="label" htmlFor="email">Work email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
                <input
                  id="email"
                  type="email"
                  className="input pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
                <input
                  id="password"
                  type="password"
                  className="input pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-error bg-error-bg rounded-md px-3 py-2">{error}</p>
            )}

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  Sign in <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-xs text-faint text-center">
            Demo build — any credentials work. Prefilled for convenience.
          </p>
        </div>
      </div>
    </div>
  );
}
