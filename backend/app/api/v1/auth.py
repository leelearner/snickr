import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.v1.deps import current_user_id
from app.core.security import hash_password, verify_password
from app.db.session import get_conn
from app.schemas.user import ProfileUpdate, UserLogin, UserOut, UserRegister

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserOut)
async def register(
    body: UserRegister,
    request: Request,
    conn: asyncpg.Connection = Depends(get_conn),
) -> UserOut:
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
        raise HTTPException(status.HTTP_409_CONFLICT, detail="email or username already in use")

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
    # Same error message for unknown-user and bad-password to avoid leaking which usernames exist.
    if row is None or not verify_password(body.password, row["passwordHash"]):
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
    row = await conn.fetchrow(
        """
        SELECT userID       AS "userId",
               email,
               username,
               nickname,
               created_time AS "createdTime"
          FROM users
         WHERE userID = $1
        """,
        user_id,
    )
    if row is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="not authenticated")
    return UserOut(**dict(row))


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: ProfileUpdate,
    user_id: int = Depends(current_user_id),
    conn: asyncpg.Connection = Depends(get_conn),
) -> UserOut:
    new_pw_hash: str | None = None
    if body.newPassword is not None:
        if body.currentPassword is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="currentPassword is required to change password")
        stored = await conn.fetchval("SELECT password FROM users WHERE userID = $1", user_id)
        if not verify_password(body.currentPassword, stored or ""):
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="currentPassword is incorrect")
        new_pw_hash = hash_password(body.newPassword)

    try:
        row = await conn.fetchrow(
            """
            UPDATE users
               SET email        = COALESCE($1, email),
                   nickname     = COALESCE($2, nickname),
                   password     = COALESCE($3, password),
                   updated_time = NOW()
             WHERE userID = $4
            RETURNING userID       AS "userId",
                      email,
                      username,
                      nickname,
                      created_time AS "createdTime"
            """,
            body.email, body.nickname, new_pw_hash, user_id,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="email already in use")

    return UserOut(**dict(row))
