import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar:collapsed") === "1",
  );

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("sidebar:collapsed", next ? "1" : "0");
      return next;
    });

  return (
    <div className="h-full flex bg-surface">
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenu={() => setMobileOpen(true)} onToggleCollapse={toggleCollapsed} />
        <main className="flex-1 overflow-y-auto scroll-thin">
          <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-7">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
