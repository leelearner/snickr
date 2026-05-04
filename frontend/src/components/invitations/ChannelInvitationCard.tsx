import { useMutation, useQueryClient } from "@tanstack/react-query";
import { channelApi } from "../../api/channels";
import type { ChannelInvitation } from "../../types/api";
import { errorMessage, formatDate } from "../../utils/format";
import { queryKeys } from "../../utils/queryKeys";
import { Button } from "../common/Button";

export function ChannelInvitationCard({ invitation }: { invitation: ChannelInvitation }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (accept: boolean) =>
      channelApi.respondToInvitation(invitation.invitationId, { accept }),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.channelInvitations }),
        queryClient.invalidateQueries({ queryKey: queryKeys.channels(invitation.workspaceId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.channel(invitation.channelId) }),
      ]);
    },
  });

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950"># {invitation.channelName}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {invitation.workspaceName} - invited by @{invitation.inviterUsername} on{" "}
            {formatDate(invitation.invitedTime)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" isLoading={mutation.isPending} onClick={() => mutation.mutate(false)}>
            Decline
          </Button>
          <Button isLoading={mutation.isPending} onClick={() => mutation.mutate(true)}>
            Accept
          </Button>
        </div>
      </div>
      {mutation.error ? <p className="mt-3 text-sm text-red-600">{errorMessage(mutation.error)}</p> : null}
    </article>
  );
}
