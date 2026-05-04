import { apiRequest } from "./http";
import type {
  InviteResponsePayload,
  InviteUserPayload,
  RoleChangePayload,
  StaleChannelInvite,
  WorkspaceAdmin,
  WorkspaceCreatePayload,
  WorkspaceDetail,
  WorkspaceInvitation,
  WorkspaceSummary,
} from "../types/api";

export const workspaceApi = {
  list() {
    return apiRequest<WorkspaceSummary[]>("/api/workspaces");
  },
  create(payload: WorkspaceCreatePayload) {
    return apiRequest<WorkspaceSummary>("/api/workspaces", {
      method: "POST",
      body: payload,
    });
  },
  listAdmins() {
    return apiRequest<WorkspaceAdmin[]>("/api/workspaces/admins");
  },
  get(workspaceId: number) {
    return apiRequest<WorkspaceDetail>(`/api/workspaces/${workspaceId}`);
  },
  inviteUser(workspaceId: number, payload: InviteUserPayload) {
    return apiRequest<{ invitationId: number }>(`/api/workspaces/${workspaceId}/invitations`, {
      method: "POST",
      body: payload,
    });
  },
  getStaleChannelInvites(workspaceId: number) {
    return apiRequest<StaleChannelInvite[]>(
      `/api/workspaces/${workspaceId}/stale-channel-invites`,
    );
  },
  removeMember(workspaceId: number, targetUserId: number) {
    return apiRequest<void>(`/api/workspaces/${workspaceId}/members/${targetUserId}`, {
      method: "DELETE",
    });
  },
  updateMemberRole(workspaceId: number, targetUserId: number, payload: RoleChangePayload) {
    return apiRequest<{ ok: boolean; role: string }>(
      `/api/workspaces/${workspaceId}/members/${targetUserId}/role`,
      { method: "PATCH", body: payload },
    );
  },
  listMyInvitations() {
    return apiRequest<WorkspaceInvitation[]>("/api/me/workspace-invitations");
  },
  respondToInvitation(invitationId: number, payload: InviteResponsePayload) {
    return apiRequest<{ ok: boolean; status: string }>(
      `/api/me/workspace-invitations/${invitationId}`,
      { method: "POST", body: payload },
    );
  },
};
