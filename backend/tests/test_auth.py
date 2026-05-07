import pytest

from tests.conftest import register

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_register_login_me_logout(make_client, uid):
    """c.1 — register + the basic session lifecycle."""
    c = await make_client()

    user = await register(c, uid, nickname="Tester")
    assert user["username"] == uid
    assert user["nickname"] == "Tester"

    # registration auto-logs-in; /me should reflect the same user
    r = await c.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json()["userId"] == user["userId"]

    # logout clears the session
    r = await c.post("/api/auth/logout")
    assert r.status_code == 200
    r = await c.get("/api/auth/me")
    assert r.status_code == 401

    # log back in
    r = await c.post("/api/auth/login", json={"username": uid, "password": "pw-12345"})
    assert r.status_code == 200


async def test_register_duplicate_returns_409(make_client, uid):
    c1 = await make_client()
    c2 = await make_client()
    await register(c1, uid)

    r = await c2.post(
        "/api/auth/register",
        json={
            "email": f"{uid}-dup@example.com",
            "username": uid,  # duplicate
            "password": "pw-12345",
        },
    )
    assert r.status_code == 409


async def test_register_normalizes_username_and_email_case(make_client, uid):
    c1 = await make_client()
    c2 = await make_client()
    c3 = await make_client()

    mixed_username = f"{uid}User"
    mixed_email = f"{uid}User@Example.COM"
    r = await c1.post(
        "/api/auth/register",
        json={
            "email": mixed_email,
            "username": mixed_username,
            "password": "pw-12345",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["email"] == mixed_email.lower()
    assert r.json()["username"] == mixed_username.lower()

    r = await c1.post("/api/auth/logout")
    assert r.status_code == 200

    r = await c2.post(
        "/api/auth/register",
        json={
            "email": f"{uid}other@example.com",
            "username": mixed_username.upper(),
            "password": "pw-12345",
        },
    )
    assert r.status_code == 409

    r = await c3.post(
        "/api/auth/register",
        json={
            "email": mixed_email.upper(),
            "username": f"{uid}other",
            "password": "pw-12345",
        },
    )
    assert r.status_code == 409

    r = await c2.post(
        "/api/auth/login", json={"username": mixed_username.upper(), "password": "pw-12345"}
    )
    assert r.status_code == 200


async def test_login_wrong_password_returns_401(make_client, uid):
    c1 = await make_client()
    c2 = await make_client()
    await register(c1, uid)

    r = await c2.post("/api/auth/login", json={"username": uid, "password": "WRONG-pw"})
    assert r.status_code == 401
    # Same message as unknown-user, to avoid leaking which usernames exist.
    assert r.json()["detail"] == "invalid credentials"


async def test_login_unknown_user_returns_401(make_client):
    c = await make_client()
    r = await c.post(
        "/api/auth/login", json={"username": "no_such_user_zzz", "password": "irrelevant"}
    )
    assert r.status_code == 401
    assert r.json()["detail"] == "invalid credentials"


async def test_profile_update_nickname(make_client, uid):
    c = await make_client()
    await register(c, uid)
    r = await c.patch("/api/auth/me", json={"nickname": "Renamed"})
    assert r.status_code == 200
    assert r.json()["nickname"] == "Renamed"


async def test_profile_password_change_requires_current(make_client, uid):
    c = await make_client()
    await register(c, uid)

    r = await c.patch("/api/auth/me", json={"newPassword": "newer-pw-1"})
    assert r.status_code == 400

    r = await c.patch(
        "/api/auth/me", json={"currentPassword": "WRONG-pw", "newPassword": "newer-pw-1"}
    )
    assert r.status_code == 403

    r = await c.patch(
        "/api/auth/me", json={"currentPassword": "pw-12345", "newPassword": "newer-pw-1"}
    )
    assert r.status_code == 200

    # Old password no longer works; new one does.
    c2 = await make_client()
    r = await c2.post("/api/auth/login", json={"username": uid, "password": "pw-12345"})
    assert r.status_code == 401
    r = await c2.post("/api/auth/login", json={"username": uid, "password": "newer-pw-1"})
    assert r.status_code == 200


async def test_profile_email_collision_returns_409(make_client, uid):
    c1 = await make_client()
    c2 = await make_client()
    await register(c1, uid)
    await register(c2, uid + "x")

    r = await c2.patch("/api/auth/me", json={"email": f"{uid}@example.com"})
    assert r.status_code == 409
