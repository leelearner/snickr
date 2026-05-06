# Snickr Backend Design

## 1. Design Decisions Summary

Snickr's backend is a FastAPI service that exposes a JSON API on top of the Postgres schema from Project 1. It uses asyncpg for parameterised SQL, bcrypt for password hashing, and Starlette `SessionMiddleware` for signed cookie sessions. Every endpoint validates membership before reading or writing, so route paths can be bookmarked without granting access by URL alone.

Multi-statement writes run inside `async with conn.transaction()` blocks, and two operations are pushed entirely into Postgres as stored procedures so the database guarantees atomicity. The API never trusts client-supplied user IDs for "who am I". Every protected route resolves the current user from the session via `current_user_id` and 401s if missing.

## 2. Architecture Overview

A request hits FastAPI, which is wrapped by `CORSMiddleware` and `SessionMiddleware`. Each resource owns one or more `APIRouter` instances. Every handler depends on `get_conn`, which leases an `asyncpg.Connection` from a single pool created during the FastAPI lifespan.

The pool is created with `statement_cache_size=0` so the same SQL can be reissued through Supabase's pooled connection without prepared-statement name clashes.

Layers:

- HTTP layer. FastAPI routers, dependency injection, status code mapping.
- Validation layer. Pydantic v2 request and response models.
- Persistence layer. asyncpg pool, parameterised SQL, two stored procedures for atomicity.
- Auth layer. Cookie-backed session, bcrypt password hashing, membership checks per route.

## 3. API Endpoint Table

| Method | Path | Purpose | Auth | Notes |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | Liveness check, returns DB `NOW()` | none | useful in demos |
| POST | `/api/auth/register` | Create user, set session cookie | none | 409 on duplicate email or username |
| POST | `/api/auth/login` | Verify password, set session cookie | none | same error for unknown user and bad password |
| POST | `/api/auth/logout` | Clear session | session | |
| GET | `/api/auth/me` | Current user profile | session | 401 if no session |
| PATCH | `/api/auth/me` | Update email, nickname, password | session | password change requires `currentPassword` |
| GET | `/api/workspaces` | Workspaces I belong to | session | |
| POST | `/api/workspaces` | Create workspace, become admin, get a default `general` channel | session | transaction wraps three inserts |
| GET | `/api/workspaces/admins` | Cross-workspace admin report | session | join-heavy demo query |
| GET | `/api/workspaces/{id}` | Workspace detail with members | member | 404 if not a member |
| POST | `/api/workspaces/{id}/invitations` | Invite by username | admin | 409 on duplicate or existing membership |
| GET | `/api/workspaces/{id}/stale-channel-invites` | Public channels with pending invites older than 5 days | session | aggregate `HAVING` query |
| DELETE | `/api/workspaces/{id}/members/{userId}` | Remove member, cascade their channel memberships | admin | 409 protects the last admin |
| PATCH | `/api/workspaces/{id}/members/{userId}/role` | Promote or demote | admin | 409 protects the last admin |
| GET | `/api/me/workspace-invitations` | My pending workspace invites | session | |
| POST | `/api/me/workspace-invitations/{id}` | Accept or decline | session | accept calls `accept_workspace_invitation` |
| GET | `/api/workspaces/{id}/channels` | Public channels, my private channels, my DMs | member | LATERAL join exposes the DM partner |
| POST | `/api/workspaces/{id}/channels` | Create public or private channel | member | calls `create_channel_for_member` |
| POST | `/api/workspaces/{id}/direct-messages` | Get or create DM channel with a peer | member | idempotent `dm-{a}-{b}` channel name |
| GET | `/api/channels/{id}` | Channel detail with members | member visibility rules | 404 hides private channels from non-members |
| POST | `/api/channels/{id}/join` | Self-join a public channel | workspace member | 403 for private and direct |
| POST | `/api/channels/{id}/invitations` | Invite a workspace member to a channel | channel member | 409 if not in workspace or already in channel |
| GET | `/api/me/channel-invitations` | My pending channel invites | session | |
| POST | `/api/me/channel-invitations/{id}` | Accept or decline | session | transaction flips status and inserts membership |
| GET | `/api/channels/{id}/messages` | Channel timeline | channel member | 404 hides non-member channels |
| POST | `/api/channels/{id}/messages` | Post a message | channel member | timestamp recorded in `America/New_York` |
| GET | `/api/users/{id}/messages` | Posts by a user with workspace and channel context | session | |
| GET | `/api/search?q=` | Substring search across visible messages | session | joins through `channelmember` and `workspacemember` |

## 4. Routers and Resources

- `auth.py`. Registration, login, logout, profile read and update.
- `workspaces.py`. Workspace creation, member roles, invitations, admin and stale-invite reports.
- `channels.py`. Channel creation, public-channel join, channel invitations, DM creation.
- `messages.py`. Channel timeline, user message history, search across visible messages.
- `deps.py`. Shared dependencies, currently `current_user_id`.

User-centric invitation endpoints under `/api/me/...` are mounted from secondary `me_router` instances declared inside `workspaces.py` and `channels.py`.

## 5. Pydantic Schemas

Defined under `app/schemas/`:

- `user.py`: `UserRegister`, `UserLogin`, `UserOut`, `ProfileUpdate`
- `workspace.py`: `WorkspaceCreate`, `WorkspaceSummary`, `WorkspaceMember`, `WorkspaceDetail`, `InviteCreate`, `WorkspaceInvitation`, `InviteResponse`, `RoleChange`, `StaleChannelInvite`, `AdminEntry`
- `channel.py`: `ChannelCreate`, `ChannelSummary`, `DirectMessageCreate`, `ChannelMember`, `ChannelDetail`, `ChannelInviteCreate`, `ChannelInvitation`, `InviteResponse`
- `message.py`: `MessageCreate`, `MessageOut`, `MessageWithLocation`

Naming convention. JSON fields are camelCase. Postgres lowercases identifiers, so each query aliases columns at the SQL layer, for example `SELECT workspaceID AS "workspaceId"`. This keeps SQL visible to graders and the JSON contract ergonomic for the frontend.

## 6. Project Directory

```text
backend/
  app/
    main.py
    api/
      v1/
        auth.py
        channels.py
        deps.py
        messages.py
        workspaces.py
    core/
      config.py
      security.py
    db/
      session.py
    schemas/
      user.py
      workspace.py
      channel.py
      message.py
  tests/
  pytest.ini
  requirements.txt
  .env.example
```

## 7. Core Code Files

- `app/main.py`. FastAPI entry, middleware, router mounts.
- `app/db/session.py`. asyncpg pool lifespan and `get_conn` dependency.
- `app/api/v1/deps.py`. `current_user_id` session reader.
- `app/api/v1/auth.py`. Register, login, logout, profile.
- `app/api/v1/workspaces.py`. Workspaces, members, invitations, reports.
- `app/api/v1/channels.py`. Channels, DMs, channel invitations.
- `app/api/v1/messages.py`. Channel timeline, user history, search.

## 8. Database Interaction

### Parameterised SQL

All queries pass user input through asyncpg's `$1, $2, ...` placeholders, which use the Postgres extended-query protocol. There is no string concatenation, no f-string interpolation of user input, and no manual escaping. The same applies to `LIKE` patterns, where the `%...%` wrapping happens before the value is bound.

### Transactions

Multi-statement writes run inside `async with conn.transaction()` so the database sees them as one atomic unit:

- Create workspace. Inserts workspace, admin membership, and the default `general` channel.
- Direct message creation. Upserts the DM channel and adds both users as members.
- Remove member. Deletes channel memberships in the workspace, then the workspace membership row.
- Accept or decline channel invitation. Updates `channelinvitation.status_type` and inserts into `channelmember` if accepted.
- Decline workspace invitation. Reads the invitation status and updates it inside one transaction so concurrent accept and decline calls cannot both win.

### Stored procedures

Two operations live entirely in the database, defined in `database/migrations/002_stored_procedures.sql`:

- `create_channel_for_member`. Verifies workspace membership, looks up the channel type, inserts the channel, and adds the creator as the first member. Returns the new `channelID`, or `NULL` if the caller is not a workspace member. Used both by `POST /api/workspaces/{id}/channels` and by the auto-`general` step inside workspace creation.
- `accept_workspace_invitation`. Validates the invitation belongs to the user, checks status, flips it to `accepted`, and inserts the `workspacemember` row as `member`. Raises if the invitation has already been responded to.

### Concurrency

asyncpg leases one pooled connection per request, so the queries inside a single handler run on the same connection and `BEGIN`/`COMMIT` boundaries are respected. Postgres handles cross-request concurrency through MVCC. Last-admin protection is a read-then-write pattern that is correct under the demo workload. A stricter version would lock the admin rows with `SELECT ... FOR UPDATE` inside the same transaction.

## 9. Security Notes

- **SQL injection.** Every query uses parameter binding. Stored procedures take typed arguments, so the same property holds end-to-end. No place in the codebase concatenates user text into SQL.
- **Cross-site scripting.** The backend stores raw text. The frontend renders messages as React text without `dangerouslySetInnerHTML`, so injected `<script>` tags are inert.
- **Authentication.** Passwords are bcrypt hashed with per-user salts. The login response and the unknown-user response use the same error to avoid user enumeration.
- **Authorisation.** Every protected route calls `current_user_id` and then checks workspace or channel membership at the SQL level before returning rows. Private and direct channels return 404 to non-members so their existence is not leaked.
- **Sessions.** Starlette's `SessionMiddleware` issues a signed cookie named `snickr_session`. Cookie flags are `httpOnly` and `sameSite=lax`, max age seven days. The cookie payload currently holds only `{"user_id": int}`.
- **CORS.** `CORSMiddleware` permits only the origins listed in `FRONTEND_ORIGIN`, with `allow_credentials=True` so the session cookie can travel.

## 10. Bookmarkable URLs and Session State

Sessions are kept in the cookie, not in URLs. URLs encode position in the data: `/api/workspaces/{id}`, `/api/channels/{id}`, `/api/channels/{id}/messages`, `/api/search?q=...`. The corresponding frontend routes are bookmarkable. Reopening a bookmark while logged in lands on the same view. Reopening while logged out redirects to login through the frontend's auth guard.

## 11. Demo Data Suggestions

Use the seeded test data, then add:

- Three users: `alice`, `bob`, `charlie`.
- One workspace `Database Lab` with `alice` as admin.
- Public channels `general` and `project-2`, private channel `staff`, and one DM between `alice` and `bob`.
- Several messages containing `index`, `transaction`, and `foreign key` so the search demo has hits.

## 12. Demo Flow Script

1. `curl /api/health` to show the connection.
2. Register `alice`, then login.
3. Create workspace `Database Lab`. Show the auto-created `general` channel.
4. Create a private channel `staff`.
5. Invite `bob` to the workspace. Accept as `bob`.
6. As `alice`, invite `bob` to `staff`. Accept as `bob`.
7. Post a message containing `index` in `general`.
8. Search for `index`. Expect one hit, scoped to the user's visibility.
9. Try to remove the only admin. Expect 409.
10. Open `/api/workspaces/admins` to show a relational join report.
11. Open `/api/workspaces/{id}/stale-channel-invites` to show a `HAVING`-style aggregate.

## 13. Documentation Paragraph

Snickr's backend is a FastAPI and asyncpg application that fronts the Project 1 Postgres schema. It speaks JSON only and is consumed by a Vite + React frontend. Authentication uses bcrypt password hashing and signed cookie sessions. Every protected route resolves the current user from the session and enforces workspace or channel membership at the SQL level. SQL injection is prevented through asyncpg's parameter binding and Postgres stored procedures, both of which use typed arguments rather than string interpolation. Cross-site scripting is prevented by the frontend's plain-text rendering of user content. Multi-step operations such as workspace creation, DM channel creation, and member removal run inside Postgres transactions; invitation acceptance and channel creation use stored procedures so the database guarantees atomicity. The API maps cleanly to the schema's modules: users and authentication, workspaces and members, channels and direct messages, messages and search.

## 14. Future Enhancements Not Implemented

- WebSocket push for new messages
- Message edit and delete
- File attachments
- Reactions, threads, and pins
- Channel rename and archive
- Audit log of admin actions
- Rate limiting on login and registration
