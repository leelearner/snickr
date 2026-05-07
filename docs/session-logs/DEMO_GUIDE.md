# Snickr Demo Guide

Reference for the live demo on May 8, 2026. Contains the seeded dataset
inventory, suggested demo flow, and the location of pre-recorded session
logs and screenshots if the live run hits a snag.

## 1. Quick start

```bash
# 1. Backend (FastAPI on :8000)
cd backend
conda activate snickr
uvicorn app.main:app --reload --port 8000

# 2. Frontend (Vite on :5173)
cd frontend
npm run dev

# 3. Reset to clean demo state at any point
python database/seeds/demo_seed.py
```

Visit `http://localhost:5173/login`. All accounts share the password
`demopass1`.

## 2. Seeded dataset

Eight accounts, two workspaces, eight channels, 37 messages, 11 mention
rows, 1 pending workspace invitation, 1 stale channel invitation older
than five days.

### 2.1 Users

| Username  | Nickname    | Notes |
|---|---|---|
| `chess`     | Chess Xu    | You. Admin of NYU CS6083; member of Roommates. |
| `xingyu`    | Xingyu Li   | Teammate. Admin of NYU CS6083. |
| `prof`      | Prof Davies | Admin of NYU CS6083. |
| `alice`     | Alice Chen  | Member of NYU CS6083. Sole admin of Roommates. |
| `bob`       | Bob Garcia  | Member of NYU CS6083 and Roommates. |
| `carol`     | Carol Patel | Member of NYU CS6083. |
| `dave`      | Dave Kim    | Not yet a workspace member. Has a pending invite to NYU CS6083. |
| `newcomer`  | Newcomer    | Recipient of a stale (>5 days) channel invitation to `#project-snickr`. |

### 2.2 Workspaces

**NYU CS6083** (workspaceId 1, created by chess)

| Channel | Type | Members | Notes |
|---|---|---|---|
| `general`        | public  | chess, xingyu, prof, alice, bob, carol | Default channel, has welcome and announcement messages. |
| `project-snickr` | public  | same as general | Discussion of the Part 2 build. |
| `help`           | public  | same as general | Q and A on the schema and project work. |
| `office-hours`   | private | prof, chess only | Demonstrates a private channel hidden from non-members. |

**Roommates** (workspaceId 2, created by alice)

| Channel | Type | Members | Notes |
|---|---|---|---|
| `general`  | public  | alice, chess, bob | Apartment chatter. |
| `cleaning` | public  | alice, chess, bob | Chore rotation. |
| `snacks`   | private | alice, chess only | Demonstrates a second private channel. |

### 2.3 Pending invitations

| Type | Target | Invited by | Age | Will it appear in stale-invites? |
|---|---|---|---|---|
| Workspace, NYU CS6083 | dave    | chess  | 3 hours | n/a, the stale endpoint is for channel invites |
| Channel, `#project-snickr` | newcomer | chess | 8 days  | yes |

## 3. Stored procedures exercised by the demo

| Procedure | Trigger in the demo |
|---|---|
| `create_channel_for_member` | Creating any new channel through `POST /api/workspaces/{id}/channels` |
| `accept_workspace_invitation` | Dave accepting his pending invite |

## 4. Suggested live demo flow

Each step lists the live action, the API path or HTTP method that runs
behind it, and the screenshot to fall back on if the live run fails.

### Scene 1: Login and workspace overview

1. Open `http://localhost:5173/login`, sign in as `chess` with
   `demopass1`. The session cookie is `httpOnly` and `sameSite=lax`, so
   `document.cookie` returns nothing in DevTools.
   - Backend: `auth.login uid=1 username=chess`
   - Screenshot: `01_login_page.png`, `02_chess_workspace_list.png`
2. Click into NYU CS6083 to show channel sidebar and member rail.
   - Backend: `GET /api/workspaces/1`, `GET /api/workspaces/1/channels`
   - Screenshot: `03_chess_cs6083_home.png`
3. Open `#general` and scroll the seeded conversation. Highlight the
   `@chess` and `@xingyu` mentions rendered as blue links.
   - Backend: `GET /api/channels/1/messages`
   - Screenshot: `04_chess_general_channel.png`

### Scene 2: Inbox and the three classifications

4. Click the Inbox icon in the workspace rail. Show the seeded mentions
   from Alice and Bob (kind `mention`) and the DM from Bob (kind `dm`).
   - Backend: `GET /api/me/mentions`
   - Screenshot: `05_chess_inbox.png`
5. To trigger a third Inbox category live, sign in as `dave` in another
   browser, accept his pending invitation, then self-join `#ship-it`
   after chess creates it (Scene 4). Dave's join writes a system message
   with `system_kind='join'` and a mention row to chess. Refreshing
   chess's Inbox shows the third `join` classification.

### Scene 3: Search with access control

6. From any page hit the Search bar, type `demo`. Three results land
   from `#general`, `#project-snickr`, and the private `#office-hours`
   that chess can see.
   - Backend: `GET /api/search?q=demo` (asyncpg binds `%demo%` as a
     parameterised value; the `ILIKE` wildcards live in the bound value
     not in the SQL text, so a query of `100%` would match the literal
     `100%`).
   - Screenshot: `06_chess_search_results.png`
7. Sign in as `bob` in another browser, search `demo`. The
   `#office-hours` hit is missing because bob is not a channel member.
   The same query yields different results depending on who runs it.
   - Screenshot: `12_bob_view_of_general.png`

### Scene 4: Stored procedures, joins, and the Inbox `join` classification

8. As chess, click the `+` next to CHANNELS, name it `ship-it`, type
   public. Behind the scenes this calls
   `SELECT create_channel_for_member($1, $2, $3, $4)`.
   - Backend: `channel.create uid=1 channelId=N name=ship-it type=public`
9. Switch to dave's browser (still logged in). Open `#ship-it` from the
   public channel list, click "Join". A system message appears in the
   channel reading "joined the channel", and chess gets a `join` event
   in her Inbox.
   - Backend: `channel.join uid=6 channelId=N new=True`

### Scene 5: Channel invitations to a private channel

10. As chess, create a private channel `release-prep`. Open its members
    panel and invite `alice` by username.
    - Backend: `channel.invite uid=1 invitee=alice invitationId=N`
11. Switch to alice's browser, open her Inbox / invitations page,
    accept the channel invitation. Alice now sees `#release-prep` in her
    sidebar.
    - Backend: `channel.invitation_response uid=3 status=accepted`

### Scene 6: Edit and delete messages

12. As chess, hover a message in `#general`, click the pencil to edit
    the content. The message displays an `edited` marker after save.
    - Backend: `message.edit uid=1 messageId=N mentions=K`
13. Hover another message, click the trash icon, confirm. The row
    disappears.
    - Backend: `message.delete uid=1 messageId=N`
14. Try to edit one of bob's messages. The pencil isn't shown in the
    UI; if poked via DevTools, the API returns 403.

### Scene 7: Last-admin guard

15. Sign in as `alice`. Open Roommates members, click her own role
    dropdown, change to `member`. The toast shows
    "cannot leave as the only admin; promote someone else first".
    - Backend: `workspace.last_admin_guard uid=3 workspaceId=2 action=demote`
16. Promote bob to admin, then alice can demote herself.
    - Backend: `workspace.role_change ... target=4 role=admin`,
      then `target=3 role=member`

### Scene 8: DM lifecycle and soft delete

17. As bob, click Alice's avatar in the member rail to open a DM. Type a
    message.
18. Hover the DM in the sidebar, click the X. The DM disappears for bob
    only. Alice can still see it. The membership row is kept and a new
    message from alice would resurface the DM.
    - Backend: `channel.dm_open ...`, then `channel.dm_hide channelId=N`

### Scene 9: Pending workspace invitation flow

19. Sign in as `dave`. The workspace list shows a "Pending invitation"
    card for NYU CS6083. Click "Accept". The
    `accept_workspace_invitation` stored procedure runs, flipping the
    invitation row to `accepted` and inserting the membership row in
    one PL/pgSQL transaction.
    - Screenshot: `13_dave_workspace_list_with_pending_invite.png`,
      `14_dave_pending_invitation.png`

### Scene 10: Stale channel invites view

20. As chess, open the workspace settings sidebar for NYU CS6083, click
    "Stale channel invites". The view lists `#project-snickr` with one
    pending invite older than five days, addressed to `newcomer` who
    has not joined.
    - Backend: `GET /api/workspaces/1/stale-channel-invites`

### Scene 11: Cross-workspace admin browsing

21. Click "Admins" in the workspace rail to see admins across every
    workspace chess belongs to. CS6083 lists chess, xingyu, prof.
    Roommates lists alice (or bob if you ran the demote step).
    - Backend: `GET /api/workspaces/admins`
    - Screenshot: `07_chess_admins_across_workspaces.png`

### Scene 12: User profile, password change

22. Open the profile page, change the email or nickname, save. To
    change password, fill in current password `demopass1` plus a new
    one. Sign out and sign back in to prove it took.
    - Backend: `PATCH /api/auth/me` (body validates with Pydantic;
      `currentPassword` is required when `newPassword` is set).
    - Screenshot: `08_chess_profile.png`
23. If you change the password, change it back to `demopass1` so the
    seed remains valid for re-runs.

### Scene 13: Browse messages by user

24. Open the User Messages page for `bob` (or click his avatar
    somewhere). The page lists every message bob has posted across
    channels chess can see, with workspace and channel context columns.
    - Backend: `GET /api/users/4/messages`
    - Screenshot: `10_chess_views_bobs_messages.png`

### Scene 14: Security guards

25. **SQL injection.** Open the Search bar, type
    `'); DROP TABLE messages; --`. The query returns zero hits because
    the value is bound through asyncpg's `$1` placeholder, not
    concatenated into SQL. Show the database is intact afterwards by
    refreshing `#general`.
    - Backend: `search uid=N q="'); DROP TABLE messages; --" hits=0`
26. **XSS.** As any user, post the message
    `<script>alert(1)</script><img src=x onerror=alert(2)>` into a
    channel. No popup fires; the literal HTML tags appear as plain
    text. React's `{value}` expression always produces a text node.
    - Backend: `message.post uid=N length=53 mentions=0`

### Scene 15 (optional): Disband workspace

27. As chess, create a throwaway workspace called `Sandbox`. Open its
    settings, click "Disband workspace". The `DELETE /api/workspaces/{id}`
    foreign-key cascade removes its channels, members, and invitations
    in a single statement.
    - Backend: `workspace.create uid=1 workspaceId=N name=Sandbox`,
      then `workspace.disband uid=1 workspaceId=N`

## 5. Backup artifacts

If the live demo fails, the pre-recorded session log and screenshots
cover every scene above.

```
docs/session-logs/
├── DEMO_GUIDE.md            (this file)
├── session-2026-05-08.txt   (full backend event log, 176 lines)
├── run_session.sh           (script that produced the log)
├── take_screenshots.py      (script that produced the screenshots)
└── screenshots/
    ├── 01_login_page.png
    ├── 02_chess_workspace_list.png
    ├── 03_chess_cs6083_home.png
    ├── 04_chess_general_channel.png
    ├── 05_chess_inbox.png
    ├── 06_chess_search_results.png
    ├── 07_chess_admins_across_workspaces.png
    ├── 08_chess_profile.png
    ├── 09_chess_workspace_members.png
    ├── 10_chess_views_bobs_messages.png
    ├── 11_bob_inbox_with_seeded_mention.png
    ├── 12_bob_view_of_general.png
    ├── 13_dave_workspace_list_with_pending_invite.png
    └── 14_dave_pending_invitation.png
```

## 6. Re-running the artifacts

```bash
# Reset to clean demo state
python database/seeds/demo_seed.py

# Generate the session log (~30 seconds)
bash docs/session-logs/run_session.sh

# Reset again, then refresh screenshots (~1 minute)
python database/seeds/demo_seed.py
python docs/session-logs/take_screenshots.py
```

Both scripts assume the backend is running on `:8000` and the frontend
is running on `:5173`.
