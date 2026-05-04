import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.v1.deps import current_user_id
from app.db.session import get_conn
from app.schemas.workspace import (
    AdminEntry,
    InviteCreate,
    InviteResponse,
    RoleChange,
    StaleChannelInvite,
    WorkspaceCreate,
    WorkspaceDetail,
    WorkspaceInvitation,
    WorkspaceMember,
    WorkspaceSummary,
)

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])
me_router = APIRouter(prefix="/api/me", tags=["me"])


async def _require_admin(conn: asyncpg.Connection, user_id: int, workspace_id: int) -> None:
    is_admin = await conn.fetchval(
        """
        SELECT EXISTS (
            SELECT 1
              FROM workspacemember wm
              JOIN roles r ON r.roleID = wm.role
             WHERE wm.workspaceID = $1
               AND wm.userID      = $2
               AND r.name         = 'admin'
        )
        """,
        workspace_id, user_id,
    )
    if not is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="admin role required")


@router.get("", response_model=list[WorkspaceSummary])
async def list_my_workspaces(
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> list[WorkspaceSummary]:
    rows = await conn.fetch(
        """
        SELECT w.workspaceID  AS "workspaceId",
               w.name,
               w.description,
               r.name         AS "myRole"
          FROM workspacemember wm
          JOIN workspaces      w ON w.workspaceID = wm.workspaceID
          JOIN roles           r ON r.roleID      = wm.role
         WHERE wm.userID = $1
         ORDER BY w.name
        """,
        user_id,
    )
    return [WorkspaceSummary(**dict(r)) for r in rows]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=WorkspaceSummary)
async def create_workspace(
    body: WorkspaceCreate,
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> WorkspaceSummary:
    async with conn.transaction():
        ws_id = await conn.fetchval(
            """
            INSERT INTO workspaces (name, description, created_by, created_time, updated_time)
            VALUES ($1, $2, $3, NOW(), NOW())
            RETURNING workspaceID
            """,
            body.name, body.description, user_id,
        )
        admin_role_id = await conn.fetchval("SELECT roleID FROM roles WHERE name = 'admin'")
        await conn.execute(
            """
            INSERT INTO workspacemember (workspaceID, userID, role, joined_time)
            VALUES ($1, $2, $3, NOW())
            """,
            ws_id, user_id, admin_role_id,
        )
        general_channel_id = await conn.fetchval(
            "SELECT create_channel_for_member($1, $2, $3, $4)",
            ws_id, "general", "public", user_id,
        )
        if general_channel_id is None:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="failed to create default channel")
    return WorkspaceSummary(
        workspaceId=ws_id, name=body.name, description=body.description, myRole="admin",
    )


@router.get("/admins", response_model=list[AdminEntry])
async def list_all_admins(
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> list[AdminEntry]:
    rows = await conn.fetch(
        """
        SELECT w.workspaceID AS "workspaceId",
               w.name        AS "workspaceName",
               u.userID      AS "userId",
               u.username,
               u.nickname
          FROM workspaces      w
          JOIN workspacemember wm ON wm.workspaceID = w.workspaceID
          JOIN roles           r  ON r.roleID       = wm.role
          JOIN users           u  ON u.userID       = wm.userID
          JOIN workspacemember me ON me.workspaceID = w.workspaceID
         WHERE r.name = 'admin'
           AND me.userID = $1
         ORDER BY w.workspaceID, u.username
        """,
        user_id,
    )
    return [AdminEntry(**dict(r)) for r in rows]


@router.get("/{workspace_id}", response_model=WorkspaceDetail)
async def get_workspace(
    workspace_id: int,
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> WorkspaceDetail:
    ws = await conn.fetchrow(
        """
        SELECT w.workspaceID  AS "workspaceId",
               w.name,
               w.description,
               w.created_time AS "createdTime",
               w.created_by   AS "createdBy",
               r.name         AS "myRole"
          FROM workspaces      w
          JOIN workspacemember wm ON wm.workspaceID = w.workspaceID
          JOIN roles           r  ON r.roleID       = wm.role
         WHERE w.workspaceID = $1
           AND wm.userID     = $2
        """,
        workspace_id, user_id,
    )
    if ws is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="workspace not found")

    members = await conn.fetch(
        """
        SELECT u.userID      AS "userId",
               u.username,
               u.nickname,
               r.name        AS "role",
               wm.joined_time AS "joinedTime"
          FROM workspacemember wm
          JOIN users u ON u.userID = wm.userID
          JOIN roles r ON r.roleID = wm.role
         WHERE wm.workspaceID = $1
         ORDER BY r.name, u.username
        """,
        workspace_id,
    )
    return WorkspaceDetail(
        **dict(ws),
        members=[WorkspaceMember(**dict(m)) for m in members],
    )


@router.post("/{workspace_id}/invitations", status_code=status.HTTP_201_CREATED)
async def invite_to_workspace(
    workspace_id: int,
    body: InviteCreate,
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> dict:
    await _require_admin(conn, user_id, workspace_id)

    invitee_id = await conn.fetchval("SELECT userID FROM users WHERE username = $1", body.username)
    if invitee_id is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user not found")

    already_member = await conn.fetchval(
        "SELECT EXISTS(SELECT 1 FROM workspacemember WHERE workspaceID=$1 AND userID=$2)",
        workspace_id, invitee_id,
    )
    if already_member:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="user is already a member")

    try:
        invitation_id = await conn.fetchval(
            """
            INSERT INTO workspaceinvitation
                  (workspaceID, invitee, inviter, invited_time, status_type)
            VALUES ($1, $2, $3, NOW(),
                    (SELECT statusID FROM status WHERE type = 'pending'))
            RETURNING invitationID
            """,
            workspace_id, invitee_id, user_id,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="invitation already exists")

    return {"invitationId": invitation_id}


@router.get("/{workspace_id}/stale-channel-invites", response_model=list[StaleChannelInvite])
async def stale_channel_invites(
    workspace_id: int,
    _: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> list[StaleChannelInvite]:
    rows = await conn.fetch(
        """
        SELECT c.channelID    AS "channelId",
               c.channel_name AS "channelName",
               COUNT(ci.invitationID) AS "pendingInvitesOver5Days"
          FROM channels    c
          JOIN channeltype ct ON ct.typeID = c.typeID
          LEFT JOIN channelinvitation ci
                 ON ci.channelID    = c.channelID
                AND ci.invited_time < NOW() - INTERVAL '5 days'
                AND ci.status_type  = (SELECT statusID FROM status WHERE type = 'pending')
                AND NOT EXISTS (
                      SELECT 1 FROM channelmember cm
                      WHERE cm.channelID = ci.channelID AND cm.userID = ci.invitee
                )
         WHERE c.workspaceID = $1
           AND ct.name       = 'public'
         GROUP BY c.channelID, c.channel_name
        HAVING COUNT(ci.invitationID) > 0
         ORDER BY c.channel_name
        """,
        workspace_id,
    )
    return [StaleChannelInvite(**dict(r)) for r in rows]


async def _admin_count(conn: asyncpg.Connection, workspace_id: int) -> int:
    return int(await conn.fetchval(
        """
        SELECT COUNT(*)
          FROM workspacemember wm
          JOIN roles r ON r.roleID = wm.role
         WHERE wm.workspaceID = $1 AND r.name = 'admin'
        """,
        workspace_id,
    ))


@router.delete("/{workspace_id}/members/{target_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    workspace_id: int,
    target_user_id: int,
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> None:
    await _require_admin(conn, user_id, workspace_id)

    target = await conn.fetchrow(
        """
        SELECT r.name AS role
          FROM workspacemember wm
          JOIN roles r ON r.roleID = wm.role
         WHERE wm.workspaceID = $1 AND wm.userID = $2
        """,
        workspace_id, target_user_id,
    )
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user is not a member of this workspace")

    if target["role"] == "admin" and await _admin_count(conn, workspace_id) == 1:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="cannot remove the last admin")

    async with conn.transaction():
        await conn.execute(
            """
            DELETE FROM channelmember
             WHERE userID = $1
               AND channelID IN (SELECT channelID FROM channels WHERE workspaceID = $2)
            """,
            target_user_id, workspace_id,
        )
        await conn.execute(
            "DELETE FROM workspacemember WHERE workspaceID = $1 AND userID = $2",
            workspace_id, target_user_id,
        )


@router.patch("/{workspace_id}/members/{target_user_id}/role")
async def change_member_role(
    workspace_id: int,
    target_user_id: int,
    body: RoleChange,
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> dict:
    await _require_admin(conn, user_id, workspace_id)

    current = await conn.fetchval(
        """
        SELECT r.name
          FROM workspacemember wm
          JOIN roles r ON r.roleID = wm.role
         WHERE wm.workspaceID = $1 AND wm.userID = $2
        """,
        workspace_id, target_user_id,
    )
    if current is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user is not a member of this workspace")
    if current == body.role:
        return {"ok": True, "role": body.role}

    if current == "admin" and body.role == "member" and await _admin_count(conn, workspace_id) == 1:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="cannot demote the last admin")

    await conn.execute(
        """
        UPDATE workspacemember
           SET role = (SELECT roleID FROM roles WHERE name = $1)
         WHERE workspaceID = $2 AND userID = $3
        """,
        body.role, workspace_id, target_user_id,
    )
    return {"ok": True, "role": body.role}


@me_router.get("/workspace-invitations", response_model=list[WorkspaceInvitation])
async def my_workspace_invitations(
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> list[WorkspaceInvitation]:
    rows = await conn.fetch(
        """
        SELECT wi.invitationID AS "invitationId",
               w.workspaceID   AS "workspaceId",
               w.name          AS "workspaceName",
               u.username      AS "inviterUsername",
               wi.invited_time AS "invitedTime"
          FROM workspaceinvitation wi
          JOIN workspaces w ON w.workspaceID = wi.workspaceID
          JOIN users      u ON u.userID      = wi.inviter
          JOIN status     s ON s.statusID    = wi.status_type
         WHERE wi.invitee = $1
           AND s.type     = 'pending'
         ORDER BY wi.invited_time DESC
        """,
        user_id,
    )
    return [WorkspaceInvitation(**dict(r)) for r in rows]


@me_router.post("/workspace-invitations/{invitation_id}")
async def respond_workspace_invitation(
    invitation_id: int,
    body: InviteResponse,
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> dict:
    if body.accept:
        # Stored procedure flips status -> accepted and inserts workspacemember atomically.
        try:
            workspace_id = await conn.fetchval(
                "SELECT accept_workspace_invitation($1, $2)", invitation_id, user_id,
            )
        except asyncpg.RaiseError as e:
            raise HTTPException(status.HTTP_409_CONFLICT, detail=str(e))
        if workspace_id is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="invitation not found")
        return {"ok": True, "status": "accepted"}

    async with conn.transaction():
        inv = await conn.fetchrow(
            """
            SELECT s.type AS status
              FROM workspaceinvitation wi
              JOIN status s ON s.statusID = wi.status_type
             WHERE wi.invitationID = $1
               AND wi.invitee      = $2
            """,
            invitation_id, user_id,
        )
        if inv is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="invitation not found")
        if inv["status"] != "pending":
            raise HTTPException(status.HTTP_409_CONFLICT, detail=f"invitation already {inv['status']}")

        await conn.execute(
            """
            UPDATE workspaceinvitation
               SET status_type = (SELECT statusID FROM status WHERE type = 'declined')
             WHERE invitationID = $1
            """,
            invitation_id,
        )
    return {"ok": True, "status": "declined"}
