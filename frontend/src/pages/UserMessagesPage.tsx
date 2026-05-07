import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Hash, MessageSquare } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { channelApi } from "../api/channels";
import { messageApi } from "../api/messages";
import { workspaceApi } from "../api/workspaces";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/common/Avatar";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { MainContent } from "../components/layout/MainContent";
import { errorMessage, formatDate } from "../utils/format";
import { queryKeys } from "../utils/queryKeys";
import { renderMessageContent } from "../utils/renderContent";

export function UserMessagesPage() {
  const { userId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const numericUserId = Number(userId);
  const fromWorkspaceParam = Number(params.get("from"));
  const fromWorkspaceId = Number.isFinite(fromWorkspaceParam) && fromWorkspaceParam > 0 ? fromWorkspaceParam : null;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dmError, setDmError] = useState("");

  const query = useQuery({
    queryKey: queryKeys.userMessages(numericUserId),
    queryFn: () => messageApi.listByUser(numericUserId),
    enabled: Number.isFinite(numericUserId),
  });
  const myWorkspacesQuery = useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: workspaceApi.list,
  });

  const dmMutation = useMutation({
    mutationFn: (workspaceId: number) =>
      channelApi.createDirectMessage(workspaceId, { targetUserId: numericUserId }),
    onSuccess: async (channel, workspaceId) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.channels(workspaceId) });
      navigate(`/app/workspaces/${workspaceId}/channels/${channel.channelId}`);
    },
    onError: (err) => setDmError(errorMessage(err)),
  });

  useEffect(() => {
    setDmError("");
  }, [numericUserId]);

  const first = query.data?.[0];
  const displayName = first?.postedByNickname ?? first?.postedByUsername ?? `user #${numericUserId}`;
  const username = first?.postedByUsername;
  const isSelf = currentUser?.userId === numericUserId;

  const sharedWorkspaces = useMemo(() => {
    const myIds = new Set((myWorkspacesQuery.data ?? []).map((w) => w.workspaceId));
    const seen = new Map<number, string>();
    for (const m of query.data ?? []) {
      if (myIds.has(m.workspaceId) && !seen.has(m.workspaceId)) {
        seen.set(m.workspaceId, m.workspaceName);
      }
    }
    return Array.from(seen, ([workspaceId, workspaceName]) => ({ workspaceId, workspaceName }));
  }, [query.data, myWorkspacesQuery.data]);

  const directDmWorkspaceId = fromWorkspaceId && sharedWorkspaces.some((w) => w.workspaceId === fromWorkspaceId)
    ? fromWorkspaceId
    : null;

  function startDm(workspaceId: number) {
    setDmError("");
    setPickerOpen(false);
    dmMutation.mutate(workspaceId);
  }

  return (
    <MainContent>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={displayName} className="h-12 w-12 text-base" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-slate-950">{displayName}</h1>
            {username ? <p className="truncate text-sm text-slate-500">@{username}</p> : null}
          </div>
        </div>
        {!isSelf && sharedWorkspaces.length > 0 ? (
          <div className="relative">
            {directDmWorkspaceId ? (
              <Button
                leftIcon={<MessageSquare className="h-4 w-4" />}
                isLoading={dmMutation.isPending}
                onClick={() => startDm(directDmWorkspaceId)}
              >
                Direct message
              </Button>
            ) : sharedWorkspaces.length === 1 ? (
              <Button
                leftIcon={<MessageSquare className="h-4 w-4" />}
                isLoading={dmMutation.isPending}
                onClick={() => startDm(sharedWorkspaces[0].workspaceId)}
              >
                Direct message
              </Button>
            ) : (
              <>
                <Button
                  leftIcon={<MessageSquare className="h-4 w-4" />}
                  isLoading={dmMutation.isPending}
                  onClick={() => setPickerOpen((open) => !open)}
                >
                  Direct message
                </Button>
                {pickerOpen ? (
                  <div className="absolute right-0 top-full z-10 mt-1 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      In which workspace?
                    </div>
                    <ul>
                      {sharedWorkspaces.map((ws) => (
                        <li key={ws.workspaceId}>
                          <button
                            type="button"
                            onClick={() => startDm(ws.workspaceId)}
                            className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                          >
                            {ws.workspaceName}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>
      {dmError ? <p className="mt-3 text-sm text-red-600">{dmError}</p> : null}
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
            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
              {renderMessageContent(message.content)}
            </p>
          </Link>
        ))}
      </div>
    </MainContent>
  );
}
