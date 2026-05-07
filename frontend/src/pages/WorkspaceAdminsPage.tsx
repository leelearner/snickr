import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "../api/workspaces";
import { Avatar } from "../components/common/Avatar";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { MainContent } from "../components/layout/MainContent";
import { queryKeys } from "../utils/queryKeys";
import { displayName as safeDisplayName } from "../utils/displayName";
import type { WorkspaceAdmin } from "../types/api";

interface AdminGroup {
  workspaceId: number;
  workspaceName: string;
  admins: WorkspaceAdmin[];
}

function groupByWorkspace(entries: WorkspaceAdmin[]): AdminGroup[] {
  const map = new Map<number, AdminGroup>();
  for (const entry of entries) {
    const existing = map.get(entry.workspaceId);
    if (existing) {
      existing.admins.push(entry);
    } else {
      map.set(entry.workspaceId, {
        workspaceId: entry.workspaceId,
        workspaceName: entry.workspaceName,
        admins: [entry],
      });
    }
  }
  return Array.from(map.values());
}

export function WorkspaceAdminsPage() {
  const query = useQuery({ queryKey: queryKeys.admins, queryFn: workspaceApi.listAdmins });
  const groups = query.data ? groupByWorkspace(query.data) : [];

  return (
    <MainContent>
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-slate-700" />
        <div>
          <h1 className="text-xl font-semibold text-slate-950">Workspace admins</h1>
          <p className="text-sm text-slate-500">
            Admins across the workspaces you belong to.
          </p>
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {query.isLoading ? <LoadingSpinner /> : null}
        {query.error ? <ErrorState error={query.error} /> : null}
        {query.data?.length === 0 ? <EmptyState title="No admins found" /> : null}
        {groups.map((group) => (
          <Fragment key={group.workspaceId}>
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                <Link
                  to={`/app/workspaces/${group.workspaceId}`}
                  className="text-sm font-semibold text-slate-950 hover:underline"
                >
                  {group.workspaceName}
                </Link>
                <span className="text-xs text-slate-500">
                  {group.admins.length} admin{group.admins.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {group.admins.map((admin) => (
                  <div key={`${admin.workspaceId}-${admin.userId}`} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar name={safeDisplayName(admin.nickname, admin.username)} className="h-8 w-8" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">
                        {safeDisplayName(admin.nickname, admin.username)}
                      </p>
                      <p className="truncate text-xs text-slate-500">@{admin.username}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </Fragment>
        ))}
      </div>
    </MainContent>
  );
}
