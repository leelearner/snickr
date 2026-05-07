import re

import asyncpg
from fastapi import APIRouter, Depends

from app.api.v1.deps import current_user_id
from app.db.session import get_conn
from app.schemas.mention import MentionOut


me_mentions_router = APIRouter(prefix="/api/me", tags=["mentions"])

MENTION_PATTERN = re.compile(r"@([A-Za-z0-9_.]+)")


async def insert_mentions_for_message(
    conn: asyncpg.Connection,
    message_id: int,
    channel_id: int,
    content: str,
) -> int:
    handles = list({match.group(1) for match in MENTION_PATTERN.finditer(content)})
    if not handles:
        return 0

    rows = await conn.fetch(
        """
        SELECT u.userID
          FROM users         u
          JOIN channelmember cm ON cm.userID = u.userID
         WHERE u.username = ANY($1::text[])
           AND cm.channelID = $2
        """,
        handles,
        channel_id,
    )
    if not rows:
        return 0

    await conn.executemany(
        """
        INSERT INTO mentions (messageID, mentioned_user)
        VALUES ($1, $2)
        ON CONFLICT (messageID, mentioned_user) DO NOTHING
        """,
        [(message_id, row["userid"]) for row in rows],
    )
    return len(rows)


@me_mentions_router.get("/mentions", response_model=list[MentionOut])
async def list_my_mentions(
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> list[MentionOut]:
    rows = await conn.fetch(
        """
        SELECT m.mentionID    AS "mentionId",
               msg.messageID  AS "messageId",
               msg.content,
               msg.posted_time AS "postedTime",
               w.workspaceID  AS "workspaceId",
               w.name         AS "workspaceName",
               c.channelID    AS "channelId",
               c.channel_name AS "channelName",
               ct.name        AS "channelType",
               CASE
                   WHEN ct.name = 'direct'        THEN 'dm'
                   WHEN msg.system_kind = 'join'  THEN 'join'
                   ELSE 'mention'
               END AS "kind",
               u.userID       AS "postedBy",
               u.username     AS "postedByUsername",
               u.nickname     AS "postedByNickname"
          FROM mentions      m
          JOIN messages      msg ON msg.messageID  = m.messageID
          JOIN channels      c   ON c.channelID    = msg.channelID
          JOIN channeltype   ct  ON ct.typeID      = c.typeID
          JOIN workspaces    w   ON w.workspaceID  = c.workspaceID
          JOIN users         u   ON u.userID       = msg.posted_by
          -- Hide mentions whose channel the user is no longer a member of, e.g.
          -- after being kicked from the channel or removed from the workspace.
          JOIN channelmember cm  ON cm.channelID   = c.channelID
                                AND cm.userID      = m.mentioned_user
         WHERE m.mentioned_user = $1
         ORDER BY msg.posted_time DESC, m.mentionID DESC
         LIMIT 100
        """,
        user_id,
    )
    return [MentionOut(**dict(r)) for r in rows]
