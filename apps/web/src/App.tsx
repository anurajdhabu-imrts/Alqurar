import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "@/layout/AppLayout";
import { ClientLayout } from "@/layout/ClientLayout";
import { ProtectedRoute } from "@/layout/ProtectedRoute";
import { ClientRoute, InternalRoute } from "@/layout/roleGuards";
import { ClientDashboardPage } from "@/pages/client/ClientDashboardPage";
import { ClaimDocumentUploadPage } from "@/pages/client/ClaimDocumentUploadPage";
import { ClientProposalsPage } from "@/pages/client/ClientProposalsPage";
import { ClientProjectsPage } from "@/pages/client/ClientProjectsPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { ClientPortalPage } from "@/pages/portal/ClientPortalPage";
import { DashboardPage } from "@/pages/Dashboard/DashboardPage";
import { EOTClaimsPage } from "@/pages/eot/EOTClaimsPage";
import { NewEOTClaimPage } from "@/pages/eot/NewEOTClaimPage";
import { EOTClaimDetailPage } from "@/pages/eot/EOTClaimDetailPage";
// Global Clause Library removed — clauses now live inside each project as a tab
// (ProjectWorkspacePage → "Clause Library"). Kept here commented for reference.
// import { ClauseLibraryPage } from "@/pages/eot/ClauseLibraryPage";
import { ContractsPage } from "@/pages/clm/ContractsPage";
import { ContractDetailPage } from "@/pages/clm/ContractDetailPage";
import { ObligationsPage } from "@/pages/clm/ObligationsPage";
import { VariationsPage } from "@/pages/clm/VariationsPage";
import { NoticesPage } from "@/pages/clm/NoticesPage";
import { DisputesPage } from "@/pages/disputes/DisputesPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { UsersPage } from "@/pages/admin/UsersPage";
import { CreateUserPage } from "@/pages/admin/CreateUserPage";
import { ClientsPage } from "@/pages/admin/ClientsPage";
import { RegisterClientPage } from "@/pages/admin/RegisterClientPage";
import { ProjectsPage } from "@/pages/projects/ProjectsPage";
import { CreateProjectPage } from "@/pages/projects/CreateProjectPage";
import { ProposalsPage } from "@/pages/proposals/ProposalsPage";
import { NewProposalPage } from "@/pages/proposals/NewProposalPage";
import { ProposalWorkspacePage } from "@/pages/proposals/ProposalWorkspacePage";
import { ProjectWorkspacePage } from "@/pages/projects/ProjectWorkspacePage";
// Lazy — pulls in the heavy Word/Excel renderers (mammoth, xlsx) only on demand.
const DocumentViewerPage = lazy(() =>
  import("@/pages/projects/DocumentViewerPage").then((m) => ({ default: m.DocumentViewerPage })),
);
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
          {/* Public, passwordless client upload portal (secret link). */}
          <Route path="/portal/:token" element={<ClientPortalPage />} />

          <Route element={<ProtectedRoute />}>
            {/* Client portal — separate layout & sidebar, clients only. */}
            <Route element={<ClientRoute />}>
              <Route element={<ClientLayout />}>
                <Route path="/client" element={<ClientDashboardPage />} />
                <Route path="/client/proposals" element={<ClientProposalsPage />} />
                <Route path="/client/projects" element={<ClientProjectsPage />} />
                <Route path="/client/upload" element={<ClaimDocumentUploadPage />} />
                <Route
                  path="/client/documents/:docId"
                  element={
                    <Suspense fallback={null}>
                      <DocumentViewerPage />
                    </Suspense>
                  }
                />
              </Route>
            </Route>

            {/* Internal (admin/staff) area — clients are redirected to /client. */}
            <Route element={<InternalRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/new" element={<CreateProjectPage />} />
              <Route path="/projects/:id/edit" element={<CreateProjectPage />} />
              <Route path="/projects/:id" element={<ProjectWorkspacePage />} />
              <Route path="/proposals" element={<ProposalsPage />} />
              <Route path="/proposals/new" element={<NewProposalPage />} />
              <Route path="/proposals/:id" element={<ProposalWorkspacePage />} />
              <Route
                path="/documents/:docId"
                element={
                  <Suspense fallback={null}>
                    <DocumentViewerPage />
                  </Suspense>
                }
              />
              <Route path="/claims" element={<EOTClaimsPage />} />
              <Route path="/claims/new" element={<NewEOTClaimPage />} />
              <Route path="/claims/:ref" element={<EOTClaimDetailPage />} />
              {/* Global Clause Library removed — now a per-project tab. */}
              {/* <Route path="/clause-library" element={<ClauseLibraryPage />} /> */}
              <Route path="/contracts" element={<ContractsPage />} />
              <Route path="/contracts/:ref" element={<ContractDetailPage />} />
              <Route path="/obligations" element={<ObligationsPage />} />
              <Route path="/variations" element={<VariationsPage />} />
              <Route path="/notices" element={<NoticesPage />} />
              <Route path="/disputes" element={<DisputesPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/clients/new" element={<RegisterClientPage />} />
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
