# Snickr — Design Report

The system is a three-tier web application. The presentation tier is a React
single-page app served by Vite. The application tier is a FastAPI service,
which holds the business logic and is the only network path that may issue
SQL. The data tier is a PostgreSQL instance running locally on the demo
laptop, with a Supabase-hosted instance available as a remote alternative.
Browser to backend traffic is HTTP and JSON. Backend to database traffic
is SQL issued through the asyncpg driver, with two operations encapsulated
as stored procedures.

---

## 2. Database Design

### 2.1 Requirements analysis and entity identification

The schema models a Slack-like collaboration product. A user account is a
person who can sign in. A workspace is a top-level container of people and
channels, analogous to a Slack team. A channel is a stream of messages
within a workspace, with three kinds, namely public, private, and direct.
Messages are the textual content posted to channels. Memberships record
which users belong to which workspaces and which channels. Invitations
record outstanding requests for a user to join a workspace or a channel.

Six business rules drove the design:

- A workspace has at least one administrator at all times. The creator is
  the first administrator. The system refuses to remove or demote the only
  remaining administrator so the workspace cannot fall into an
  unmanageable state.
- Channel visibility comes in three modes. A public channel can be
  self-joined by any workspace member. A private channel is invitation-only.
  A direct-message channel is created on demand between exactly two members
  of the same workspace and is reused on subsequent opens so the timeline is
  preserved.
- Workspace membership is a prerequisite for any channel access in that
  workspace. Channel membership is a prerequisite for reading or posting
  messages in that channel. The two checks are independent so revoking
  workspace membership reliably revokes all downstream access.
- Invitations have a small lifecycle, namely pending, accepted, declined.
  Two invitations to the same target in the same workspace are forbidden by
  a unique constraint so duplicate sends collapse into a single row.
- Messages are immutable once posted. The schema does not record edits or
  deletions, and the application does not expose endpoints for either. This
  keeps the audit trail simple and lets timeline reads be a single
  monotonic scan.
- Direct messages reuse the same `channels` and `messages` tables as ordinary
  channels rather than living in a parallel pair of tables. The only
  difference is `channeltype` and a deterministic two-user channel name. The
  reuse means search, read, post, and timeline display are a single code path
  for all three channel kinds.

Three changes were made to the Project 1 schema during Project 2, each
shipped as a numbered migration so the original DDL stays intact and
reproducible.

- `001_widen_password.sql` widens `users.password` from `VARCHAR(30)` to
  `VARCHAR(255)`. The Project 1 column was sized for plaintext because the
  hashing strategy had not yet been chosen. bcrypt hashes are 60 characters
  and the wider column also tolerates future hash algorithms without
  another migration.
- `002_stored_procedures.sql` adds two stored procedures,
  `create_channel_for_member` and `accept_workspace_invitation`, both
  documented in Section 2.4. These wrap multi-step transactional operations
  inside the database where atomicity is most important.
- `003_message_time_eastern.sql` redefines the default of
  `messages.posted_time` to `timezone('America/New_York', NOW())` so message
  timestamps in the UI agree with the wall-clock time at the demo location
  without any per-request timezone conversion in the application layer.
- `004_mentions.sql` adds a `mentions` table that records one row per
  `(messageID, mentioned_user)` pair. The application populates it during
  message creation by parsing `@username` patterns out of the content and
  joining against `channelmember`. Both foreign keys cascade on delete so
  removing a message or a user automatically cleans up the corresponding
  mention rows.
- `005_message_edit.sql` adds an `edited_time` column to `messages`. The
  column is `NULL` for messages that have never been edited and is set
  to the wall-clock time on every edit, so the UI can render an
  `(edited)` marker without needing a separate audit table.
- `006_message_system_kind.sql` adds a `system_kind` column to `messages`.
  A NULL value marks a regular user message; a non-NULL value names the
  system event that produced the row, currently only `'join'`. Channel
  joins write a system message identifying who joined, and the edit and
  delete endpoints reject any message whose `system_kind` is not NULL so
  the row remains tamper-proof. The Inbox uses the same column to classify
  notifications as `join` rather than relying on a fragile content match.
- `007_channelmember_hidden_at.sql` adds a `hidden_at` column to
  `channelmember`. A NULL value means the membership row is visible in
  the user's channel list. A non-NULL timestamp means the user has
  dismissed a direct-message channel from their list. The membership
  row is intentionally kept so message history stays accessible and the
  partner is unaffected. Reopening the DM through the same endpoint, or
  the partner posting a new message, clears the timestamp so the channel
  reappears.

Migrations must be applied in numeric order. Each one is idempotent so
re-running is safe, and the seed data in `database/seeds/sample_data.sql`
assumes all six have already been applied.

The outline mentions message threading, soft-delete, and a separate
direct-message table as common designs. None of the three is implemented
here. Replies are not modelled as a self-referencing relationship because
Project 2 keeps the timeline flat. A user who wants to reply posts a normal
message in the same channel. Hard delete is preferred to soft delete, so
removing a message clears the row and lets foreign-key cascades take care
of the dependent mention rows in one step. Direct messages share the
channel and message tables for the reuse argument given above. These are
deliberate choices, not omissions.

### 2.2 Entity-relationship model

The full ER diagram lives at `docs/ER-Diagram.drawio.svg` in draw.io format
and is reproduced as a figure in the Part 1 report at
`docs/report/report.md`. The ten entities and their relationships are
summarised below.

| Relationship | Cardinality | Realisation |
| --- | --- | --- |
| User to Workspace | many to many | join table `workspacemember` with a role attribute |
| User to Channel | many to many | join table `channelmember` |
| Workspace to Channel | one to many | `channels.workspaceID` foreign key |
| Channel to Message | one to many | `messages.channelID` foreign key |
| User to Message (poster) | one to many | `messages.posted_by` foreign key |
| User to Workspace invitation (invitee) | one to many | `workspaceinvitation.invitee` |
| User to Workspace invitation (inviter) | one to many | `workspaceinvitation.inviter` |
| User to Channel invitation (invitee) | one to many | `channelinvitation.invitee` |
| User to Channel invitation (inviter) | one to many | `channelinvitation.inviter` |
| Channel to Channel invitation | one to many | `channelinvitation.channelID` |
| Workspace to Workspace invitation | one to many | `workspaceinvitation.workspaceID` |

Three lookup tables, namely `roles`, `status`, and `channeltype`, sit
alongside the business tables and replace string enums. A workspace member
holds a foreign key into `roles` rather than a `VARCHAR` literal, an
invitation row holds a foreign key into `status`, and a channel holds a
foreign key into `channeltype`. New roles, statuses, or channel types can
therefore be added with a single insert into the lookup table rather than
a schema-altering data migration.

Participation constraints are deliberately weak so the schema can describe
in-progress states. A user may belong to zero workspaces, a workspace may
contain zero channels for a brief moment between creation steps before the
default `general` channel is added, and a channel may be empty for the
moment between creation and the first message. The application transactions
described in Section 3.3 ensure that the gaps between these states never
become visible to other users.

Notable design choices, restated explicitly:

- Direct-message channels reuse the channel table with `channeltype.name = 'direct'`
  and a deterministic name derived from the two participants' user
  identifiers. Reopening a direct-message conversation returns the same
  channel identifier, so the URL is stable and the timeline is preserved.
- Messages have no parent pointer. The schema can store reply content but
  not reply structure. The application chose not to introduce a
  self-referencing foreign key in Project 2 because no UI flow uses one.
- Workspace and channel deletes cascade. Removing a workspace removes its
  channels, members, and invitations. Removing a channel removes its
  messages and members. Workspace creators are set to `NULL` rather than
  cascading on user delete so a removed user does not silently take a
  workspace down with them.

### 2.3 Relational schema

The schema consists of twelve tables. The application uses lowercase
identifiers everywhere and relies on Postgres folding for unquoted names.
The canonical DDL lives at `database/schema/schema.sql`, with the
incremental migrations enumerated in Section 2.1. The full attribute
list of every table follows.

**`users`** — core account record.

| Column | Type | Constraints |
| --- | --- | --- |
| `userID` | INTEGER | primary key, auto-generated identity |
| `email` | VARCHAR(50) | NOT NULL, UNIQUE |
| `username` | VARCHAR(30) | NOT NULL, UNIQUE |
| `nickname` | VARCHAR(30) | nullable |
| `password` | VARCHAR(255) | nullable, holds the bcrypt hash |
| `created_time` | TIMESTAMP | NOT NULL, defaults to `CURRENT_TIMESTAMP` |
| `updated_time` | TIMESTAMP | NOT NULL, defaults to `CURRENT_TIMESTAMP` |

**`workspaces`** — workspace header.

| Column | Type | Constraints |
| --- | --- | --- |
| `workspaceID` | INTEGER | primary key, auto-generated identity |
| `name` | VARCHAR(30) | NOT NULL |
| `description` | VARCHAR(200) | nullable |
| `created_time` | TIMESTAMP | NOT NULL, defaults to `CURRENT_TIMESTAMP` |
| `updated_time` | TIMESTAMP | NOT NULL, defaults to `CURRENT_TIMESTAMP` |
| `created_by` | INTEGER | foreign key to `users.userID` `ON DELETE SET NULL` |

**`roles`** — role lookup table holding the literals `admin` and `member`.

| Column | Type | Constraints |
| --- | --- | --- |
| `roleID` | INTEGER | primary key, auto-generated identity |
| `name` | VARCHAR(20) | NOT NULL, UNIQUE |

**`workspacemember`** — workspace membership join.

| Column | Type | Constraints |
| --- | --- | --- |
| `workspaceID` | INTEGER | part of composite primary key, foreign key to `workspaces.workspaceID` `ON DELETE CASCADE` |
| `userID` | INTEGER | part of composite primary key, foreign key to `users.userID` `ON DELETE CASCADE` |
| `role` | INTEGER | NOT NULL, foreign key to `roles.roleID` |
| `joined_time` | TIMESTAMP | NOT NULL, defaults to `CURRENT_TIMESTAMP` |

**`status`** — invitation lifecycle lookup table holding the literals `pending`, `accepted`, `declined`.

| Column | Type | Constraints |
| --- | --- | --- |
| `statusID` | INTEGER | primary key, auto-generated identity |
| `type` | VARCHAR(30) | NOT NULL, UNIQUE |

**`workspaceinvitation`** — outstanding workspace invites.

| Column | Type | Constraints |
| --- | --- | --- |
| `invitationID` | INTEGER | primary key, auto-generated identity |
| `workspaceID` | INTEGER | NOT NULL, foreign key to `workspaces.workspaceID` `ON DELETE CASCADE` |
| `invitee` | INTEGER | NOT NULL, foreign key to `users.userID` `ON DELETE CASCADE` |
| `inviter` | INTEGER | NOT NULL, foreign key to `users.userID` |
| `invited_time` | TIMESTAMP | NOT NULL, defaults to `CURRENT_TIMESTAMP` |
| `status_type` | INTEGER | NOT NULL, foreign key to `status.statusID` |
| | | UNIQUE on `(workspaceID, invitee)` |

**`channeltype`** — channel kind lookup table holding the literals `public`, `private`, `direct`.

| Column | Type | Constraints |
| --- | --- | --- |
| `typeID` | INTEGER | primary key, auto-generated identity |
| `name` | VARCHAR(30) | NOT NULL, UNIQUE |

**`channels`** — channel header.

| Column | Type | Constraints |
| --- | --- | --- |
| `channelID` | INTEGER | primary key, auto-generated identity |
| `workspaceID` | INTEGER | NOT NULL, foreign key to `workspaces.workspaceID` `ON DELETE CASCADE` |
| `channel_name` | VARCHAR(50) | NOT NULL |
| `typeID` | INTEGER | NOT NULL, foreign key to `channeltype.typeID` |
| `created_by` | INTEGER | NOT NULL, foreign key to `users.userID` |
| `created_time` | TIMESTAMP | NOT NULL, defaults to `CURRENT_TIMESTAMP` |
| `updated_time` | TIMESTAMP | NOT NULL, defaults to `CURRENT_TIMESTAMP` |
| | | UNIQUE on `(workspaceID, channel_name)` |

**`channelmember`** — channel membership join.

| Column | Type | Constraints |
| --- | --- | --- |
| `channelID` | INTEGER | part of composite primary key, foreign key to `channels.channelID` `ON DELETE CASCADE` |
| `userID` | INTEGER | part of composite primary key, foreign key to `users.userID` `ON DELETE CASCADE` |
| `joined_time` | TIMESTAMP | NOT NULL, defaults to `CURRENT_TIMESTAMP` |

**`channelinvitation`** — outstanding channel invites.

| Column | Type | Constraints |
| --- | --- | --- |
| `invitationID` | INTEGER | primary key, auto-generated identity |
| `channelID` | INTEGER | NOT NULL, foreign key to `channels.channelID` `ON DELETE CASCADE` |
| `invitee` | INTEGER | NOT NULL, foreign key to `users.userID` `ON DELETE CASCADE` |
| `inviter` | INTEGER | NOT NULL, foreign key to `users.userID` |
| `invited_time` | TIMESTAMP | NOT NULL, defaults to `CURRENT_TIMESTAMP` |
| `status_type` | INTEGER | NOT NULL, foreign key to `status.statusID` |
| | | UNIQUE on `(channelID, invitee)` |

**`messages`** — channel timeline.

| Column | Type | Constraints |
| --- | --- | --- |
| `messageID` | INTEGER | primary key, auto-generated identity |
| `channelID` | INTEGER | NOT NULL, foreign key to `channels.channelID` `ON DELETE CASCADE` |
| `content` | VARCHAR(500) | NOT NULL |
| `posted_time` | TIMESTAMP | NOT NULL, defaults to `timezone('America/New_York', NOW())` |
| `edited_time` | TIMESTAMP | nullable, set on every edit |
| `posted_by` | INTEGER | NOT NULL, foreign key to `users.userID` |

**`mentions`** — record of `@username` mentions, used by the Inbox.

| Column | Type | Constraints |
| --- | --- | --- |
| `mentionID` | INTEGER | primary key, auto-generated identity |
| `messageID` | INTEGER | NOT NULL, foreign key to `messages.messageID` `ON DELETE CASCADE` |
| `mentioned_user` | INTEGER | NOT NULL, foreign key to `users.userID` `ON DELETE CASCADE` |
| `created_time` | TIMESTAMP | NOT NULL, defaults to `timezone('America/New_York', NOW())` |
| | | UNIQUE on `(messageID, mentioned_user)` so the same mention is never double-counted |

**Normalisation.** Each table is in third normal form. Every non-key
attribute depends on the whole primary key and on no other non-key
attribute. The user record carries no derived values. Membership tables
hold only the join key, the role or join time, and no facts about the
user or the channel. The lookup tables hold only the surrogate identifier
and the canonical name. Messages hold only the channel pointer, the
poster pointer, the content, and the timestamp; the poster's name is not
denormalised onto the message and is instead joined at read time.

The one place where the design verges on denormalisation is the lookup
tables. Strictly, a CHECK constraint with an enumerated list would be
sufficient and would avoid a join. The design chose tables instead so new
values can be added with a single INSERT rather than a schema migration,
and so foreign-key referential integrity catches typos that a CHECK list
cannot.

**Indexes.** The schema declares three secondary indexes on top of the
implicit primary-key and unique-constraint indexes.

| Index | Table and columns | Reason |
| --- | --- | --- |
| `idx_messages_channel` | `messages (channelID)` | Channel timeline reads filter by `channelID` and order by `posted_time`. This is the most common read path in the system. |
| `idx_workspace_member_user` | `workspacemember (userID)` | The "list workspaces I belong to" query filters by `userID`. The composite primary key `(workspaceID, userID)` does not help this query because `workspaceID` is the leading column. |
| `idx_channel_member_user` | `channelmember (userID)` | Same reasoning as the workspace index, applied to channels. |
| `idx_mentions_user` | `mentions (mentioned_user, created_time DESC)` | The Inbox query filters by `mentioned_user` and orders by recency, so a covering composite index turns the read into a single backward index scan. |

Foreign-key columns that participate in joins benefit from indexing because
of cascade-delete behaviour on the parent. Postgres scans the child by the
foreign key when the parent is deleted, and an index makes that scan an
index seek rather than a sequential scan.

### 2.4 Stored procedures and queries

The catalog below groups every database-encapsulated operation by feature.
Each item names the responsible procedure or handler, summarises its
purpose, lists its inputs, sketches its key logic, and states its return
shape. Two of the operations, marked **stored procedure**, live as
PL/pgSQL functions in `database/migrations/002_stored_procedures.sql`.
The remaining operations live in FastAPI handlers under
`backend/app/api/v1/`, marked **handler transaction** when they open an
explicit `async with conn.transaction()` block and **parameterised SQL**
when they are a single statement. All three forms share the same SQL
injection guarantee described in Section 3.2 because every value is bound
through asyncpg's `$1, $2, ...` placeholders.

**Authentication.**

- `register_user` (parameterised SQL, in `auth.py`). Purpose: create a
  user account and seed a session. Inputs: email, username, optional
  nickname, plaintext password. Logic: bcrypt-hash the password,
  `INSERT INTO users` with the hash, set the user identifier in the
  session cookie. Returns the new user row, or 409 on duplicate email or
  username.
- `authenticate_user` (parameterised SQL, in `auth.py`). Purpose: verify
  a username and password and seed a session. Inputs: username,
  plaintext password. Logic: `SELECT` the user row, `bcrypt.checkpw`
  against the stored hash, set the user identifier in the session
  cookie. Returns the user row on success, 401 on either an unknown
  username or a bad password, with the same generic error so an
  attacker cannot enumerate usernames.

**Workspace management.**

- `create_workspace` (handler transaction, in `workspaces.py`). Purpose:
  create a workspace, make the caller its first admin, and seed a
  default `general` channel. Inputs: workspace name, optional
  description, caller's user identifier. Logic, all inside one
  transaction: `INSERT INTO workspaces`, look up the `admin` role,
  `INSERT INTO workspacemember`, then call `create_channel_for_member`
  to add the `general` channel. Returns the workspace summary.
- `create_channel_for_member` (**stored procedure**, signature
  `(p_workspace_id INTEGER, p_channel_name VARCHAR, p_type_name VARCHAR, p_user_id INTEGER) RETURNS INTEGER`).
  Purpose: insert a channel and add the creator as its first member,
  atomically, but only if the caller is already a member of the
  workspace. Logic: check `workspacemember`, return `NULL` if absent;
  look up the channel-type identifier, raise on an unknown type; insert
  the `channels` row; insert the `channelmember` row. The whole block
  runs as one PL/pgSQL function, so the database guarantees both
  inserts commit together or neither does. Returns the new `channelID`,
  or `NULL` if the membership check fails. Used by the workspace-creation
  flow above and by `POST /api/workspaces/{id}/channels`.
- `invite_member` (parameterised SQL, in `workspaces.py`). Purpose:
  send a workspace invitation. Inputs: workspace identifier, invitee
  username, caller's user identifier. Logic: assert caller is admin,
  resolve the invitee username to a user identifier, `INSERT INTO
  workspaceinvitation` with `status_type = pending`. Returns the new
  invitation row, 409 if a duplicate row already exists for
  `(workspaceID, invitee)`.
- `respond_to_invitation` (workspace, accept path) is the
  `accept_workspace_invitation` stored procedure described next.
- `accept_workspace_invitation` (**stored procedure**, signature
  `(p_invitation_id INTEGER, p_user_id INTEGER) RETURNS INTEGER`).
  Purpose: flip an invitation from `pending` to `accepted` and add the
  invitee to `workspacemember`, atomically. Logic: read the invitation
  row joined with `status`, return `NULL` if it is not addressed to the
  caller, raise if it is already responded to; look up the `accepted`
  status and the `member` role identifiers; update the invitation
  status; insert the membership row with `ON CONFLICT DO NOTHING` so a
  concurrent accept does not double-insert. Returns the workspace
  identifier on success, `NULL` for an invitation not addressed to the
  caller, raise on a non-pending invitation. Used by
  `POST /api/me/workspace-invitations/{id}` with `accept: true`.
- `respond_to_invitation` (workspace, decline path) is a handler
  transaction in `workspaces.py`. It opens a transaction, reads the
  invitation status under MVCC, and updates it to `declined`.
- `remove_member` (handler transaction, in `workspaces.py`). Purpose:
  remove a user from a workspace and clean up their channel memberships
  in that workspace. Logic, inside one transaction: `DELETE` matching
  rows from `channelmember` joined to channels in this workspace, then
  `DELETE` the `workspacemember` row. Returns 204.
- `change_role` (parameterised SQL, in `workspaces.py`). Purpose:
  promote or demote a member. Last-admin guard counts admins and
  refuses if the change would leave the workspace with zero admins.

**Channel management.**

- `create_channel` is `create_channel_for_member` described above.
- `join_channel` (parameterised SQL, in `channels.py`). Purpose: let
  any workspace member self-join a public channel. Logic: assert
  caller's workspace membership, assert the channel's type is `public`,
  `INSERT INTO channelmember ON CONFLICT DO NOTHING`. Returns 200.
- `invite_to_channel` (parameterised SQL, in `channels.py`). Purpose:
  invite a workspace member into a private channel. Logic: assert
  caller is a channel member, resolve username, `INSERT INTO
  channelinvitation` with `pending`. Returns the new invitation,
  409 on a duplicate row.
- `respond_to_channel_invitation` (handler transaction, in
  `channels.py`). On accept, runs an update on `channelinvitation`
  followed by an `INSERT INTO channelmember ON CONFLICT DO NOTHING`
  inside one transaction. On decline, just updates the invitation.
- `open_direct_message` (handler transaction, in `channels.py`).
  Purpose: open or reuse a direct-message channel between the caller
  and another workspace member. Logic, inside one transaction: derive
  the deterministic name `dm-{minId}-{maxId}` from the two user
  identifiers, upsert the `channels` row with type `direct`, insert
  both participants into `channelmember`. Returns the channel summary.
  The deterministic name guarantees idempotency; reopening returns the
  same `channelID`.

**Messaging.**

- `post_message` (parameterised SQL, in `messages.py`). Purpose: append
  a message to a channel. Logic: assert caller's channel membership,
  `INSERT INTO messages (channelID, content, posted_by)`. The
  `posted_time` default in the schema records the timestamp in
  `America/New_York` so the application does not pass one. Returns the
  new message row including `posted_time` and the poster's display
  name.
- `post_reply` is not implemented. Replies are posted as ordinary
  messages in the same channel; the schema has no parent-message
  pointer.
- `get_channel_messages` (parameterised SQL, in `messages.py`).
  Purpose: list a channel's messages in chronological order. Logic:
  assert caller's channel membership, `SELECT m.*, u.username, u.nickname
  FROM messages m JOIN users u ON u.userID = m.posted_by WHERE
  m.channelID = $1 ORDER BY m.posted_time, m.messageID`. The
  `idx_messages_channel` index covers the filter and the secondary
  order is the primary key for stability. Returns the message list.
- `get_user_messages` (parameterised SQL, in `messages.py`). Purpose:
  list every message posted by a given user, scoped to channels the
  caller can see. Joins `messages` to `channels`, `workspaces`, and
  `channelmember` filtered by the caller. Used by `GET
  /api/users/{id}/messages`.

**Search.**

- `search_messages` (parameterised SQL, in `messages.py`). Purpose:
  substring search across messages the caller can read. Logic:
  `SELECT m.*, w.name, c.channel_name FROM messages m JOIN channels c
  ... JOIN channelmember cm ON cm.channelID = m.channelID AND cm.userID
  = $1 WHERE m.content ILIKE $2`, with the second parameter bound as
  `f"%{q}%"`. The `ILIKE` wildcards live in the bound value, not in
  the SQL text, so a user query of `100%` searches for the literal
  string. Returns the matched messages with workspace and channel
  context for the result-list rendering.
- `search_channels` is not exposed as its own endpoint. The frontend's
  channel sidebar already shows every channel the user can see, so
  channel search would be a duplicate of the existing list endpoint.

**Why two stored procedures, not twelve.** The outline lists a wider
catalog of hypothetical procedures. Project 2 chose to keep simple
single-table reads and writes inside the FastAPI handlers as
parameterised SQL on the ground that a one-line INSERT or SELECT does
not benefit from being moved into the database. Stored procedures were
reserved for the two cases where atomicity across multiple tables matters
most and where the application would otherwise have to coordinate the
sequence by hand, namely channel creation with the first-member insert
and invitation acceptance with the membership insert. The remaining
transactional operations live as `async with conn.transaction()` blocks
in handlers and are catalogued by feature above and again by transaction
boundary in Section 3.3.

The seven Part 1 query templates live at `database/queries/queries.sql`
as parameterised statements with `:name` placeholders. The Part 2 backend
re-issues each of these as a parameterised asyncpg call, so the same
logic is reachable both from the Postgres CLI and from the JSON API.

---

## 3. Backend Design

### 3.1 API layer structure

The backend is written in Python 3.11 using the FastAPI web framework, with
asyncpg as the Postgres driver, bcrypt for password hashing, Pydantic v2
for request and response validation, and Starlette's `SessionMiddleware`
for signed cookie sessions. FastAPI was chosen because it generates an
interactive API explorer at `/docs` from the same Pydantic models that
validate requests, which removes drift between the implementation and the
documented API contract, and because its dependency-injection mechanism
makes authentication checks visible in every route signature.

A request enters FastAPI and passes through two pieces of middleware.
`CORSMiddleware` permits only the origins listed in `FRONTEND_ORIGIN`. In
ordinary development the React dev server proxies `/api/*` to the backend
so requests are same-origin from the browser's point of view, and the CORS
list only matters when a developer chooses to call the backend directly
from another host. `SessionMiddleware` reads and writes the signed
`snickr_session` cookie. After middleware, FastAPI dispatches to a router
under `app/api/v1/`. There is one router per resource group, namely
`auth.py`, `workspaces.py`, `channels.py`, `messages.py`, and
`mentions.py`, plus a small `deps.py` that holds the shared
`current_user_id` dependency. The mention parser and `/api/me/mentions`
endpoint live in `mentions.py` and are imported by the message router
so a single transaction covers both message creation and mention
insertion.

Each handler depends on `get_conn`, which leases an `asyncpg.Connection`
from a single pool created during the FastAPI lifespan. Because asyncpg
leases one connection per request, every query inside a handler runs on
the same connection, and therefore inside the same transactional context
if the handler chooses to open one. The pool also disables asyncpg's
per-connection prepared-statement cache so that the same SQL can be
reissued cleanly when running through a connection pooler such as
Supabase's session pooler, without prepared-statement name clashes.

**Endpoint inventory.** The full API is exposed under `/api`. The table
below lists every endpoint, grouped by resource.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create a user and start a session |
| POST | `/api/auth/login` | Verify password and start a session |
| POST | `/api/auth/logout` | Clear the session cookie |
| GET | `/api/auth/me` | Return the current user's profile |
| PATCH | `/api/auth/me` | Update email, display name, or password |
| GET | `/api/workspaces` | List workspaces I belong to |
| POST | `/api/workspaces` | Create a workspace and become its first admin |
| GET | `/api/workspaces/{id}` | Workspace details and member list |
| POST | `/api/workspaces/{id}/invitations` | Invite a user by username |
| GET | `/api/workspaces/{id}/stale-channel-invites` | Channel invites unanswered for over five days |
| DELETE | `/api/workspaces/{id}/members/{userId}` | Remove a member |
| PATCH | `/api/workspaces/{id}/members/{userId}/role` | Promote or demote a member |
| GET | `/api/workspaces/admins` | All admins across the workspaces I belong to |
| GET | `/api/me/workspace-invitations` | Pending workspace invitations addressed to me |
| POST | `/api/me/workspace-invitations/{id}` | Accept or decline a workspace invitation |
| GET | `/api/workspaces/{id}/channels` | Channels visible to me in a workspace |
| POST | `/api/workspaces/{id}/channels` | Create a public or private channel |
| POST | `/api/workspaces/{id}/direct-messages` | Open or reuse a direct-message channel |
| GET | `/api/channels/{id}` | Channel details and member list |
| POST | `/api/channels/{id}/join` | Self-join a public channel |
| POST | `/api/channels/{id}/leave` | Leave a public or private channel I am in |
| POST | `/api/channels/{id}/invitations` | Invite a member to a channel |
| GET | `/api/me/channel-invitations` | Pending channel invitations addressed to me |
| POST | `/api/me/channel-invitations/{id}` | Accept or decline a channel invitation |
| GET | `/api/channels/{id}/messages` | Channel timeline in chronological order |
| POST | `/api/channels/{id}/messages` | Post a message |
| PATCH | `/api/channels/{id}/messages/{messageId}` | Edit a message I posted |
| DELETE | `/api/channels/{id}/messages/{messageId}` | Delete a message I posted |
| DELETE | `/api/workspaces/{id}` | Disband a workspace, admins only |
| GET | `/api/users/{id}/messages` | All messages posted by a user, with workspace and channel context |
| GET | `/api/search?q=` | Substring search across messages I can see |
| GET | `/api/me/mentions` | Inbox events for the current user, classified as `mention`, `dm`, or `join` |

**HTTP method conventions.** The API uses GET for reads, POST for creating
new rows or for actions that change state without a clean PUT semantics
such as accepting an invitation or joining a channel, PATCH for partial
updates to existing rows, and DELETE for removals. PUT is not used in
this API because no resource has a fully replaceable representation.
Resource paths are pluralised, identifiers are numeric, and nested paths
mirror containment. A channel lives under a workspace and its messages
live under the channel.

**Request and response format.** Every request and response body is JSON,
encoded as UTF-8. Field names are camelCase on the wire, while Postgres
identifiers are lowercase. The mapping is performed in SQL with column
aliases such as `SELECT workspaceID AS "workspaceId"`. Aliasing in SQL
rather than in a global serializer keeps the SQL readable and makes the
mapping inspectable in the source.

**Error handling.** All error responses use FastAPI's default body shape,
namely a JSON object with a single `detail` key carrying a human-readable
string. Status codes follow the HTTP conventions, namely 400 for malformed
requests that pass schema validation, 401 for unauthenticated requests,
403 for authenticated requests that lack permission for a non-private
resource, 404 for missing or private resources hidden from the caller,
409 for unique-constraint conflicts and lifecycle conflicts such as a
duplicate invitation, 422 for schema-validation failures emitted by
Pydantic, and 500 for unhandled server errors. Private and direct
channels return 404 to non-members rather than 403 so the existence of a
private channel is hidden from users who are not invited.

The shape of the error body is uniform across endpoints, which means the
frontend has a single error path. The frontend reads `detail` and displays
it directly, with a fallback to a generic message if the field is missing.

**Membership exit.** Two endpoints let a user remove themselves from
shared resources. `POST /api/channels/{id}/leave` deletes the caller's
row from `channelmember` for any public or private channel they belong
to and returns 204. Direct-message channels follow a softer rule because
both participants are part of the conversation by construction: the same
endpoint sets `channelmember.hidden_at = NOW()` on the leaver's row
without deleting it, so the message history is preserved and the
partner's view is unaffected. The DM reappears in the leaver's list
when they open it through the direct-message endpoint or when the
partner posts a new message. `DELETE /api/workspaces/{id}`
disbands an entire workspace and is restricted to administrators. The
foreign-key cascade on `workspaces` removes its channels, members, and
invitations in a single statement, which is why no extra clean-up logic
lives in the handler. A separate guard prevents the last administrator
from demoting or removing themselves through the role-change endpoint,
because that would leave the workspace governed by no one. The disband
path is the supported way to retire a workspace where the last admin
also wants to leave.

**Inbox event log.** The `mentions` table records one row per
`(messageID, mentioned_user)` pair and serves as the storage for three
distinct kinds of Inbox events. A regular `@username` mention writes one
row for the mentioned user. A direct-message post writes one row for the
other participant in the channel, so DMs surface in the Inbox without a
separate notifications table. A successful self-join into a public
channel writes a system message with `system_kind = 'join'` and a row
addressed to the channel creator so the owner of the channel sees who
joined. The `GET /api/me/mentions` query classifies each row at read
time using a `CASE` expression: `'dm'` when the channel type is
`direct`, `'join'` when the underlying message has `system_kind = 'join'`,
otherwise `'mention'`. The classifier reads from columns rather than
matching on message content, so a user who happens to type the words
`joined the channel` is not misclassified as a system join event.

### 3.2 Security: guarding against SQL injection

Every query and every stored-procedure invocation passes user input
through asyncpg's parameter binding. The Postgres extended-query protocol
treats those bound values as data, never as SQL grammar, so even input
that looks like SQL keywords cannot escape its placeholder. There is no
codepath in the application where user text is concatenated into a SQL
string, no f-string interpolation of user input, and no manual escaping.
Because the project specification highlights stored procedures and
prepared statements as acceptable mitigations, the design relies on both.
asyncpg uses Postgres's extended-query protocol, which prepares each
query and binds its arguments through the binary protocol; this is the
database-side equivalent of a prepared statement.

**Stored procedures as an additional layer.** The two procedures described
in Section 2.4 take typed arguments and are invoked through
`SELECT create_channel_for_member($1, $2, $3, $4)` style calls. The
application layer therefore never constructs raw SQL even for the most
sensitive multi-step writes. The procedure body is owned by the database
schema rather than by the application, so a future application bug cannot
cause it to send a malformed write.

**Input validation layer.** Pydantic v2 models live in `app/schemas/` and
describe both the request payloads and the response shapes. Field length
limits in these models mirror the schema constraints so a 31-character
username is rejected at validation time before it ever reaches Postgres.
Email addresses are validated against the RFC 5321 mailbox grammar by
Pydantic's `EmailStr`. Type coercion is strict, so passing the string
`"1"` where an integer is required is rejected rather than silently
parsed.

**Vulnerable versus safe pattern.** A vulnerable Python pattern would
build SQL with f-strings such as
`f"INSERT INTO messages (content) VALUES ('{user_text}')"`, where a
message containing `'); DROP TABLE messages; --` would be parsed as two
SQL statements and the second one would drop the table. The Snickr
backend never builds SQL this way. Every write looks like
`await conn.execute("INSERT INTO messages (content) VALUES ($1)", user_text)`,
where asyncpg sends the SQL and the bound argument as separate fields in
the Postgres extended-query protocol, so the user text is always a value
and never grammar.

**Edge cases.** A username containing a single quote, a workspace
description containing a backslash, a message that begins with two
hyphens, and a search query of `100%` are all handled correctly without
any code change because every value travels through the same binding
mechanism. The search endpoint binds the wildcard string `f"%{q}%"` as a
single argument, so a user query of `100%` searches for the literal string
`100%` rather than expanding into a wildcard. SQL keywords appearing
inside message content are never interpreted as SQL because they are part
of a bound value, not part of the query text. The same property holds
for `@username` mention parsing on message creation and edit. A regex
extracts candidate handles from the message text in Python, the resulting
list is passed to Postgres as a bound `text[]` argument with
`username = ANY($1::text[])`, and the lookup never builds a WHERE clause
out of user-supplied substrings.

**Result.** The SQL injection guarantee in this project is structural
rather than convention-based. Removing it would require a developer to
replace asyncpg's parameter API with raw SQL, which would be a noisy and
out-of-pattern change.

### 3.3 Concurrency control and transactions

Multiple users use the system at the same time, so any operation that
touches more than one row needs to be safe under concurrent execution.
The backend addresses this by running multi-statement writes inside
Postgres transactions, so each write either commits as a unit or rolls
back as a unit, and by trusting Postgres's MVCC isolation for everything
else.

**Transactional operations.** The list below catalogues every place where
the backend opens an explicit transaction. Each entry names the operation,
the rows it touches, and why a transaction is necessary.

- Workspace creation. Inserts the workspace row, the creator's
  admin-role membership row, and the default `general` channel through
  `create_channel_for_member`. Without a transaction a crash between the
  three writes would leave a workspace with no admin or no general
  channel.
- Direct-message channel creation. Upserts the channel under a
  deterministic name and inserts both participants as members. Without a
  transaction one of the two participants could be added without the
  other, which would silently exclude one side from their own
  conversation.
- Member removal. Deletes the user's memberships in all channels of the
  workspace and then deletes the workspace-membership row. Without a
  transaction the removed user could end up with channel rows that point
  at a workspace they no longer belong to.
- Channel-invitation response. Updates `channelinvitation.status_type`
  and, on accept, inserts the channel-membership row. Without a
  transaction the invitation could be marked accepted without the
  membership row appearing.
- Workspace-invitation decline. Reads the invitation status and updates
  it inside one transaction so concurrent accept and decline calls
  cannot both succeed.
- Workspace-invitation acceptance. Encapsulated inside the
  `accept_workspace_invitation` stored procedure described in Section
  2.4. The procedure runs inside the database as one PL/pgSQL block, so
  Postgres serialises the read of the invitation status, the update to
  `accepted`, and the insert into `workspacemember`. Two users who race
  to accept the same invitation cannot both succeed.
- Message creation. Inserts the message row and then walks the new
  content for `@username` patterns, resolves them against `channelmember`,
  and bulk-inserts the resulting `mentions` rows. Without a transaction a
  message could land without its mention rows, leaving recipients
  silently uninformed.
- Message editing. Updates `messages.content` and `messages.edited_time`,
  deletes the existing `mentions` rows for the message, and re-inserts
  mentions parsed from the new content. The whole sequence runs inside
  one transaction so a partially edited message can never coexist with a
  stale mention set.

**Isolation level.** The default Postgres isolation level, READ COMMITTED,
is left in place. This level is appropriate because the backend's writes
are typically a small number of statements that touch unrelated rows
across tables, and the unique constraints described below catch the few
cases where two writers could land on the same key.

**MVCC framing.** Under MVCC every transaction sees a consistent snapshot
of each row at statement start, which prevents dirty reads without
blocking readers behind writers. Lost updates and write skew on the same
row are prevented because Postgres locks the row for any concurrent
writer until the holder of the row's latest version commits or rolls
back. The application does not rely on any stricter isolation level.

**Unique constraints as a safety net.** Where two writers could race to
insert duplicates, the schema's unique constraints act as the final
safety net.

- `(workspaceID, channel_name)` on `channels` guarantees that two
  simultaneous create-channel calls cannot both succeed even if they
  both pass the duplicate-name check before either writes.
- `(workspaceID, invitee)` on `workspaceinvitation` plays the same role
  for workspace invitations and is the reason duplicate invites
  collapse into a 409 rather than a phantom second row.
- `(channelID, invitee)` on `channelinvitation` plays the same role for
  channel invitations.
- `(workspaceID, userID)` on `workspacemember` and
  `(channelID, userID)` on `channelmember` prevent the same user from
  being inserted twice if two accept calls land at the same instant. The
  stored-procedure path uses `ON CONFLICT DO NOTHING` so the second
  insert is silently absorbed rather than raising.

**Last-admin guard.** A workspace must have at least one administrator at
all times. The backend enforces this with a read-then-write pattern that
counts admins and refuses the operation if the demote or remove would
leave zero admins. Under the demo workload this is correct because the
only way to interleave two attempts to demote the last admin is for two
admins to demote each other simultaneously, which is fine in either
order. A stricter implementation would lock the relevant rows with
`SELECT ... FOR UPDATE` inside the same transaction and is listed as a
future improvement.

### 3.4 Session state and URL design

The Snickr backend keeps session state in a signed cookie and uses URLs
only to address content. Identity travels in the cookie, not in the URL.

**Session mechanism.** The session is implemented with Starlette's
`SessionMiddleware`, which signs a JSON document with the secret key in
`SESSION_SECRET` and stores the result in a cookie named `snickr_session`.
Three alternatives were considered. A JWT bearer token would require the
frontend to attach the token explicitly on every request, which adds
client-side code without removing trust in the browser. A server-side
session store would require a second backing service such as Redis, which
is not justified for a single-laptop demo. A signed cookie is the closest
match for the project's needs because the cookie is HTTP-native, browsers
attach it automatically on same-origin requests, and the signature
guarantees that the cookie cannot be tampered with offline. Because the
cookie is signed rather than encrypted, the user could in principle
inspect its contents, which is acceptable for a numeric user identifier.

**Cookie attributes.** The cookie is marked `httpOnly` so client-side
JavaScript cannot read it, which means a hypothetical XSS payload cannot
exfiltrate the session. It is marked `sameSite=lax` so the browser does
not send it on cross-site POST requests, which mitigates CSRF on
state-changing endpoints. Its lifetime is seven days, after which the
browser drops the cookie and the next protected request returns 401.

**URL design philosophy.** URLs are RESTful, bookmarkable, and
human-readable. The frontend mirrors the API path structure so a URL
encodes a position in the data rather than a position in the UI. A
workspace lives at `/api/workspaces/{id}` and at `/app/workspaces/{id}`.
A channel lives at `/api/channels/{id}` and at
`/app/workspaces/{id}/channels/{id}`. A search result page lives at
`/app/search?q={query}`. None of these URLs encodes the user's identity,
so the same URL points at the same conceptual resource for every user,
and the backend decides at request time whether the caller is allowed to
see it. The URL of a user's profile page lives at `/app/profile`, which
is intentionally not parameterised by user identifier; the page reads its
content from `/api/auth/me`, and the backend resolves "me" from the
session.

**Deep linking.** The frontend reconstructs page state from the URL on
every load. A user who pastes the URL of a channel into a fresh browser
session lands on the login page, logs in, and is redirected to the same
channel. The redirection target is preserved across the login round-trip
by carrying it in a `?next=` query parameter on the login form. A user
who pastes a search URL is taken to the search page with the query
prefilled and the results computed.

**Session invalidation.** Two paths invalidate a session. A user who logs
out hits `POST /api/auth/logout`, which clears the server-side session
dictionary and causes Starlette to set an empty signed cookie on the
response, so the browser stops sending the user identifier on subsequent
requests. A user who simply walks away will eventually hit the cookie's
seven-day expiry, at which point the browser drops the cookie and the
next protected request returns 401, and the frontend redirects to the
login page. There is no refresh-token mechanism, so an expired session
always sends the user back through login. This is acceptable for a course
project because a continuous seven-day session covers any realistic demo
scenario, and the cost of re-logging in is one form.

### 3.5 Cross-site scripting

The project specification asks the system to guard against cross-site
scripting in addition to SQL injection. The defence is split between
this backend and the React frontend. The full rendering-layer story
belongs in the Frontend Design section of the documentation outline.
This subsection describes the backend's part of the contract.

The backend stores user-submitted text exactly as it was received. It
does not call `htmlspecialchars`, it does not strip HTML tags, and it
does not normalise whitespace at write time. A message whose content is
the literal string `<script>alert(1)</script>` is stored as those 26
characters in the `messages.content` column, and a username containing
an ampersand is stored with the ampersand as-is.

The reason is that escaping at write time would couple the database
representation to a single output format. A future plain-text export, a
mobile client, or a CLI viewer would have to undo the HTML escaping
before re-escaping for its own context. Storing the original input keeps
the data clean and pushes escaping to the rendering boundary, which is
where the output context is actually known.

The rendering boundary is the React frontend. React's JSX expression
syntax `{value}` always produces a text node, never raw HTML, so an
injected `<script>` tag in a message body becomes the literal four
characters `<` `s` `c` ... rather than an executable script element. The
project deliberately avoids `dangerouslySetInnerHTML`, which is the only
React API that opts out of the auto-escape. Because every place a
message can appear in the UI flows through the same `<MessageItem>`
component, a single audit point covers every rendering path. The
end-to-end Playwright suite verifies that an `<img src=x onerror=...>`
payload typed into the composer never fires its `onerror` handler when
the message is rendered.

Two backend choices reinforce the rendering-layer defence. The session
cookie is marked `httpOnly`, so a hypothetical script that did execute
in the page could not exfiltrate the cookie through `document.cookie`.
The cookie is also marked `sameSite=lax`, which prevents the browser
from attaching it to cross-site POST requests, blunting CSRF as a
secondary effect. Neither attribute is XSS protection on its own, but
each limits the damage of a hypothetical render-layer mistake.

---

*End of design report.*
