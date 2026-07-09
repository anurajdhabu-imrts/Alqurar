import { useState } from "react";
import { Check, Eye, EyeOff, Loader2, Lock, Mail, Settings, UserCircle2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuthStore } from "@/store/authStore";
import { api, apiErrorMessage } from "@/api/client";
import { meApi } from "@/api/auth";

export function ClientSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.login); // we'll re-fetch via /me instead

  // ── Profile fields ──
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  // ── Password fields ──
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ── UI state ──
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim()) return setError("Full name is required.");
    if (!email.trim()) return setError("Email is required.");

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email.trim())) return setError("Please enter a valid email address.");

    // Password validation
    const changingPassword = !!(currentPassword || newPassword || confirmPassword);
    if (changingPassword) {
      if (!currentPassword) return setError("Current password is required to set a new password.");
      if (newPassword.length < 6) return setError("New password must be at least 6 characters.");
      if (newPassword !== confirmPassword) return setError("New passwords do not match.");
    }

    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (name.trim() !== user?.name) payload.name = name.trim();
      if (email.trim().toLowerCase() !== user?.email?.toLowerCase()) payload.email = email.trim();
      if (changingPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      if (Object.keys(payload).length === 0) {
        setSuccess("No changes to save.");
        setSaving(false);
        return;
      }

      await api.patch("/auth/me", payload);

      // Refresh user info in the auth store
      const updated = await meApi();
      const authStore = useAuthStore.getState();
      // Update user in store without re-logging in
      useAuthStore.setState({ user: updated });

      // Reset password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Profile updated successfully.");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save changes — please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-in">
      <PageHeader
        title="Settings"
        subtitle="Manage your profile and security preferences."
      />

      <form onSubmit={onSaveProfile} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Profile card ── */}
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader title="Personal information" subtitle="Update your name and email address" />
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-4 mb-2">
                <div className="size-14 rounded-full bg-linear-to-br from-navy-700 to-navy-900 text-white grid place-items-center text-lg font-semibold shrink-0">
                  {user?.initials}
                </div>
                <div>
                  <p className="font-semibold text-ink">{user?.name}</p>
                  <p className="text-xs text-muted">{user?.email}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Full name</label>
                <div className="relative">
                  <UserCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
                  <input
                    className="input pl-9"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
                  <input
                    className="input pl-9"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* ── Password card ── */}
          <Card>
            <CardHeader title="Change password" subtitle="Enter your current password and choose a new one" />
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Current password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
                  <input
                    className="input pl-9 pr-9"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-muted transition-colors"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    tabIndex={-1}
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  >
                    {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">New password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
                    <input
                      className="input pl-9 pr-9"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-muted transition-colors"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      tabIndex={-1}
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Confirm new password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
                    <input
                      className="input pl-9 pr-9"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-muted transition-colors"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-faint">Leave all password fields blank if you don't want to change your password.</p>
            </div>
          </Card>
        </div>

        {/* ── Sidebar info ── */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Security tips" />
            <ul className="p-3 space-y-1">
              {[
                { icon: Lock, text: "Use a strong, unique password" },
                { icon: Lock, text: "Never share your login credentials" },
                { icon: Settings, text: "Update your email if it changes" },
              ].map((s) => (
                <li key={s.text} className="flex items-center gap-3 px-2 py-2.5 text-sm text-ink">
                  <span className="size-8 rounded-lg bg-navy-50 text-navy-700 grid place-items-center shrink-0">
                    <s.icon className="size-4" />
                  </span>
                  {s.text}
                </li>
              ))}
            </ul>
          </Card>

          {/* Save button + feedback */}
          <div className="space-y-3">
            {error && (
              <p className="text-sm text-error bg-error-bg rounded-lg px-3 py-2">{error}</p>
            )}
            {success && (
              <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-2">
                <Check className="size-4" /> {success}
              </p>
            )}
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={saving}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
