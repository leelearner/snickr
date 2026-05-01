from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
import asyncpg

from app.api.v1 import auth as auth_router
from app.api.v1 import channels as channels_router
from app.api.v1 import workspaces as workspaces_router
from app.core.config import settings
from app.db.session import get_conn, lifespan

app = FastAPI(title="Snickr API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET,
    session_cookie="snickr_session",
    same_site="lax",
    https_only=False,
    max_age=60 * 60 * 24 * 7,
)

app.include_router(auth_router.router)
app.include_router(workspaces_router.router)
app.include_router(workspaces_router.me_router)
app.include_router(channels_router.workspace_channels_router)
app.include_router(channels_router.channels_router)
app.include_router(channels_router.me_router)


@app.get("/api/health")
async def health(conn: asyncpg.Connection = Depends(get_conn)) -> dict:
    server_time = await conn.fetchval("SELECT NOW()")
    return {"ok": True, "db": server_time.isoformat()}
