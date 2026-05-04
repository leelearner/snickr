# Snickr Frontend Design

## 1. Design Decisions Summary

Snickr is implemented as a real productivity app rather than a landing page. The frontend trusts the FastAPI backend as the source of truth and only calls documented endpoints. Session state is never read from cookies; `AuthProvider` calls `GET /api/auth/me` and treats `401` as logged out. All authenticated requests use `credentials: "include"`.

TanStack Query owns server state for users, workspaces, channels, messages, invitations, admins, stale invites, search results, and user message history. Mutations use conservative invalidation instead of optimistic updates, which keeps concurrency behavior easy to explain during a database course demo.

User-generated content is rendered as React text with `whitespace-pre-wrap`; no component uses `dangerouslySetInnerHTML`.

## 2. Visual Style

The app uses a Slack-like three-column product layout:

- left workspace rail: `slate-950`
- channel sidebar: `slate-900`
- main content: white and slate-neutral surfaces
- restrained blue, emerald, amber, and red state colors
- Material-style focus rings, hover states, disabled states, modal surfaces, and form controls

There are no pastel gradients, glassmorphism, neon effects, marketing hero blocks, or decorative illustrations.

## 3. Route Table

| Route | Purpose | Params/query | Main APIs | Main actions | States and status handling |
| --- | --- | --- | --- | --- | --- |
| `/login` | Log in | none | `POST /api/auth/login` | submit username/password | validation errors inline; success redirects `/app/workspaces`; `401` shows backend detail |
| `/register` | Register | none | `POST /api/auth/register` | create user | `409` duplicate email/username shown inline |
| `/app` | Protected app root | none | `GET /api/auth/me` | redirect | unauthenticated users redirect to `/login` |
| `/app/workspaces` | Workspace list | none | `GET /api/workspaces`, `POST /api/workspaces` | create/open workspace | empty state when no workspaces |
| `/app/workspaces/:workspaceId` | Workspace home | `workspaceId` | `GET /api/workspaces/{id}`, `GET /api/workspaces/{id}/channels`, stale invites | invite workspace user, open channel/member pages | `403/404` via error state |
| `/app/workspaces/:workspaceId/channels/:channelId` | Channel messages | `workspaceId`, `channelId` | `GET /api/channels/{id}`, `GET/POST /api/channels/{id}/messages`, `POST /api/channels/{id}/join` | join public channel, send message, invite channel user | non-member public channel disables composer; `403/404` shown |
| `/app/workspaces/:workspaceId/members` | Workspace members | `workspaceId` | `GET /api/workspaces/{id}`, member role/remove endpoints | promote/demote/remove/invite | admin-only controls; `409` last-admin protection shown |
| `/app/workspaces/:workspaceId/invitations` | Workspace tools | `workspaceId` | same as members plus stale invite query | invite workspace user, inspect stale channel invites | membership-based entry point |
| `/app/invitations` | My invitations | none | `GET /api/me/workspace-invitations`, `GET /api/me/channel-invitations`, response endpoints | accept/decline | `409` already handled by showing detail and refreshing lists |
| `/app/search?q=...` | Message search | `q` | `GET /api/search?q=...` | search visible messages | blank q does not call API; empty result state |
| `/app/profile` | Profile | none | `GET/PATCH /api/auth/me` | update email/nickname/password | current password errors shown near form |
| `/app/users/:userId/messages` | User message history | `userId` | `GET /api/users/{id}/messages` | navigate to channel | empty state if no posts |
| `/app/admins` | Workspace admins report | none | `GET /api/workspaces/admins` | inspect admin join query | demo-friendly relational query page |

## 4. API And Page Mapping

- Auth: `LoginPage`, `RegisterPage`, `ProfilePage`, `AuthProvider`
- Workspace: `WorkspaceRail`, `WorkspaceListPage`, `WorkspaceHomePage`, `WorkspaceMembersPage`
- Channel: `ChannelSidebar`, `ChannelPage`, channel dialogs and join button
- Message: `MessageList`, `MessageItem`, `MessageComposer`, `UserMessagesPage`
- Invitations: `InvitationsPage`, invitation cards
- Search: `SearchPage`, `SearchResultItem`
- Reports: `WorkspaceAdminsPage`, `StaleChannelInvitesCard`

## 5. TypeScript Models

Core response and payload models are defined in `src/types/api.ts`, including:

- `UserOut`
- `WorkspaceSummary`, `WorkspaceDetail`, `WorkspaceMember`, `WorkspaceAdmin`
- `StaleChannelInvite`
- `ChannelSummary`, `ChannelDetail`, `ChannelMember`
- `MessageOut`, `UserMessage`, `SearchResult`
- `WorkspaceInvitation`, `ChannelInvitation`
- `ApiError`

## 6. Project Directory

```text
frontend/
  index.html
  package.json
  tailwind.config.js
  src/
    api/
    components/
    context/
    pages/
    types/
    utils/
```

## 7. Core Code Files

The main entry points are:

- `src/main.tsx`
- `src/App.tsx`
- `src/api/http.ts`
- `src/context/AuthContext.tsx`
- `src/components/layout/AppShell.tsx`
- `src/pages/ChannelPage.tsx`

## 8. Demo Data Suggestions

Create three users:

- `alice` as workspace owner/admin
- `bob` as normal member
- `charlie` as invite target

Create one workspace named `Database Lab`, public channels `general` and `project-2`, and a private channel `staff`. Post several messages containing searchable terms like `index`, `transaction`, and `foreign key`.

## 9. Demo Flow Script

1. Register or log in as `alice`.
2. Create `Database Lab`.
3. Create public and private channels.
4. Invite `bob` to the workspace, then accept as `bob`.
5. Join a public channel and post a message.
6. Invite `bob` to a channel and accept.
7. Search for a message keyword.
8. Open members, promote/demote a role, and explain the `409` last-admin protection.
9. Open workspace admins to show a relational join report.
10. Open stale channel invitations to show an aggregate-style database query.

## 10. Documentation Paragraph

Snickr's frontend is a React + TypeScript + Vite application that connects directly to the FastAPI backend using a typed fetch client. It relies on the backend's httpOnly `snickr_session` cookie and verifies login state with `GET /api/auth/me`. Server state is cached with TanStack Query and refreshed after mutations. The UI models users, workspaces, roles, channels, invitations, messages, search, and admin reports without inventing unsupported backend functionality. User content is always rendered as plain text, while the backend protects SQL queries through asyncpg parameter binding and transactions.

## 11. Future Enhancements Not Implemented

- Direct message creation flow
- Message edit/delete
- Reactions, threads, and pins
- File uploads and avatars
- Realtime WebSocket updates
- Workspace/channel rename or delete
- Invite expiration management UI
- Full audit log
