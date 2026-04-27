-- Part (c) — Snickr SQL queries.  Placeholders use :name notation.


-- (c.1) Create a new user account.
INSERT INTO users (email, username, nickname, password, created_time, updated_time)
VALUES (:email, :username, :nickname, :password, NOW(), NOW())
RETURNING userID;


-- (c.2) Create a public channel in a workspace by a user,
--       only if the user is a member of that workspace.
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


-- (c.3) For each workspace, list all current administrators.
SELECT  w.workspaceID, w.name AS workspace_name,
        u.userID, u.username, u.nickname
FROM    workspaces      w
JOIN    workspacemember wm ON wm.workspaceID = w.workspaceID
JOIN    roles           r  ON r.roleID       = wm.role
JOIN    users           u  ON u.userID       = wm.userID
WHERE   r.name = 'admin'
ORDER BY w.workspaceID, u.username;


-- (c.4) For each public channel in a given workspace, count users
--       invited more than 5 days ago who have not yet joined.
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


-- (c.5) All messages of a given channel in chronological order.
SELECT  m.messageID, m.content, m.posted_time,
        u.userID, u.username, u.nickname
FROM    messages m
JOIN    users    u ON u.userID = m.posted_by
WHERE   m.channelID = :channel_id
ORDER BY m.posted_time ASC, m.messageID ASC;


-- (c.6) All messages posted by a given user in any channel.
SELECT  m.messageID,
        w.workspaceID, w.name AS workspace_name,
        c.channelID,   c.channel_name,
        m.content, m.posted_time
FROM    messages   m
JOIN    channels   c ON c.channelID   = m.channelID
JOIN    workspaces w ON w.workspaceID = c.workspaceID
WHERE   m.posted_by = :user_id
ORDER BY m.posted_time DESC, m.messageID DESC;


-- (c.7) Messages accessible to a user (member of both workspace
--       and channel) containing the keyword "perpendicular".
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
