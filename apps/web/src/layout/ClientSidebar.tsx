import { NavLink } from "react-router-dom";
import { FileSignature, FolderKanban, LayoutDashboard, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserPermissions } from "@/hooks/usePermission";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** If set, the item is only shown when the client holds this permission. */
  permission?: string;
}

const items: NavItem[] = [
  { to: "/client", label: "Dashboard", icon: LayoutDashboard, end: true, permission: "client.dashboard" },
  { to: "/client/proposals", label: "Proposal", icon: FileSignature, permission: "client.dashboard" },
  { to: "/client/projects", label: "Projects", icon: FolderKanban, permission: "client.documents.upload" },
];

const linkBase =
  "relative group flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-medium transition-all duration-150";

function Item({ item, onClose }: { item: NavItem; onClose: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClose}
      className={({ isActive }) =>
        cn(
          linkBase,
          isActive
            ? "bg-emerald-500/15 text-white font-semibold"
            : "text-white/65 hover:bg-white/[0.06] hover:text-white",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-emerald-400 shadow-[0_0_10px_rgba(56,189,120,0.6)]" />
          )}
          <Icon
            className={cn(
              "size-[18px] shrink-0 transition-colors",
              isActive ? "text-emerald-300" : "text-white/45 group-hover:text-white/85",
            )}
            strokeWidth={2}
          />
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

export function ClientSidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const granted = useUserPermissions();
  const visibleItems = items.filter((i) => !i.permission || granted.includes(i.permission));

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-navy-950/40 backdrop-blur-sm lg:hidden transition-opacity",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed z-50 inset-y-0 left-0 w-64 flex flex-col transition-transform",
          "bg-linear-to-b from-navy-900 via-navy-900 to-navy-950 border-r border-white/5",
          "lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Brand */}
        <div className="h-16 shrink-0 flex items-center gap-2.5 px-5 border-b border-white/5">
          <div className="size-9 shrink-0 rounded-xl bg-linear-to-br from-navy-600 to-navy-800 ring-1 ring-inset ring-gold-400/40 grid place-items-center font-extrabold font-display shadow-navy">
            <span className="bg-linear-to-br from-emerald-300 to-white bg-clip-text text-transparent">AQ</span>
          </div>
          <div className="leading-tight">
            <p className="font-bold font-display text-[15px] text-white">Al Qarar</p>
            <p className="text-[11px] text-emerald-300/80">Client Portal</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-4">
          <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Menu</p>
          <div className="space-y-0.5">
            {visibleItems.map((item) => (
              <Item key={item.to} item={item} onClose={onClose} />
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="shrink-0 px-3 py-3 border-t border-white/5">
          <p className="px-3 text-[11px] text-white/30">Client view · read-only</p>
        </div>
      </aside>
    </>
  );
}
