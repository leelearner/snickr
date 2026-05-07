#!/bin/bash
# Drives a comprehensive multi-user session against the running backend on
# localhost:8000 and produces docs/session-logs/session-2026-05-08.txt by
# slicing backend/snickr.log between the start and end of the run.
#
# Prerequisites:
#   1. The seed script database/seeds/demo_seed.py has been run
#   2. uvicorn is running on port 8000

set -e

ROOT="/Users/jessica/Desktop/Jessica/NYU/2026Spring/CS6083/snickr"
LOG="$ROOT/backend/snickr.log"
OUT="$ROOT/docs/session-logs/session-2026-05-08.txt"
mkdir -p "$(dirname "$OUT")"
START=$(stat -f%z "$LOG")
BASE=http://localhost:8000

CH=/tmp/jar-chess
BB=/tmp/jar-bob
DD=/tmp/jar-dave
AA=/tmp/jar-alice
CC=/tmp/jar-carol
XY=/tmp/jar-xingyu
NC=/tmp/jar-newcomer
rm -f $CH $BB $DD $AA $CC $XY $NC

mark() { sleep 0.15; printf '\n### [%s] %s\n' "$(date +%H:%M:%S)" "$1" >> "$LOG"; sleep 0.1; }

login() {
  curl -s -c "$1" -X POST $BASE/api/auth/login \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$2\",\"password\":\"$3\"}" >/dev/null
}

# ============= Phase 1: chess returns and reads the workspace =============

mark "chess logs in with the seeded password"
login $CH chess demopass1

mark "chess fetches workspaces she belongs to"
WS_LIST=$(curl -s -b $CH $BASE/api/workspaces)
WS_CS=$(python3 -c "import json,sys;ws=json.loads('''$WS_LIST''');print(next(w for w in ws if w['name']=='NYU CS6083')['workspaceId'])")
WS_ROOM=$(python3 -c "import json,sys;ws=json.loads('''$WS_LIST''');print(next(w for w in ws if w['name']=='Roommates')['workspaceId'])")
CHESS_ID=$(curl -s -b $CH $BASE/api/auth/me | python3 -c "import json,sys;print(json.load(sys.stdin)['userId'])")

mark "chess fetches workspace detail (member list, role)"
curl -s -b $CH $BASE/api/workspaces/$WS_CS >/dev/null

mark "chess lists CS6083 channels"
CH_LIST=$(curl -s -b $CH $BASE/api/workspaces/$WS_CS/channels)
GENERAL=$(python3 -c "import json,sys;chs=json.loads('''$CH_LIST''');print(next(c for c in chs if c['channelName']=='general')['channelId'])")
PROJ=$(python3 -c "import json,sys;chs=json.loads('''$CH_LIST''');print(next(c for c in chs if c['channelName']=='project-snickr')['channelId'])")

mark "chess reads #general timeline"
curl -s -b $CH $BASE/api/channels/$GENERAL/messages >/dev/null

mark "chess fetches the cross-workspace admin list"
curl -s -b $CH $BASE/api/workspaces/admins >/dev/null

mark "chess fetches stale channel invites in CS6083 (catches the seeded >5d invite to newcomer)"
curl -s -b $CH $BASE/api/workspaces/$WS_CS/stale-channel-invites >/dev/null

# ============= Phase 2: post + mention, second user logs in =============

mark "chess posts an announcement that @mentions bob"
ANN_ID=$(curl -s -b $CH -X POST $BASE/api/channels/$GENERAL/messages \
  -H 'Content-Type: application/json' \
  -d '{"content":"Demo at 10am tomorrow. @bob please pull main before then."}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['messageId'])")

mark "bob logs in from another browser"
login $BB bob demopass1
BOB_ID=$(curl -s -b $BB $BASE/api/auth/me | python3 -c "import json,sys;print(json.load(sys.stdin)['userId'])")

mark "bob checks his Inbox - sees the new mention"
curl -s -b $BB $BASE/api/me/mentions >/dev/null

mark "bob navigates to #general and reads"
curl -s -b $BB $BASE/api/channels/$GENERAL/messages >/dev/null

mark "bob replies @chess in #general"
curl -s -b $BB -X POST $BASE/api/channels/$GENERAL/messages \
  -H 'Content-Type: application/json' \
  -d '{"content":"got it @chess, pulling now."}' >/dev/null

# ============= Phase 3: edit and delete messages =============

mark "chess edits her announcement (PATCH messages, sets edited_time)"
curl -s -b $CH -X PATCH $BASE/api/channels/$GENERAL/messages/$ANN_ID \
  -H 'Content-Type: application/json' \
  -d '{"content":"Demo at 10am tomorrow. @bob please pull main and run the tests."}' >/dev/null

mark "chess posts a throwaway message and then deletes it"
TMP_ID=$(curl -s -b $CH -X POST $BASE/api/channels/$GENERAL/messages \
  -H 'Content-Type: application/json' \
  -d '{"content":"oops wrong channel"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['messageId'])")
curl -s -b $CH -X DELETE $BASE/api/channels/$GENERAL/messages/$TMP_ID >/dev/null

mark "bob tries to edit chess's message - 403 forbidden"
curl -s -b $BB -X PATCH $BASE/api/channels/$GENERAL/messages/$ANN_ID \
  -H 'Content-Type: application/json' \
  -d '{"content":"hijacked"}' >/dev/null

# ============= Phase 4: search across visible channels =============

mark "chess searches for 'demo' (4 hits across visible channels)"
curl -s -b $CH "$BASE/api/search?q=demo" >/dev/null

mark "chess views all messages posted by carol"
CAROL_ID=$(curl -s -X POST $BASE/api/auth/login -c /tmp/jar-tmp \
  -H 'Content-Type: application/json' -d '{"username":"carol","password":"demopass1"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['userId'])")
curl -s -b $CH $BASE/api/users/$CAROL_ID/messages >/dev/null

# ============= Phase 5: pending workspace invitation acceptance =============

mark "dave logs in - he has a pending workspace invitation"
login $DD dave demopass1
DAVE_ID=$(curl -s -b $DD $BASE/api/auth/me | python3 -c "import json,sys;print(json.load(sys.stdin)['userId'])")

mark "dave lists pending workspace invitations"
INV_ID=$(curl -s -b $DD $BASE/api/me/workspace-invitations \
  | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['invitationId'])")

mark "dave accepts the invitation - accept_workspace_invitation stored procedure runs"
curl -s -b $DD -X POST $BASE/api/me/workspace-invitations/$INV_ID \
  -H 'Content-Type: application/json' -d '{"accept":true}' >/dev/null

# ============= Phase 6: create channel via stored procedure + self-join =============

mark "chess creates a new public channel #ship-it (calls create_channel_for_member SP)"
SHIP=$(curl -s -b $CH -X POST $BASE/api/workspaces/$WS_CS/channels \
  -H 'Content-Type: application/json' \
  -d '{"channelName":"ship-it","type":"public"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['channelId'])")

mark "dave self-joins #ship-it (writes system_kind='join' message + mention row to creator chess)"
curl -s -b $DD -X POST $BASE/api/channels/$SHIP/join >/dev/null

mark "chess fetches Inbox - now contains all three event kinds (mention, dm, join)"
curl -s -b $CH $BASE/api/me/mentions >/dev/null

# ============= Phase 7: channel invitation flow (private channel) =============

mark "chess creates a private channel #release-prep"
RELEASE=$(curl -s -b $CH -X POST $BASE/api/workspaces/$WS_CS/channels \
  -H 'Content-Type: application/json' \
  -d '{"channelName":"release-prep","type":"private"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['channelId'])")

mark "alice logs in"
login $AA alice demopass1
ALICE_ID=$(curl -s -b $AA $BASE/api/auth/me | python3 -c "import json,sys;print(json.load(sys.stdin)['userId'])")

mark "alice tries to fetch #release-prep before being invited - 404 hides existence"
curl -s -b $AA $BASE/api/channels/$RELEASE >/dev/null

mark "chess invites alice to #release-prep"
curl -s -b $CH -X POST $BASE/api/channels/$RELEASE/invitations \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice"}' >/dev/null

mark "alice lists pending channel invitations"
CINV_ID=$(curl -s -b $AA $BASE/api/me/channel-invitations \
  | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['invitationId'])")

mark "alice accepts the channel invitation"
curl -s -b $AA -X POST $BASE/api/me/channel-invitations/$CINV_ID \
  -H 'Content-Type: application/json' -d '{"accept":true}' >/dev/null

mark "alice can now read and post in #release-prep"
curl -s -b $AA $BASE/api/channels/$RELEASE/messages >/dev/null
curl -s -b $AA -X POST $BASE/api/channels/$RELEASE/messages \
  -H 'Content-Type: application/json' \
  -d '{"content":"thanks @chess, joined!"}' >/dev/null

# ============= Phase 8: last-admin guard =============

mark "alice (sole admin of Roommates) tries to demote herself - last-admin guard refuses with 409"
curl -s -b $AA -X PATCH $BASE/api/workspaces/$WS_ROOM/members/$ALICE_ID/role \
  -H 'Content-Type: application/json' -d '{"role":"member"}' >/dev/null

mark "alice promotes bob to admin first"
curl -s -b $AA -X PATCH $BASE/api/workspaces/$WS_ROOM/members/$BOB_ID/role \
  -H 'Content-Type: application/json' -d '{"role":"admin"}' >/dev/null

mark "alice now safely demotes herself"
curl -s -b $AA -X PATCH $BASE/api/workspaces/$WS_ROOM/members/$ALICE_ID/role \
  -H 'Content-Type: application/json' -d '{"role":"member"}' >/dev/null

# ============= Phase 9: security =============

mark "security: anonymous attacker registers with SQL-injection-shaped nickname (stored as literal text)"
curl -s -X POST $BASE/api/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"eve@x.com\",\"username\":\"eve\",\"nickname\":\"'); DROP TABLE users; --\",\"password\":\"evpw12345\"}" >/dev/null

mark "security: bob runs a SQL-injection-shaped search query (bound as literal substring, returns 0 hits)"
curl -s -b $BB "$BASE/api/search?q=%27%29%3B+DROP+TABLE+messages%3B+--" >/dev/null

mark "security: carol posts an XSS payload (stored verbatim, escaped at render)"
login $CC carol demopass1
curl -s -b $CC -X POST $BASE/api/channels/$GENERAL/messages \
  -H 'Content-Type: application/json' \
  -d '{"content":"<script>alert(1)</script><img src=x onerror=alert(2)>"}' >/dev/null

# ============= Phase 10: DM lifecycle =============

mark "bob opens a DM with alice in CS6083"
curl -s -b $BB -X POST $BASE/api/workspaces/$WS_CS/direct-messages \
  -H 'Content-Type: application/json' \
  -d "{\"targetUserId\":$ALICE_ID}" >/dev/null

mark "bob hides the DM from his sidebar (soft delete via hidden_at)"
DM_LIST=$(curl -s -b $BB $BASE/api/workspaces/$WS_CS/channels)
DM_ID=$(python3 -c "import json,sys;chs=json.loads('''$DM_LIST''');dms=[c for c in chs if c.get('type')=='direct'];print(dms[0]['channelId'] if dms else 0)")
[ "$DM_ID" != "0" ] && curl -s -b $BB -X POST $BASE/api/channels/$DM_ID/leave >/dev/null

# ============= Phase 11: password change =============

mark "chess changes her password via PATCH /api/auth/me"
curl -s -b $CH -X PATCH $BASE/api/auth/me \
  -H 'Content-Type: application/json' \
  -d '{"currentPassword":"demopass1","newPassword":"newpass4567"}' >/dev/null

mark "chess logs out, then logs back in with the new password"
curl -s -b $CH -X POST $BASE/api/auth/logout >/dev/null
rm -f $CH
login $CH chess newpass4567

mark "chess restores the original password so the seed remains valid"
curl -s -b $CH -X PATCH $BASE/api/auth/me \
  -H 'Content-Type: application/json' \
  -d '{"currentPassword":"newpass4567","newPassword":"demopass1"}' >/dev/null

# ============= Phase 12: disband workspace =============

mark "chess creates a throwaway workspace 'Sandbox' to demo disband"
SANDBOX=$(curl -s -b $CH -X POST $BASE/api/workspaces \
  -H 'Content-Type: application/json' \
  -d '{"name":"Sandbox","description":"throwaway for disband demo"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['workspaceId'])")

mark "chess disbands Sandbox - foreign-key cascade removes channels, members, invites"
curl -s -b $CH -X DELETE $BASE/api/workspaces/$SANDBOX >/dev/null

mark "chess logs out"
curl -s -b $CH -X POST $BASE/api/auth/logout >/dev/null
mark "session ends"
sleep 0.3

tail -c +$((START + 1)) "$LOG" > "$OUT"
echo "saved: $OUT ($(wc -l < "$OUT") lines, $(wc -c < "$OUT") bytes)"
