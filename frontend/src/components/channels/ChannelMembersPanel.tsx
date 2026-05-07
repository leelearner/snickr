import { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { channelApi } from '../../api/channels';
import type { ChannelMember } from '../../types/api';
import { queryKeys } from '../../utils/queryKeys';
import { Avatar } from '../common/Avatar';
import { displayName as safeDisplayName } from '../../utils/displayName';

interface ChannelMembersPanelProps {
  members: ChannelMember[];
  workspaceId: number;
  currentUserId?: number;
  onClose?: () => void;
}

export function ChannelMembersPanel({
  members,
  workspaceId,
  currentUserId,
  onClose,
}: ChannelMembersPanelProps) {
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
    <aside className="flex w-full flex-col border-t border-slate-200 bg-white lg:w-72 lg:border-l lg:border-t-0">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 px-4">
        <h2 className="text-sm font-semibold text-slate-950">Members ({members.length})</h2>
        {onClose ? (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {members.map((member) => {
          const isCurrentUser = member.userId === currentUserId;
          const displayName = safeDisplayName(member.nickname, member.username);
          const content = (
            <>
              <Avatar name={displayName} className="h-7 w-7" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-800">
                  {displayName}
                  {isCurrentUser ? (
                    <span className="ml-1 text-xs text-slate-500">(you)</span>
                  ) : null}
                </p>
              </div>
              {!isCurrentUser ? (
                dmMutation.isPending && activeTargetId === member.userId ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                ) : (
                  <MessageSquare className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100" />
                )
              ) : null}
            </>
          );

          return isCurrentUser ? (
            <div key={member.userId} className="group flex items-center gap-2.5 px-3 py-1.5">
              {content}
            </div>
          ) : (
            <button
              key={member.userId}
              className="group flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              title={`Message ${displayName}`}
              onClick={() => startDm(member.userId)}
              disabled={dmMutation.isPending}
            >
              {content}
            </button>
          );
        })}
        {dmMutation.error ? (
          <p className="px-3 py-2 text-sm text-red-600">{(dmMutation.error as Error).message}</p>
        ) : null}
      </div>
    </aside>
  );
}
