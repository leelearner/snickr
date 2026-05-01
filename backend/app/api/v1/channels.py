import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.v1.deps import current_user_id
from app.db.session import get_conn
from app.schemas.channel import (
    ChannelCreate,
    ChannelDetail,
    ChannelInviteCreate,
    ChannelInvitation,
    ChannelMember,
    ChannelSummary,
    InviteResponse,
)


workspace_channels_router = APIRouter(prefix="/api/workspaces", tags=["channels"])
channels_router = APIRouter(prefix="/api/channels", tags=["channels"])
me_router = APIRouter(prefix="/api/me", tags=["me"])


async def _is_workspace_member(conn: asyncpg.Connection, user_id: int, workspace_id: int) -> bool:
    return bool(await conn.fetchval(
        "SELECT EXISTS(SELECT 1 FROM workspacemember WHERE workspaceID=$1 AND userID=$2)",
        workspace_id, user_id,
    ))


async def _is_channel_member(conn: asyncpg.Connection, user_id: int, channel_id: int) -> bool:
    return bool(await conn.fetchval(
        "SELECT EXISTS(SELECT 1 FROM channelmember WHERE channelID=$1 AND userID=$2)",
        channel_id, user_id,
    ))


@workspace_channels_router.get("/{workspace_id}/channels", response_model=list[ChannelSummary])
async def list_channels(
    workspace_id: int,
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> list[ChannelSummary]:
    if not await _is_workspace_member(conn, user_id, workspace_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="workspace not found")

    rows = await conn.fetch(
        """
        SELECT c.channelID    AS "channelId",
               c.channel_name AS "channelName",
               ct.name        AS "type",
               EXISTS (
                   SELECT 1 FROM channelmember cm
                    WHERE cm.channelID = c.channelID
                      AND cm.userID    = $2
               ) AS "isMember"
          FROM channels    c
          JOIN channeltype ct ON ct.typeID = c.typeID
         WHERE c.workspaceID = $1
           AND (
               ct.name <> 'private'
               OR EXISTS (
                   SELECT 1 FROM channelmember cm
                    WHERE cm.channelID = c.channelID
                      AND cm.userID    = $2
               )
           )
         ORDER BY c.channel_name
        """,
        workspace_id, user_id,
    )
    return [ChannelSummary(**dict(r)) for r in rows]


@workspace_channels_router.post(
    "/{workspace_id}/channels",
    status_code=status.HTTP_201_CREATED,
    response_model=ChannelSummary,
)
async def create_channel(
    workspace_id: int,
    body: ChannelCreate,
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> ChannelSummary:
    async with conn.transaction():
        type_id = await conn.fetchval(
            "SELECT typeID FROM channeltype WHERE name = $1", body.type,
        )
        try:
            channel_id = await conn.fetchval(
                """
                INSERT INTO channels (workspaceID, channel_name, typeID, created_by,
                                      created_time, updated_time)
                SELECT $1, $2, $3, $4, NOW(), NOW()
                 WHERE EXISTS (
                     SELECT 1 FROM workspacemember
                      WHERE workspaceID = $1 AND userID = $4
                 )
                RETURNING channelID
                """,
                workspace_id, body.channelName, type_id, user_id,
            )
        except asyncpg.UniqueViolationError:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="channel name already exists in this workspace")
        if channel_id is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="not a member of this workspace")

        await conn.execute(
            "INSERT INTO channelmember (channelID, userID, joined_time) VALUES ($1, $2, NOW())",
            channel_id, user_id,
        )

    return ChannelSummary(
        channelId=channel_id, channelName=body.channelName, type=body.type, isMember=True,
    )


@channels_router.get("/{channel_id}", response_model=ChannelDetail)
async def get_channel(
    channel_id: int,
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> ChannelDetail:
    ch = await conn.fetchrow(
        """
        SELECT c.channelID    AS "channelId",
               c.workspaceID  AS "workspaceId",
               c.channel_name AS "channelName",
               ct.name        AS "type",
               c.created_by   AS "createdBy",
               c.created_time AS "createdTime"
          FROM channels    c
          JOIN channeltype ct ON ct.typeID = c.typeID
         WHERE c.channelID = $1
        """,
        channel_id,
    )
    if ch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="channel not found")

    if not await _is_workspace_member(conn, user_id, ch["workspaceId"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="channel not found")

    is_member = await _is_channel_member(conn, user_id, channel_id)
    if ch["type"] == "private" and not is_member:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="channel not found")

    members = await conn.fetch(
        """
        SELECT u.userID      AS "userId",
               u.username,
               u.nickname,
               cm.joined_time AS "joinedTime"
          FROM channelmember cm
          JOIN users u ON u.userID = cm.userID
         WHERE cm.channelID = $1
         ORDER BY cm.joined_time
        """,
        channel_id,
    )
    return ChannelDetail(
        **dict(ch),
        isMember=is_member,
        members=[ChannelMember(**dict(m)) for m in members],
    )


@channels_router.post("/{channel_id}/join")
async def join_channel(
    channel_id: int,
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> dict:
    ch = await conn.fetchrow(
        """
        SELECT c.workspaceID, ct.name AS type
          FROM channels c JOIN channeltype ct ON ct.typeID = c.typeID
         WHERE c.channelID = $1
        """,
        channel_id,
    )
    if ch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="channel not found")
    if not await _is_workspace_member(conn, user_id, ch["workspaceid"]):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="channel not found")
    if ch["type"] != "public":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="only public channels can be joined directly")

    await conn.execute(
        """
        INSERT INTO channelmember (channelID, userID, joined_time)
        VALUES ($1, $2, NOW())
        ON CONFLICT (channelID, userID) DO NOTHING
        """,
        channel_id, user_id,
    )
    return {"ok": True}


@channels_router.post("/{channel_id}/invitations", status_code=status.HTTP_201_CREATED)
async def invite_to_channel(
    channel_id: int,
    body: ChannelInviteCreate,
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> dict:
    ch = await conn.fetchrow(
        """
        SELECT c.workspaceID, c.created_by
          FROM channels c
         WHERE c.channelID = $1
        """,
        channel_id,
    )
    if ch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="channel not found")
    if not await _is_channel_member(conn, user_id, channel_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="must be a channel member to invite")

    invitee_id = await conn.fetchval("SELECT userID FROM users WHERE username = $1", body.username)
    if invitee_id is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user not found")
    if not await _is_workspace_member(conn, invitee_id, ch["workspaceid"]):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="invitee is not a member of this workspace")
    if await _is_channel_member(conn, invitee_id, channel_id):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="user is already a channel member")

    try:
        invitation_id = await conn.fetchval(
            """
            INSERT INTO channelinvitation
                  (channelID, invitee, inviter, invited_time, status_type)
            VALUES ($1, $2, $3, NOW(),
                    (SELECT statusID FROM status WHERE type = 'pending'))
            RETURNING invitationID
            """,
            channel_id, invitee_id, user_id,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="invitation already exists")

    return {"invitationId": invitation_id}


@me_router.get("/channel-invitations", response_model=list[ChannelInvitation])
async def my_channel_invitations(
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> list[ChannelInvitation]:
    rows = await conn.fetch(
        """
        SELECT ci.invitationID  AS "invitationId",
               c.channelID      AS "channelId",
               c.channel_name   AS "channelName",
               w.workspaceID    AS "workspaceId",
               w.name           AS "workspaceName",
               u.username       AS "inviterUsername",
               ci.invited_time  AS "invitedTime"
          FROM channelinvitation ci
          JOIN channels   c ON c.channelID   = ci.channelID
          JOIN workspaces w ON w.workspaceID = c.workspaceID
          JOIN users      u ON u.userID      = ci.inviter
          JOIN status     s ON s.statusID    = ci.status_type
         WHERE ci.invitee = $1
           AND s.type     = 'pending'
         ORDER BY ci.invited_time DESC
        """,
        user_id,
    )
    return [ChannelInvitation(**dict(r)) for r in rows]


@me_router.post("/channel-invitations/{invitation_id}")
async def respond_channel_invitation(
    invitation_id: int,
    body: InviteResponse,
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> dict:
    async with conn.transaction():
        inv = await conn.fetchrow(
            """
            SELECT ci.channelID, s.type AS status
              FROM channelinvitation ci
              JOIN status s ON s.statusID = ci.status_type
             WHERE ci.invitationID = $1
               AND ci.invitee      = $2
            """,
            invitation_id, user_id,
        )
        if inv is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="invitation not found")
        if inv["status"] != "pending":
            raise HTTPException(status.HTTP_409_CONFLICT, detail=f"invitation already {inv['status']}")

        new_status = "accepted" if body.accept else "declined"
        await conn.execute(
            "UPDATE channelinvitation SET status_type = (SELECT statusID FROM status WHERE type = $1) WHERE invitationID = $2",
            new_status, invitation_id,
        )

        if body.accept:
            await conn.execute(
                """
                INSERT INTO channelmember (channelID, userID, joined_time)
                VALUES ($1, $2, NOW())
                ON CONFLICT (channelID, userID) DO NOTHING
                """,
                inv["channelid"], user_id,
            )

    return {"ok": True, "status": new_status}
