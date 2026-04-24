-- Part (d) — Test runs against sample_data.sql


-- (c.1) Register "george" → expect new userID.
INSERT INTO users (email, username, nickname, password, created_time, updated_time)
VALUES ('george@acme.com', 'george', 'Georgie', 'pw_george', NOW(), NOW())
RETURNING userID, email, username;

DELETE FROM users WHERE username = 'george';


-- (c.2A) carol (member of W1) creates #announcements → should succeed.
BEGIN;
WITH new_channel AS (
    INSERT INTO channels (workspaceID, channel_name, typeID, created_by)
    SELECT 1, 'announcements',
           (SELECT typeID FROM channeltype WHERE name='public'), 3
    WHERE EXISTS (SELECT 1 FROM workspacemember WHERE workspaceID=1 AND userID=3)
    RETURNING channelID
)
INSERT INTO channelmember (channelID, userID)
SELECT channelID, 3 FROM new_channel;
COMMIT;

SELECT * FROM channels WHERE channel_name='announcements';
SELECT * FROM channelmember
WHERE  channelID = (SELECT channelID FROM channels WHERE channel_name='announcements');

-- (c.2B) frank (not in W1) tries to create #hack → should insert nothing.
BEGIN;
WITH new_channel AS (
    INSERT INTO channels (workspaceID, channel_name, typeID, created_by)
    SELECT 1, 'hack',
           (SELECT typeID FROM channeltype WHERE name='public'), 6
    WHERE EXISTS (SELECT 1 FROM workspacemember WHERE workspaceID=1 AND userID=6)
    RETURNING channelID
)
INSERT INTO channelmember (channelID, userID)
SELECT channelID, 6 FROM new_channel;
COMMIT;

SELECT COUNT(*) AS must_be_zero FROM channels WHERE channel_name='hack';

DELETE FROM channels WHERE channel_name='announcements';


-- (c.3) Admins per workspace → Acme: alice, bob ; Math Club: bob.
SELECT  w.workspaceID, w.name AS workspace_name,
        u.userID, u.username, u.nickname
FROM    workspaces w
JOIN    workspacemember wm ON wm.workspaceID = w.workspaceID
JOIN    roles           r  ON r.roleID       = wm.role
JOIN    users           u  ON u.userID       = wm.userID
WHERE   r.name = 'admin'
ORDER BY w.workspaceID, u.username;


-- (c.4) W1 public channels, pending invites older than 5 days
--       → #general=1, #random=1.
SELECT  c.channelID, c.channel_name,
        COUNT(ci.invitationID) AS pending_invites_over_5_days
FROM    channels    c
JOIN    channeltype ct ON ct.typeID = c.typeID
LEFT JOIN channelinvitation ci
       ON ci.channelID    = c.channelID
      AND ci.invited_time < NOW() - INTERVAL '5 days'
      AND ci.status_type  = (SELECT statusID FROM status WHERE type='pending')
      AND NOT EXISTS (SELECT 1 FROM channelmember cm
                      WHERE cm.channelID = ci.channelID AND cm.userID = ci.invitee)
WHERE   c.workspaceID = 1 AND ct.name = 'public'
GROUP BY c.channelID, c.channel_name
ORDER BY c.channel_name;


-- (c.5) Messages in #general chronologically → alice, bob, carol.
SELECT  m.messageID, m.content, m.posted_time, u.username
FROM    messages m JOIN users u ON u.userID = m.posted_by
WHERE   m.channelID = 1
ORDER BY m.posted_time ASC, m.messageID ASC;


-- (c.6) Messages by alice (userID=1) → 3 rows, newest first.
SELECT  m.messageID, w.name AS workspace_name, c.channel_name,
        m.content, m.posted_time
FROM    messages   m
JOIN    channels   c ON c.channelID   = m.channelID
JOIN    workspaces w ON w.workspaceID = c.workspaceID
WHERE   m.posted_by = 1
ORDER BY m.posted_time DESC, m.messageID DESC;


-- (c.7) Messages containing "perpendicular" accessible to carol (userID=3)
--       → 3 rows: bob/carol in #general, carol in #calculus.
SELECT  m.messageID, w.name AS workspace_name, c.channel_name,
        poster.username AS posted_by, m.content, m.posted_time
FROM    messages        m
JOIN    channels        c  ON c.channelID    = m.channelID
JOIN    workspaces      w  ON w.workspaceID  = c.workspaceID
JOIN    channelmember   cm ON cm.channelID   = c.channelID   AND cm.userID = 3
JOIN    workspacemember wm ON wm.workspaceID = w.workspaceID AND wm.userID = 3
JOIN    users           poster ON poster.userID = m.posted_by
WHERE   m.content ILIKE '%perpendicular%'
ORDER BY m.posted_time ASC, m.messageID ASC;


-- (c.7 sanity) Same query for frank (userID=6, no memberships) → 0.
SELECT  COUNT(*) AS frank_accessible_count
FROM    messages        m
JOIN    channels        c  ON c.channelID    = m.channelID
JOIN    workspaces      w  ON w.workspaceID  = c.workspaceID
JOIN    channelmember   cm ON cm.channelID   = c.channelID   AND cm.userID = 6
JOIN    workspacemember wm ON wm.workspaceID = w.workspaceID AND wm.userID = 6
WHERE   m.content ILIKE '%perpendicular%';
