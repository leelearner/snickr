import { FormEvent, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { searchApi } from "../api/search";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { Input } from "../components/common/Input";
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

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    navigate(trimmed ? `/app/search?q=${encodeURIComponent(trimmed)}` : "/app/search");
  }

  return (
    <MainContent>
      <h1 className="text-xl font-semibold text-slate-950">Search messages</h1>
      <form className="mt-6 flex gap-2" onSubmit={submit}>
        <div className="flex-1">
          <Input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Keyword" />
        </div>
        <Button leftIcon={<Search className="h-4 w-4" />}>Search</Button>
      </form>
      <div className="mt-6">
        {!q ? <EmptyState title="Enter a keyword" /> : null}
        {query.isLoading ? <LoadingSpinner /> : null}
        {query.error ? <ErrorState error={query.error} /> : null}
        {q && query.data?.length === 0 ? <EmptyState title="No matching messages" /> : null}
        <div className="space-y-3">
          {query.data?.map((result) => (
            <SearchResultItem key={result.messageId} result={result} />
          ))}
        </div>
      </div>
    </MainContent>
  );
}
