import { useState } from "react";
import { useParams } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { channelApi } from "../api/channels";
import { messageApi } from "../api/messages";
import { useAuth } from "../context/AuthContext";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
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
  const title =
    channel.type === "direct"
      ? directPeer?.nickname ?? directPeer?.username ?? "Direct message"
      : `# ${channel.channelName}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-950">
              {title}
            </h1>
            <Badge tone={channel.type === "public" ? "emerald" : "neutral"}>{channel.type}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {channel.type === "direct" ? "Direct message" : `${channel.members.length} members`}
          </p>
        </div>
        <div className="flex gap-2">
          {!channel.isMember && channel.type === "public" ? (
            <JoinChannelButton channelId={channel.channelId} workspaceId={numericWorkspaceId} />
          ) : null}
          {channel.isMember && channel.type !== "direct" ? (
            <Button variant="secondary" leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>
              Invite
            </Button>
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
              <MessageList messages={messagesQuery.data ?? []} currentUser={user} />
            )}
          </div>
          <MessageComposer channelId={channel.channelId} disabled={!channel.isMember} />
        </div>
        <ChannelMembersPanel
          members={channel.members}
          workspaceId={numericWorkspaceId}
          currentUserId={user?.userId}
        />
      </div>
      <InviteChannelUserDialog channelId={channel.channelId} open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
