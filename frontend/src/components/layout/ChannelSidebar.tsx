import { useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Hash, Lock, MessageSquare, Plus, Users, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams<{ channelId?: string }>();
  const activeChannelId = params.channelId ? Number(params.channelId) : undefined;
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
  const hideDmMutation = useMutation({
    mutationFn: (channelId: number) => channelApi.leave(channelId),
    onSuccess: async (_data, channelId) => {
      if (workspaceId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.channels(workspaceId) });
      }
      if (activeChannelId === channelId && workspaceId) {
        navigate(`/app/workspaces/${workspaceId}`);
      }
    },
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
            `flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              isActive
                ? "bg-blue-700 font-semibold text-white"
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
        {channel.type === "direct" ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              hideDmMutation.mutate(channel.channelId);
            }}
            disabled={hideDmMutation.isPending}
            title="Close direct message"
            className="invisible rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white group-hover:visible"
          >
            <X className="h-3.5 w-3.5" />
          </button>
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
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-3">
        <section>
          <div className="flex items-center justify-between pr-1">
            <button
              onClick={() => setChannelsOpen((open) => !open)}
              className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {channelsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Channels
            </button>
            <button
              className="rounded p-1 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              title="Create channel"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {channelsOpen ? (
            workspaceChannels.length === 0 ? (
              <EmptyState title="No channels yet" description="Create a public or private channel." />
            ) : (
              <div className="mt-1 space-y-0.5">{workspaceChannels.map(renderChannel)}</div>
            )
          ) : null}
        </section>
        <section className="pt-3">
          <button
            onClick={() => setDmsOpen((open) => !open)}
            className="flex w-full items-center gap-1 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {dmsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Direct messages
          </button>
          {dmsOpen ? (
            directChannels.length === 0 ? (
              <p className="px-2 pt-1 text-xs leading-5 text-slate-500">
                Open a member to start a DM.
              </p>
            ) : (
              <div className="mt-1 space-y-0.5">{directChannels.map(renderChannel)}</div>
            )
          ) : null}
        </section>
      </nav>
      <div className="border-t border-slate-800 p-2">
        <Link
          to={`/app/workspaces/${workspaceId}/members`}
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <Users className="h-4 w-4" />
          People
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
