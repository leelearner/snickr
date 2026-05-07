import { apiRequest } from './http';
import type { MessageCreatePayload, MessageOut, UserMessage } from '../types/api';

export const messageApi = {
  list(channelId: number) {
    return apiRequest<MessageOut[]>(`/api/channels/${channelId}/messages`);
  },
  create(channelId: number, payload: MessageCreatePayload) {
    return apiRequest<MessageOut>(`/api/channels/${channelId}/messages`, {
      method: 'POST',
      body: payload,
    });
  },
  update(channelId: number, messageId: number, payload: MessageCreatePayload) {
    return apiRequest<MessageOut>(`/api/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      body: payload,
    });
  },
  delete(channelId: number, messageId: number) {
    return apiRequest<void>(`/api/channels/${channelId}/messages/${messageId}`, {
      method: 'DELETE',
    });
  },
  listByUser(targetUserId: number) {
    return apiRequest<UserMessage[]>(`/api/users/${targetUserId}/messages`);
  },
  listReplies(channelId: number, messageId: number) {
    return apiRequest<MessageOut[]>(`/api/channels/${channelId}/messages/${messageId}/replies`);
  },
};
