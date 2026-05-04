import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "../api/workspaces";
import { Avatar } from "../components/common/Avatar";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { MainContent } from "../components/layout/MainContent";
import { queryKeys } from "../utils/queryKeys";

export function WorkspaceAdminsPage() {
  const query = useQuery({ queryKey: queryKeys.admins, queryFn: workspaceApi.listAdmins });

  return (
    <MainContent>
      <h1 className="text-xl font-semibold text-slate-950">Workspace admins</h1>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white">
        {query.isLoading ? <LoadingSpinner /> : null}
        {query.error ? <div className="p-4"><ErrorState error={query.error} /></div> : null}
        {query.data?.length === 0 ? <div className="p-4"><EmptyState title="No admins found" /></div> : null}
        <div className="divide-y divide-slate-200">
          {query.data?.map((admin) => (
            <div key={`${admin.workspaceId}-${admin.userId}`} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={admin.nickname ?? admin.username} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-950">{admin.nickname ?? admin.username}</p>
                  <p className="truncate text-sm text-slate-500">@{admin.username}</p>
                </div>
              </div>
              <Link className="text-sm font-medium text-blue-700 hover:underline" to={`/app/workspaces/${admin.workspaceId}`}>
                {admin.workspaceName}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </MainContent>
  );
}
