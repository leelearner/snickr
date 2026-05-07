import { FormEvent, useState } from 'react';
import { Check, UserPlus } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { workspaceApi } from '../../api/workspaces';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { errorMessage } from '../../utils/format';

export function InviteWorkspaceUserDialog({
  workspaceId,
  open,
  onClose,
}: {
  workspaceId: number;
  open: boolean;
  onClose: () => void;
}) {
  const [username, setUsername] = useState('');
  const [validation, setValidation] = useState('');
  const [lastInvited, setLastInvited] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (trimmed: string) => workspaceApi.inviteUser(workspaceId, { username: trimmed }),
    onSuccess: (_data, trimmed) => {
      setLastInvited(trimmed);
      setUsername('');
      setValidation('');
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = username.trim();
    if (!trimmed || trimmed.length > 30) {
      setValidation('Username must be 1 to 30 characters.');
      return;
    }
    setValidation('');
    setLastInvited(null);
    mutation.mutate(trimmed);
  }

  function handleClose() {
    setLastInvited(null);
    setValidation('');
    onClose();
  }

  return (
    <Modal open={open} title="Invite to workspace" onClose={handleClose}>
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
          <UserPlus className="h-4 w-4" />
        </div>
        <p className="text-sm text-slate-600">
          Send a workspace invitation by username. The recipient will see it in their Activity inbox
          and can accept or decline.
        </p>
      </div>
      <form className="space-y-4" onSubmit={submit}>
        <Input
          label="Username"
          value={username}
          maxLength={30}
          autoFocus
          placeholder="alice"
          onChange={(event) => setUsername(event.target.value)}
        />
        {validation ? <p className="text-sm text-red-600">{validation}</p> : null}
        {mutation.error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage(mutation.error)}
          </p>
        ) : null}
        {lastInvited ? (
          <p className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <Check className="h-4 w-4" />
            Invitation sent to <span className="font-semibold">@{lastInvited}</span>.
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
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
