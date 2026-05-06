import type { MessageOut } from "../../types/api";
import { formatDate, formatTimeShort } from "../../utils/format";
import { Avatar } from "../common/Avatar";

interface MessageItemProps {
  message: MessageOut;
  compact?: boolean;
}

export function MessageItem({ message, compact = false }: MessageItemProps) {
  const displayName = message.postedByNickname ?? message.postedByUsername;

  if (compact) {
    return (
      <article className="group flex gap-3 px-5 py-0.5 hover:bg-slate-50">
        <div className="w-10 shrink-0 pt-0.5 text-right text-[11px] leading-6 text-slate-400 opacity-0 group-hover:opacity-100">
          {formatTimeShort(message.postedTime)}
        </div>
        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
          {message.content}
        </p>
      </article>
    );
  }

  return (
    <article className="group flex gap-3 px-5 py-2 hover:bg-slate-50">
      <Avatar name={displayName} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-bold text-slate-950">{displayName}</span>
          <time className="text-xs text-slate-400">{formatDate(message.postedTime)}</time>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
          {message.content}
        </p>
      </div>
    </article>
  );
}
