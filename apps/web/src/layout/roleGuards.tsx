import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { isClientUser } from "@/lib/roles";

/**
 * Wraps the internal (admin/staff) area. Clients are bounced to the client
 * portal so they never see the admin layout. Login keeps navigating to "/";
 * this guard handles the role-based redirect centrally.
 */
export function InternalRoute() {
  const user = useAuthStore((s) => s.user);
  if (isClientUser(user)) return <Navigate to="/client" replace />;
  return <Outlet />;
}

/** Wraps the client portal. Internal users are redirected back to "/". */
export function ClientRoute() {
  const user = useAuthStore((s) => s.user);
  if (!isClientUser(user)) return <Navigate to="/" replace />;
  return <Outlet />;
}
