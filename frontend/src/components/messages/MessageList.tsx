import { useEffect, useRef } from "react";
import type { MessageOut, UserOut } from "../../types/api";
import { EmptyState } from "../common/EmptyState";
import { MessageItem } from "./MessageItem";

export function MessageList({
  messages,
  currentUser,
}: {
  messages: MessageOut[];
  currentUser: UserOut | null;
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
    <div className="divide-y divide-slate-100">
      {messages.map((message) => (
        <MessageItem
          key={message.messageId}
          message={message}
          isMine={message.postedBy === currentUser?.userId}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
