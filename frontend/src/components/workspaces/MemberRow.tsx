import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare, Trash2 } from 'lucide-react';
import type { WorkspaceMember } from '../../types/api';
import { formatDate } from '../../utils/format';
import { displayName as safeDisplayName } from '../../utils/displayName';
import { queryKeys } from '../../utils/queryKeys';
import { channelApi } from '../../api/channels';
import { workspaceApi } from '../../api/workspaces';
import { Avatar } from '../common/Avatar';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';

export function MemberRow({
  member,
  workspaceId,
  canManage,
  currentUserId,
}: {
  member: WorkspaceMember;
  workspaceId: number;
  canManage: boolean;
  currentUserId?: number;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) });
  const roleMutation = useMutation({
    mutationFn: () =>
      workspaceApi.updateMemberRole(workspaceId, member.userId, {
        role: member.role === 'admin' ? 'member' : 'admin',
      }),
    onSuccess: invalidate,
  });
  const removeMutation = useMutation({
    mutationFn: () => workspaceApi.removeMember(workspaceId, member.userId),
    onSuccess: invalidate,
  });
  const dmMutation = useMutation({
    mutationFn: () => channelApi.createDirectMessage(workspaceId, { targetUserId: member.userId }),
    onSuccess: async (channel) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.channels(workspaceId) });
      navigate(`/app/workspaces/${workspaceId}/channels/${channel.channelId}`);
    },
  });

  const isSelf = member.userId === currentUserId;
  const showActions = !isSelf || canManage;
  const error = roleMutation.error ?? removeMutation.error ?? dmMutation.error;

  return (
    <div className="group grid grid-cols-[1fr_auto] gap-4 px-1 py-2.5 transition hover:bg-slate-50">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={safeDisplayName(member.nickname, member.username)} className="h-9 w-9" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="truncate text-sm font-semibold text-slate-950 hover:underline"
              to={`/app/users/${member.userId}/messages`}
            >
              {safeDisplayName(member.nickname, member.username)}
            </Link>
            {member.role === 'admin' ? <Badge tone="blue">admin</Badge> : null}
            {isSelf ? <span className="text-xs text-slate-400">(you)</span> : null}
          </div>
          <p className="truncate text-xs text-slate-500">
            @{member.username} joined {formatDate(member.joinedTime)}
          </p>
        </div>
      </div>
      {showActions ? (
        <div className="flex items-center gap-1.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          {!isSelf ? (
            <Button
              variant="ghost"
              className="h-8 px-2"
              leftIcon={<MessageSquare className="h-4 w-4" />}
              isLoading={dmMutation.isPending}
              onClick={() => dmMutation.mutate()}
              title="Direct message"
            >
              Message
            </Button>
          ) : null}
          {canManage ? (
            <>
              <Button
                variant="secondary"
                className="h-8 px-2 text-xs"
                isLoading={roleMutation.isPending}
                onClick={() => roleMutation.mutate()}
              >
                {member.role === 'admin' ? 'Demote' : 'Promote'}
              </Button>
              <Button
                variant="ghost"
                className="h-8 w-8 px-0 text-red-600 hover:bg-red-50"
                isLoading={removeMutation.isPending}
                onClick={() => removeMutation.mutate()}
                title="Remove from workspace"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="col-span-2 text-sm text-red-600">{(error as Error).message}</p> : null}
    </div>
  );
}
