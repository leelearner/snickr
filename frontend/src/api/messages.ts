import { apiRequest } from "./http";
import type { MessageCreatePayload, MessageOut, UserMessage } from "../types/api";

export const messageApi = {
  list(channelId: number) {
    return apiRequest<MessageOut[]>(`/api/channels/${channelId}/messages`);
  },
  create(channelId: number, payload: MessageCreatePayload) {
    return apiRequest<MessageOut>(`/api/channels/${channelId}/messages`, {
      method: "POST",
      body: payload,
    });
  },
  listByUser(targetUserId: number) {
    return apiRequest<UserMessage[]>(`/api/users/${targetUserId}/messages`);
  },
};
