# Test Results (Part d)

Results from running `test_queries.sql` against the data in `sample_data.sql`.
Timestamps use the form `T − Nd`, where T is the moment `sample_data.sql` was
run (all `posted_time` / `invited_time` values come from `NOW() - INTERVAL 'N days'`).

---

## (c.1) Register a new user

```sql
INSERT INTO users (email, username, nickname, password, created_time, updated_time)
VALUES ('george@acme.com', 'george', 'Georgie', 'pw_george', NOW(), NOW())
RETURNING userID, email, username;
```

| userID | email           | username |
|:------:|:----------------|:---------|
| 7      | george@acme.com | george   |

`userID` is assigned by the identity sequence; it is 7 right after seeding
(users 1–6 are the test users).

---

## (c.2) Create a public channel

**Test A.** carol (userID = 3, member of Acme) creates `#announcements`.

Channel row:

| channelID | workspaceID | channel_name  | typeID | created_by |
|:---------:|:-----------:|:--------------|:------:|:----------:|
| 6         | 1           | announcements | 1      | 3          |

Channel-member row (creator joined automatically):

| channelID | userID | joined_time |
|:---------:|:------:|:-----------:|
| 6         | 3      | T − 0       |

**Test B.** frank (userID = 6, not in Acme) tries to create `#hack`.

| must_be_zero |
|:------------:|
| 0            |

The `WHERE EXISTS` check on workspace membership produces zero rows, so
neither `channels` nor `channelmember` receives an insert.

---

## (c.3) Workspace administrators

| workspaceID | workspace_name | userID | username | nickname |
|:-----------:|:---------------|:------:|:---------|:---------|
| 1           | Acme Corp      | 1      | alice    | Ali      |
| 1           | Acme Corp      | 2      | bob      | Bobby    |
| 2           | Math Club      | 2      | bob      | Bobby    |

---

## (c.4) Pending invitations older than 5 days (public channels in Acme)

| channelID | channel_name | pending_invites_over_5_days |
|:---------:|:-------------|:---------------------------:|
| 1         | general      | 1                           |
| 2         | random       | 1                           |

Why the count is what it is:

| Channel | Invitee | Age  | Status  | Joined? | Counted? |
|:--------|:--------|:----:|:--------|:-------:|:--------:|
| general | dave    | 7 d  | pending | no      | yes      |
| random  | carol   | 10 d | pending | no      | yes      |
| random  | dave    | 3 d  | pending | no      | no, age ≤ 5 d |
| exec    | carol   | 20 d | pending | no      | no, private channel |

---

## (c.5) Messages in `#general`, oldest first (channelID = 1)

| messageID | content                                                      | posted_time | username |
|:---------:|:-------------------------------------------------------------|:-----------:|:---------|
| 1         | Hello team, welcome to Acme general channel!                 | T − 5d      | alice    |
| 2         | Our new logo features perpendicular lines for a modern look. | T − 4d      | bob      |
| 3         | Love the perpendicular motif — very clean.                   | T − 3d      | carol    |

---

## (c.6) All messages posted by alice (userID = 1), newest first

| messageID | workspace_name | channel_name | content                                                 | posted_time |
|:---------:|:---------------|:-------------|:--------------------------------------------------------|:-----------:|
| 5         | Acme Corp      | exec         | Confidential — we need a perpendicular strategy for Q4. | T − 1d      |
| 4         | Acme Corp      | random       | Off-topic: perpendicular is my favorite geometry word.  | T − 2d      |
| 1         | Acme Corp      | general      | Hello team, welcome to Acme general channel!            | T − 5d      |

---

## (c.7) Messages containing "perpendicular" visible to carol (userID = 3)

| messageID | workspace_name | channel_name | posted_by | content                                                      | posted_time |
|:---------:|:---------------|:-------------|:----------|:-------------------------------------------------------------|:-----------:|
| 8         | Math Club      | calculus     | carol     | Recall: the tangent and normal vectors are perpendicular.    | T − 8d      |
| 2         | Acme Corp      | general      | bob       | Our new logo features perpendicular lines for a modern look. | T − 4d      |
| 3         | Acme Corp      | general      | carol     | Love the perpendicular motif — very clean.                   | T − 3d      |

The three messages containing "perpendicular" that do **not** appear:

| Message  | Channel        | Reason for exclusion                      |
|:---------|:---------------|:------------------------------------------|
| M4 alice | #random (W1)   | carol is not in this channel              |
| M5 alice | #exec (W1)     | carol is not in this channel (also private) |
| M6 bob   | #geometry (W2) | carol is not in this channel              |

Sanity check — same query for frank (userID = 6), who has no workspace or
channel memberships:

| frank_accessible_count |
|:----------------------:|
| 0                      |
