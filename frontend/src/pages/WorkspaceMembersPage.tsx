import { useState } from "react";
import { useParams } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "../api/workspaces";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/common/Button";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { MainContent } from "../components/layout/MainContent";
import { InviteWorkspaceUserDialog } from "../components/workspaces/InviteWorkspaceUserDialog";
import { MemberRow } from "../components/workspaces/MemberRow";
import { StaleChannelInvitesCard } from "../components/workspaces/StaleChannelInvitesCard";
import { queryKeys } from "../utils/queryKeys";

export function WorkspaceMembersPage() {
  const { workspaceId } = useParams();
  const numericWorkspaceId = Number(workspaceId);
  const [inviteOpen, setInviteOpen] = useState(false);
  const { user } = useAuth();
  const query = useQuery({
    queryKey: queryKeys.workspace(numericWorkspaceId),
    queryFn: () => workspaceApi.get(numericWorkspaceId),
    enabled: Number.isFinite(numericWorkspaceId),
  });

  if (query.isLoading) return <LoadingSpinner />;
  if (query.error) return <MainContent><ErrorState error={query.error} /></MainContent>;
  const workspace = query.data;
  if (!workspace) return null;
  const canManage = workspace.myRole === "admin";

  return (
    <MainContent>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-950">{workspace.name} members</h1>
          <p className="mt-1 text-sm text-slate-500">
            Members can view this page. Admin controls appear only for workspace admins.
          </p>
        </div>
        {canManage ? (
          <Button leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>
            Invite user
          </Button>
        ) : null}
      </div>
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="divide-y divide-slate-200">
          {workspace.members.map((member) => (
            <MemberRow
              key={member.userId}
              workspaceId={workspace.workspaceId}
              member={member}
              canManage={canManage}
              currentUserId={user?.userId}
            />
          ))}
        </div>
      </section>
      <div className="mt-4">
        <StaleChannelInvitesCard workspaceId={workspace.workspaceId} />
      </div>
      <InviteWorkspaceUserDialog
        workspaceId={workspace.workspaceId}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />
    </MainContent>
  );
}
