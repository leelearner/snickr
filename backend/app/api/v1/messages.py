import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.v1.deps import current_user_id
from app.api.v1.mentions import insert_mentions_for_message
from app.db.session import get_conn
from app.schemas.message import MessageCreate, MessageOut, MessageUpdate, MessageWithLocation


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
               m.edited_time  AS "editedTime",
               m.system_kind  AS "systemKind",
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

    async with conn.transaction():
        row = await conn.fetchrow(
            """
            WITH inserted AS (
                INSERT INTO messages (channelID, content, posted_time, posted_by)
                VALUES ($1, $2, timezone('America/New_York', NOW()), $3)
                RETURNING messageID, content, posted_time, edited_time, system_kind, posted_by
            )
            SELECT i.messageID    AS "messageId",
                   i.content,
                   i.posted_time  AS "postedTime",
                   i.edited_time  AS "editedTime",
                   i.system_kind  AS "systemKind",
                   u.userID       AS "postedBy",
                   u.username     AS "postedByUsername",
                   u.nickname     AS "postedByNickname"
              FROM inserted i
              JOIN users u ON u.userID = i.posted_by
            """,
            channel_id, body.content, user_id,
        )
        await insert_mentions_for_message(conn, row["messageId"], channel_id, body.content)

        # In direct-message channels every new message is implicitly a notification
        # to the other participant, so we add a mention row to surface it in the Inbox.
        await conn.execute(
            """
            INSERT INTO mentions (messageID, mentioned_user)
            SELECT $1, cm.userID
              FROM channelmember cm
              JOIN channels      c  ON c.channelID = cm.channelID
              JOIN channeltype   ct ON ct.typeID   = c.typeID
             WHERE cm.channelID = $2
               AND cm.userID   <> $3
               AND ct.name      = 'direct'
            ON CONFLICT (messageID, mentioned_user) DO NOTHING
            """,
            row["messageId"], channel_id, user_id,
        )
        # If the partner had dismissed the DM, a fresh message brings it back
        # into their list automatically.
        await conn.execute(
            """
            UPDATE channelmember cm
               SET hidden_at = NULL
              FROM channels    c
              JOIN channeltype ct ON ct.typeID = c.typeID
             WHERE cm.channelID = c.channelID
               AND c.channelID  = $1
               AND ct.name      = 'direct'
               AND cm.userID   <> $2
               AND cm.hidden_at IS NOT NULL
            """,
            channel_id, user_id,
        )
    return MessageOut(**dict(row))


@channel_msgs_router.patch(
    "/{channel_id}/messages/{message_id}",
    response_model=MessageOut,
)
async def edit_channel_message(
    channel_id: int,
    message_id: int,
    body: MessageUpdate,
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> MessageOut:
    async with conn.transaction():
        existing = await conn.fetchrow(
            """
            SELECT posted_by, channelID, system_kind
              FROM messages
             WHERE messageID = $1
            """,
            message_id,
        )
        if existing is None or existing["channelid"] != channel_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="message not found")
        if existing["system_kind"] is not None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="cannot edit a system message")
        if existing["posted_by"] != user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="cannot edit another user's message")

        row = await conn.fetchrow(
            """
            WITH updated AS (
                UPDATE messages
                   SET content     = $1,
                       edited_time = timezone('America/New_York', NOW())
                 WHERE messageID = $2
                RETURNING messageID, content, posted_time, edited_time, system_kind, posted_by
            )
            SELECT u_msg.messageID    AS "messageId",
                   u_msg.content,
                   u_msg.posted_time  AS "postedTime",
                   u_msg.edited_time  AS "editedTime",
                   u_msg.system_kind  AS "systemKind",
                   u.userID           AS "postedBy",
                   u.username         AS "postedByUsername",
                   u.nickname         AS "postedByNickname"
              FROM updated u_msg
              JOIN users   u ON u.userID = u_msg.posted_by
            """,
            body.content, message_id,
        )

        await conn.execute("DELETE FROM mentions WHERE messageID = $1", message_id)
        await insert_mentions_for_message(conn, message_id, channel_id, body.content)

    return MessageOut(**dict(row))


@channel_msgs_router.delete(
    "/{channel_id}/messages/{message_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_channel_message(
    channel_id: int,
    message_id: int,
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> None:
    existing = await conn.fetchrow(
        """
        SELECT posted_by, channelID, system_kind
          FROM messages
         WHERE messageID = $1
        """,
        message_id,
    )
    if existing is None or existing["channelid"] != channel_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="message not found")
    if existing["system_kind"] is not None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="cannot delete a system message")
    if existing["posted_by"] != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="cannot delete another user's message")

    await conn.execute("DELETE FROM messages WHERE messageID = $1", message_id)


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
               m.edited_time  AS "editedTime",
               m.system_kind  AS "systemKind",
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
               m.edited_time  AS "editedTime",
               m.system_kind  AS "systemKind",
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
