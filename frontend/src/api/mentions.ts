import { apiRequest } from "./http";
import type { MentionOut } from "../types/api";

export const mentionsApi = {
  list() {
    return apiRequest<MentionOut[]>("/api/me/mentions");
  },
};
