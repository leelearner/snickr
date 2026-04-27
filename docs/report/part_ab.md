# Snickr — Project Report, Parts (a) and (b)

## (a) Database Schema Design

### System Overview

Snickr is a web-based team collaboration system modelled closely on Slack.
Users register with an email address, choose a username and password, and
then participate in one or more _workspaces_. Within each workspace, members
communicate through _channels_, each of which holds a chronologically ordered
sequence of _messages_. Access control is layered: workspace membership is
required before a user can see or join any channel inside that workspace, and
channel membership is required before a user can read or post messages.

The schema is designed around four functional modules:

| Module | Core tables |
|--------|-------------|
| User management | `users` |
| Workspace management | `workspaces`, `roles`, `workspacemember`, `workspaceinvitation` |
| Channel management | `channeltype`, `channels`, `channelmember`, `channelinvitation` |
| Message management | `messages` |

Three small lookup tables (`roles`, `status`, `channeltype`) replace
hard-coded string literals in the business tables, keeping the schema
open to adding new values without a structural change.

---

### ER Diagram

The full entity–relationship diagram is stored in the repository at
`docs/ER-Diagram.drawio.svg`. The diagram was drawn with draw.io and covers
all eleven tables, their attributes, and the cardinalities of every
relationship.

The four primary entities are:

- **User** — identified by `userID`; holds authentication and profile data.
- **Workspace** — identified by `workspaceID`; the top-level grouping unit.
- **Channel** — identified by `channelID`; belongs to exactly one workspace.
- **Message** — identified by `messageID`; belongs to exactly one channel.

The major relationships and their cardinalities are:

| Relationship | Cardinality | Realised by |
|---|---|---|
| User _creates_ Workspace | 1 : N | `workspaces.created_by` |
| User _belongs to_ Workspace | M : N | `workspacemember` |
| Workspace _invites_ User | M : N | `workspaceinvitation` |
| Workspace _contains_ Channel | 1 : N | `channels.workspaceID` |
| User _creates_ Channel | 1 : N | `channels.created_by` |
| User _belongs to_ Channel | M : N | `channelmember` |
| Channel _invites_ User | M : N | `channelinvitation` |
| User _posts_ Message | 1 : N | `messages.posted_by` |
| Channel _contains_ Message | 1 : N | `messages.channelID` |

---

### Relational Schema

The translation from the ER diagram yields the following eleven relations.
Primary keys are **bold**; foreign keys are noted inline.

#### `users`

| Column | Type | Constraints |
|---|---|---|
| **`userID`** | INTEGER | PK, identity |
| `email` | VARCHAR(50) | UNIQUE, NOT NULL |
| `username` | VARCHAR(30) | UNIQUE, NOT NULL |
| `nickname` | VARCHAR(30) | — |
| `password` | VARCHAR(30) | — |
| `created_time` | TIMESTAMP | NOT NULL, default NOW() |
| `updated_time` | TIMESTAMP | NOT NULL, default NOW() |

#### `workspaces`

| Column | Type | Constraints |
|---|---|---|
| **`workspaceID`** | INTEGER | PK, identity |
| `name` | VARCHAR(30) | NOT NULL |
| `description` | VARCHAR(200) | — |
| `created_time` | TIMESTAMP | NOT NULL, default NOW() |
| `updated_time` | TIMESTAMP | NOT NULL, default NOW() |
| `created_by` | INTEGER | FK → `users.userID` ON DELETE SET NULL |

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

The composite primary key `(workspaceID, userID)` enforces that a user can
appear at most once in any given workspace. Index `idx_workspace_member_user`
on `userID` accelerates the common lookup "which workspaces does this user
belong to?"

#### `status`

| Column | Type | Constraints |
|---|---|---|
| **`statusID`** | INTEGER | PK, identity |
| `type` | VARCHAR(30) | UNIQUE, NOT NULL |

Seeded values: `'pending'`, `'accepted'`, `'declined'`. Shared by both
`workspaceinvitation` and `channelinvitation` so that the invitation
lifecycle is defined in one place.

#### `workspaceinvitation`

| Column | Type | Constraints |
|---|---|---|
| **`invitationID`** | INTEGER | PK, identity |
| `workspaceID` | INTEGER | NOT NULL, FK → `workspaces.workspaceID` ON DELETE CASCADE |
| `invitee` | INTEGER | NOT NULL, FK → `users.userID` ON DELETE CASCADE |
| `inviter` | INTEGER | NOT NULL, FK → `users.userID` |
| `invited_time` | TIMESTAMP | NOT NULL, default NOW() |
| `status_type` | INTEGER | NOT NULL, FK → `status.statusID` |

Unique constraint on `(workspaceID, invitee)` prevents duplicate invitations
for the same user to the same workspace.

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
names are unique within a workspace (matching Slack's behaviour) but the same
name may appear in different workspaces.

#### `channelmember`

| Column | Type | Constraints |
|---|---|---|
| **`channelID`** | INTEGER | PK (composite), FK → `channels.channelID` ON DELETE CASCADE |
| **`userID`** | INTEGER | PK (composite), FK → `users.userID` ON DELETE CASCADE |
| `joined_time` | TIMESTAMP | NOT NULL, default NOW() |

Composite PK `(channelID, userID)` prevents duplicate memberships. Index
`idx_channel_member_user` on `userID` accelerates "which channels does this
user belong to?"

#### `channelinvitation`

| Column | Type | Constraints |
|---|---|---|
| **`invitationID`** | INTEGER | PK, identity |
| `channelID` | INTEGER | NOT NULL, FK → `channels.channelID` ON DELETE CASCADE |
| `invitee` | INTEGER | NOT NULL, FK → `users.userID` ON DELETE CASCADE |
| `inviter` | INTEGER | NOT NULL, FK → `users.userID` |
| `invited_time` | TIMESTAMP | NOT NULL, default NOW() |
| `status_type` | INTEGER | NOT NULL, FK → `status.statusID` |

Unique constraint on `(channelID, invitee)` mirrors the workspace invitation
constraint.

#### `messages`

| Column | Type | Constraints |
|---|---|---|
| **`messageID`** | INTEGER | PK, identity |
| `channelID` | INTEGER | NOT NULL, FK → `channels.channelID` ON DELETE CASCADE |
| `content` | VARCHAR(500) | NOT NULL |
| `posted_time` | TIMESTAMP | NOT NULL, default NOW() |
| `posted_by` | INTEGER | NOT NULL, FK → `users.userID` |

Index `idx_messages_channel` on `channelID` directly accelerates the
most frequent query: fetching all messages for a given channel in order.

---

### Design Assumptions and Justifications

**Workspace creator becomes admin automatically.**  
The `created_by` column records who founded the workspace. The application
inserts a row into `workspacemember` at creation time with
`role = 'admin'`. The `created_by` reference is kept as a historical audit
field and is set to NULL if the creator is later deleted, rather than
cascading the delete to the whole workspace.

**Role granularity is workspace-level only.**  
Channels do not have their own role system. Any workspace member can create a
channel; channel access is instead controlled through the `channeltype` and
the invitation flow. This keeps the permission model simple and avoids a
combinatorial explosion of role assignments.

**`status` is shared by both invitation tables.**  
Workspace and channel invitations share the same lifecycle (`pending →
accepted / declined`). Rather than duplicating the enum in two tables or in
application code, a single `status` lookup table is referenced by both. This
is a deliberate normalisation choice: if a new state (e.g., `expired`) is
ever needed, it is added in one place.

**Channel name uniqueness is scoped to the workspace.**  
The unique constraint is `(workspaceID, channel_name)`, not globally on
`channel_name`. This matches Slack's behaviour and is the natural expectation
for users: `#general` in one company's workspace is unrelated to `#general`
in another's.

**Timestamps on every mutable entity.**  
`created_time` and `updated_time` are stored on users, workspaces, and
channels. `posted_time` is stored on messages. `joined_time` is stored on
membership rows. `invited_time` is stored on invitation rows. This makes it
possible to answer queries like "invite older than 5 days" (part c.4) purely
from stored data, and provides an audit trail for the application layer.

**No threading, no message deletion, no payment tiers.**  
Per the project specification, threading within a channel is not required.
Messages are append-only in this schema; there is no `deleted_at` column.
Payment and tier information are also out of scope.

**Access control is enforced at the application layer, not via DBMS roles.**  
The schema does not use PostgreSQL row-level security, views, or per-user
database accounts. The single application user has full read/write access to
all tables. Visibility rules (e.g., "a user cannot see messages in a private
channel unless they are a member") are implemented in the application queries
by joining `channelmember` and `workspacemember` against the authenticated
user, as shown in query (c.7).

---

## (b) Schema Implementation

The schema is implemented in plain PostgreSQL (hosted on Supabase). The full
DDL is in `database/schema/schema.sql`. This section describes the
constraint strategy and index design.

### Identity Columns

Every synthetic primary key uses `INTEGER GENERATED ALWAYS AS IDENTITY`,
which is the SQL-standard equivalent of `SERIAL`. The database exclusively
controls these values; the application cannot supply its own. New IDs are
retrieved with `RETURNING` on insert, avoiding a second round-trip.

### Constraints

**Primary keys.**  
Single-column PKs are defined on the identity column of every main table.
Composite PKs are defined on the join tables `workspacemember`
`(workspaceID, userID)` and `channelmember` `(channelID, userID)`.

**Foreign keys and delete behaviour.**  
The delete policy reflects the natural ownership hierarchy:

| Relationship | Policy | Rationale |
|---|---|---|
| `workspaces.created_by` → `users` | SET NULL | Workspace survives creator deletion |
| `workspacemember` → `users`, `workspaces` | CASCADE | No orphan memberships |
| `workspaceinvitation` → `users (invitee)`, `workspaces` | CASCADE | Invitations are meaningless without the target user or workspace |
| `workspaceinvitation.inviter` → `users` | no action | Historical record; inviter may be deleted later |
| `channels` → `workspaces` | CASCADE | Channel cannot exist without its workspace |
| `channelmember` → `users`, `channels` | CASCADE | No orphan memberships |
| `channelinvitation` → `users (invitee)`, `channels` | CASCADE | Same rationale as workspace invitations |
| `messages` → `channels` | CASCADE | Messages belong entirely to their channel |
| `messages.posted_by` → `users` | no action | Message content is preserved even if poster is deleted |

**Unique constraints.**  
`users.email` and `users.username` are globally unique; a second registration
with the same email or handle is rejected at the database level.
`(workspaceID, invitee)` on `workspaceinvitation` and `(channelID, invitee)`
on `channelinvitation` prevent sending duplicate invitations. `(workspaceID,
channel_name)` on `channels` enforces channel name uniqueness within a
workspace.

**NOT NULL.**  
Every column that the system requires for correct operation is marked NOT
NULL. Optional profile fields (`nickname`, `description`) are left nullable
intentionally.

**Defaults.**  
All timestamp columns default to `CURRENT_TIMESTAMP`. This means the
application only needs to supply values when it wants to override the
recording time, which is never the case in normal operation.

### Index Design

Three additional indexes are created beyond the implicit PK indexes:

| Index | Table | Column | Purpose |
|---|---|---|---|
| `idx_messages_channel` | `messages` | `channelID` | Fetch all messages for a channel — the most frequent query |
| `idx_workspace_member_user` | `workspacemember` | `userID` | Find all workspaces a given user belongs to |
| `idx_channel_member_user` | `channelmember` | `userID` | Find all channels a given user belongs to |

All three indexes support access patterns that appear in every part of the
application (timeline display, navigation sidebar, access-control joins).
The composite PK indexes on the join tables cover the reverse lookups (members
of a workspace, members of a channel) without needing separate indexes.

### Reproducing the Schema

```
psql -f database/schema/schema.sql
```

The script is idempotent with respect to re-creation only if run on an empty
database; it does not include `DROP TABLE IF EXISTS` guards. After the schema
is in place, seed the lookup tables and run the sample data:

```
psql -f database/seeds/sample_data.sql
```
