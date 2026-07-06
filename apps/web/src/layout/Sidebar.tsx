import { NavLink } from "react-router-dom";
import {
  // ── Icons for sections hidden for now (uncomment with their nav items) ──
  // BellRing,
  // BookText,
  // FileText,
  // Gavel,
  // GitBranch,
  // ListChecks,
  Building2,
  FileSignature,
  FolderKanban,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserPermissions } from "@/hooks/usePermission";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  end?: boolean;
  /** If set, the item is only shown when the user holds this permission. */
  permission?: string;
}

const sections: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/proposals", label: "Proposals", icon: FileSignature },
      { to: "/projects", label: "Projects", icon: FolderKanban },
    ],
  },
  // ── Hidden for now (backend pending) — uncomment to restore ──────────────
  // {
  //   heading: "EOT Claims",
  //   items: [
  //     { to: "/claims", label: "Claims Register", icon: Gavel },
  //     { to: "/clause-library", label: "Clause Library", icon: BookText },
  //   ],
  // },
  // {
  //   heading: "Contract Lifecycle",
  //   items: [
  //     { to: "/contracts", label: "Contracts", icon: FileText },
  //     { to: "/obligations", label: "Obligations", icon: ListChecks },
  //     { to: "/variations", label: "Variations", icon: GitBranch },
  //     { to: "/notices", label: "Notice Timeline", icon: BellRing },
  //   ],
  // },
  {
    heading: "Administration",
    items: [
      { to: "/clients", label: "Clients", icon: Building2, permission: "admin.users" },
      { to: "/users", label: "Users", icon: Users, permission: "admin.users" },
      { to: "/roles", label: "Roles & Permissions", icon: ShieldCheck, permission: "admin.roles" },
    ],
  },
];

const linkBase =
  "relative group flex items-center gap-3 h-10 px-3 rounded-[10px] text-sm font-medium transition-colors";

function Item({
  item,
  onClose,
  collapsed,
}: {
  item: NavItem;
  onClose: () => void;
  collapsed?: boolean;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClose}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          linkBase,
          collapsed && "justify-center px-0",
          isActive ? "bg-navy-50 text-navy-900 font-semibold" : "text-muted hover:bg-navy-50/70 hover:text-navy-900",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-amber-500" />}
          <Icon
            className={cn("size-[18px] shrink-0", isActive ? "text-navy-700" : "text-faint group-hover:text-navy-700")}
            strokeWidth={2}
          />
          {!collapsed && <span className="truncate">{item.label}</span>}
          {!collapsed && item.badge && (
            <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar({
  mobileOpen,
  onClose,
  collapsed = false,
}: {
  mobileOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
}) {
  const granted = useUserPermissions();
  const visibleSections = sections
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.permission || granted.includes(i.permission)) }))
    .filter((s) => s.items.length > 0);

  // Collapse only applies on desktop; the mobile drawer always shows full width.
  const desktopCollapsed = collapsed;

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
          "fixed z-50 inset-y-0 left-0 w-64 bg-card border-r border-border flex flex-col transition-[transform,width] duration-200",
          "lg:static lg:translate-x-0",
          desktopCollapsed && "lg:w-[72px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "h-16 shrink-0 flex items-center gap-2.5 border-b border-border",
            desktopCollapsed ? "lg:justify-center lg:px-0 px-5" : "px-5",
          )}
        >
          <div className="size-9 shrink-0 rounded-xl bg-linear-to-br from-navy-800 to-navy-950 text-amber-400 grid place-items-center font-extrabold font-display shadow-navy">
            AQ
          </div>
          {!desktopCollapsed && (
            <div className="leading-tight">
              <p className="font-bold font-display text-[15px] text-navy-900">Al Qarar</p>
              <p className="text-[11px] text-faint">Claims Intelligence</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-4 space-y-5">
          {visibleSections.map((section) => (
            <div key={section.heading}>
              {!desktopCollapsed && (
                <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
                  {section.heading}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <Item key={item.to} item={item} onClose={onClose} collapsed={desktopCollapsed} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 px-3 py-3 border-t border-border space-y-1">
          <Item
            item={{ to: "/settings", label: "Settings", icon: Settings }}
            onClose={onClose}
            collapsed={desktopCollapsed}
          />
          {!desktopCollapsed && <p className="px-3 pt-1 text-[11px] text-faint">Phase 1 Beta · v0.1</p>}
        </div>
      </aside>
    </>
  );
}
