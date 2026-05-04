import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AppShell } from "./components/layout/AppShell";
import { EmptyState } from "./components/common/EmptyState";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { WorkspaceListPage } from "./pages/WorkspaceListPage";
import { WorkspaceHomePage } from "./pages/WorkspaceHomePage";
import { ChannelPage } from "./pages/ChannelPage";
import { WorkspaceMembersPage } from "./pages/WorkspaceMembersPage";
import { InvitationsPage } from "./pages/InvitationsPage";
import { SearchPage } from "./pages/SearchPage";
import { ProfilePage } from "./pages/ProfilePage";
import { UserMessagesPage } from "./pages/UserMessagesPage";
import { WorkspaceAdminsPage } from "./pages/WorkspaceAdminsPage";

function NotFoundPage() {
  return (
    <div className="p-6">
      <EmptyState title="Page not found" description="The route does not map to a Snickr screen." />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app/workspaces" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Navigate to="/app/workspaces" replace />} />
          <Route path="workspaces" element={<WorkspaceListPage />} />
          <Route path="workspaces/:workspaceId" element={<WorkspaceHomePage />} />
          <Route path="workspaces/:workspaceId/channels/:channelId" element={<ChannelPage />} />
          <Route path="workspaces/:workspaceId/members" element={<WorkspaceMembersPage />} />
          <Route path="workspaces/:workspaceId/invitations" element={<WorkspaceMembersPage />} />
          <Route path="invitations" element={<InvitationsPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="users/:userId/messages" element={<UserMessagesPage />} />
          <Route path="admins" element={<WorkspaceAdminsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
