import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { searchApi } from "../api/search";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { MainContent } from "../components/layout/MainContent";
import { SearchResultItem } from "../components/search/SearchResultItem";
import { queryKeys } from "../utils/queryKeys";

export function SearchPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const q = useMemo(() => (params.get("q") ?? "").trim(), [params]);
  const [value, setValue] = useState(q);
  const query = useQuery({
    queryKey: queryKeys.search(q),
    queryFn: () => searchApi.search(q),
    enabled: q.length > 0,
  });

  useEffect(() => {
    setValue(q);
  }, [q]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    navigate(trimmed ? `/app/search?q=${encodeURIComponent(trimmed)}` : "/app/search");
  }

  const resultCount = query.data?.length ?? 0;

  return (
    <MainContent>
      <h1 className="text-xl font-semibold text-slate-950">Search messages</h1>
      <form className="mt-4 flex gap-2" onSubmit={submit}>
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Search visible messages"
            className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </label>
      </form>
      {q ? (
        <p className="mt-3 text-sm text-slate-500">
          {query.isLoading
            ? `Searching for "${q}"...`
            : `${resultCount} result${resultCount === 1 ? "" : "s"} for "${q}"`}
        </p>
      ) : null}
      <div className="mt-4">
        {!q ? <EmptyState title="Enter a keyword" description="Search runs across messages in channels you can see." /> : null}
        {query.isLoading ? <LoadingSpinner /> : null}
        {query.error ? <ErrorState error={query.error} /> : null}
        {q && resultCount === 0 && !query.isLoading && !query.error ? (
          <EmptyState title="No matching messages" description={`Nothing matched "${q}".`} />
        ) : null}
        <div className="space-y-2">
          {query.data?.map((result) => (
            <SearchResultItem key={result.messageId} result={result} />
          ))}
        </div>
      </div>
    </MainContent>
  );
}
