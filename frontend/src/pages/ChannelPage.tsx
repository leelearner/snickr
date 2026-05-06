import { useState } from "react";
import { useParams } from "react-router-dom";
import { Hash, Lock, MessageSquare, UserPlus, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { channelApi } from "../api/channels";
import { messageApi } from "../api/messages";
import { useAuth } from "../context/AuthContext";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { ChannelMembersPanel } from "../components/channels/ChannelMembersPanel";
import { InviteChannelUserDialog } from "../components/channels/InviteChannelUserDialog";
import { JoinChannelButton } from "../components/channels/JoinChannelButton";
import { MessageComposer } from "../components/messages/MessageComposer";
import { MessageList } from "../components/messages/MessageList";
import { queryKeys } from "../utils/queryKeys";

export function ChannelPage() {
  const { channelId, workspaceId } = useParams();
  const numericChannelId = Number(channelId);
  const numericWorkspaceId = Number(workspaceId);
  const { user } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [membersPanelOpen, setMembersPanelOpen] = useState(false);
  const channelQuery = useQuery({
    queryKey: queryKeys.channel(numericChannelId),
    queryFn: () => channelApi.get(numericChannelId),
    enabled: Number.isFinite(numericChannelId),
  });
  const messagesQuery = useQuery({
    queryKey: queryKeys.messages(numericChannelId),
    queryFn: () => messageApi.list(numericChannelId),
    enabled: Number.isFinite(numericChannelId) && channelQuery.data?.isMember === true,
  });

  if (channelQuery.isLoading) return <LoadingSpinner />;
  if (channelQuery.error) return <div className="p-6"><ErrorState error={channelQuery.error} /></div>;

  const channel = channelQuery.data;
  if (!channel) return null;

  const directPeer = channel.members.find((member) => member.userId !== user?.userId);
  const headerName =
    channel.type === "direct"
      ? directPeer?.nickname ?? directPeer?.username ?? "Direct message"
      : channel.channelName;

  const HeaderIcon = channel.type === "private" ? Lock : channel.type === "direct" ? MessageSquare : Hash;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4">
        <div className="flex min-w-0 items-center gap-1.5">
          <HeaderIcon className="h-4 w-4 text-slate-500" />
          <h1 className="truncate text-base font-semibold text-slate-950">{headerName}</h1>
        </div>
        <div className="flex items-center gap-1">
          {channel.type !== "direct" ? (
            <button
              onClick={() => setMembersPanelOpen((open) => !open)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              title="Members"
            >
              <Users className="h-4 w-4" />
              <span>{channel.members.length}</span>
            </button>
          ) : null}
          {channel.isMember && channel.type !== "direct" ? (
            <button
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              onClick={() => setInviteOpen(true)}
              title="Invite people"
            >
              <UserPlus className="h-4 w-4" />
            </button>
          ) : null}
          {!channel.isMember && channel.type === "public" ? (
            <JoinChannelButton channelId={channel.channelId} workspaceId={numericWorkspaceId} />
          ) : null}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-auto">
            {!channel.isMember ? (
              <div className="p-5"><ErrorState title="Join required" error={{ detail: "Join this public channel before reading messages.", status: 403 }} /></div>
            ) : messagesQuery.isLoading ? (
              <LoadingSpinner label="Loading messages" />
            ) : messagesQuery.error ? (
              <div className="p-5"><ErrorState error={messagesQuery.error} /></div>
            ) : (
              <MessageList messages={messagesQuery.data ?? []} />
            )}
          </div>
          <MessageComposer channelId={channel.channelId} disabled={!channel.isMember} />
        </div>
        {membersPanelOpen ? (
          <ChannelMembersPanel
            members={channel.members}
            workspaceId={numericWorkspaceId}
            currentUserId={user?.userId}
            onClose={() => setMembersPanelOpen(false)}
          />
        ) : null}
      </div>
      <InviteChannelUserDialog channelId={channel.channelId} open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
