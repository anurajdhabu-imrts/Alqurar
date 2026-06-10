import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "@/layout/AppLayout";
import { ClientLayout } from "@/layout/ClientLayout";
import { ProtectedRoute } from "@/layout/ProtectedRoute";
import { ClientRoute, InternalRoute } from "@/layout/roleGuards";
import { ClientDashboardPage } from "@/pages/client/ClientDashboardPage";
import { ClaimDocumentUploadPage } from "@/pages/client/ClaimDocumentUploadPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { DashboardPage } from "@/pages/Dashboard/DashboardPage";
import { EOTClaimsPage } from "@/pages/eot/EOTClaimsPage";
import { NewEOTClaimPage } from "@/pages/eot/NewEOTClaimPage";
import { EOTClaimDetailPage } from "@/pages/eot/EOTClaimDetailPage";
import { ClauseLibraryPage } from "@/pages/eot/ClauseLibraryPage";
import { ContractsPage } from "@/pages/clm/ContractsPage";
import { ContractDetailPage } from "@/pages/clm/ContractDetailPage";
import { ObligationsPage } from "@/pages/clm/ObligationsPage";
import { VariationsPage } from "@/pages/clm/VariationsPage";
import { NoticesPage } from "@/pages/clm/NoticesPage";
import { DisputesPage } from "@/pages/disputes/DisputesPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { UsersPage } from "@/pages/admin/UsersPage";
import { CreateUserPage } from "@/pages/admin/CreateUserPage";
import { RolesPage } from "@/pages/admin/RolesPage";
import { CreateRolePage } from "@/pages/admin/CreateRolePage";
import { useAuthStore } from "@/store/authStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 1000 * 60 * 2 },
  },
});

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);

  // Restore any persisted session before the first protected render.
  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            {/* Client portal — separate layout & sidebar, clients only. */}
            <Route element={<ClientRoute />}>
              <Route element={<ClientLayout />}>
                <Route path="/client" element={<ClientDashboardPage />} />
                <Route path="/client/upload" element={<ClaimDocumentUploadPage />} />
              </Route>
            </Route>

            {/* Internal (admin/staff) area — clients are redirected to /client. */}
            <Route element={<InternalRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/claims" element={<EOTClaimsPage />} />
              <Route path="/claims/new" element={<NewEOTClaimPage />} />
              <Route path="/claims/:ref" element={<EOTClaimDetailPage />} />
              <Route path="/clause-library" element={<ClauseLibraryPage />} />
              <Route path="/contracts" element={<ContractsPage />} />
              <Route path="/contracts/:ref" element={<ContractDetailPage />} />
              <Route path="/obligations" element={<ObligationsPage />} />
              <Route path="/variations" element={<VariationsPage />} />
              <Route path="/notices" element={<NoticesPage />} />
              <Route path="/disputes" element={<DisputesPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/users/new" element={<CreateUserPage />} />
              <Route path="/users/:id/edit" element={<CreateUserPage />} />
              <Route path="/roles" element={<RolesPage />} />
              <Route path="/roles/new" element={<CreateRolePage />} />
              <Route path="/roles/:id/edit" element={<CreateRolePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
