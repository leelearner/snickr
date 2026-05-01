from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
import asyncpg

from app.api.v1 import auth as auth_router
from app.core.config import settings
from app.db.session import get_conn, lifespan

app = FastAPI(
    title="Snickr API",
    version="0.1.0",
    description="Backend for the CS6083 Snickr project.",
    lifespan=lifespan,
)

# Cross-origin requests from the React dev server. With credentials=True
# the browser will send the session cookie. If the frontend uses Vite's
# server.proxy for /api, requests look same-origin and CORS is a no-op.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Signed cookie carrying { "user_id": <int> } once the user logs in.
# The cookie is itsdangerous-signed (tamper-evident); contents are NOT
# encrypted, so we only put non-sensitive identifiers in it.
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET,
    session_cookie="snickr_session",
    same_site="lax",
    https_only=False,  # set True behind HTTPS in production
    max_age=60 * 60 * 24 * 7,  # 7 days
)


app.include_router(auth_router.router)


@app.get("/api/health")
async def health(conn: asyncpg.Connection = Depends(get_conn)) -> dict:
    server_time = await conn.fetchval("SELECT NOW()")
    return {"ok": True, "db": server_time.isoformat()}
