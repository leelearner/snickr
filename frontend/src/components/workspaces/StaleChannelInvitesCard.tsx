import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "../../api/workspaces";
import { queryKeys } from "../../utils/queryKeys";
import { EmptyState } from "../common/EmptyState";
import { ErrorState } from "../common/ErrorState";
import { LoadingSpinner } from "../common/LoadingSpinner";

export function StaleChannelInvitesCard({ workspaceId }: { workspaceId: number }) {
  const query = useQuery({
    queryKey: queryKeys.staleInvites(workspaceId),
    queryFn: () => workspaceApi.getStaleChannelInvites(workspaceId),
  });

  if (query.isLoading) return <LoadingSpinner label="Loading stale invites" />;
  if (query.error) return <ErrorState error={query.error} />;

  const stale = (query.data ?? []).filter((item) => item.pendingInvitesOver5Days > 0);
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-950">Stale channel invitations</h2>
      <p className="mt-1 text-sm text-slate-500">Pending public channel invitations older than five days.</p>
      {stale.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No stale channel invites" description="No pending channel invitations are older than 5 days." />
        </div>
      ) : (
        <div className="mt-4 divide-y divide-slate-200">
          {stale.map((item) => (
            <div key={item.channelId} className="flex items-center justify-between py-3 text-sm">
              <span className="font-medium text-slate-900"># {item.channelName}</span>
              <span className="text-slate-500">{item.pendingInvitesOver5Days} pending</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
