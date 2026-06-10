import { useState } from "react";
import { Outlet } from "react-router-dom";
import { ClientSidebar } from "./ClientSidebar";
import { Topbar } from "./Topbar";

export function ClientLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-screen overflow-hidden flex bg-surface">
      <ClientSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto scroll-thin">
          <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-7">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
