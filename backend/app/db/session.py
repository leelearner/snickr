from contextlib import asynccontextmanager
from typing import AsyncIterator

import asyncpg
from fastapi import FastAPI, Request

from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        min_size=1,
        max_size=10,
        # 0 disables asyncpg's per-connection prepared-statement cache so the
        # same SQL can be re-issued through Supabase's pooler without name clashes.
        statement_cache_size=0,
    )
    try:
        yield
    finally:
        await app.state.pool.close()


async def get_conn(request: Request) -> AsyncIterator[asyncpg.Connection]:
    pool: asyncpg.Pool = request.app.state.pool
    async with pool.acquire() as conn:
        yield conn
