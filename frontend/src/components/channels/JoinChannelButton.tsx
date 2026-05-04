import { Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { channelApi } from "../../api/channels";
import { queryKeys } from "../../utils/queryKeys";
import { Button } from "../common/Button";

export function JoinChannelButton({
  channelId,
  workspaceId,
  compact = false,
}: {
  channelId: number;
  workspaceId: number;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => channelApi.join(channelId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.channels(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.channel(channelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.messages(channelId) }),
      ]);
    },
  });

  if (compact) {
    return (
      <button
        className="rounded p-1 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
        title="Join public channel"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        <Plus className="h-4 w-4" />
      </button>
    );
  }

  return (
    <Button isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
      Join channel
    </Button>
  );
}
