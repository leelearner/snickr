import { Link } from "react-router-dom";
import { AtSign, Hash, LogIn, MessageSquare } from "lucide-react";
import type { MentionOut } from "../../types/api";
import { formatDate } from "../../utils/format";
import { renderMessageContent } from "../../utils/renderContent";
import { Avatar } from "../common/Avatar";

export function MentionCard({ mention }: { mention: MentionOut }) {
  const displayName = mention.postedByNickname ?? mention.postedByUsername;

  const Icon = mention.kind === "dm" ? MessageSquare : mention.kind === "join" ? LogIn : AtSign;
  const accent =
    mention.kind === "dm" ? "text-violet-700"
    : mention.kind === "join" ? "text-emerald-700"
    : "text-blue-700";

  const headerLocation =
    mention.kind === "dm" ? (
      <span className="flex items-center gap-1">
        <span>From</span>
        <span className="font-medium text-slate-700">@{mention.postedByUsername}</span>
      </span>
    ) : (
      <span className="flex items-center gap-1">
        <Hash className="h-3 w-3" />
        {mention.channelName}
      </span>
    );

  return (
    <Link
      to={`/app/workspaces/${mention.workspaceId}/channels/${mention.channelId}`}
      className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Icon className={`h-3.5 w-3.5 ${accent}`} />
        <span className="font-semibold text-slate-700">{mention.workspaceName}</span>
        {headerLocation}
        <time className="ml-auto">{formatDate(mention.postedTime)}</time>
      </div>
      <div className="mt-2 flex items-start gap-3">
        <Avatar name={displayName} className="h-8 w-8" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-950">{displayName}</p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
            {renderMessageContent(mention.content)}
          </p>
        </div>
      </div>
    </Link>
  );
}
