import { Link } from "react-router-dom";
import type { SearchResult } from "../../types/api";
import { formatDate } from "../../utils/format";

export function SearchResultItem({ result }: { result: SearchResult }) {
  return (
    <Link
      to={`/app/workspaces/${result.workspaceId}/channels/${result.channelId}`}
      className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-slate-950">{result.workspaceName}</span>
        <span className="text-slate-400">/</span>
        <span className="font-medium text-slate-700"># {result.channelName}</span>
        <span className="text-slate-400">-</span>
        <span className="font-bold text-slate-700">@{result.postedByUsername}</span>
        <time className="text-slate-400">{formatDate(result.postedTime)}</time>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
        {result.content}
      </p>
    </Link>
  );
}
