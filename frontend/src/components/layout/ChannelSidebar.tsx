import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Hash, Lock, MessageSquare, Plus, Settings, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { channelApi } from "../../api/channels";
import { workspaceApi } from "../../api/workspaces";
import { Badge } from "../common/Badge";
import { EmptyState } from "../common/EmptyState";
import { ErrorState } from "../common/ErrorState";
import { LoadingSpinner } from "../common/LoadingSpinner";
import { CreateChannelDialog } from "../channels/CreateChannelDialog";
import { JoinChannelButton } from "../channels/JoinChannelButton";
import { channelDisplayName } from "../../utils/format";
import { queryKeys } from "../../utils/queryKeys";
import type { ChannelSummary, ChannelType } from "../../types/api";

function ChannelIcon({ type }: { type: ChannelType }) {
  if (type === "private") return <Lock className="h-4 w-4" />;
  if (type === "direct") return <MessageSquare className="h-4 w-4" />;
  return <Hash className="h-4 w-4" />;
}

export function ChannelSidebar({ workspaceId }: { workspaceId?: number }) {
  const [createOpen, setCreateOpen] = useState(false);
  const workspaceQuery = useQuery({
    queryKey: workspaceId ? queryKeys.workspace(workspaceId) : ["workspace", "none"],
    queryFn: () => workspaceApi.get(workspaceId!),
    enabled: Boolean(workspaceId),
  });
  const channelsQuery = useQuery({
    queryKey: workspaceId ? queryKeys.channels(workspaceId) : ["channels", "none"],
    queryFn: () => channelApi.list(workspaceId!),
    enabled: Boolean(workspaceId),
  });

  if (!workspaceId) {
    return (
      <div className="p-4">
        <p className="text-sm text-slate-400">Choose a workspace to view channels.</p>
      </div>
    );
  }

  if (workspaceQuery.isLoading || channelsQuery.isLoading) return <LoadingSpinner />;
  if (workspaceQuery.error) return <ErrorState error={workspaceQuery.error} />;
  if (channelsQuery.error) return <ErrorState error={channelsQuery.error} />;

  const workspace = workspaceQuery.data;
  const channels = channelsQuery.data ?? [];
  const workspaceChannels = channels.filter((channel) => channel.type !== "direct");
  const directChannels = channels.filter((channel) => channel.type === "direct");

  function renderChannel(channel: ChannelSummary) {
    return (
      <div key={channel.channelId} className="group flex items-center gap-1">
        <NavLink
          to={`/app/workspaces/${workspaceId}/channels/${channel.channelId}`}
          className={({ isActive }) =>
            `flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              isActive
                ? "bg-slate-700 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`
          }
        >
          <ChannelIcon type={channel.type} />
          <span className="truncate">
            {channel.type === "direct" ? channelDisplayName(channel) : channel.channelName}
          </span>
          {!channel.isMember ? <Badge tone="amber">join</Badge> : null}
        </NavLink>
        {!channel.isMember && channel.type === "public" ? (
          <JoinChannelButton channelId={channel.channelId} workspaceId={workspaceId!} compact />
        ) : null}
      </div>
    );
  }

  return (
    <aside className="flex h-full flex-col">
      <div className="border-b border-slate-800 p-4">
        <h1 className="truncate text-base font-semibold text-white">{workspace?.name}</h1>
        <p className="mt-1 truncate text-xs text-slate-400">{workspace?.myRole}</p>
      </div>
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Channels</span>
        <button
          className="rounded p-1 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          title="Create channel"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-2">
        <section>
          {workspaceChannels.length === 0 ? (
          <EmptyState title="No channels yet" description="Create a public or private channel." />
        ) : (
          <div className="space-y-1">{workspaceChannels.map(renderChannel)}</div>
        )}
        </section>
        <section>
          <div className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <MessageSquare className="h-3.5 w-3.5" />
            Direct messages
          </div>
          {directChannels.length === 0 ? (
            <p className="px-2 text-xs leading-5 text-slate-500">
              Use a channel member row or workspace members page to start a DM.
            </p>
          ) : (
            <div className="space-y-1">{directChannels.map(renderChannel)}</div>
          )}
        </section>
      </nav>
      <div className="space-y-1 border-t border-slate-800 p-2">
        <Link
          to={`/app/workspaces/${workspaceId}/members`}
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <Users className="h-4 w-4" />
          Members
        </Link>
        <Link
          to={`/app/workspaces/${workspaceId}/invitations`}
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <Settings className="h-4 w-4" />
          Workspace tools
        </Link>
      </div>
      <CreateChannelDialog
        workspaceId={workspaceId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </aside>
  );
}
