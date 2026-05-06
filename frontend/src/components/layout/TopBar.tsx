import { FormEvent, useState } from "react";
import { LogOut, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Avatar } from "../common/Avatar";

export function TopBar() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [search, setSearch] = useState("");

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
    <header className="flex h-11 shrink-0 items-center justify-end gap-3 border-b border-slate-800 bg-slate-950 px-3">
      <form className="w-full max-w-md" onSubmit={submitSearch}>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1.5 h-4 w-4 text-slate-400" />
          <input
            className="h-7 w-full rounded-md border border-slate-700 bg-slate-900 pl-8 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-700"
            placeholder="Search messages"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </form>
      <Avatar name={user?.nickname ?? user?.username} className="h-7 w-7 text-xs" />
      <button
        type="button"
        onClick={handleLogout}
        title="Log out"
        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-300 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </header>
  );
}
