import { Outlet, useParams } from "react-router-dom";
import { ChannelSidebar } from "./ChannelSidebar";
import { TopBar } from "./TopBar";
import { WorkspaceRail } from "./WorkspaceRail";

export function AppShell() {
  const { workspaceId } = useParams();
  const selectedWorkspaceId = workspaceId ? Number(workspaceId) : undefined;

  return (
    <div className="grid h-full min-h-screen grid-cols-[72px_minmax(220px,280px)_1fr] bg-white max-lg:grid-cols-[64px_220px_minmax(0,1fr)] max-md:grid-cols-[56px_minmax(0,1fr)]">
      <WorkspaceRail selectedWorkspaceId={selectedWorkspaceId} />
      <div className="border-r border-slate-800 bg-slate-900 text-slate-100 max-md:hidden">
        <ChannelSidebar workspaceId={selectedWorkspaceId} />
      </div>
      <div className="flex min-w-0 flex-col bg-white">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-auto bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
