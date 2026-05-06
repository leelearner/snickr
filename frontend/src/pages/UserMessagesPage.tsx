import { Link, useParams } from "react-router-dom";
import { Hash } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { messageApi } from "../api/messages";
import { Avatar } from "../components/common/Avatar";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { MainContent } from "../components/layout/MainContent";
import { formatDate } from "../utils/format";
import { queryKeys } from "../utils/queryKeys";

export function UserMessagesPage() {
  const { userId } = useParams();
  const numericUserId = Number(userId);
  const query = useQuery({
    queryKey: queryKeys.userMessages(numericUserId),
    queryFn: () => messageApi.listByUser(numericUserId),
    enabled: Number.isFinite(numericUserId),
  });

  const first = query.data?.[0];
  const displayName = first?.postedByNickname ?? first?.postedByUsername ?? `user #${numericUserId}`;
  const username = first?.postedByUsername;

  return (
    <MainContent>
      <div className="flex items-center gap-4">
        <Avatar name={displayName} className="h-12 w-12 text-base" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-slate-950">{displayName}</h1>
          {username ? <p className="truncate text-sm text-slate-500">@{username}</p> : null}
        </div>
      </div>
      <h2 className="mt-6 text-sm font-semibold text-slate-700">
        {query.data ? `${query.data.length} message${query.data.length === 1 ? "" : "s"}` : "Messages"}
      </h2>
      <div className="mt-3 space-y-2">
        {query.isLoading ? <LoadingSpinner /> : null}
        {query.error ? <ErrorState error={query.error} /> : null}
        {query.data?.length === 0 ? <EmptyState title="No messages for this user" /> : null}
        {query.data?.map((message) => (
          <Link
            key={message.messageId}
            to={`/app/workspaces/${message.workspaceId}/channels/${message.channelId}`}
            className="block rounded-lg border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{message.workspaceName}</span>
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                {message.channelName}
              </span>
              <time className="ml-auto">{formatDate(message.postedTime)}</time>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{message.content}</p>
          </Link>
        ))}
      </div>
    </MainContent>
  );
}
