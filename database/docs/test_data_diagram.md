# Test Data (Part d)

The dataset has 6 users, 2 workspaces, 5 channels, 4 channel invitations,
and 9 messages. It is small enough to keep in your head, but it is picked
so each query in part (c) has both a row it should return and a row it
should leave out.

---

## Overall layout

```
                       ┌──────────────────────────────────────────────────┐
                       │                      USERS                       │
                       │                                                  │
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

## Channel invitations

All four invitations belong to W1 (Acme), which is the workspace passed to
query c.4.

| Channel         | Invitee | Age     | Status  | Joined? | Counted by c.4? |
|-----------------|---------|---------|---------|---------|-----------------|
| C1 #general     | dave    | 7 days  | pending | no      | yes             |
| C2 #random      | carol   | 10 days | pending | no      | yes             |
| C2 #random      | dave    | 3 days  | pending | no      | no, age ≤ 5 d   |
| C3 #exec (priv) | carol   | 20 days | pending | no      | no, private     |

Expected c.4 output for W1: `#general = 1`, `#random = 1`.

## Messages

Rows marked ★ contain "perpendicular" and are used by query c.7.

| #   | Channel       | Poster | Age     | Content (excerpt)                                    |
|-----|---------------|--------|---------|------------------------------------------------------|
| 1   | C1 #general   | alice  | 5 days  | "Hello team, welcome..."                             |
| 2 ★ | C1 #general   | bob    | 4 days  | "logo features **perpendicular** lines..."           |
| 3 ★ | C1 #general   | carol  | 3 days  | "Love the **perpendicular** motif..."                |
| 4 ★ | C2 #random    | alice  | 2 days  | "Off-topic: **perpendicular** is my favorite..."     |
| 5 ★ | C3 #exec      | alice  | 1 day   | "Confidential — **perpendicular** strategy..."       |
| 6 ★ | C4 #geometry  | bob    | 10 days | "Two **perpendicular** lines form right angle"       |
| 7   | C4 #geometry  | eve    | 9 days  | "Indeed, that is the definition."                    |
| 8 ★ | C5 #calculus  | carol  | 8 days  | "tangent and normal vectors are **perpendicular**"   |
| 9   | C5 #calculus  | bob    | 7 days  | "Great insight, thanks."                             |

## What each query tests

| Query | What the data lets us check                                                 |
|-------|-----------------------------------------------------------------------------|
| c.1   | Inserting `george` and cleaning him up afterwards.                          |
| c.2   | Authorized path (carol, a member) and unauthorized path (frank, non-member) through the same CTE. |
| c.3   | Two admins in W1, one in W2.                                                |
| c.4   | Old-and-pending counts; recent-and-pending does not; private channel is skipped. |
| c.5   | Chronological order in a channel (alice → bob → carol).                     |
| c.6   | Posts by one user across a public and a private channel.                    |
| c.7   | Carol matches 3 ★ messages (2, 3, 8); frank (no memberships) matches 0.     |

## Why each user / row exists

- **frank** is a user with no workspace at all. Without him, c.7's empty-result case never runs.
- **dave** was invited to two channels in Acme but never joined. He supplies both the "old pending" case (7 d, counted) and the "too recent" case (3 d, not counted) in c.4.
- **carol** is in both workspaces but only in a subset of channels in each, which is what makes c.7 interesting.
- **#exec** is private and contains a ★ message that only alice and bob can see. It checks that c.7 does not leak private content.
- Each of the four channel invitations has a distinct reason to be counted or skipped in c.4, so every branch of the filter is exercised.
