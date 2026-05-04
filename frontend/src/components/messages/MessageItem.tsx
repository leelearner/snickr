import type { MessageOut } from "../../types/api";
import { formatDate } from "../../utils/format";
import { Avatar } from "../common/Avatar";

export function MessageItem({ message, isMine }: { message: MessageOut; isMine: boolean }) {
  const displayName = message.postedByNickname ?? message.postedByUsername;

  return (
    <article className={`flex gap-3 px-5 py-3 ${isMine ? "bg-blue-50/40" : "bg-white"}`}>
      <Avatar name={displayName} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-bold text-slate-950">{displayName}</span>
          <span className="text-xs text-slate-500">@{message.postedByUsername}</span>
          <time className="text-xs text-slate-400">{formatDate(message.postedTime)}</time>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
          {message.content}
        </p>
      </div>
    </article>
  );
}
