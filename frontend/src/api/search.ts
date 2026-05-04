import { apiRequest } from "./http";
import type { SearchResult } from "../types/api";

export const searchApi = {
  search(q: string) {
    return apiRequest<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`);
  },
};
