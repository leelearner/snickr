import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { workspaceApi } from "../../api/workspaces";
import { Button } from "../common/Button";
import { ErrorState } from "../common/ErrorState";
import { Input } from "../common/Input";
import { Modal } from "../common/Modal";

export function InviteWorkspaceUserDialog({
  workspaceId,
  open,
  onClose,
}: {
  workspaceId: number;
  open: boolean;
  onClose: () => void;
}) {
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const mutation = useMutation({
    mutationFn: (trimmed: string) => workspaceApi.inviteUser(workspaceId, { username: trimmed }),
    onSuccess: () => {
      setUsername("");
      setMessage("Invitation sent.");
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = username.trim();
    if (!trimmed || trimmed.length > 30) {
      setMessage("Username must be 1-30 characters.");
      return;
    }
    setMessage("");
    mutation.mutate(trimmed);
  }

  return (
    <Modal open={open} title="Invite user to workspace" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <Input label="Username" value={username} maxLength={30} onChange={(event) => setUsername(event.target.value)} />
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        {mutation.error ? <ErrorState title="Invitation failed" error={mutation.error} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            Send invite
          </Button>
        </div>
      </form>
    </Modal>
  );
}
