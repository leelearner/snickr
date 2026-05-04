import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Hash, UserPlus, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "../api/workspaces";
import { channelApi } from "../api/channels";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { MainContent } from "../components/layout/MainContent";
import { InviteWorkspaceUserDialog } from "../components/workspaces/InviteWorkspaceUserDialog";
import { StaleChannelInvitesCard } from "../components/workspaces/StaleChannelInvitesCard";
import { queryKeys } from "../utils/queryKeys";

export function WorkspaceHomePage() {
  const { workspaceId } = useParams();
  const numericWorkspaceId = Number(workspaceId);
  const [inviteOpen, setInviteOpen] = useState(false);
  const workspaceQuery = useQuery({
    queryKey: queryKeys.workspace(numericWorkspaceId),
    queryFn: () => workspaceApi.get(numericWorkspaceId),
    enabled: Number.isFinite(numericWorkspaceId),
  });
  const channelsQuery = useQuery({
    queryKey: queryKeys.channels(numericWorkspaceId),
    queryFn: () => channelApi.list(numericWorkspaceId),
    enabled: Number.isFinite(numericWorkspaceId),
  });

  if (workspaceQuery.isLoading) return <LoadingSpinner />;
  if (workspaceQuery.error) return <MainContent><ErrorState error={workspaceQuery.error} /></MainContent>;

  const workspace = workspaceQuery.data;
  if (!workspace) return null;

  return (
    <MainContent>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-950">{workspace.name}</h1>
            <Badge tone={workspace.myRole === "admin" ? "blue" : "neutral"}>{workspace.myRole}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">{workspace.description ?? "No description"}</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/app/workspaces/${workspace.workspaceId}/members`}>
            <Button variant="secondary" leftIcon={<Users className="h-4 w-4" />}>Members</Button>
          </Link>
          {workspace.myRole === "admin" ? (
            <Button leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>
              Invite user
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-950">Channels</h2>
          {channelsQuery.isLoading ? <LoadingSpinner /> : null}
          {channelsQuery.error ? <ErrorState error={channelsQuery.error} /> : null}
          {channelsQuery.data?.length === 0 ? (
            <EmptyState title="No visible channels" description="Create or join a public channel from the sidebar." />
          ) : (
            <div className="mt-3 divide-y divide-slate-200">
              {channelsQuery.data?.map((channel) => (
                <Link
                  key={channel.channelId}
                  to={`/app/workspaces/${workspace.workspaceId}/channels/${channel.channelId}`}
                  className="flex items-center justify-between py-3 text-sm hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2 font-medium text-slate-900">
                    <Hash className="h-4 w-4 text-slate-500" />
                    {channel.channelName}
                  </span>
                  <Badge>{channel.type}{channel.isMember ? "" : " - not joined"}</Badge>
                </Link>
              ))}
            </div>
          )}
        </section>
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
