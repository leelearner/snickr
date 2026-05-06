import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Home, Inbox, Plus, ShieldCheck, User, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "../../api/workspaces";
import { CreateWorkspaceDialog } from "../workspaces/CreateWorkspaceDialog";
import { initials } from "../../utils/format";
import { queryKeys } from "../../utils/queryKeys";

interface RailNavProps {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}

function RailNav({ to, icon: Icon, label, end }: RailNavProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex w-full flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
          isActive
            ? "bg-slate-800 text-white"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`
      }
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </NavLink>
  );
}

export function WorkspaceRail({ selectedWorkspaceId }: { selectedWorkspaceId?: number }) {
  const [createOpen, setCreateOpen] = useState(false);
  const { data = [] } = useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: workspaceApi.list,
  });

  return (
    <aside className="flex h-full w-full flex-col bg-slate-950 px-1.5 py-2 text-slate-300">
      <nav className="flex flex-col gap-1">
        <RailNav to="/app/workspaces" icon={Home} label="Home" end />
        <RailNav to="/app/invitations" icon={Inbox} label="Activity" />
        <RailNav to="/app/admins" icon={ShieldCheck} label="Admins" />
      </nav>

      <div className="my-2 h-px bg-slate-800" />

      <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto py-1">
        {data.map((workspace) => {
          const active = workspace.workspaceId === selectedWorkspaceId;
          return (
            <NavLink
              key={workspace.workspaceId}
              to={`/app/workspaces/${workspace.workspaceId}`}
              title={workspace.name}
              className={`flex h-10 w-10 items-center justify-center rounded-md text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                active
                  ? "bg-blue-700 text-white"
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

      <div className="mt-2 border-t border-slate-800 pt-2">
        <RailNav to="/app/profile" icon={User} label="Profile" />
      </div>

      <CreateWorkspaceDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </aside>
  );
}
