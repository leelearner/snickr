# Snickr Backend API

Base URL: `http://localhost:8000`

All endpoints under `/api`. JSON in, JSON out. Field names are **camelCase**.

Authentication is via a signed session cookie (`snickr_session`). After `POST /api/auth/login`, subsequent requests must include the cookie. With Vite's `server.proxy` setup the cookie is automatic.

> Tip: an interactive version of this document is auto-generated at `/docs` while the server is running.

## Conventions

- Success responses: HTTP 200 (or 201 on create) with a JSON body.
- Error responses: HTTP 4xx / 5xx with `{ "detail": "<message>" }` (FastAPI's default error shape).
- Timestamps are ISO 8601 strings in UTC.
- IDs are integers.

## Status — work in progress

Endpoints are added here **before** they are implemented. If the docs disagree with the running server, the running server wins — open an issue.

---

## Health

### `GET /api/health`

No auth. Returns `{ "ok": true, "db": "<timestamp>" }` if the backend can reach Supabase.

---

## Auth

### `POST /api/auth/register`

Register a new user. On success the response body is the new user **and** the session cookie is set, so the client is logged in immediately.

**Body**
```json
{ "email": "alice@acme.com", "username": "alice", "nickname": "Ali", "password": "..." }
```
- `nickname` is optional.
- `email` and `username` must be globally unique.
- Implements project query (c.1).

**201 Created**
```json
{
  "userId": 7,
  "email": "alice@acme.com",
  "username": "alice",
  "nickname": "Ali",
  "createdTime": "2026-04-30T12:34:56.000Z"
}
```

**400** — validation failure (Pydantic response shape). **409** — email or username already in use.

---

### `POST /api/auth/login`

**Body**
```json
{ "username": "alice", "password": "..." }
```

**200 OK** — same shape as `UserOut` (without `createdTime`). Sets the session cookie.

**401** — invalid credentials. (Same message whether the username is wrong or the password is wrong, to avoid leaking user existence.)

---

### `POST /api/auth/logout`

No body. Clears the session. Always returns `{ "ok": true }`.

---

### `GET /api/auth/me`

Returns the currently logged-in user. **Frontend should call this on app load** to discover whether the user is logged in.

**200 OK**
```json
{
  "userId": 7,
  "email": "alice@acme.com",
  "username": "alice",
  "nickname": "Ali",
  "createdTime": "2026-04-30T12:34:56.000Z"
}
```

**401** — not authenticated.

## Workspaces

### `GET /api/workspaces`

List the workspaces the current user is a member of.

**200 OK**
```json
[
  { "workspaceId": 1, "name": "Acme Corp", "description": "...", "myRole": "admin" }
]
```

### `POST /api/workspaces`

Create a workspace. The creator is automatically inserted as `admin`.

**Body**
```json
{ "name": "Acme Corp", "description": "Company workspace" }
```

**201 Created** — same shape as one entry of `GET /api/workspaces`.

### `GET /api/workspaces/admins`

Implements project query (c.3): every administrator of every workspace, joined to user info.

**200 OK**
```json
[
  { "workspaceId": 1, "workspaceName": "Acme Corp", "userId": 1, "username": "alice", "nickname": "Ali" }
]
```

### `GET /api/workspaces/{workspaceId}`

Workspace detail including members (with their roles). Caller must be a member.

**200 OK**
```json
{
  "workspaceId": 1,
  "name": "Acme Corp",
  "description": "...",
  "createdTime": "2026-...",
  "createdBy": 1,
  "myRole": "admin",
  "members": [
    { "userId": 1, "username": "alice", "nickname": "Ali",  "role": "admin",  "joinedTime": "..." },
    { "userId": 2, "username": "bob",   "nickname": "Bobby","role": "admin",  "joinedTime": "..." }
  ]
}
```

**404** — workspace does not exist or caller is not a member.

### `POST /api/workspaces/{workspaceId}/invitations`

Invite a user (by username) to the workspace. Caller must be an admin of the workspace.

**Body**
```json
{ "username": "carol" }
```

**201 Created** — `{ "invitationId": 7 }`.
**403** — not an admin. **404** — username not found. **409** — already a member or invitation already exists.

### `GET /api/workspaces/{workspaceId}/stale-channel-invites`

Implements project query (c.4): for each public channel in this workspace, the count of channel invitations that are still pending and were sent more than 5 days ago.

**200 OK**
```json
[
  { "channelId": 1, "channelName": "general", "pendingInvitesOver5Days": 1 }
]
```

---

## Invitations (current user)

### `GET /api/me/workspace-invitations`

Pending workspace invitations addressed to the current user.

**200 OK**
```json
[
  { "invitationId": 7, "workspaceId": 1, "workspaceName": "Acme Corp",
    "inviterUsername": "alice", "invitedTime": "..." }
]
```

### `POST /api/me/workspace-invitations/{invitationId}`

Accept or decline an invitation.

**Body**
```json
{ "accept": true }
```

**200 OK** — `{ "ok": true, "status": "accepted" }` (or `"declined"`).
On accept the user is inserted into `workspacemember` as a `member` (transactional with the status update).
**404** — invitation does not exist or is not addressed to the current user. **409** — invitation has already been responded to.

## Channels

_(to be added)_

## Messages

_(to be added)_

## Search

_(to be added)_

## Invitations

_(to be added)_
