import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "../api/workspaces";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { MainContent } from "../components/layout/MainContent";
import { CreateWorkspaceDialog } from "../components/workspaces/CreateWorkspaceDialog";
import { queryKeys } from "../utils/queryKeys";

export function WorkspaceListPage() {
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: queryKeys.workspaces, queryFn: workspaceApi.list });

  return (
    <MainContent>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-950">Workspaces</h1>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
          New workspace
        </Button>
      </div>
      {query.isLoading ? <LoadingSpinner /> : null}
      {query.error ? <ErrorState error={query.error} /> : null}
      {query.data?.length === 0 ? (
        <EmptyState title="No workspaces yet" description="Create one to start channels, members, invites, and messages." />
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {query.data?.map((workspace) => (
          <Link
            key={workspace.workspaceId}
            to={`/app/workspaces/${workspace.workspaceId}`}
            className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">{workspace.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{workspace.description ?? "No description"}</p>
              </div>
              <Badge tone={workspace.myRole === "admin" ? "blue" : "neutral"}>{workspace.myRole}</Badge>
            </div>
          </Link>
        ))}
      </div>
      <CreateWorkspaceDialog open={open} onClose={() => setOpen(false)} />
    </MainContent>
  );
}
