# Snickr — Project Report, Parts (c) and (d)

This section covers the seven SQL queries required by part (c) and the
sample data and test runs that verify them in part (d). All queries target
the schema described in the previous sections of the report. The database
is hosted on Supabase, which provides a stock PostgreSQL instance, so every
SQL statement here is plain Postgres (no Supabase-specific features).

A short note on placeholders: where a query needs runtime input (such as a
specific user or workspace), the query in `sql/queries.sql` uses
`:placeholder` syntax. The runnable test versions in `sql/test_queries.sql`
substitute concrete IDs from the sample data.

---

## (c) The seven queries

### (c.1) Register a new user

Requirement: insert a new user given an email, username, nickname, and
password.

```sql
INSERT INTO users (email, username, nickname, password,
                   created_time, updated_time)
VALUES (:email, :username, :nickname, :password, NOW(), NOW())
RETURNING userID;
```

The `userID` column is `GENERATED ALWAYS AS IDENTITY`, so the new ID is
assigned by the database. Returning it lets the application know which row
was just created without an extra round trip. Both timestamps are set to
`NOW()` so that the audit fields match the moment of registration.

### (c.2) Create a public channel inside a workspace

Requirement: a particular user creates a new public channel inside a
workspace, but only if that user is currently a member of the workspace.

```sql
BEGIN;

WITH new_channel AS (
    INSERT INTO channels (workspaceID, channel_name, typeID, created_by,
                          created_time, updated_time)
    SELECT :workspace_id,
           :channel_name,
           (SELECT typeID FROM channeltype WHERE name = 'public'),
           :user_id,
           NOW(), NOW()
    WHERE EXISTS (
        SELECT 1 FROM workspacemember
        WHERE workspaceID = :workspace_id AND userID = :user_id
    )
    RETURNING channelID
)
INSERT INTO channelmember (channelID, userID, joined_time)
SELECT channelID, :user_id, NOW() FROM new_channel;

COMMIT;
```

The authorisation check is the `WHERE EXISTS` inside the `INSERT … SELECT`.
If the requesting user is not in the target workspace, the subquery
returns no row and the channel is never inserted. Because the second
`INSERT` reads from the same CTE, it also inserts nothing. The two
statements are wrapped in a transaction so the channel and its initial
membership row commit together.

The `typeID` for `'public'` is looked up by name rather than hard-coded so
that the query is independent of the actual identity values in
`channeltype`.

### (c.3) List all administrators of every workspace

Requirement: for each workspace, list its current administrators.

```sql
SELECT  w.workspaceID, w.name AS workspace_name,
        u.userID, u.username, u.nickname
FROM    workspaces      w
JOIN    workspacemember wm ON wm.workspaceID = w.workspaceID
JOIN    roles           r  ON r.roleID       = wm.role
JOIN    users           u  ON u.userID       = wm.userID
WHERE   r.name = 'admin'
ORDER BY w.workspaceID, u.username;
```

The role is stored as a foreign key into the `roles` lookup table, so the
filter joins through `roles` and matches by name. Sorting by
`workspaceID` first keeps administrators of the same workspace grouped
together in the output.

### (c.4) Pending invitations older than five days

Requirement: for each public channel in a given workspace, count the
number of users who were invited more than five days ago and have still
not joined.

```sql
SELECT  c.channelID, c.channel_name,
        COUNT(ci.invitationID) AS pending_invites_over_5_days
FROM    channels    c
JOIN    channeltype ct ON ct.typeID = c.typeID
LEFT JOIN channelinvitation ci
       ON ci.channelID    = c.channelID
      AND ci.invited_time < NOW() - INTERVAL '5 days'
      AND ci.status_type  = (SELECT statusID FROM status WHERE type = 'pending')
      AND NOT EXISTS (
            SELECT 1 FROM channelmember cm
            WHERE cm.channelID = ci.channelID AND cm.userID = ci.invitee
      )
WHERE   c.workspaceID = :workspace_id
  AND   ct.name       = 'public'
GROUP BY c.channelID, c.channel_name
ORDER BY c.channel_name;
```

Two design choices are worth noting:

* The age filter, the status filter, and the "has not yet joined" check
  are all on the `LEFT JOIN`'s `ON` clause, not on the `WHERE` clause.
  Keeping them on the join ensures a public channel with zero qualifying
  invitations still appears in the result with a count of zero, instead
  of being dropped from the output entirely.
* The "has not yet joined" check is expressed with `NOT EXISTS` against
  `channelmember` rather than purely by status. An invitation whose
  status is still `pending` while the user has, in some other path,
  ended up in the channel will not be counted. This matches the
  natural-language requirement more faithfully than relying on the
  status column alone.

### (c.5) All messages in a particular channel

Requirement: list all messages of a given channel in chronological order.

```sql
SELECT  m.messageID, m.content, m.posted_time,
        u.userID, u.username, u.nickname
FROM    messages m
JOIN    users    u ON u.userID = m.posted_by
WHERE   m.channelID = :channel_id
ORDER BY m.posted_time ASC, m.messageID ASC;
```

The secondary sort on `messageID` is a tiebreaker for the (unlikely but
possible) case where two messages share a timestamp; without it the
display order would be non-deterministic. The `messages` table has an
index on `channelID` (`idx_messages_channel`), which is the access path
this query uses.

### (c.6) All messages posted by a particular user

Requirement: list all messages posted by a particular user across any
channel.

```sql
SELECT  m.messageID,
        w.workspaceID, w.name AS workspace_name,
        c.channelID,   c.channel_name,
        m.content, m.posted_time
FROM    messages   m
JOIN    channels   c ON c.channelID   = m.channelID
JOIN    workspaces w ON w.workspaceID = c.workspaceID
WHERE   m.posted_by = :user_id
ORDER BY m.posted_time DESC, m.messageID DESC;
```

The result includes the workspace and channel name so that the same
message stream is readable without further lookups. Newest first matches
how a typical activity feed is presented.

### (c.7) Keyword search restricted to accessible messages

Requirement: for a particular user, list every message that contains the
keyword "perpendicular" in its body, restricted to messages that the user
is allowed to see (the user must be a member of both the workspace and
the specific channel where the message was posted).

```sql
SELECT  m.messageID,
        w.workspaceID, w.name AS workspace_name,
        c.channelID,   c.channel_name,
        poster.username AS posted_by,
        m.content, m.posted_time
FROM    messages        m
JOIN    channels        c  ON c.channelID    = m.channelID
JOIN    workspaces      w  ON w.workspaceID  = c.workspaceID
JOIN    channelmember   cm ON cm.channelID   = c.channelID   AND cm.userID = :user_id
JOIN    workspacemember wm ON wm.workspaceID = w.workspaceID AND wm.userID = :user_id
JOIN    users           poster ON poster.userID = m.posted_by
WHERE   m.content ILIKE '%perpendicular%'
ORDER BY m.posted_time ASC, m.messageID ASC;
```

Access control is expressed as two `JOIN`s: one against `channelmember`
filtered to the requesting user, and one against `workspacemember`
filtered to the same user. A message survives the joins only when the
user is a member of both the channel and its enclosing workspace. The
workspace check is technically implied by the channel check today (a
user cannot be in a channel without being in the workspace it belongs
to), but stating both makes the access rule explicit in the query and
keeps the query correct if that invariant is ever weakened.

`ILIKE` is used so the search is case-insensitive; `LIKE` would also be
acceptable but would miss `Perpendicular` at the start of a sentence.

---

## (d) Sample data and tests

### Description of the test dataset

The test dataset is small enough to reason about row by row, while still
covering the positive and negative branches of every query in part (c).
It contains 6 users, 2 workspaces, 5 channels, 4 channel invitations,
and 9 messages.

```
                       ┌──────────────────────────────────────────────────┐
                       │                      USERS                       │
                       │   u1 alice     u2 bob      u3 carol              │
                       │   u4 dave      u5 eve      u6 frank  (no ws)     │
                       └──────────────────────────────────────────────────┘
                                        │ membership
         ┌──────────────────────────────┴──────────────────────────────┐
         ▼                                                             ▼
┌────────────────────────────┐                           ┌───────────────────────────┐
│  W1 "Acme Corp"            │                           │  W2 "Math Club"           │
│  created_by alice          │                           │  created_by bob           │
│                            │                           │                           │
│  admins : alice, bob       │                           │  admins : bob             │
│  members: carol, dave      │                           │  members: carol, eve      │
│                            │                           │                           │
│  ┌──────────────────────┐  │                           │  ┌─────────────────────┐  │
│  │ C1 #general (public) │  │                           │  │ C4 #geometry (pub)  │  │
│  │   alice, bob, carol  │  │                           │  │   bob, eve          │  │
│  └──────────────────────┘  │                           │  └─────────────────────┘  │
│  ┌──────────────────────┐  │                           │  ┌─────────────────────┐  │
│  │ C2 #random  (public) │  │                           │  │ C5 #calculus (pub)  │  │
│  │   alice, bob         │  │                           │  │   bob, carol, eve   │  │
│  └──────────────────────┘  │                           │  └─────────────────────┘  │
│  ┌──────────────────────┐  │                           └───────────────────────────┘
│  │ C3 #exec  (private)  │  │
│  │   alice, bob         │  │
│  └──────────────────────┘  │
└────────────────────────────┘
```

Two users are deliberately given unusual memberships:

* **frank** (u6) is registered but not added to any workspace. He is the
  empty-result case for any query that depends on workspace or channel
  membership.
* **carol** (u3) belongs to both workspaces but is only in a subset of
  the channels in each. She lets us see (c.7) include some of her
  messages and exclude others within the same query run.

Channel invitations are placed in W1 only, since (c.4) takes a single
workspace as input. Each invitation is positioned to fall on a different
side of the filter:

| Channel        | Invitee | Age (days) | Status  | Joined? | Counted by (c.4)? |
|----------------|---------|------------|---------|---------|-------------------|
| C1 #general    | dave    | 7          | pending | no      | yes               |
| C2 #random     | carol   | 10         | pending | no      | yes               |
| C2 #random     | dave    | 3          | pending | no      | no, age ≤ 5 days  |
| C3 #exec (priv)| carol   | 20         | pending | no      | no, private       |

Of the nine messages, six contain the keyword "perpendicular". They are
spread across three workspaces' worth of access boundaries so that
(c.7) for different users returns visibly different result sets.

| #  | Channel      | Poster | Age (days) | Contains "perpendicular"? |
|----|--------------|--------|------------|---------------------------|
| 1  | C1 #general  | alice  | 5          | no                        |
| 2  | C1 #general  | bob    | 4          | yes                       |
| 3  | C1 #general  | carol  | 3          | yes                       |
| 4  | C2 #random   | alice  | 2          | yes                       |
| 5  | C3 #exec     | alice  | 1          | yes                       |
| 6  | C4 #geometry | bob    | 10         | yes                       |
| 7  | C4 #geometry | eve    | 9          | no                        |
| 8  | C5 #calculus | carol  | 8          | yes                       |
| 9  | C5 #calculus | bob    | 7          | no                        |

The full INSERT script is `sql/sample_data.sql` and is idempotent — it
truncates the business tables and reseeds them on every run, so the
identity sequences always restart from 1 and the test runs that follow
remain deterministic.

### Test results

The runnable tests live in `sql/test_queries.sql`. Each query below is
the same one from part (c) with a concrete value substituted for its
placeholder. Timestamps in the tables use the form `T − Nd`, where `T`
is the moment `sample_data.sql` was executed.

#### (c.1) — register `george`

The insert returns one row. The `userID` is 7 because the seed already
fills 1–6.

| userID | email           | username |
|:------:|:----------------|:---------|
| 7      | george@acme.com | george   |

`george` is then deleted to keep the dataset stable for the queries that
follow.

#### (c.2) — create a channel, with and without authorisation

**Test A.** carol (u3, a member of Acme) creates `#announcements` in W1.

The new channel and its initial membership row are both written:

| channelID | workspaceID | channel_name  | typeID | created_by |
|:---------:|:-----------:|:--------------|:------:|:----------:|
| 6         | 1           | announcements | 1      | 3          |

| channelID | userID | joined_time |
|:---------:|:------:|:-----------:|
| 6         | 3      | T − 0       |

**Test B.** frank (u6, not a member of Acme) tries to create `#hack` in
the same workspace. The membership check in the `WHERE EXISTS` clause
fails, so no row is written.

| must_be_zero |
|:------------:|
| 0            |

Together, the two tests show that the same query both performs the work
and silently rejects unauthorised attempts — there is no need for a
separate permission check at the application layer.

#### (c.3) — administrators per workspace

| workspaceID | workspace_name | userID | username | nickname |
|:-----------:|:---------------|:------:|:---------|:---------|
| 1           | Acme Corp      | 1      | alice    | Ali      |
| 1           | Acme Corp      | 2      | bob      | Bobby    |
| 2           | Math Club      | 2      | bob      | Bobby    |

Acme Corp returns two administrators (alice and bob); Math Club returns
one (bob). bob appears twice because he is an administrator of both
workspaces.

#### (c.4) — old pending invitations in Acme

| channelID | channel_name | pending_invites_over_5_days |
|:---------:|:-------------|:---------------------------:|
| 1         | general      | 1                           |
| 2         | random       | 1                           |

The private channel `#exec` does not appear because the outer `WHERE`
filters to public channels. The recent invitation to dave on `#random`
(3 days old) is excluded by the age filter on the join, and the
20-day-old invitation on `#exec` is excluded twice over (private channel
and not in the result set anyway).

#### (c.5) — messages in `#general`

| messageID | content                                                      | posted_time | username |
|:---------:|:-------------------------------------------------------------|:-----------:|:---------|
| 1         | Hello team, welcome to Acme general channel!                 | T − 5d      | alice    |
| 2         | Our new logo features perpendicular lines for a modern look. | T − 4d      | bob      |
| 3         | Love the perpendicular motif — very clean.                   | T − 3d      | carol    |

Three messages, oldest first, as expected.

#### (c.6) — messages posted by alice

| messageID | workspace | channel  | content                                                 | posted_time |
|:---------:|:----------|:---------|:--------------------------------------------------------|:-----------:|
| 5         | Acme Corp | exec     | Confidential — we need a perpendicular strategy for Q4. | T − 1d      |
| 4         | Acme Corp | random   | Off-topic: perpendicular is my favorite geometry word.  | T − 2d      |
| 1         | Acme Corp | general  | Hello team, welcome to Acme general channel!            | T − 5d      |

Alice's three posts come back newest first. They span both a public
channel (`general`, `random`) and a private one (`exec`); the query
does not apply any visibility filter because (c.6) is about the user's
own posts, which the user can always see.

#### (c.7) — keyword search visible to carol

| messageID | workspace | channel  | posted_by | content                                                      | posted_time |
|:---------:|:----------|:---------|:----------|:-------------------------------------------------------------|:-----------:|
| 8         | Math Club | calculus | carol     | Recall: the tangent and normal vectors are perpendicular.    | T − 8d      |
| 2         | Acme Corp | general  | bob       | Our new logo features perpendicular lines for a modern look. | T − 4d      |
| 3         | Acme Corp | general  | carol     | Love the perpendicular motif — very clean.                   | T − 3d      |

Three of the six "perpendicular" messages survive the access filter for
carol. The other three are correctly excluded:

| Message  | Channel        | Why carol cannot see it                  |
|:---------|:---------------|:-----------------------------------------|
| M4 alice | #random (W1)   | not a member of #random                  |
| M5 alice | #exec (W1)     | not a member of #exec (private channel)  |
| M6 bob   | #geometry (W2) | not a member of #geometry                |

As a sanity check the same query is run for frank (u6), who has no
workspace or channel memberships:

| frank_accessible_count |
|:----------------------:|
| 0                      |

Frank cannot reach any channel, and the result is empty as required.

### Summary

All seven queries return the expected rows on the sample data. The
positive cases (admins listed, messages returned, accessible content
matched) and the negative cases (unauthorised inserts, recent
invitations, private channels, users with no memberships) all hold. The
data intentionally keeps the boundaries of every filter populated, so a
later regression — for instance, accidentally treating a private
channel as public, or losing the age filter in (c.4) — would change the
returned counts and be caught by re-running these tests.
