import { useState } from "react";
import { ChevronDown, ChevronRight, MessageSquare } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { channelApi } from "../../api/channels";
import type { ChannelMember } from "../../types/api";
import { formatDate } from "../../utils/format";
import { queryKeys } from "../../utils/queryKeys";
import { Avatar } from "../common/Avatar";

export function ChannelMembersPanel({
  members,
  workspaceId,
  currentUserId,
}: {
  members: ChannelMember[];
  workspaceId: number;
  currentUserId?: number;
}) {
  const [membersOpen, setMembersOpen] = useState(true);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [activeTargetId, setActiveTargetId] = useState<number | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dmMutation = useMutation({
    mutationFn: (targetUserId: number) =>
      channelApi.createDirectMessage(workspaceId, { targetUserId }),
    onSuccess: async (channel) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.channels(workspaceId) });
      navigate(`/app/workspaces/${workspaceId}/channels/${channel.channelId}`);
    },
    onSettled: () => setActiveTargetId(null),
  });

  function startDm(targetUserId: number) {
    setActiveTargetId(targetUserId);
    dmMutation.mutate(targetUserId);
  }

  return (
    <aside className="w-full border-t border-zinc-300 bg-zinc-100 p-4 lg:w-[22rem] lg:border-l lg:border-t-0">
      <div className="rounded-lg border border-zinc-300 bg-white shadow-sm">
        <button
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-950 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          onClick={() => setAboutOpen((open) => !open)}
        >
          <span>Channel details</span>
          {aboutOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {aboutOpen ? (
          <div className="border-t border-zinc-200 px-4 py-3 text-sm text-slate-600">
            <p>{members.length} people can participate in this conversation.</p>
          </div>
        ) : null}
      </div>

      <div className="mt-3 rounded-lg border border-zinc-300 bg-white shadow-sm">
        <button
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-950 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          onClick={() => setMembersOpen((open) => !open)}
        >
          <span>Members</span>
          <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
            {members.length}
            {membersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        </button>
        {membersOpen ? (
          <div className="divide-y divide-zinc-200 border-t border-zinc-200">
            {members.map((member) => {
              const isCurrentUser = member.userId === currentUserId;
              const content = (
                <>
                  <Avatar name={member.nickname ?? member.username} className="h-8 w-8" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-950">
                      {member.nickname ?? member.username}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      @{member.username} - joined {formatDate(member.joinedTime)}
                    </p>
                  </div>
                  {!isCurrentUser ? (
                    <span className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500">
                      {dmMutation.isPending && activeTargetId === member.userId ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                    </span>
                  ) : null}
                </>
              );

              return isCurrentUser ? (
                <div key={member.userId} className="flex items-center gap-3 px-4 py-3">
                  {content}
                </div>
              ) : (
                <button
                  key={member.userId}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                  title={`Message ${member.nickname ?? member.username}`}
                  onClick={() => startDm(member.userId)}
                  disabled={dmMutation.isPending}
                >
                  {content}
                </button>
              );
            })}
            {dmMutation.error ? (
              <p className="px-4 py-3 text-sm text-red-600">
                {(dmMutation.error as Error).message}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
