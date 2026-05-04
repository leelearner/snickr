import { FormEvent, useState } from "react";
import { LogOut, Search } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { channelApi } from "../../api/channels";
import { useAuth } from "../../context/AuthContext";
import { Avatar } from "../common/Avatar";
import { Button } from "../common/Button";
import { queryKeys } from "../../utils/queryKeys";

export function TopBar() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { channelId } = useParams();
  const [search, setSearch] = useState("");
  const numericChannelId = channelId ? Number(channelId) : undefined;
  const channelQuery = useQuery({
    queryKey: numericChannelId ? queryKeys.channel(numericChannelId) : ["channel", "none"],
    queryFn: () => channelApi.get(numericChannelId!),
    enabled: Boolean(numericChannelId),
  });

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const q = search.trim();
    navigate(q ? `/app/search?q=${encodeURIComponent(q)}` : "/app/search");
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-950">
          {channelQuery.data ? `# ${channelQuery.data.channelName}` : "Snickr"}
        </p>
        <p className="truncate text-xs text-slate-500">
          {channelQuery.data?.isMember === false ? "Join this public channel to read and post." : "Team workspace"}
        </p>
      </div>
      <form className="hidden min-w-48 flex-1 max-w-md sm:block" onSubmit={submitSearch}>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="h-9 w-full rounded-md border border-slate-300 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            placeholder="Search visible messages"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </form>
      <div className="flex items-center gap-2">
        <Avatar name={user?.nickname ?? user?.username} className="h-8 w-8" />
        <Button variant="ghost" className="h-8 px-2" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
