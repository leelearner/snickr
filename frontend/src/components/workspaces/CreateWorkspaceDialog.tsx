import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { channelApi } from "../../api/channels";
import { workspaceApi } from "../../api/workspaces";
import { trimOrUndefined } from "../../utils/format";
import { queryKeys } from "../../utils/queryKeys";
import { Button } from "../common/Button";
import { ErrorState } from "../common/ErrorState";
import { Input } from "../common/Input";
import { Modal } from "../common/Modal";
import { Textarea } from "../common/Textarea";

export function CreateWorkspaceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [validation, setValidation] = useState("");
  const mutation = useMutation({
    mutationFn: workspaceApi.create,
    onSuccess: async (workspace) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      await queryClient.invalidateQueries({ queryKey: queryKeys.channels(workspace.workspaceId) });
      const channels = await channelApi.list(workspace.workspaceId);
      const defaultChannel = channels.find((channel) => channel.channelName === "general");
      setName("");
      setDescription("");
      onClose();
      navigate(
        defaultChannel
          ? `/app/workspaces/${workspace.workspaceId}/channels/${defaultChannel.channelId}`
          : `/app/workspaces/${workspace.workspaceId}`,
      );
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedDescription = trimOrUndefined(description);
    if (!trimmedName || trimmedName.length > 30) {
      setValidation("Workspace name must be 1-30 characters.");
      return;
    }
    if ((trimmedDescription?.length ?? 0) > 200) {
      setValidation("Description must be 200 characters or fewer.");
      return;
    }
    setValidation("");
    mutation.mutate({ name: trimmedName, description: trimmedDescription ?? null });
  }

  return (
    <Modal open={open} title="Create workspace" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <Input label="Name" value={name} maxLength={30} onChange={(event) => setName(event.target.value)} />
        <Textarea
          label="Description"
          value={description}
          maxLength={200}
          onChange={(event) => setDescription(event.target.value)}
        />
        {validation ? <p className="text-sm text-red-600">{validation}</p> : null}
        {mutation.error ? <ErrorState title="Could not create workspace" error={mutation.error} /> : null}
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
