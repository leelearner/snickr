import { Fragment, useEffect, useRef } from "react";
import type { ChannelMember, MessageOut } from "../../types/api";
import { dateKey, formatDateDivider } from "../../utils/format";
import { EmptyState } from "../common/EmptyState";
import { MessageItem } from "./MessageItem";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function shouldGroupWithPrevious(prev: MessageOut, current: MessageOut): boolean {
  if (prev.systemKind != null || current.systemKind != null) return false;
  if (prev.postedBy !== current.postedBy) return false;
  const prevTime = new Date(prev.postedTime).getTime();
  const currentTime = new Date(current.postedTime).getTime();
  if (Number.isNaN(prevTime) || Number.isNaN(currentTime)) return false;
  return currentTime - prevTime < FIVE_MINUTES_MS;
}

export function MessageList({
  messages,
  channelId,
  workspaceId,
  members,
}: {
  messages: MessageOut[];
  channelId: number;
  workspaceId?: number;
  members?: ChannelMember[];
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="p-5">
        <EmptyState title="No messages yet" description="Start the conversation with a short plain-text message." />
      </div>
    );
  }

  return (
    <div className="py-3">
      {messages.map((message, index) => {
        const previous = index > 0 ? messages[index - 1] : null;
        const newDay = !previous || dateKey(previous.postedTime) !== dateKey(message.postedTime);
        const compact = !newDay && previous ? shouldGroupWithPrevious(previous, message) : false;
        return (
          <Fragment key={message.messageId}>
            {newDay ? (
              <div className="flex items-center gap-3 px-5 py-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="rounded-full border border-slate-200 bg-white px-3 py-0.5 text-xs font-semibold text-slate-600">
                  {formatDateDivider(message.postedTime)}
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            ) : null}
            <MessageItem
              message={message}
              channelId={channelId}
              workspaceId={workspaceId}
              members={members}
              compact={compact}
            />
          </Fragment>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
