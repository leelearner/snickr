import secrets
from pathlib import Path

import asyncpg
import pytest
import pytest_asyncio
from dotenv import load_dotenv
from httpx import ASGITransport, AsyncClient

load_dotenv(Path(__file__).parent.parent / ".env")

from app.core.config import settings  # noqa: E402
from app.main import app  # noqa: E402

TEST_PREFIX = "ptest"


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def app_lifespan():
    async with app.router.lifespan_context(app):
        yield


@pytest_asyncio.fixture(loop_scope="session")
async def make_client(app_lifespan):
    opened: list[AsyncClient] = []

    async def _factory() -> AsyncClient:
        c = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
        opened.append(c)
        return c

    yield _factory
    for c in opened:
        await c.aclose()


@pytest.fixture
def uid() -> str:
    return f"{TEST_PREFIX}_{secrets.token_hex(4)}"


@pytest_asyncio.fixture(scope="session", loop_scope="session", autouse=True)
async def _cleanup_test_users(app_lifespan):
    yield
    # Drop workspaces first (CASCADE wipes channels -> messages, channelmember,
    # channelinvitation, plus workspacemember and workspaceinvitation). That clears
    # every FK back to test users that's marked NO ACTION (channels.created_by,
    # messages.posted_by, *.inviter).
    conn = await asyncpg.connect(dsn=settings.DATABASE_URL, statement_cache_size=0)
    await conn.execute(
        r"DELETE FROM workspaces WHERE created_by IN ("
        r"  SELECT userID FROM users WHERE username LIKE 'ptest\_%' ESCAPE '\'"
        r")"
    )
    n = await conn.execute(r"DELETE FROM users WHERE username LIKE 'ptest\_%' ESCAPE '\'")
    print(f"\n[cleanup] {n}")
    await conn.close()


async def register(client: AsyncClient, username: str, password: str = "pw", **extra) -> dict:
    payload = {
        "email": f"{username}@example.com",
        "username": username,
        "password": password,
        **extra,
    }
    r = await client.post("/api/auth/register", json=payload)
    assert r.status_code == 201, r.text
    return r.json()
