"""Postgres connection pool, exposed as a FastAPI dependency.

Every database call in the app goes through this module so we have one
place to control:
  - prepared-statement / parameter binding (asyncpg's `$1, $2, ...` form
    serves as our SQL injection defense — user input is bound, never
    string-concatenated into the SQL),
  - transaction boundaries (`async with conn.transaction():`),
  - connection lifetime (acquired per request, returned to the pool).
"""

from contextlib import asynccontextmanager
from typing import AsyncIterator

import asyncpg
from fastapi import FastAPI, Request

from app.core.config import settings


async def init_pool(app: FastAPI) -> None:
    app.state.pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        min_size=1,
        max_size=10,
        # asyncpg uses Postgres's native PREPARE protocol per query.
        # Disabling statement_cache lets us re-issue the same SQL through
        # Supabase's transaction pooler without name collisions; for the
        # session pooler this could be left at the default.
        statement_cache_size=0,
    )


async def close_pool(app: FastAPI) -> None:
    await app.state.pool.close()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await init_pool(app)
    try:
        yield
    finally:
        await close_pool(app)


async def get_conn(request: Request) -> AsyncIterator[asyncpg.Connection]:
    """FastAPI dependency: hand a pooled connection to the route, return it on exit."""
    pool: asyncpg.Pool = request.app.state.pool
    async with pool.acquire() as conn:
        yield conn
