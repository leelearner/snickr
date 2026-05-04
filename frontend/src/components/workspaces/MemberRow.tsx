import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import type { WorkspaceMember } from "../../types/api";
import { formatDate } from "../../utils/format";
import { queryKeys } from "../../utils/queryKeys";
import { channelApi } from "../../api/channels";
import { workspaceApi } from "../../api/workspaces";
import { Avatar } from "../common/Avatar";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";

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
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) });
  const roleMutation = useMutation({
    mutationFn: () =>
      workspaceApi.updateMemberRole(workspaceId, member.userId, {
        role: member.role === "admin" ? "member" : "admin",
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

  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-slate-200 px-1 py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={member.nickname ?? member.username} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="truncate font-bold text-slate-950 hover:underline"
              to={`/app/users/${member.userId}/messages`}
            >
              {member.nickname ?? member.username}
            </Link>
            <Badge tone={member.role === "admin" ? "blue" : "neutral"}>{member.role}</Badge>
          </div>
          <p className="text-sm text-slate-500">
            @{member.username} joined {formatDate(member.joinedTime)}
          </p>
        </div>
      </div>
      {member.userId !== currentUserId || canManage ? (
        <div className="flex items-center gap-2">
          {member.userId !== currentUserId ? (
            <Button
              variant="secondary"
              leftIcon={<MessageSquare className="h-4 w-4" />}
              isLoading={dmMutation.isPending}
              onClick={() => dmMutation.mutate()}
            >
              Message
            </Button>
          ) : null}
          {canManage ? (
            <>
              <Button variant="secondary" isLoading={roleMutation.isPending} onClick={() => roleMutation.mutate()}>
                {member.role === "admin" ? "Make member" : "Make admin"}
              </Button>
              <Button variant="danger" isLoading={removeMutation.isPending} onClick={() => removeMutation.mutate()}>
                Remove
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
      {(roleMutation.error || removeMutation.error || dmMutation.error) ? (
        <p className="col-span-2 text-sm text-red-600">
          {String((roleMutation.error ?? removeMutation.error ?? dmMutation.error) && ((roleMutation.error ?? removeMutation.error ?? dmMutation.error) as Error).message)}
        </p>
      ) : null}
    </div>
  );
}
