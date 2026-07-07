import { useState } from "react";
import { Bell, ChevronDown, LogOut, Menu, Search } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

export function Topbar({
  onMenu,
  onToggleCollapse,
}: {
  onMenu: () => void;
  onToggleCollapse?: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="h-16 shrink-0 bg-card/85 backdrop-blur-md border-b border-border flex items-center gap-3 px-4 sm:px-6 sticky top-0 z-30">
      <button className="btn btn-ghost px-2 lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu className="size-5" />
      </button>
      <button
        className="btn btn-ghost px-2 hidden lg:inline-flex"
        onClick={onToggleCollapse}
        aria-label="Toggle sidebar"
      >
        <Menu className="size-5" />
      </button>

      <div className="relative hidden sm:block w-full max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-faint" />
        <input
          className="input pl-10 rounded-full bg-surface border-transparent focus:bg-white"
          placeholder="Search proposals, projects, clauses…"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-faint bg-card border border-border rounded-md px-1.5 py-0.5">⌘K</kbd>
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <button className="btn btn-ghost px-2 relative" aria-label="Notifications">
          <Bell className="size-5" />
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent ring-2 ring-card" />
        </button>

        <div className="w-px h-7 bg-border mx-1 hidden sm:block" />

        <div className="relative">
          <button
            className="flex items-center gap-2.5 pl-1 sm:pl-1.5 pr-1 py-1 rounded-xl hover:bg-navy-50 transition-colors"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <div className="size-9 rounded-full bg-linear-to-br from-navy-700 to-navy-900 text-white grid place-items-center text-sm font-semibold shadow-navy">
              {user?.initials}
            </div>
            <div className="hidden sm:block leading-tight text-left">
              <p className="text-sm font-semibold text-ink">{user?.name}</p>
              <p className="text-xs text-muted">{user?.role}</p>
            </div>
            <ChevronDown className="size-4 text-faint hidden sm:block" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-56 z-20 card p-1.5 shadow-lg">
                <div className="px-3 py-2.5 border-b border-border mb-1">
                  <p className="text-sm font-semibold text-ink truncate">{user?.name}</p>
                  <p className="text-xs text-muted truncate">{user?.email}</p>
                </div>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-error hover:bg-error-bg transition-colors"
                  onClick={logout}
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
