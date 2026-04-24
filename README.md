# Snickr — Database Design (CS6083 Project, Part 1)

Snickr is a Slack-like web collaboration system. Users register, create workspaces, create channels inside those workspaces, and exchange messages. This repository contains the schema design, SQL, and test data for Part 1 of the course project. The database is hosted on Supabase (PostgreSQL).

## Repository contents

| Path | Description |
|---|---|
| `ER-Diagram.drawio.svg` | ER diagram (draw.io) |
| `README.md` | Schema documentation: tables, columns, constraints, FKs, indexes |
| `snickr_schema_documentation.md` | Chinese version of the schema documentation |
| `sql/schema.sql` | `CREATE TABLE` / index statements |
| `sql/queries.sql` | Answers to part (c), parameterised with `:name` placeholders |
| `sql/sample_data.sql` | Test data for part (d): 6 users, 2 workspaces, 5 channels, 4 invitations, 9 messages |
| `sql/test_queries.sql` | Part (c) queries with concrete values substituted in |
| `sql/test_data_diagram.md` | Diagram of the test dataset and design notes |
| `sql/test_results.md` | Results of every test query as Markdown tables |

To reproduce: run `sql/schema.sql`, then `sql/sample_data.sql`, then `sql/test_queries.sql` on any PostgreSQL instance.

---

## ER Diagram

![Snickr ER Diagram](ER-Diagram.drawio.svg)

The diagram was created with [draw.io](https://app.diagrams.net) and captures all 12 tables along with their relationships and cardinalities.

---

## Relational Schema

The database is divided into four functional modules: **User Management**, **Workspace Management**, **Channel Management**, and **Message Management**.

### Module 1 — User Management

#### `users`

Core entity referenced by almost every other table.

| Column | Type | Notes |
|---|---|---|
| `userID` | INTEGER PK (auto-increment) | System-generated unique identifier |
| `email` | VARCHAR(50) | Globally unique, required |
| `username` | VARCHAR(30) | Globally unique, required |
| `nickname` | VARCHAR(30) | Optional display name |
| `password` | VARCHAR(30) | |
| `created_time` | TIMESTAMP | Defaults to current time |
| `updated_time` | TIMESTAMP | Defaults to current time |

Referenced by: `workspaces`, `workspacemember`, `workspaceinvitation`, `channels`, `channelmember`, `channelinvitation`, `messages`

---

### Module 2 — Workspace Management

#### `workspaces`

Top-level organizational unit, analogous to a Slack "team".

| Column | Type | Notes |
|---|---|---|
| `workspaceID` | INTEGER PK (auto-increment) | |
| `name` | VARCHAR(30) | Required |
| `description` | VARCHAR(200) | Optional |
| `created_time` | TIMESTAMP | |
| `updated_time` | TIMESTAMP | |
| `created_by` | INTEGER FK → `users.userID` | Creator becomes admin automatically; SET NULL on user delete |

#### `roles`

Lookup table for workspace member roles (e.g., `admin`, `member`).

| Column | Type | Notes |
|---|---|---|
| `roleID` | INTEGER PK (auto-increment) | |
| `name` | VARCHAR(20) | Globally unique |

#### `workspacemember`

Many-to-many join between `users` and `workspaces`.

| Column | Type | Notes |
|---|---|---|
| `workspaceID` | INTEGER FK → `workspaces.workspaceID` | Part of composite PK; CASCADE on workspace delete |
| `userID` | INTEGER FK → `users.userID` | Part of composite PK; CASCADE on user delete |
| `role` | INTEGER FK → `roles.roleID` | Required |
| `joined_time` | TIMESTAMP | |

**PK:** `(workspaceID, userID)` — one record per user per workspace  
**Index:** `idx_workspace_member_user (userID)` — accelerates "find all workspaces for a user"

#### `status`

Shared lookup table for invitation states (`pending`, `accepted`, `declined`), used by both workspace and channel invitations.

| Column | Type | Notes |
|---|---|---|
| `statusID` | INTEGER PK (auto-increment) | |
| `type` | VARCHAR(30) | Globally unique |

#### `workspaceinvitation`

Tracks admin-to-user invitations for workspaces.

| Column | Type | Notes |
|---|---|---|
| `invitationID` | INTEGER PK (auto-increment) | |
| `workspaceID` | INTEGER FK → `workspaces.workspaceID` | CASCADE on workspace delete |
| `invitee` | INTEGER FK → `users.userID` | CASCADE on user delete |
| `inviter` | INTEGER FK → `users.userID` | Should be a workspace admin |
| `invited_time` | TIMESTAMP | |
| `status_type` | INTEGER FK → `status.statusID` | |

**Unique constraint:** `(workspaceID, invitee)` — one active invitation per user per workspace

---

### Module 3 — Channel Management

#### `channeltype`

Lookup table for channel access modes (`public`, `private`, `direct`).

| Column | Type | Notes |
|---|---|---|
| `typeID` | INTEGER PK (auto-increment) | |
| `name` | VARCHAR(30) | Globally unique |

#### `channels`

Containers for messages; belong to a workspace.

| Column | Type | Notes |
|---|---|---|
| `channelID` | INTEGER PK (auto-increment) | |
| `workspaceID` | INTEGER FK → `workspaces.workspaceID` | CASCADE on workspace delete |
| `channel_name` | VARCHAR(50) | Unique within workspace |
| `typeID` | INTEGER FK → `channeltype.typeID` | |
| `created_by` | INTEGER FK → `users.userID` | |
| `created_time` | TIMESTAMP | |
| `updated_time` | TIMESTAMP | |

**Unique constraint:** `(workspaceID, channel_name)`

#### `channelmember`

Many-to-many join between `users` and `channels`. Membership gates read/write access.

| Column | Type | Notes |
|---|---|---|
| `channelID` | INTEGER FK → `channels.channelID` | Part of composite PK; CASCADE on channel delete |
| `userID` | INTEGER FK → `users.userID` | Part of composite PK; CASCADE on user delete |
| `joined_time` | TIMESTAMP | |

**PK:** `(channelID, userID)`  
**Index:** `idx_channel_member_user (userID)`

#### `channelinvitation`

Tracks creator-to-member invitations for private channels. Public channels can be joined directly; private channels require this flow.

| Column | Type | Notes |
|---|---|---|
| `invitationID` | INTEGER PK (auto-increment) | |
| `channelID` | INTEGER FK → `channels.channelID` | CASCADE on channel delete |
| `invitee` | INTEGER FK → `users.userID` | CASCADE on user delete |
| `inviter` | INTEGER FK → `users.userID` | Should be the channel creator |
| `invited_time` | TIMESTAMP | |
| `status_type` | INTEGER FK → `status.statusID` | |

**Unique constraint:** `(channelID, invitee)`

---

### Module 4 — Message Management

#### `messages`

Core business data table. Supports full-text search via `LIKE` / `CONTAINS`.

| Column | Type | Notes |
|---|---|---|
| `messageID` | INTEGER PK (auto-increment) | |
| `channelID` | INTEGER FK → `channels.channelID` | CASCADE on channel delete |
| `content` | VARCHAR(500) | Required |
| `posted_time` | TIMESTAMP | Defaults to current time |
| `posted_by` | INTEGER FK → `users.userID` | |

**Index:** `idx_messages_channel (channelID)` — the most-used query path: fetch all messages in a channel

---

## Table Hierarchy

```
users
 ├── workspaces (created_by)
 │    ├── workspacemember    (userID, workspaceID, role → roles)
 │    ├── workspaceinvitation (invitee, inviter, status_type → status)
 │    └── channels           (created_by, workspaceID, typeID → channeltype)
 │         ├── channelmember      (userID, channelID)
 │         ├── channelinvitation  (invitee, inviter, status_type → status)
 │         └── messages           (posted_by, channelID)
```

## Foreign Key Summary

| Relationship | Delete Policy |
|---|---|
| `workspaces.created_by` → `users` | SET NULL |
| `workspacemember` → `users` / `workspaces` | CASCADE |
| `workspacemember.role` → `roles` | — |
| `workspaceinvitation.invitee` → `users` | CASCADE |
| `workspaceinvitation` → `workspaces` | CASCADE |
| `workspaceinvitation.status_type` → `status` | — |
| `channels` → `workspaces` | CASCADE |
| `channels.typeID` → `channeltype` | — |
| `channelmember` → `channels` / `users` | CASCADE |
| `channelinvitation` → `channels` | CASCADE |
| `channelinvitation.invitee` → `users` | CASCADE |
| `channelinvitation.status_type` → `status` | — |
| `messages` → `channels` | CASCADE |

## Shared Lookup Tables

| Table | Used By | Purpose |
|---|---|---|
| `roles` | `workspacemember.role` | Workspace role enum (admin / member) |
| `status` | `workspaceinvitation.status_type`, `channelinvitation.status_type` | Invitation state enum (pending / accepted / declined) |
| `channeltype` | `channels.typeID` | Channel access mode enum (public / private / direct) |

---

## Index Design

| Index | Table | Column | Purpose |
|---|---|---|---|
| `idx_messages_channel` | `messages` | `channelID` | Timeline queries per channel |
| `idx_workspace_member_user` | `workspacemember` | `userID` | Find all workspaces for a user |
| `idx_channel_member_user` | `channelmember` | `userID` | Find all channels for a user |

---

## Design Notes

- **Cascade deletes** propagate automatically: deleting a workspace removes all its channels, members, and invitations; deleting a channel removes its messages and members.
- **Lookup tables** (`roles`, `status`, `channeltype`) avoid hard-coded strings in business tables and make it easy to add new values without schema changes.
- **Composite unique constraints** prevent duplicate invitations (`workspaceID, invitee`) and duplicate channel names within a workspace (`workspaceID, channel_name`).
