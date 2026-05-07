import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LogOut, Trash2, UserPlus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workspaceApi } from "../api/workspaces";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/common/Button";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { MainContent } from "../components/layout/MainContent";
import { InviteWorkspaceUserDialog } from "../components/workspaces/InviteWorkspaceUserDialog";
import { MemberRow } from "../components/workspaces/MemberRow";
import { StaleChannelInvitesCard } from "../components/workspaces/StaleChannelInvitesCard";
import { errorMessage } from "../utils/format";
import { queryKeys } from "../utils/queryKeys";

export function WorkspaceMembersPage() {
  const { workspaceId } = useParams();
  const numericWorkspaceId = Number(workspaceId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [danger, setDanger] = useState("");
  const { user } = useAuth();
  const query = useQuery({
    queryKey: queryKeys.workspace(numericWorkspaceId),
    queryFn: () => workspaceApi.get(numericWorkspaceId),
    enabled: Number.isFinite(numericWorkspaceId),
  });

  const leaveMutation = useMutation({
    mutationFn: () => workspaceApi.removeMember(numericWorkspaceId, user!.userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      navigate("/app/workspaces");
    },
    onError: (err) => setDanger(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => workspaceApi.delete(numericWorkspaceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      navigate("/app/workspaces");
    },
    onError: (err) => setDanger(errorMessage(err)),
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
        <div className="flex gap-2">
          <Button
            variant="ghost"
            leftIcon={<LogOut className="h-4 w-4" />}
            onClick={() => {
              setDanger("");
              if (window.confirm(`Leave ${workspace.name}? You will lose access to its channels and messages.`)) {
                leaveMutation.mutate();
              }
            }}
            isLoading={leaveMutation.isPending}
          >
            Leave workspace
          </Button>
          {canManage ? (
            <Button leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>
              Invite user
            </Button>
          ) : null}
        </div>
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
      {canManage ? (
        <section className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-semibold text-red-800">Danger zone</h2>
          <p className="mt-1 text-xs text-red-700">
            Deleting the workspace removes its channels, messages, and memberships for everyone. This cannot be undone.
          </p>
          <Button
            variant="danger"
            className="mt-3"
            leftIcon={<Trash2 className="h-4 w-4" />}
            isLoading={deleteMutation.isPending}
            onClick={() => {
              setDanger("");
              if (window.confirm(`Delete ${workspace.name} for everyone? This cannot be undone.`)) {
                deleteMutation.mutate();
              }
            }}
          >
            Delete workspace
          </Button>
        </section>
      ) : null}
      {danger ? <p className="mt-3 text-sm text-red-700">{danger}</p> : null}
      <InviteWorkspaceUserDialog
        workspaceId={workspace.workspaceId}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />
    </MainContent>
  );
}
