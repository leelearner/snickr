import { FormEvent, useState } from "react";
import { LogOut, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Avatar } from "../common/Avatar";
import { Button } from "../common/Button";

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
    <header className="flex h-11 shrink-0 items-center justify-end gap-3 border-b border-slate-200 bg-white px-3">
      <form className="w-full max-w-md" onSubmit={submitSearch}>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1.5 h-4 w-4 text-slate-400" />
          <input
            className="h-7 w-full rounded-md border border-slate-300 bg-slate-50 pl-8 pr-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            placeholder="Search messages"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </form>
      <Avatar name={user?.nickname ?? user?.username} className="h-7 w-7" />
      <Button variant="ghost" className="h-7 px-2" onClick={handleLogout} title="Log out">
        <LogOut className="h-4 w-4" />
      </Button>
    </header>
  );
}
