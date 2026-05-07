import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { messageApi } from '../../api/messages';
import type { ChannelMember, MessageOut } from '../../types/api';
import { queryKeys } from '../../utils/queryKeys';
import { ErrorState } from '../common/ErrorState';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { MessageComposer } from './MessageComposer';
import { MessageItem } from './MessageItem';

export function ThreadPanel({
  channelId,
  workspaceId,
  parentMessageId,
  parent,
  members,
  onClose,
}: {
  channelId: number;
  workspaceId: number;
  parentMessageId: number;
  parent: MessageOut | null;
  members: ChannelMember[];
  onClose: () => void;
}) {
  const repliesQuery = useQuery({
    queryKey: queryKeys.replies(channelId, parentMessageId),
    queryFn: () => messageApi.listReplies(channelId, parentMessageId),
  });

  return (
    <aside className="flex h-full w-full flex-col border-l border-slate-200 bg-white sm:max-w-md">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Thread</h2>
          <p className="text-xs text-slate-500">Replies stay in this side panel.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          title="Close thread"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {parent ? (
          <div className="border-b border-slate-200">
            <MessageItem
              message={parent}
              channelId={channelId}
              workspaceId={workspaceId}
              members={members}
              hideThreadActions
            />
          </div>
        ) : (
          <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500">
            Parent message not in current view.
          </div>
        )}

        {repliesQuery.isLoading ? (
          <div className="flex justify-center py-6">
            <LoadingSpinner />
          </div>
        ) : repliesQuery.error ? (
          <div className="px-4 py-4">
            <ErrorState error={repliesQuery.error} />
          </div>
        ) : (
          <div className="py-2">
            {(repliesQuery.data ?? []).map((reply) => (
              <MessageItem
                key={reply.messageId}
                message={reply}
                channelId={channelId}
                workspaceId={workspaceId}
                members={members}
                hideThreadActions
              />
            ))}
            {(repliesQuery.data ?? []).length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">No replies yet. Be the first.</p>
            ) : null}
          </div>
        )}
      </div>

      <MessageComposer
        channelId={channelId}
        members={members}
        parentMessageId={parentMessageId}
        placeholder="Reply in thread"
      />
    </aside>
  );
}
