export const queryKeys = {
  me: ["auth", "me"] as const,
  workspaces: ["workspaces"] as const,
  workspace: (workspaceId: number) => ["workspaces", workspaceId] as const,
  admins: ["workspaces", "admins"] as const,
  staleInvites: (workspaceId: number) => ["workspaces", workspaceId, "stale-invites"] as const,
  channels: (workspaceId: number) => ["workspaces", workspaceId, "channels"] as const,
  channel: (channelId: number) => ["channels", channelId] as const,
  messages: (channelId: number) => ["channels", channelId, "messages"] as const,
  userMessages: (userId: number) => ["users", userId, "messages"] as const,
  workspaceInvitations: ["me", "workspace-invitations"] as const,
  channelInvitations: ["me", "channel-invitations"] as const,
  search: (q: string) => ["search", q] as const,
};
