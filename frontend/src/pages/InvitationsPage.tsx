import { Hash, Inbox, LayoutGrid } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { channelApi } from "../api/channels";
import { workspaceApi } from "../api/workspaces";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { MainContent } from "../components/layout/MainContent";
import { ChannelInvitationCard } from "../components/invitations/ChannelInvitationCard";
import { WorkspaceInvitationCard } from "../components/invitations/WorkspaceInvitationCard";
import { queryKeys } from "../utils/queryKeys";

export function InvitationsPage() {
  const workspaceInvites = useQuery({
    queryKey: queryKeys.workspaceInvitations,
    queryFn: workspaceApi.listMyInvitations,
  });
  const channelInvites = useQuery({
    queryKey: queryKeys.channelInvitations,
    queryFn: channelApi.listMyInvitations,
  });

  const loading = workspaceInvites.isLoading || channelInvites.isLoading;
  const empty =
    (workspaceInvites.data?.length ?? 0) === 0 && (channelInvites.data?.length ?? 0) === 0;
  const totalCount =
    (workspaceInvites.data?.length ?? 0) + (channelInvites.data?.length ?? 0);

  return (
    <MainContent>
      <div className="flex items-center gap-3">
        <Inbox className="h-6 w-6 text-slate-700" />
        <div>
          <h1 className="text-xl font-semibold text-slate-950">Invitations</h1>
          <p className="text-sm text-slate-500">
            {totalCount > 0 ? `${totalCount} pending` : "Pending workspace and channel invites land here."}
          </p>
        </div>
      </div>
      <div className="mt-6 space-y-6">
        {loading ? <LoadingSpinner /> : null}
        {workspaceInvites.error ? <ErrorState error={workspaceInvites.error} /> : null}
        {channelInvites.error ? <ErrorState error={channelInvites.error} /> : null}
        {!loading && empty ? (
          <EmptyState title="No pending invitations" description="Accepted or declined invitations disappear from this list." />
        ) : null}
        {(workspaceInvites.data?.length ?? 0) > 0 ? (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <LayoutGrid className="h-3.5 w-3.5" />
              Workspace invitations
            </h2>
            <div className="space-y-2">
              {workspaceInvites.data?.map((invitation) => (
                <WorkspaceInvitationCard key={invitation.invitationId} invitation={invitation} />
              ))}
            </div>
          </section>
        ) : null}
        {(channelInvites.data?.length ?? 0) > 0 ? (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Hash className="h-3.5 w-3.5" />
              Channel invitations
            </h2>
            <div className="space-y-2">
              {channelInvites.data?.map((invitation) => (
                <ChannelInvitationCard key={invitation.invitationId} invitation={invitation} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </MainContent>
  );
}
