"""Authentication endpoints: register, login, logout, me."""

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.v1.deps import current_user_id
from app.core.security import hash_password, verify_password
from app.db.session import get_conn
from app.schemas.user import UserLogin, UserOut, UserRegister

router = APIRouter(prefix="/api/auth", tags=["auth"])


# Reused in /register and /me. Aliases each lowercased Postgres column
# back to the camelCase shape the frontend expects.
_USER_SELECT = """
    SELECT userID       AS "userId",
           email,
           username,
           nickname,
           created_time AS "createdTime"
      FROM users
"""


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserOut)
async def register(
    body: UserRegister,
    request: Request,
    conn: asyncpg.Connection = Depends(get_conn),
) -> UserOut:
    """Implements query (c.1) — register a new user — with bcrypt-hashed password.

    On success the new user's id is stored in the session, so the client is
    logged in immediately and does not need a follow-up POST /login.
    """
    pw_hash = hash_password(body.password)
    try:
        row = await conn.fetchrow(
            """
            INSERT INTO users (email, username, nickname, password,
                               created_time, updated_time)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            RETURNING userID       AS "userId",
                      email,
                      username,
                      nickname,
                      created_time AS "createdTime"
            """,
            body.email, body.username, body.nickname, pw_hash,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="email or username already in use",
        )

    request.session["user_id"] = row["userId"]
    return UserOut(**dict(row))


@router.post("/login", response_model=UserOut)
async def login(
    body: UserLogin,
    request: Request,
    conn: asyncpg.Connection = Depends(get_conn),
) -> UserOut:
    row = await conn.fetchrow(
        """
        SELECT userID   AS "userId",
               email,
               username,
               nickname,
               password AS "passwordHash"
          FROM users
         WHERE username = $1
        """,
        body.username,
    )
    if row is None or not verify_password(body.password, row["passwordHash"]):
        # Same message for both branches so attackers can't probe usernames.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid credentials")

    request.session["user_id"] = row["userId"]
    return UserOut(
        userId=row["userId"],
        email=row["email"],
        username=row["username"],
        nickname=row["nickname"],
    )


@router.post("/logout")
async def logout(request: Request) -> dict:
    request.session.clear()
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> UserOut:
    row = await conn.fetchrow(_USER_SELECT + " WHERE userID = $1", user_id)
    if row is None:
        # Session refers to a deleted user — clear it.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="not authenticated")
    return UserOut(**dict(row))
