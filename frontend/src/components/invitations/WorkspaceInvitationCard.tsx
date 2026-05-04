import { useMutation, useQueryClient } from "@tanstack/react-query";
import { workspaceApi } from "../../api/workspaces";
import type { WorkspaceInvitation } from "../../types/api";
import { errorMessage, formatDate } from "../../utils/format";
import { queryKeys } from "../../utils/queryKeys";
import { Button } from "../common/Button";

export function WorkspaceInvitationCard({ invitation }: { invitation: WorkspaceInvitation }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (accept: boolean) =>
      workspaceApi.respondToInvitation(invitation.invitationId, { accept }),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.workspaceInvitations }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workspaces }),
      ]);
    },
  });

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{invitation.workspaceName}</h3>
          <p className="mt-1 text-sm text-slate-500">
            Invited by @{invitation.inviterUsername} on {formatDate(invitation.invitedTime)}
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
