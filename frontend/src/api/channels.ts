import { apiRequest } from "./http";
import type {
  ChannelCreatePayload,
  ChannelDetail,
  ChannelInvitation,
  ChannelSummary,
  DirectMessageCreatePayload,
  InviteResponsePayload,
  InviteUserPayload,
} from "../types/api";

export const channelApi = {
  list(workspaceId: number) {
    return apiRequest<ChannelSummary[]>(`/api/workspaces/${workspaceId}/channels`);
  },
  create(workspaceId: number, payload: ChannelCreatePayload) {
    return apiRequest<ChannelSummary>(`/api/workspaces/${workspaceId}/channels`, {
      method: "POST",
      body: payload,
    });
  },
  createDirectMessage(workspaceId: number, payload: DirectMessageCreatePayload) {
    return apiRequest<ChannelSummary>(`/api/workspaces/${workspaceId}/direct-messages`, {
      method: "POST",
      body: payload,
    });
  },
  get(channelId: number) {
    return apiRequest<ChannelDetail>(`/api/channels/${channelId}`);
  },
  join(channelId: number) {
    return apiRequest<{ ok: boolean }>(`/api/channels/${channelId}/join`, {
      method: "POST",
    });
  },
  inviteUser(channelId: number, payload: InviteUserPayload) {
    return apiRequest<{ invitationId: number }>(`/api/channels/${channelId}/invitations`, {
      method: "POST",
      body: payload,
    });
  },
  listMyInvitations() {
    return apiRequest<ChannelInvitation[]>("/api/me/channel-invitations");
  },
  respondToInvitation(invitationId: number, payload: InviteResponsePayload) {
    return apiRequest<{ ok: boolean; status: string }>(
      `/api/me/channel-invitations/${invitationId}`,
      { method: "POST", body: payload },
    );
  },
};
