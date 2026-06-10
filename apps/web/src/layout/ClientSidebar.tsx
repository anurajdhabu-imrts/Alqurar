import { NavLink } from "react-router-dom";
import { LayoutDashboard, UploadCloud, type LucideIcon } from "lucide-react";
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
  { to: "/client/upload", label: "Claim Document Upload", icon: UploadCloud, permission: "client.documents.upload" },
];

const linkBase =
  "relative group flex items-center gap-3 h-10 px-3 rounded-[10px] text-sm font-medium transition-colors";

function Item({ item, onClose }: { item: NavItem; onClose: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClose}
      className={({ isActive }) =>
        cn(linkBase, isActive ? "bg-navy-50 text-navy-900 font-semibold" : "text-muted hover:bg-navy-50/70 hover:text-navy-900")
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-amber-500" />}
          <Icon
            className={cn("size-[18px] shrink-0", isActive ? "text-navy-700" : "text-faint group-hover:text-navy-700")}
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
          "fixed z-50 inset-y-0 left-0 w-64 bg-card border-r border-border flex flex-col transition-transform",
          "lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Brand */}
        <div className="h-16 shrink-0 flex items-center gap-2.5 px-5 border-b border-border">
          <div className="size-9 shrink-0 rounded-xl bg-linear-to-br from-navy-800 to-navy-950 text-amber-400 grid place-items-center font-extrabold font-display shadow-navy">
            AQ
          </div>
          <div className="leading-tight">
            <p className="font-bold font-display text-[15px] text-navy-900">Al Qarar</p>
            <p className="text-[11px] text-faint">Client Portal</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-4">
          <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">Menu</p>
          <div className="space-y-0.5">
            {visibleItems.map((item) => (
              <Item key={item.to} item={item} onClose={onClose} />
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="shrink-0 px-3 py-3 border-t border-border">
          <p className="px-3 text-[11px] text-faint">Client view · read-only</p>
        </div>
      </aside>
    </>
  );
}
