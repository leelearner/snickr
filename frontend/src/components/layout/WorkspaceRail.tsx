import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Inbox, Plus, Search, ShieldCheck, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "../../api/workspaces";
import { CreateWorkspaceDialog } from "../workspaces/CreateWorkspaceDialog";
import { initials } from "../../utils/format";
import { queryKeys } from "../../utils/queryKeys";

export function WorkspaceRail({ selectedWorkspaceId }: { selectedWorkspaceId?: number }) {
  const [createOpen, setCreateOpen] = useState(false);
  const { data = [] } = useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: workspaceApi.list,
  });

  return (
    <aside className="flex h-full flex-col items-center gap-3 bg-slate-950 py-3 text-slate-300">
      <Link
        to="/app/workspaces"
        className="mb-1 flex h-10 w-10 items-center justify-center rounded-md bg-white text-sm font-bold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        title="Snickr workspaces"
      >
        S
      </Link>
      <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto">
        {data.map((workspace) => {
          const active = workspace.workspaceId === selectedWorkspaceId;
          return (
            <NavLink
              key={workspace.workspaceId}
              to={`/app/workspaces/${workspace.workspaceId}`}
              title={workspace.name}
              className={`flex h-10 w-10 items-center justify-center rounded-md text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                active
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              {initials(workspace.name)}
            </NavLink>
          );
        })}
        <button
          className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-800 text-slate-200 transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          title="Create workspace"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-col items-center gap-2 border-t border-slate-800 pt-3">
        <NavLink to="/app/search" title="Search" className="rail-link">
          <Search className="h-4 w-4" />
        </NavLink>
        <NavLink to="/app/invitations" title="Invitations" className="rail-link">
          <Inbox className="h-4 w-4" />
        </NavLink>
        <NavLink to="/app/admins" title="Workspace admins" className="rail-link">
          <ShieldCheck className="h-4 w-4" />
        </NavLink>
        <NavLink to="/app/profile" title="Profile" className="rail-link">
          <User className="h-4 w-4" />
        </NavLink>
      </div>
      <CreateWorkspaceDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </aside>
  );
}
