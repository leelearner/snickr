export type WorkspaceRole = "admin" | "member";
export type ChannelType = "public" | "private" | "direct";

export interface UserOut {
  userId: number;
  email: string;
  username: string;
  nickname: string | null;
  createdTime: string | null;
}

export interface WorkspaceSummary {
  workspaceId: number;
  name: string;
  description: string | null;
  myRole: WorkspaceRole | string;
}

export interface WorkspaceDetail {
  workspaceId: number;
  name: string;
  description: string | null;
  createdTime: string;
  createdBy: number | null;
  myRole: WorkspaceRole | string;
  members: WorkspaceMember[];
}

export interface WorkspaceMember {
  userId: number;
  username: string;
  nickname: string | null;
  role: WorkspaceRole | string;
  joinedTime: string;
}

export interface WorkspaceAdmin {
  workspaceId: number;
  workspaceName: string;
  userId: number;
  username: string;
  nickname: string | null;
}

export interface StaleChannelInvite {
  channelId: number;
  channelName: string;
  pendingInvitesOver5Days: number;
}

export interface ChannelSummary {
  channelId: number;
  channelName: string;
  type: ChannelType;
  isMember: boolean;
  directUserId?: number | null;
  directUsername?: string | null;
  directNickname?: string | null;
}

export interface ChannelDetail {
  channelId: number;
  workspaceId: number;
  channelName: string;
  type: ChannelType;
  createdBy: number;
  createdTime: string;
  isMember: boolean;
  members: ChannelMember[];
}

export interface ChannelMember {
  userId: number;
  username: string;
  nickname: string | null;
  joinedTime: string;
}

export interface MessageOut {
  messageId: number;
  content: string;
  postedTime: string;
  postedBy: number;
  postedByUsername: string;
  postedByNickname: string | null;
}

export interface UserMessage {
  messageId: number;
  content: string;
  postedTime: string;
  workspaceId: number;
  workspaceName: string;
  channelId: number;
  channelName: string;
  postedBy: number;
  postedByUsername: string;
  postedByNickname: string | null;
}

export type SearchResult = UserMessage;

export interface WorkspaceInvitation {
  invitationId: number;
  workspaceId: number;
  workspaceName: string;
  inviterUsername: string;
  invitedTime: string;
}

export interface ChannelInvitation {
  invitationId: number;
  channelId: number;
  channelName: string;
  workspaceId: number;
  workspaceName: string;
  inviterUsername: string;
  invitedTime: string;
}

export interface ApiError extends Error {
  detail: string;
  status: number;
}

export interface HealthOut {
  ok: boolean;
  db: string;
}

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
  nickname?: string | null;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface ProfileUpdatePayload {
  email?: string;
  nickname?: string | null;
  currentPassword?: string;
  newPassword?: string;
}

export interface WorkspaceCreatePayload {
  name: string;
  description?: string | null;
}

export interface InviteUserPayload {
  username: string;
}

export interface InviteResponsePayload {
  accept: boolean;
}

export interface RoleChangePayload {
  role: WorkspaceRole;
}

export interface ChannelCreatePayload {
  channelName: string;
  type: Exclude<ChannelType, "direct">;
}

export interface DirectMessageCreatePayload {
  targetUserId: number;
}

export interface MessageCreatePayload {
  content: string;
}
