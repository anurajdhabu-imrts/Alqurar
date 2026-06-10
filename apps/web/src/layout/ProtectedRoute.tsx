import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);

  // initialize() runs in App before paint; while it resolves (verifying any
  // saved token against the backend) show a light placeholder, not a blank page.
  if (status === "idle") {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted">
        Loading…
      </div>
    );
  }
  if (status !== "authenticated") return <Navigate to="/login" replace />;

  return <Outlet />;
}
