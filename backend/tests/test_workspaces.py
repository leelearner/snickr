import pytest

from tests.conftest import register

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_create_workspace_makes_creator_admin(make_client, uid):
    c = await make_client()
    await register(c, uid)
    r = await c.post("/api/workspaces", json={"name": f"ws_{uid}", "description": "x"})
    assert r.status_code == 201
    assert r.json()["myRole"] == "admin"


async def test_invite_accept_flow(make_client, uid):
    """alice creates workspace, invites bob, bob accepts, both appear in detail."""
    alice = await make_client()
    bob = await make_client()

    a = await register(alice, uid + "a")
    b = await register(bob, uid + "b")

    ws = (await alice.post("/api/workspaces", json={"name": f"ws_{uid}"})).json()
    ws_id = ws["workspaceId"]

    r = await alice.post(f"/api/workspaces/{ws_id}/invitations", json={"username": b["username"]})
    assert r.status_code == 201

    invs = (await bob.get("/api/me/workspace-invitations")).json()
    assert len(invs) == 1
    inv_id = invs[0]["invitationId"]

    r = await bob.post(f"/api/me/workspace-invitations/{inv_id}", json={"accept": True})
    assert r.status_code == 200
    assert r.json()["status"] == "accepted"

    # bob's workspace list now includes ws
    bob_ws = (await bob.get("/api/workspaces")).json()
    assert any(w["workspaceId"] == ws_id for w in bob_ws)
    # workspace detail shows both members
    detail = (await alice.get(f"/api/workspaces/{ws_id}")).json()
    usernames = {m["username"] for m in detail["members"]}
    assert {a["username"], b["username"]} <= usernames


async def test_invite_double_accept_returns_409(make_client, uid):
    """SP raises 'invitation already accepted' on second call."""
    alice = await make_client()
    bob = await make_client()
    await register(alice, uid + "a")
    b = await register(bob, uid + "b")

    ws_id = (await alice.post("/api/workspaces", json={"name": f"ws_{uid}"})).json()["workspaceId"]
    await alice.post(f"/api/workspaces/{ws_id}/invitations", json={"username": b["username"]})
    inv_id = (await bob.get("/api/me/workspace-invitations")).json()[0]["invitationId"]

    await bob.post(f"/api/me/workspace-invitations/{inv_id}", json={"accept": True})
    r = await bob.post(f"/api/me/workspace-invitations/{inv_id}", json={"accept": True})
    assert r.status_code == 409


async def test_non_admin_cannot_invite(make_client, uid):
    alice = await make_client()
    bob = await make_client()
    carol = await make_client()
    await register(alice, uid + "a")
    b = await register(bob, uid + "b")
    c_user = await register(carol, uid + "c")

    ws_id = (await alice.post("/api/workspaces", json={"name": f"ws_{uid}"})).json()["workspaceId"]
    await alice.post(f"/api/workspaces/{ws_id}/invitations", json={"username": b["username"]})
    inv_id = (await bob.get("/api/me/workspace-invitations")).json()[0]["invitationId"]
    await bob.post(f"/api/me/workspace-invitations/{inv_id}", json={"accept": True})

    # bob is now a member but not admin -> cannot invite carol
    r = await bob.post(f"/api/workspaces/{ws_id}/invitations", json={"username": c_user["username"]})
    assert r.status_code == 403


async def test_admin_promote_demote_and_last_admin_guard(make_client, uid):
    alice = await make_client()
    bob = await make_client()
    await register(alice, uid + "a")
    b = await register(bob, uid + "b")

    ws_id = (await alice.post("/api/workspaces", json={"name": f"ws_{uid}"})).json()["workspaceId"]
    await alice.post(f"/api/workspaces/{ws_id}/invitations", json={"username": b["username"]})
    inv_id = (await bob.get("/api/me/workspace-invitations")).json()[0]["invitationId"]
    await bob.post(f"/api/me/workspace-invitations/{inv_id}", json={"accept": True})

    # alice is the only admin; demoting her must fail.
    a_user_id = (await alice.get("/api/auth/me")).json()["userId"]
    r = await alice.patch(f"/api/workspaces/{ws_id}/members/{a_user_id}/role", json={"role": "member"})
    assert r.status_code == 409

    # promote bob
    r = await alice.patch(f"/api/workspaces/{ws_id}/members/{b['userId']}/role", json={"role": "admin"})
    assert r.status_code == 200

    # now alice CAN be demoted (bob is also admin)
    r = await alice.patch(f"/api/workspaces/{ws_id}/members/{a_user_id}/role", json={"role": "member"})
    assert r.status_code == 200


async def test_remove_member_kicks_from_channels_too(make_client, uid):
    alice = await make_client()
    bob = await make_client()
    await register(alice, uid + "a")
    b = await register(bob, uid + "b")

    ws_id = (await alice.post("/api/workspaces", json={"name": f"ws_{uid}"})).json()["workspaceId"]
    await alice.post(f"/api/workspaces/{ws_id}/invitations", json={"username": b["username"]})
    inv_id = (await bob.get("/api/me/workspace-invitations")).json()[0]["invitationId"]
    await bob.post(f"/api/me/workspace-invitations/{inv_id}", json={"accept": True})

    ch_id = (await alice.post(f"/api/workspaces/{ws_id}/channels",
                              json={"channelName": "ops", "type": "public"})).json()["channelId"]
    await bob.post(f"/api/channels/{ch_id}/join")

    # confirm bob is in the channel
    detail = (await alice.get(f"/api/channels/{ch_id}")).json()
    assert b["userId"] in {m["userId"] for m in detail["members"]}

    # remove bob from workspace
    r = await alice.delete(f"/api/workspaces/{ws_id}/members/{b['userId']}")
    assert r.status_code == 204

    # he's no longer in the channel either
    detail = (await alice.get(f"/api/channels/{ch_id}")).json()
    assert b["userId"] not in {m["userId"] for m in detail["members"]}


async def test_admins_endpoint_includes_my_workspace_admins(make_client, uid):
    """c.3 — list all admins. We just verify our own workspace's admin shows up."""
    alice = await make_client()
    await register(alice, uid + "a")
    ws = (await alice.post("/api/workspaces", json={"name": f"ws_{uid}"})).json()
    a_user_id = (await alice.get("/api/auth/me")).json()["userId"]

    rows = (await alice.get("/api/workspaces/admins")).json()
    assert any(
        r["workspaceId"] == ws["workspaceId"] and r["userId"] == a_user_id
        for r in rows
    )


async def test_stale_channel_invites_endpoint_smoke(make_client, uid):
    """c.4 — endpoint runs on an empty workspace and returns []."""
    alice = await make_client()
    await register(alice, uid + "a")
    ws_id = (await alice.post("/api/workspaces", json={"name": f"ws_{uid}"})).json()["workspaceId"]
    r = await alice.get(f"/api/workspaces/{ws_id}/stale-channel-invites")
    assert r.status_code == 200
    assert r.json() == []
