# Snickr — Design Report

Snickr is a three-tier web application. The presentation tier is a React
single-page app built with Vite. The application tier is a FastAPI service
that holds all business logic and is the sole originator of SQL. The data
tier is a local PostgreSQL instance, with a Supabase-hosted instance
available as a remote alternative. Browser-to-backend traffic is HTTP
carrying JSON. Backend-to-database traffic is SQL issued through asyncpg,
with two multi-step writes encapsulated as PL/pgSQL stored procedures.

---

## 2. Database Design

### 2.1 Requirements analysis and entity identification

The schema models a Slack-style collaboration product. A user account
represents a person who can sign in. A workspace is a top-level container
of users and channels, analogous to a Slack team. A channel is a stream
of messages inside a workspace, of one of three kinds: public, private,
or direct. Messages carry the textual content posted to a channel.
Membership tables record which users belong to which workspaces and
channels. Invitation tables record outstanding requests for a user to
join a workspace or a channel.

Six business rules drove the design:

- A workspace has at least one administrator at all times. The creator is
  seeded as the first administrator, and the system refuses any operation
  that would leave the workspace with zero admins.
- Channel visibility has three modes. A public channel can be self-joined
  by any workspace member. A private channel is invitation-only. A
  direct-message channel is created on demand between exactly two members
  of the same workspace and is reused on subsequent opens, preserving the
  timeline.
- Workspace membership is a prerequisite for any channel access in that
  workspace, and channel membership is a prerequisite for reading or
  posting messages in that channel. The two checks are independent, so
  revoking workspace membership reliably revokes all downstream access.
- Invitations follow a three-state lifecycle: pending, accepted, declined.
  A unique constraint on the invitee within a workspace collapses
  duplicate sends into a single row.
- The timeline is append-only at the row level. Edits update `content`
  and `edited_time` in place rather than creating a new row, and deletes
  are hard. Channel timeline reads are therefore a single monotonic scan
  ordered by `posted_time`, with no version chains or tombstones.
- Direct messages reuse the `channels` and `messages` tables rather than
  living in a parallel pair. The only differences from a regular channel
  are `channeltype` and a deterministic two-user channel name. Reuse
  collapses search, read, post, and timeline display into a single code
  path across all three channel kinds.

Project 2 introduced seven schema changes on top of the Project 1 DDL,
each shipped as a numbered migration so the original DDL stays intact and
reproducible.

- `001_widen_password.sql` widens `users.password` from `VARCHAR(30)` to
  `VARCHAR(255)`. The Project 1 column had been sized for plaintext
  before the hashing strategy was fixed. bcrypt hashes occupy 60
  characters, and the wider column accommodates future hash algorithms
  without an additional migration.
- `002_stored_procedures.sql` adds two stored procedures,
  `create_channel_for_member` and `accept_workspace_invitation`,
  documented in Section 2.4. Each wraps a multi-step transactional
  write inside the database, where atomicity is most important.
- `003_message_time_eastern.sql` redefines the default of
  `messages.posted_time` to `timezone('America/New_York', NOW())`. The
  rendered timestamps then match the wall-clock time at the demo
  location with no per-request timezone conversion in the application
  layer.
- `004_mentions.sql` adds a `mentions` table containing one row per
  `(messageID, mentioned_user)` pair. The application populates it on
  message creation by parsing `@username` patterns from the content and
  joining against `channelmember`. Both foreign keys cascade on delete,
  so removing a message or a user automatically cleans up mention rows.
- `005_message_edit.sql` adds an `edited_time` column to `messages`. The
  column is `NULL` for messages that have never been edited and is set
  to the wall-clock time on every edit, allowing the UI to render an
  `edited` marker without a separate audit table.
- `006_message_system_kind.sql` adds a `system_kind` column to
  `messages`. A `NULL` value marks an ordinary user message; a non-`NULL`
  value names the system event that produced the row, currently only
  `'join'`. Channel joins write a system message identifying who joined,
  and the edit and delete endpoints reject any message whose
  `system_kind` is non-`NULL`. The Inbox classifier in Section 3.1 also
  reads this column rather than matching on message content.
- `007_channelmember_hidden_at.sql` adds a `hidden_at` column to
  `channelmember`. A `NULL` value means the membership is visible in the
  user's channel list. A non-`NULL` timestamp means the user has
  dismissed a direct-message channel from their list. The membership
  row is retained so message history stays accessible and the partner
  is unaffected. Reopening the DM, or the partner posting a new message,
  clears the timestamp and the channel reappears.

Migrations are applied in numeric order. Each one is idempotent, and the
seed data in `database/seeds/sample_data.sql` assumes all seven have
already been applied.

The course outline lists message threading, soft delete, and a separate
direct-message table as common designs. None of the three is implemented.
Replies are not modelled as a self-referencing relationship because the
timeline is flat by design; a user who wants to reply posts an ordinary
message in the same channel. Hard delete is preferred over soft delete,
so removing a message clears the row and lets foreign-key cascades clean
up the dependent mention rows in one step. Direct messages share the
channel and message tables for the reuse argument given above.

### 2.2 Entity-relationship model

![Figure 1: Entity–Relationship diagram of the Snickr database.](../ER-Diagram.drawio.svg)

The major entities and their relationships are summarised below.

| Relationship | Cardinality | Realised by |
|---|---|---|
| User _creates_ Workspace | 1 : N | `workspaces.created_by` |
| User _belongs to_ Workspace | M : N | `workspacemember` |
| User _invites_ User to _Workspace_ | M : N | `workspaceinvitation` |
| Workspace _contains_ Channel | 1 : N | `channels.workspaceID` |
| User _creates_ Channel | 1 : N | `channels.created_by` |
| User _belongs to_ Channel | M : N | `channelmember` |
| User _invites_ User to _Channel_ | M : N | `channelinvitation` |
| User _posts_ Message | 1 : N | `messages.posted_by` |
| Channel _contains_ Message | 1 : N | `messages.channelID` |
| User _is mentioned in_ Message | M : N | `mentions` |

Three lookup tables, `roles`, `status`, and `channeltype`, sit alongside
the business tables and replace string enums. A workspace member holds a
foreign key into `roles` rather than a `VARCHAR` literal, an invitation
row holds a foreign key into `status`, and a channel holds a foreign key
into `channeltype`. New roles, statuses, or channel types can therefore
be added with a single insert into the lookup table rather than a
schema-altering data migration.

Participation constraints are weak by design, so the schema can describe
in-progress states. A user may belong to zero workspaces, a workspace may
contain zero channels for the brief moment between creation steps before
the default `general` channel is added, and a channel may be empty for the
moment between creation and the first message. The application
transactions described in Section 3.3 ensure that these gaps never become
visible to other users.

Notable design choices:

- Direct-message channels reuse the channel table with
  `channeltype.name = 'direct'` and a deterministic name derived from the
  two participants' user identifiers. Reopening a direct-message
  conversation returns the same channel identifier, so the URL is stable
  and the timeline is preserved.
- Messages have no parent pointer. The schema can store reply content
  but not reply structure. A self-referencing foreign key was not added
  because no UI flow uses one.
- Workspace and channel deletes cascade. Removing a workspace removes
  its channels, members, and invitations. Removing a channel removes its
  messages and members. The `created_by` column on `workspaces` uses
  `SET NULL` rather than `CASCADE`, so a deleted user does not silently
  take a workspace down.

### 2.3 Relational schema

The schema consists of twelve tables. All identifiers are lowercase,
relying on Postgres folding for unquoted names. The full DDL is in
`database/schema/schema.sql`, with the incremental migrations enumerated
in Section 2.1. The full attribute list of each table follows.

#### `users`

| Column | Type | Constraints |
|---|---|---|
| **`userID`** | INTEGER | PK, identity |
| `email` | VARCHAR(50) | UNIQUE, NOT NULL |
| `username` | VARCHAR(30) | UNIQUE, NOT NULL |
| `nickname` | VARCHAR(30) | — |
| `password` | VARCHAR(255) | nullable, holds the bcrypt hash |
| `created_time` | TIMESTAMP | NOT NULL, default NOW() |
| `updated_time` | TIMESTAMP | NOT NULL, default NOW() |

The `password` column was widened from `VARCHAR(30)` to `VARCHAR(255)` by
migration `001` so it can hold a bcrypt hash and accommodate future hash
algorithms.

#### `workspaces`

| Column | Type | Constraints |
|---|---|---|
| **`workspaceID`** | INTEGER | PK, identity |
| `name` | VARCHAR(30) | NOT NULL |
| `description` | VARCHAR(200) | — |
| `created_time` | TIMESTAMP | NOT NULL, default NOW() |
| `updated_time` | TIMESTAMP | NOT NULL, default NOW() |
| `created_by` | INTEGER | nullable, FK → `users.userID` ON DELETE SET NULL |

`created_by` is nullable so that deleting a user does not cascade-delete
the workspaces they founded.

#### `roles`

| Column | Type | Constraints |
|---|---|---|
| **`roleID`** | INTEGER | PK, identity |
| `name` | VARCHAR(20) | UNIQUE, NOT NULL |

Seeded values: `'admin'`, `'member'`.

#### `workspacemember`

| Column | Type | Constraints |
|---|---|---|
| **`workspaceID`** | INTEGER | PK (composite), FK → `workspaces.workspaceID` ON DELETE CASCADE |
| **`userID`** | INTEGER | PK (composite), FK → `users.userID` ON DELETE CASCADE |
| `role` | INTEGER | NOT NULL, FK → `roles.roleID` |
| `joined_time` | TIMESTAMP | NOT NULL, default NOW() |

The composite PK `(workspaceID, userID)` enforces that a user appears at
most once in a given workspace.

#### `status`

| Column | Type | Constraints |
|---|---|---|
| **`statusID`** | INTEGER | PK, identity |
| `type` | VARCHAR(30) | UNIQUE, NOT NULL |

Seeded values: `'pending'`, `'accepted'`, `'declined'`. Shared by both
`workspaceinvitation` and `channelinvitation`, so the invitation lifecycle
is defined in one place.

#### `workspaceinvitation`

| Column | Type | Constraints |
|---|---|---|
| **`invitationID`** | INTEGER | PK, identity |
| `workspaceID` | INTEGER | NOT NULL, FK → `workspaces.workspaceID` ON DELETE CASCADE |
| `invitee` | INTEGER | NOT NULL, FK → `users.userID` ON DELETE CASCADE |
| `inviter` | INTEGER | NOT NULL, FK → `users.userID` |
| `invited_time` | TIMESTAMP | NOT NULL, default NOW() |
| `status_type` | INTEGER | NOT NULL, FK → `status.statusID` |

Unique constraint on `(workspaceID, invitee)` prevents duplicate invites
to the same user.

#### `channeltype`

| Column | Type | Constraints |
|---|---|---|
| **`typeID`** | INTEGER | PK, identity |
| `name` | VARCHAR(30) | UNIQUE, NOT NULL |

Seeded values: `'public'`, `'private'`, `'direct'`.

#### `channels`

| Column | Type | Constraints |
|---|---|---|
| **`channelID`** | INTEGER | PK, identity |
| `workspaceID` | INTEGER | NOT NULL, FK → `workspaces.workspaceID` ON DELETE CASCADE |
| `channel_name` | VARCHAR(50) | NOT NULL |
| `typeID` | INTEGER | NOT NULL, FK → `channeltype.typeID` |
| `created_by` | INTEGER | NOT NULL, FK → `users.userID` |
| `created_time` | TIMESTAMP | NOT NULL, default NOW() |
| `updated_time` | TIMESTAMP | NOT NULL, default NOW() |

Unique constraint on `(workspaceID, channel_name)` enforces that channel
names are unique within a workspace while allowing the same name to
exist in different workspaces.

#### `channelmember`

| Column | Type | Constraints |
|---|---|---|
| **`channelID`** | INTEGER | PK (composite), FK → `channels.channelID` ON DELETE CASCADE |
| **`userID`** | INTEGER | PK (composite), FK → `users.userID` ON DELETE CASCADE |
| `joined_time` | TIMESTAMP | NOT NULL, default NOW() |
| `hidden_at` | TIMESTAMP | nullable; non-`NULL` hides a DM channel from the user's list |

The composite PK prevents duplicate memberships. `hidden_at` was added by
migration `007` to support DM dismissal without deleting the membership
row, so the message history remains accessible to both participants.

#### `channelinvitation`

| Column | Type | Constraints |
|---|---|---|
| **`invitationID`** | INTEGER | PK, identity |
| `channelID` | INTEGER | NOT NULL, FK → `channels.channelID` ON DELETE CASCADE |
| `invitee` | INTEGER | NOT NULL, FK → `users.userID` ON DELETE CASCADE |
| `inviter` | INTEGER | NOT NULL, FK → `users.userID` |
| `invited_time` | TIMESTAMP | NOT NULL, default NOW() |
| `status_type` | INTEGER | NOT NULL, FK → `status.statusID` |

Unique constraint on `(channelID, invitee)` mirrors the workspace
invitation constraint.

#### `messages`

| Column | Type | Constraints |
|---|---|---|
| **`messageID`** | INTEGER | PK, identity |
| `channelID` | INTEGER | NOT NULL, FK → `channels.channelID` ON DELETE CASCADE |
| `content` | VARCHAR(500) | NOT NULL |
| `posted_time` | TIMESTAMP | NOT NULL, default `timezone('America/New_York', NOW())` |
| `edited_time` | TIMESTAMP | nullable, set on every edit |
| `posted_by` | INTEGER | NOT NULL, FK → `users.userID` |
| `system_kind` | VARCHAR(20) | nullable; non-`NULL` marks a system event such as `'join'` |

`edited_time` and `system_kind` were added by migrations `005` and `006`.
A non-`NULL` `system_kind` makes the row tamper-proof: the edit and
delete endpoints reject any message whose `system_kind` is set.

#### `mentions`

| Column | Type | Constraints |
|---|---|---|
| **`mentionID`** | INTEGER | PK, identity |
| `messageID` | INTEGER | NOT NULL, FK → `messages.messageID` ON DELETE CASCADE |
| `mentioned_user` | INTEGER | NOT NULL, FK → `users.userID` ON DELETE CASCADE |
| `created_time` | TIMESTAMP | NOT NULL, default `timezone('America/New_York', NOW())` |

Unique constraint on `(messageID, mentioned_user)` prevents the same
mention from being double-counted.

**Normalisation.** Every table is in third normal form. Each non-key
attribute depends on the whole primary key and on no other non-key
attribute. The user record carries no derived values. Membership tables
hold only the join key, the role or join time, and no facts about the
user or the channel. The lookup tables hold only the surrogate identifier
and the canonical name. Messages hold the channel pointer, the poster
pointer, the content, and the timestamps; the poster's name is not
denormalised onto the message and is joined at read time.

The lookup tables are the closest the design comes to denormalisation. A
`CHECK` constraint with an enumerated list would suffice and would avoid a
join. The schema uses tables instead so new values can be added with a
single `INSERT` rather than a schema migration, and so foreign-key
referential integrity catches typos that a `CHECK` list cannot.

**Indexes.** The schema declares four secondary indexes on top of the
implicit primary-key and unique-constraint indexes.

| Index | Table and columns | Reason |
| --- | --- | --- |
| `idx_messages_channel` | `messages (channelID)` | Channel timeline reads filter by `channelID` and order by `posted_time`. This is the most common read path in the system. |
| `idx_workspace_member_user` | `workspacemember (userID)` | The "list workspaces I belong to" query filters by `userID`. The composite primary key `(workspaceID, userID)` does not help this query because `workspaceID` is the leading column. |
| `idx_channel_member_user` | `channelmember (userID)` | Same reasoning as the workspace index, applied to channels. |
| `idx_mentions_user` | `mentions (mentioned_user, created_time DESC)` | The Inbox query filters by `mentioned_user` and orders by recency, so a covering composite index turns the read into a single backward index scan. |

Foreign-key columns that participate in joins benefit from indexing
because of cascade-delete behaviour on the parent. Postgres scans the
child by the foreign key when the parent is deleted, and an index makes
that scan an index seek rather than a sequential scan.

### 2.4 Stored procedures and queries

The catalog below groups every database-encapsulated operation by
feature. Each entry names the responsible procedure or handler,
summarises its behaviour, and states its return shape. Two of the
operations, marked **stored procedure**, are PL/pgSQL functions in
`database/migrations/002_stored_procedures.sql`. The remaining
operations are FastAPI handlers under `backend/app/api/v1/`, marked
**handler transaction** when they open an explicit
`async with conn.transaction()` block and **parameterised SQL** when
they are a single statement. All three forms share the SQL injection
guarantee of Section 3.2: every value is bound through asyncpg's
`$1, $2, ...` placeholders.

**Authentication.**

- `register_user`. Parameterised SQL in `auth.py`. Given an email, a
  username, an optional nickname, and a plaintext password, the handler
  bcrypt-hashes the password, inserts a row into `users`, and writes the
  user identifier into the session cookie. Returns the new user row, or
  409 on duplicate email or username.
- `authenticate_user`. Parameterised SQL in `auth.py`. Given a username
  and a plaintext password, the handler selects the user row, calls
  `bcrypt.checkpw` against the stored hash, and writes the user
  identifier into the session cookie on success. Returns the user row,
  or 401 with a generic message on either an unknown username or a bad
  password, so an attacker cannot enumerate usernames.

**Workspace management.**

- `create_workspace`. Handler transaction in `workspaces.py`. Inserts the
  workspace row, looks up the `admin` role, inserts the creator into
  `workspacemember`, then calls `create_channel_for_member` to seed the
  default `general` channel. The whole sequence runs inside a single
  transaction. Returns the workspace summary.
- `create_channel_for_member`. **Stored procedure** with signature
  `(p_workspace_id INTEGER, p_channel_name VARCHAR, p_type_name VARCHAR, p_user_id INTEGER) RETURNS INTEGER`.
  Verifies the caller's workspace membership and returns `NULL` if it is
  absent; otherwise resolves the channel-type identifier, raises on an
  unknown type, inserts the `channels` row, and inserts the
  `channelmember` row. Both inserts commit together inside the PL/pgSQL
  function. Returns the new `channelID`. Used by `create_workspace` and
  by `POST /api/workspaces/{id}/channels`.
- `invite_member`. Parameterised SQL in `workspaces.py`. Asserts the
  caller is an admin, resolves the invitee username, and inserts a row
  into `workspaceinvitation` with `status_type = pending`. Returns the
  new invitation row, or 409 if `(workspaceID, invitee)` already exists.
- `accept_workspace_invitation`. **Stored procedure** with signature
  `(p_invitation_id INTEGER, p_user_id INTEGER) RETURNS INTEGER`. Reads
  the invitation row joined with `status`; returns `NULL` if it is not
  addressed to the caller; raises if it is already responded to.
  Otherwise it resolves the `accepted` and `member` lookup identifiers,
  updates the invitation status, and inserts the membership row with
  `ON CONFLICT DO NOTHING` so a concurrent accept does not double-insert.
  Returns the workspace identifier on success. Used by
  `POST /api/me/workspace-invitations/{id}` with `accept: true`.
- `respond_to_invitation`, decline path. Handler transaction in
  `workspaces.py`. Reads the invitation status under MVCC inside one
  transaction and updates it to `declined`.
- `remove_member`. Handler transaction in `workspaces.py`. Inside one
  transaction, deletes the user's rows from `channelmember` for every
  channel in the workspace, then deletes the `workspacemember` row.
  Returns 204.
- `change_role`. Parameterised SQL in `workspaces.py`. Promotes or
  demotes a member. The last-admin guard counts admins and refuses any
  change that would leave the workspace with zero admins.

**Channel management.**

- `create_channel` is `create_channel_for_member`, described above.
- `join_channel`. Parameterised SQL in `channels.py`. Asserts the
  caller's workspace membership and that the channel's type is `public`,
  then runs `INSERT INTO channelmember ON CONFLICT DO NOTHING`. Returns
  200.
- `invite_to_channel`. Parameterised SQL in `channels.py`. Asserts the
  caller is a channel member, resolves the username, and inserts a
  pending row into `channelinvitation`. Returns the new invitation, or
  409 on a duplicate row.
- `respond_to_channel_invitation`. Handler transaction in `channels.py`.
  On accept, runs an update on `channelinvitation` followed by an
  `INSERT INTO channelmember ON CONFLICT DO NOTHING` inside one
  transaction. On decline, only updates the invitation.
- `open_direct_message`. Handler transaction in `channels.py`. Inside
  one transaction, derives the deterministic name `dm-{minId}-{maxId}`
  from the two user identifiers, upserts the `channels` row with type
  `direct`, and inserts both participants into `channelmember`. The
  deterministic name guarantees idempotency, so reopening returns the
  same `channelID`.

**Messaging.**

- `post_message`. Parameterised SQL in `messages.py`. Asserts the
  caller's channel membership and runs
  `INSERT INTO messages (channelID, content, posted_by)`. The
  `posted_time` default in the schema records the timestamp in
  `America/New_York`, so the application does not pass one. Returns the
  new message row including `posted_time` and the poster's display name.
- `post_reply` is not implemented. Replies are posted as ordinary
  messages in the same channel; the schema has no parent-message
  pointer.
- `get_channel_messages`. Parameterised SQL in `messages.py`. Asserts
  the caller's channel membership, then runs
  `SELECT m.*, u.username, u.nickname FROM messages m JOIN users u ON u.userID = m.posted_by WHERE m.channelID = $1 ORDER BY m.posted_time, m.messageID`.
  The `idx_messages_channel` index covers the filter, and the secondary
  order on `messageID` is the primary key for stability.
- `get_user_messages`. Parameterised SQL in `messages.py`. Lists every
  message posted by a given user, scoped to channels the caller can see.
  Joins `messages` to `channels`, `workspaces`, and `channelmember`
  filtered by the caller. Used by `GET /api/users/{id}/messages`.

**Search.**

- `search_messages`. Parameterised SQL in `messages.py`. Substring
  search across messages the caller can read. The query is
  `SELECT m.*, w.name, c.channel_name FROM messages m JOIN channels c ... JOIN channelmember cm ON cm.channelID = m.channelID AND cm.userID = $1 WHERE m.content ILIKE $2`,
  with the second parameter bound as `f"%{q}%"`. The `ILIKE` wildcards
  live in the bound value, not in the SQL text, so a user query of
  `100%` searches for the literal string `100%`.
- `search_channels` is not exposed as its own endpoint. The frontend's
  channel sidebar already shows every channel the user can see, so a
  channel search would duplicate the existing list endpoint.

**Why two stored procedures and not twelve.** A wider catalog of stored
procedures would have moved single-table reads and writes into the
database for no clear gain. A one-line `INSERT` or `SELECT` does not
benefit from PL/pgSQL encapsulation. Stored procedures were reserved for
the two cases where atomicity across multiple tables matters most and
where the application would otherwise have to coordinate the sequence by
hand: channel creation with the first-member insert, and invitation
acceptance with the membership insert. The remaining transactional
operations live as `async with conn.transaction()` blocks in handlers and
are catalogued by feature above and again by transaction boundary in
Section 3.3.

The seven Part 1 query templates, kept as parameterised statements with
`:name` placeholders in `database/queries/queries.sql`, are reissued by
the Part 2 backend as parameterised asyncpg calls. The same logic is
therefore reachable both from the Postgres CLI and from the JSON API.

---

## 3. Backend Design

### 3.1 API layer structure

The backend is written in Python 3.11 on FastAPI, with asyncpg as the
Postgres driver, bcrypt for password hashing, Pydantic v2 for request
and response validation, and Starlette's `SessionMiddleware` for signed
cookie sessions. FastAPI was chosen for two reasons. First, it generates
an interactive API explorer at `/docs` from the same Pydantic models
that validate requests, eliminating drift between the implementation and
the documented contract. Second, its dependency-injection mechanism
makes authentication checks visible in every route signature.

A request enters FastAPI and passes through two middleware layers.
`CORSMiddleware` permits only the origins listed in `FRONTEND_ORIGIN`.
The React dev server proxies `/api/*` to the backend, so requests are
same-origin from the browser's point of view, and the CORS list matters
only when a developer calls the backend directly from another host.
`SessionMiddleware` reads and writes the signed `snickr_session` cookie.
After middleware, FastAPI dispatches to a router under `app/api/v1/`.
There is one router per resource group: `auth.py`, `workspaces.py`,
`channels.py`, `messages.py`, and `mentions.py`, plus a small `deps.py`
that holds the shared `current_user_id` dependency. The mention parser
and the `/api/me/mentions` endpoint live in `mentions.py` and are
imported by the message router so a single transaction covers both
message creation and mention insertion.

Each handler depends on `get_conn`, which leases an `asyncpg.Connection`
from a single pool created during the FastAPI lifespan. asyncpg leases
one connection per request, so every query inside a handler runs on the
same connection, and inside the same transactional context if the
handler opens one. The pool also disables asyncpg's per-connection
prepared-statement cache, allowing the same SQL to be reissued cleanly
through a connection pooler such as Supabase's session pooler without
prepared-statement name clashes.

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

**HTTP method conventions.** The API uses `GET` for reads, `POST` for
creating new rows or performing actions without a clean `PUT` semantics
such as accepting an invitation or joining a channel, `PATCH` for
partial updates to existing rows, and `DELETE` for removals. `PUT` is
not used because no resource has a fully replaceable representation.
Resource paths are pluralised, identifiers are numeric, and nested paths
mirror containment: a channel lives under a workspace, and its messages
live under the channel.

**Request and response format.** Every request and response body is
JSON encoded as UTF-8. Field names are camelCase on the wire, while
Postgres identifiers are lowercase. The mapping is performed in SQL with
column aliases such as `SELECT workspaceID AS "workspaceId"`. Aliasing
in SQL rather than in a global serialiser keeps the SQL readable and
makes the mapping inspectable in the source.

**Error handling.** All error responses use FastAPI's default body
shape, a JSON object with a single `detail` key carrying a human-readable
string. Status codes follow HTTP conventions: 400 for malformed requests
that nonetheless pass schema validation, 401 for unauthenticated
requests, 403 for authenticated requests that lack permission for a
non-private resource, 404 for missing or private resources hidden from
the caller, 409 for unique-constraint and lifecycle conflicts such as a
duplicate invitation, 422 for schema-validation failures emitted by
Pydantic, and 500 for unhandled server errors. Private and direct
channels return 404 to non-members rather than 403, hiding the existence
of a private channel from users who are not invited.

The error body is uniform across endpoints, so the frontend has a single
error path. The frontend reads `detail` and displays it directly, with a
fallback to a generic message if the field is missing.

**Membership exit.** Two endpoints let a user remove themselves from
shared resources. `POST /api/channels/{id}/leave` deletes the caller's
row from `channelmember` for any public or private channel they belong
to, and returns 204. Direct-message channels follow a softer rule because
both participants are part of the conversation by construction: the same
endpoint sets `channelmember.hidden_at = NOW()` on the leaver's row
without deleting it, so the message history is preserved and the
partner's view is unaffected. The DM reappears in the leaver's list when
they reopen it through the direct-message endpoint or when the partner
posts a new message. `DELETE /api/workspaces/{id}` disbands an entire
workspace and is restricted to administrators. The foreign-key cascade
on `workspaces` removes the channels, members, and invitations in a
single statement, so no extra clean-up logic is needed in the handler. A
separate guard prevents the last administrator from demoting or removing
themselves through the role-change endpoint, since that would leave the
workspace ungoverned. The disband path is the supported way to retire a
workspace whose last admin also wants to leave.

**Inbox event log.** The `mentions` table stores three kinds of Inbox
events under the same row format. A regular `@username` mention writes
one row for the mentioned user. A direct-message post writes one row for
the other participant in the channel, so DMs surface in the Inbox without
a separate notifications table. A successful self-join into a public
channel writes a system message with `system_kind = 'join'` and a
mention row addressed to the channel creator, so the owner of the
channel sees who joined. The `GET /api/me/mentions` query classifies
each row at read time using a `CASE` expression: `'dm'` when the channel
type is `direct`, `'join'` when the underlying message has
`system_kind = 'join'`, otherwise `'mention'`. The classifier reads from
columns rather than matching on message content, so a user who happens
to type `joined the channel` is not misclassified as a system join
event.

### 3.2 Security: guarding against SQL injection

Every query and every stored-procedure invocation passes user input
through asyncpg's parameter binding. The Postgres extended-query protocol
treats bound values as data, never as SQL grammar, so input that resembles
SQL keywords cannot escape its placeholder. There is no codepath in the
application where user text is concatenated into a SQL string, no
f-string interpolation of user input, and no manual escaping. The course
specification calls out stored procedures and prepared statements as
acceptable mitigations, and the design relies on both. asyncpg uses
Postgres's extended-query protocol, which prepares each query and binds
its arguments through the binary protocol; this is the database-side
equivalent of a prepared statement.

**Stored procedures as an additional layer.** The two procedures from
Section 2.4 take typed arguments and are invoked through
`SELECT create_channel_for_member($1, $2, $3, $4)` style calls. The
application layer therefore never constructs raw SQL even for the most
sensitive multi-step writes. The procedure body is owned by the database
schema rather than by the application, so a future application bug
cannot cause a malformed write inside the procedure.

**Input validation layer.** Pydantic v2 models in `app/schemas/` describe
both request payloads and response shapes. Field length limits in these
models mirror the schema constraints, so a 31-character username is
rejected at validation time before it reaches Postgres. Email addresses
are validated against the RFC 5321 mailbox grammar by Pydantic's
`EmailStr`. Type coercion is strict, so passing the string `"1"` where
an integer is required is rejected rather than silently parsed.

**Vulnerable versus safe pattern.** A vulnerable Python pattern would
build SQL with f-strings such as
`f"INSERT INTO messages (content) VALUES ('{user_text}')"`, where a
message containing `'); DROP TABLE messages; --` would parse as two SQL
statements and the second one would drop the table. The Snickr backend
never builds SQL this way. Every write looks like
`await conn.execute("INSERT INTO messages (content) VALUES ($1)", user_text)`,
where asyncpg sends the SQL and the bound argument as separate fields in
the Postgres extended-query protocol. The user text is always a value
and never grammar.

**Edge cases.** A username containing a single quote, a workspace
description containing a backslash, a message that begins with two
hyphens, and a search query of `100%` are all handled correctly without
any code change because every value travels through the same binding
mechanism. The search endpoint binds the wildcard string `f"%{q}%"` as
a single argument, so a user query of `100%` searches for the literal
string `100%` rather than expanding into a wildcard. SQL keywords inside
message content are never interpreted as SQL because they are part of a
bound value, not part of the query text. The same property holds for
`@username` mention parsing on message creation and edit. A regex
extracts candidate handles from the message text in Python, the
resulting list is passed to Postgres as a bound `text[]` argument with
`username = ANY($1::text[])`, and the lookup never builds a `WHERE`
clause out of user-supplied substrings.

**Result.** The SQL injection guarantee in this project is structural
rather than convention-based. Defeating it would require replacing
asyncpg's parameter API with raw SQL, which would be a noisy change far
outside the established pattern.

### 3.3 Concurrency control and transactions

Multiple users use the system simultaneously, so any operation that
touches more than one row must be safe under concurrent execution. The
backend addresses this in two ways: multi-statement writes run inside
Postgres transactions so each commits as a unit or rolls back as a unit,
and everything else is left to Postgres's default MVCC isolation.

**Transactional operations.** The list below catalogues every place
where the backend opens an explicit transaction. Each entry names the
operation, the rows it touches, and the invariant the transaction
preserves.

- Workspace creation. Inserts the workspace row, the creator's
  admin-role membership row, and the default `general` channel through
  `create_channel_for_member`. The transaction guarantees that a
  workspace never exists without an admin or without its `general`
  channel.
- Direct-message channel creation. Upserts the channel under the
  deterministic name and inserts both participants as members. The
  transaction guarantees that both participants see the channel together
  or neither does.
- Member removal. Deletes the user's memberships in every channel of
  the workspace, then deletes the workspace-membership row. The
  transaction guarantees that the user does not retain channel rows that
  outlive their workspace membership.
- Channel-invitation response. Updates `channelinvitation.status_type`
  and, on accept, inserts the channel-membership row. The transaction
  guarantees that an invitation is never marked accepted without its
  membership row.
- Workspace-invitation decline. Reads the invitation status and updates
  it inside one transaction, so concurrent accept and decline calls
  cannot both succeed.
- Workspace-invitation acceptance. Encapsulated inside the
  `accept_workspace_invitation` stored procedure described in Section
  2.4. The procedure runs as one PL/pgSQL block, so Postgres serialises
  the read of the invitation status, the update to `accepted`, and the
  insert into `workspacemember`. Two users racing to accept the same
  invitation cannot both succeed.
- Message creation. Inserts the message row, walks the new content for
  `@username` patterns, resolves them against `channelmember`, and
  bulk-inserts the resulting `mentions` rows. The transaction guarantees
  that a message and its mention rows commit together.
- Message editing. Updates `messages.content` and `messages.edited_time`,
  deletes the existing `mentions` rows for the message, and re-inserts
  mentions parsed from the new content. The transaction guarantees that
  edited content and the corresponding mention set are never out of
  sync.

**Isolation level.** The default Postgres isolation level, READ
COMMITTED, is left in place. This level is appropriate because the
backend's writes touch a small number of unrelated rows across tables,
and the unique constraints below catch the few cases where two writers
could land on the same key.

**MVCC framing.** Under MVCC, every transaction sees a consistent
snapshot of each row at statement start, preventing dirty reads without
blocking readers behind writers. Lost updates and write skew on the same
row are prevented because Postgres locks the row for any concurrent
writer until the holder of the row's latest version commits or rolls
back. The application does not rely on any stricter isolation level.

**Unique constraints as a safety net.** Where two writers could race to
insert duplicates, the schema's unique constraints act as the final
safety net.

- `(workspaceID, channel_name)` on `channels` guarantees that two
  simultaneous create-channel calls cannot both succeed, even if both
  pass the duplicate-name check before either writes.
- `(workspaceID, invitee)` on `workspaceinvitation` plays the same role
  for workspace invitations and is the reason duplicate invites collapse
  into a 409 rather than a phantom second row.
- `(channelID, invitee)` on `channelinvitation` plays the same role for
  channel invitations.
- `(workspaceID, userID)` on `workspacemember` and
  `(channelID, userID)` on `channelmember` prevent the same user from
  being inserted twice if two accept calls land at the same instant.
  The stored-procedure path uses `ON CONFLICT DO NOTHING` so the second
  insert is silently absorbed rather than raising.

**Last-admin guard.** A workspace must have at least one administrator
at all times. The backend enforces this with a read-then-write pattern
that counts admins and refuses any change that would leave zero admins.
Under the demo workload this is correct because the only way to
interleave two attempts to demote the last admin is for two admins to
demote each other simultaneously, and either ordering is acceptable. A
stricter implementation would lock the relevant rows with
`SELECT ... FOR UPDATE` inside the same transaction, and is listed as
a future improvement.

### 3.4 Session state and URL design

The backend keeps session state in a signed cookie and uses URLs only
to address content. Identity travels in the cookie, never in the URL.

**Session mechanism.** Sessions are implemented with Starlette's
`SessionMiddleware`, which signs a JSON document with the secret key in
`SESSION_SECRET` and stores the result in a cookie named
`snickr_session`. Three alternatives were evaluated. A JWT bearer token
would require the frontend to attach the token explicitly on every
request, adding client-side code without removing trust in the browser.
A server-side session store would require a second backing service such
as Redis, which the deployment scope does not justify. A signed cookie
fits the project's needs because the cookie is HTTP-native, browsers
attach it automatically on same-origin requests, and the signature
prevents offline tampering. The cookie is signed rather than encrypted,
so a user could in principle inspect the contents, which is acceptable
for a numeric user identifier.

**Cookie attributes.** The cookie is marked `httpOnly`, so client-side
JavaScript cannot read it; a hypothetical XSS payload therefore cannot
exfiltrate the session through `document.cookie`. It is marked
`sameSite=lax`, so the browser does not attach it to cross-site `POST`
requests, which mitigates CSRF on state-changing endpoints. Its lifetime
is seven days, after which the browser drops the cookie and the next
protected request returns 401.

**URL design philosophy.** URLs are RESTful, bookmarkable, and
human-readable. The frontend mirrors the API path structure, so a URL
encodes a position in the data rather than a position in the UI. A
workspace lives at `/api/workspaces/{id}` and at `/app/workspaces/{id}`.
A channel lives at `/api/channels/{id}` and at
`/app/workspaces/{id}/channels/{id}`. A search result page lives at
`/app/search?q={query}`. None of these URLs encodes the user's identity,
so the same URL points at the same conceptual resource for every user,
and the backend decides at request time whether the caller is allowed
to see it. The user's profile page lives at `/app/profile`, deliberately
unparameterised by user identifier; the page reads its content from
`/api/auth/me`, and the backend resolves "me" from the session.

**Deep linking.** The frontend reconstructs page state from the URL on
every load. A user who pastes the URL of a channel into a fresh browser
session lands on the login page, logs in, and is redirected to the same
channel. The redirect target is preserved across the login round-trip
through a `?next=` query parameter on the login form. A user who pastes
a search URL is taken to the search page with the query prefilled and
the results computed.

**Session invalidation.** Two paths invalidate a session. A user who
logs out hits `POST /api/auth/logout`, which clears the server-side
session dictionary and causes Starlette to set an empty signed cookie on
the response, so the browser stops sending the user identifier on
subsequent requests. A user who simply walks away eventually hits the
cookie's seven-day expiry, after which the browser drops the cookie and
the next protected request returns 401, redirecting to the login page.
There is no refresh-token mechanism, so an expired session always sends
the user back through login. A continuous seven-day session covers any
realistic demo scenario, and the cost of re-logging in is one form.

### 3.5 Cross-site scripting

The course specification asks the system to guard against cross-site
scripting in addition to SQL injection. Defence is split between this
backend and the React frontend. The backend's part is described here;
the rendering-layer behaviour is covered in this section as well, since
the rendering boundary is the load-bearing element of the defence.

The backend stores user-submitted text exactly as received. It does not
call `htmlspecialchars`, it does not strip HTML tags, and it does not
normalise whitespace at write time. A message whose content is the
literal string `<script>alert(1)</script>` is stored as those 26
characters in `messages.content`. A username containing an ampersand is
stored with the ampersand as-is.

Escaping at write time would couple the database representation to a
single output format. A future plain-text export, a mobile client, or
a CLI viewer would have to undo HTML escaping before re-escaping for
its own output context. Storing the original input keeps the data
clean and pushes escaping to the rendering boundary, where the output
context is actually known.

The rendering boundary is the React frontend. React's JSX expression
syntax `{value}` always produces a text node, never raw HTML, so an
injected `<script>` tag in a message body becomes the literal four
characters `<`, `s`, `c`, `r` rather than an executable script element.
The codebase does not use `dangerouslySetInnerHTML`, the only React API
that opts out of automatic escaping. Every place a message can appear
in the UI flows through the same `<MessageItem>` component, so a single
audit point covers every rendering path. A payload such as
`<img src=x onerror=alert(1)>` typed into the composer is therefore
rendered as the literal characters of an HTML tag rather than as an
`img` element, so the `onerror` handler is never attached and never
fires.

Two backend choices reinforce the rendering-layer defence. The session
cookie is marked `httpOnly`, so a hypothetical script that did execute
in the page could not exfiltrate the cookie through `document.cookie`.
The cookie is also marked `sameSite=lax`, which prevents the browser
from attaching it to cross-site `POST` requests, blunting CSRF as a
secondary effect. Neither attribute is XSS protection on its own, but
each limits the damage of a hypothetical render-layer mistake.