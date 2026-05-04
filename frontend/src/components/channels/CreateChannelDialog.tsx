import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { channelApi } from "../../api/channels";
import type { ChannelType } from "../../types/api";
import { queryKeys } from "../../utils/queryKeys";
import { Button } from "../common/Button";
import { ErrorState } from "../common/ErrorState";
import { Input } from "../common/Input";
import { Modal } from "../common/Modal";

export function CreateChannelDialog({
  workspaceId,
  open,
  onClose,
}: {
  workspaceId: number;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [channelName, setChannelName] = useState("");
  const [type, setType] = useState<Exclude<ChannelType, "direct">>("public");
  const [validation, setValidation] = useState("");
  const mutation = useMutation({
    mutationFn: () => channelApi.create(workspaceId, { channelName: channelName.trim(), type }),
    onSuccess: async (channel) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.channels(workspaceId) });
      setChannelName("");
      setType("public");
      onClose();
      navigate(`/app/workspaces/${workspaceId}/channels/${channel.channelId}`);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = channelName.trim();
    if (!trimmed || trimmed.length > 50) {
      setValidation("Channel name must be 1-50 characters.");
      return;
    }
    setValidation("");
    mutation.mutate();
  }

  return (
    <Modal open={open} title="Create channel" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <Input
          label="Channel name"
          value={channelName}
          maxLength={50}
          onChange={(event) => setChannelName(event.target.value)}
        />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Type</span>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
            value={type}
            onChange={(event) => setType(event.target.value as Exclude<ChannelType, "direct">)}
          >
            <option className="text-slate-950" value="public">public</option>
            <option className="text-slate-950" value="private">private</option>
          </select>
        </label>
        {validation ? <p className="text-sm text-red-600">{validation}</p> : null}
        {mutation.error ? <ErrorState title="Could not create channel" error={mutation.error} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
