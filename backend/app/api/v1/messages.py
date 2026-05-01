import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.v1.deps import current_user_id
from app.db.session import get_conn
from app.schemas.message import MessageCreate, MessageOut, MessageWithLocation


channel_msgs_router = APIRouter(prefix="/api/channels", tags=["messages"])
user_msgs_router = APIRouter(prefix="/api/users", tags=["messages"])
search_router = APIRouter(prefix="/api/search", tags=["search"])


async def _is_channel_member(conn: asyncpg.Connection, user_id: int, channel_id: int) -> bool:
    return bool(await conn.fetchval(
        "SELECT EXISTS(SELECT 1 FROM channelmember WHERE channelID=$1 AND userID=$2)",
        channel_id, user_id,
    ))


@channel_msgs_router.get("/{channel_id}/messages", response_model=list[MessageOut])
async def list_channel_messages(
    channel_id: int,
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> list[MessageOut]:
    if not await _is_channel_member(conn, user_id, channel_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="channel not found")

    rows = await conn.fetch(
        """
        SELECT m.messageID    AS "messageId",
               m.content,
               m.posted_time  AS "postedTime",
               u.userID       AS "postedBy",
               u.username     AS "postedByUsername",
               u.nickname     AS "postedByNickname"
          FROM messages m
          JOIN users    u ON u.userID = m.posted_by
         WHERE m.channelID = $1
         ORDER BY m.posted_time ASC, m.messageID ASC
        """,
        channel_id,
    )
    return [MessageOut(**dict(r)) for r in rows]


@channel_msgs_router.post(
    "/{channel_id}/messages",
    status_code=status.HTTP_201_CREATED,
    response_model=MessageOut,
)
async def post_channel_message(
    channel_id: int,
    body: MessageCreate,
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> MessageOut:
    if not await _is_channel_member(conn, user_id, channel_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="not a member of this channel")

    row = await conn.fetchrow(
        """
        WITH inserted AS (
            INSERT INTO messages (channelID, content, posted_time, posted_by)
            VALUES ($1, $2, NOW(), $3)
            RETURNING messageID, content, posted_time, posted_by
        )
        SELECT i.messageID    AS "messageId",
               i.content,
               i.posted_time  AS "postedTime",
               u.userID       AS "postedBy",
               u.username     AS "postedByUsername",
               u.nickname     AS "postedByNickname"
          FROM inserted i
          JOIN users u ON u.userID = i.posted_by
        """,
        channel_id, body.content, user_id,
    )
    return MessageOut(**dict(row))


@user_msgs_router.get("/{target_user_id}/messages", response_model=list[MessageWithLocation])
async def list_user_messages(
    target_user_id: int,
    _: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> list[MessageWithLocation]:
    rows = await conn.fetch(
        """
        SELECT m.messageID    AS "messageId",
               m.content,
               m.posted_time  AS "postedTime",
               w.workspaceID  AS "workspaceId",
               w.name         AS "workspaceName",
               c.channelID    AS "channelId",
               c.channel_name AS "channelName",
               u.userID       AS "postedBy",
               u.username     AS "postedByUsername",
               u.nickname     AS "postedByNickname"
          FROM messages   m
          JOIN channels   c ON c.channelID   = m.channelID
          JOIN workspaces w ON w.workspaceID = c.workspaceID
          JOIN users      u ON u.userID      = m.posted_by
         WHERE m.posted_by = $1
         ORDER BY m.posted_time DESC, m.messageID DESC
        """,
        target_user_id,
    )
    return [MessageWithLocation(**dict(r)) for r in rows]


@search_router.get("", response_model=list[MessageWithLocation])
async def search_messages(
    q: str,
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> list[MessageWithLocation]:
    if not q.strip():
        return []
    pattern = f"%{q}%"
    rows = await conn.fetch(
        """
        SELECT m.messageID    AS "messageId",
               m.content,
               m.posted_time  AS "postedTime",
               w.workspaceID  AS "workspaceId",
               w.name         AS "workspaceName",
               c.channelID    AS "channelId",
               c.channel_name AS "channelName",
               u.userID       AS "postedBy",
               u.username     AS "postedByUsername",
               u.nickname     AS "postedByNickname"
          FROM messages        m
          JOIN channels        c  ON c.channelID    = m.channelID
          JOIN workspaces      w  ON w.workspaceID  = c.workspaceID
          JOIN channelmember   cm ON cm.channelID   = c.channelID   AND cm.userID = $1
          JOIN workspacemember wm ON wm.workspaceID = w.workspaceID AND wm.userID = $1
          JOIN users           u  ON u.userID       = m.posted_by
         WHERE m.content ILIKE $2
         ORDER BY m.posted_time ASC, m.messageID ASC
        """,
        user_id, pattern,
    )
    return [MessageWithLocation(**dict(r)) for r in rows]
