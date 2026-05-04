import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { messageApi } from "../api/messages";
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

  return (
    <MainContent>
      <h1 className="text-xl font-semibold text-slate-950">User messages</h1>
      <p className="mt-1 text-sm text-slate-500">Messages posted by user #{numericUserId}.</p>
      <div className="mt-6 space-y-3">
        {query.isLoading ? <LoadingSpinner /> : null}
        {query.error ? <ErrorState error={query.error} /> : null}
        {query.data?.length === 0 ? <EmptyState title="No messages for this user" /> : null}
        {query.data?.map((message) => (
          <Link
            key={message.messageId}
            to={`/app/workspaces/${message.workspaceId}/channels/${message.channelId}`}
            className="block rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50"
          >
            <div className="flex flex-wrap gap-2 text-sm text-slate-500">
              <span className="font-semibold text-slate-950">{message.workspaceName}</span>
              <span># {message.channelName}</span>
              <span className="font-bold text-slate-700">@{message.postedByUsername}</span>
              <time>{formatDate(message.postedTime)}</time>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{message.content}</p>
          </Link>
        ))}
      </div>
    </MainContent>
  );
}
