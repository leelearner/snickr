import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { CircleUserRound, Home, Inbox, Plus, ShieldCheck, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "../../api/workspaces";
import { channelApi } from "../../api/channels";
import { mentionsApi } from "../../api/mentions";
import { CreateWorkspaceDialog } from "../workspaces/CreateWorkspaceDialog";
import { initials } from "../../utils/format";
import { queryKeys } from "../../utils/queryKeys";
import { INBOX_LAST_SEEN_KEY, INBOX_SEEN_EVENT, readInboxLastSeen } from "../../utils/inboxSeen";

interface RailNavProps {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  badge?: number;
}

function RailNav({ to, icon: Icon, label, end, badge }: RailNavProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex w-full flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
          isActive
            ? "bg-slate-800 text-white"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`
      }
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
      {badge && badge > 0 ? (
        <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </NavLink>
  );
}

export function WorkspaceRail({ selectedWorkspaceId }: { selectedWorkspaceId?: number }) {
  const [createOpen, setCreateOpen] = useState(false);
  const { data = [] } = useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: workspaceApi.list,
  });
  const wsInvitesQuery = useQuery({
    queryKey: queryKeys.workspaceInvitations,
    queryFn: workspaceApi.listMyInvitations,
  });
  const chInvitesQuery = useQuery({
    queryKey: queryKeys.channelInvitations,
    queryFn: channelApi.listMyInvitations,
  });
  const mentionsQuery = useQuery({
    queryKey: queryKeys.mentions,
    queryFn: mentionsApi.list,
  });

  // Bootstrap the baseline on first ever load so a returning user does not see
  // every historical mention counted as unread.
  useEffect(() => {
    if (localStorage.getItem(INBOX_LAST_SEEN_KEY) == null) {
      localStorage.setItem(INBOX_LAST_SEEN_KEY, String(Date.now()));
    }
  }, []);

  // Subscribe to lastSeen changes so the badge clears immediately when the
  // user visits the Inbox or hits "Mark all as read".
  const [, setSeenTick] = useState(0);
  useEffect(() => {
    const bump = () => setSeenTick((n) => n + 1);
    window.addEventListener(INBOX_SEEN_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(INBOX_SEEN_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);
  const lastSeen = readInboxLastSeen();
  const unreadMentions = (mentionsQuery.data ?? []).filter((m) => {
    const t = new Date(m.postedTime).getTime();
    return Number.isFinite(t) && t > lastSeen;
  }).length;
  const inboxBadge =
    (wsInvitesQuery.data?.length ?? 0) + (chInvitesQuery.data?.length ?? 0) + unreadMentions;

  return (
    <aside className="flex h-full w-full flex-col bg-slate-950 px-1.5 py-2 text-slate-300">
      <nav className="flex flex-col gap-1">
        <RailNav to="/app/workspaces" icon={Home} label="Home" end />
        <RailNav to="/app/invitations" icon={Inbox} label="Inbox" badge={inboxBadge} />
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
        <RailNav to="/app/profile" icon={CircleUserRound} label="Profile" />
      </div>

      <CreateWorkspaceDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </aside>
  );
}
