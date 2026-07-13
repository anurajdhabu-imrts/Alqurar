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
  Library,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserPermissions } from "@/hooks/usePermission";
import { useAuthStore } from "@/store/authStore";

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
  {
    heading: "Knowledge",
    items: [
      // The central library of standard contract books (FIDIC, NEC4, …). Distinct
      // from a project's own Clause Library, which lives in the project workspace.
      { to: "/knowledge", label: "Knowledge Center", icon: Library, permission: "contracts.view" },
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
      { to: "/employees", label: "Employees", icon: UserCog, permission: "admin.users" },
      { to: "/users", label: "Users", icon: Users, permission: "admin.users" },
      { to: "/roles", label: "Roles & Permissions", icon: ShieldCheck, permission: "admin.roles" },
    ],
  },
];

const linkBase =
  "relative group flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-medium transition-all duration-150";

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
          {!collapsed && <span className="truncate">{item.label}</span>}
          {!collapsed && item.badge && (
            <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-200">
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
  const user = useAuthStore((s) => s.user);
  const visibleSections = sections
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.permission || granted.includes(i.permission)) }))
    .filter((s) => s.items.length > 0);

  // Collapse only applies on desktop; the mobile drawer always shows full width.
  const desktopCollapsed = collapsed;

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-navy-950/50 backdrop-blur-sm lg:hidden transition-opacity",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed z-50 inset-y-0 left-0 w-64 flex flex-col transition-[transform,width] duration-200",
          "bg-linear-to-b from-navy-900 via-navy-900 to-navy-950 border-r border-white/5",
          "lg:static lg:translate-x-0",
          desktopCollapsed && "lg:w-[74px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "h-16 shrink-0 flex items-center gap-2.5 border-b border-white/5",
            desktopCollapsed ? "lg:justify-center lg:px-0 px-5" : "px-5",
          )}
        >
          <div className="size-9 shrink-0 rounded-xl bg-linear-to-br from-navy-600 to-navy-800 ring-1 ring-inset ring-gold-400/40 text-white grid place-items-center font-extrabold font-display shadow-navy">
            <span className="bg-linear-to-br from-emerald-300 to-white bg-clip-text text-transparent">AQ</span>
          </div>
          {!desktopCollapsed && (
            <div className="leading-tight">
              <p className="font-bold font-display text-[15px] text-white">Al Qarar</p>
              <p className="text-[11px] text-emerald-300/80">Claims Intelligence</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-4 space-y-5">
          {visibleSections.map((section) => (
            <div key={section.heading}>
              {!desktopCollapsed && (
                <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">
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

        {/* Footer — user card + settings */}
        <div className="shrink-0 px-3 py-3 border-t border-white/5 space-y-1.5">
          {user && (
            <div
              className={cn(
                "flex items-center gap-2.5 rounded-xl bg-white/[0.06] border border-white/5",
                desktopCollapsed ? "lg:justify-center lg:p-1.5 p-2.5" : "p-2.5",
              )}
              title={desktopCollapsed ? `${user.name} · ${user.role}` : undefined}
            >
              <div className="size-9 shrink-0 rounded-full bg-linear-to-br from-emerald-500 to-navy-700 ring-1 ring-white/10 text-white grid place-items-center text-xs font-semibold">
                {user.initials}
              </div>
              {!desktopCollapsed && (
                <div className="min-w-0 leading-tight">
                  <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                  <p className="text-[11px] text-white/50 truncate">{user.role}</p>
                </div>
              )}
            </div>
          )}
          <Item
            item={{ to: "/settings", label: "Settings", icon: Settings }}
            onClose={onClose}
            collapsed={desktopCollapsed}
          />
          {!desktopCollapsed && <p className="px-3 pt-1 text-[11px] text-white/25">Phase 1 Beta · v0.1</p>}
        </div>
      </aside>
    </>
  );
}
