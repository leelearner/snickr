import { KeyboardEvent, forwardRef, useEffect, useRef, useState } from 'react';
import { LogIn, LogOut, Pencil, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChannelMember, MessageOut } from '../../types/api';
import { messageApi } from '../../api/messages';
import { useAuth } from '../../context/useAuth';
import { errorMessage, formatDate, formatTimeShort } from '../../utils/format';
import { displayName as safeDisplayName } from '../../utils/displayName';
import { renderMessageContent } from '../../utils/renderContent';
import { queryKeys } from '../../utils/queryKeys';
import { Avatar } from '../common/Avatar';

interface MessageItemProps {
  message: MessageOut;
  channelId: number;
  workspaceId?: number;
  members?: ChannelMember[];
  compact?: boolean;
}

export function MessageItem({
  message,
  channelId,
  workspaceId,
  members,
  compact = false,
}: MessageItemProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [actionError, setActionError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const displayName = safeDisplayName(message.postedByNickname, message.postedByUsername);
  const isSystem = message.systemKind != null;
  const isMine = !isSystem && user?.userId === message.postedBy;

  const updateMutation = useMutation({
    mutationFn: (content: string) => messageApi.update(channelId, message.messageId, { content }),
    onSuccess: async () => {
      setEditing(false);
      setActionError('');
      await queryClient.invalidateQueries({ queryKey: queryKeys.messages(channelId) });
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => messageApi.delete(channelId, message.messageId),
    onSuccess: async () => {
      setActionError('');
      await queryClient.invalidateQueries({ queryKey: queryKeys.messages(channelId) });
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(draft.length, draft.length);
    }
  }, [editing, draft.length]);

  function startEdit() {
    setDraft(message.content);
    setActionError('');
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft(message.content);
    setActionError('');
  }

  function saveEdit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed.length > 500) {
      setActionError('Message must be 1-500 characters.');
      return;
    }
    if (trimmed === message.content) {
      cancelEdit();
      return;
    }
    updateMutation.mutate(trimmed);
  }

  function handleKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      saveEdit();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    }
  }

  function confirmDelete() {
    if (window.confirm('Delete this message? This cannot be undone.')) {
      deleteMutation.mutate();
    }
  }

  const editedSuffix = message.editedTime ? (
    <span className="ml-1 text-xs text-slate-400">(edited)</span>
  ) : null;

  const actions =
    isMine && !editing ? (
      <div className="absolute right-3 top-1.5 hidden gap-0.5 rounded-md border border-slate-200 bg-white p-0.5 shadow-sm group-hover:flex">
        <button
          type="button"
          onClick={startEdit}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          title="Edit message"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={confirmDelete}
          disabled={deleteMutation.isPending}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          title="Delete message"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    ) : null;

  const editView = (
    <EditView
      ref={textareaRef}
      draft={draft}
      setDraft={setDraft}
      onSave={saveEdit}
      onCancel={cancelEdit}
      onKey={handleKey}
      isPending={updateMutation.isPending}
    />
  );

  if (isSystem) {
    const SystemIcon = message.systemKind === 'leave' ? LogOut : LogIn;
    return (
      <article className="flex items-center gap-2 px-5 py-1 text-xs text-slate-500">
        <SystemIcon className="h-3.5 w-3.5 text-slate-400" />
        <span className="font-medium text-slate-600">{displayName}</span>
        <span>{message.content}</span>
        <time className="ml-auto text-[11px] text-slate-400">
          {formatTimeShort(message.postedTime)}
        </time>
      </article>
    );
  }

  if (compact) {
    return (
      <article className="group relative flex gap-3 px-5 py-0.5 hover:bg-slate-50">
        <div className="w-10 shrink-0 pt-0.5 text-right text-[11px] leading-6 text-slate-400 opacity-0 group-hover:opacity-100">
          {formatTimeShort(message.postedTime)}
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            editView
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
              {renderMessageContent(message.content, { members, fromWorkspaceId: workspaceId })}
              {editedSuffix}
            </p>
          )}
          {actionError ? <p className="mt-1 text-xs text-red-600">{actionError}</p> : null}
        </div>
        {actions}
      </article>
    );
  }

  return (
    <article className="group relative flex gap-3 px-5 py-2 hover:bg-slate-50">
      <Avatar name={displayName} userId={message.postedBy} fromWorkspaceId={workspaceId} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-bold text-slate-950">{displayName}</span>
          <time className="text-xs text-slate-400">{formatDate(message.postedTime)}</time>
        </div>
        {editing ? (
          editView
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
            {renderMessageContent(message.content)}
            {editedSuffix}
          </p>
        )}
        {actionError ? <p className="mt-1 text-xs text-red-600">{actionError}</p> : null}
      </div>
      {actions}
    </article>
  );
}

interface EditViewProps {
  draft: string;
  setDraft: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onKey: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  isPending: boolean;
}

const EditView = forwardRef<HTMLTextAreaElement, EditViewProps>(function EditView(
  { draft, setDraft, onSave, onCancel, onKey, isPending },
  ref,
) {
  return (
    <div className="mt-1 rounded-md border border-slate-300 bg-white">
      <textarea
        ref={ref}
        value={draft}
        maxLength={500}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKey}
        disabled={isPending}
        className="block max-h-40 min-h-9 w-full resize-none border-0 px-3 py-2 text-sm leading-6 outline-none disabled:bg-slate-50"
      />
      <div className="flex justify-end gap-2 border-t border-slate-100 px-2 py-1.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isPending}
          className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          Save
        </button>
      </div>
    </div>
  );
});
