import pytest

from tests.conftest import register

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _setup_workspace_with_member(make_client, uid):
    """Returns (alice_client, bob_client, alice_user, bob_user, workspace_id)."""
    alice = await make_client()
    bob = await make_client()
    a = await register(alice, uid + "a")
    b = await register(bob, uid + "b")
    ws_id = (await alice.post("/api/workspaces", json={"name": f"ws_{uid}"})).json()["workspaceId"]
    await alice.post(f"/api/workspaces/{ws_id}/invitations", json={"username": b["username"]})
    inv_id = (await bob.get("/api/me/workspace-invitations")).json()[0]["invitationId"]
    await bob.post(f"/api/me/workspace-invitations/{inv_id}", json={"accept": True})
    return alice, bob, a, b, ws_id


async def test_create_channel_via_sp_succeeds_for_member(make_client, uid):
    """c.2 — create_channel_for_member SP path."""
    alice = await make_client()
    await register(alice, uid + "a")
    ws_id = (await alice.post("/api/workspaces", json={"name": f"ws_{uid}"})).json()["workspaceId"]

    r = await alice.post(f"/api/workspaces/{ws_id}/channels",
                         json={"channelName": "project", "type": "public"})
    assert r.status_code == 201
    assert r.json()["isMember"] is True


async def test_create_channel_rejects_non_member(make_client, uid):
    """SP returns NULL when the caller isn't in the workspace -> 403."""
    alice = await make_client()
    bob = await make_client()
    await register(alice, uid + "a")
    await register(bob, uid + "b")
    ws_id = (await alice.post("/api/workspaces", json={"name": f"ws_{uid}"})).json()["workspaceId"]

    r = await bob.post(f"/api/workspaces/{ws_id}/channels",
                       json={"channelName": "x", "type": "public"})
    assert r.status_code == 403


async def test_create_channel_duplicate_name_returns_409(make_client, uid):
    alice = await make_client()
    await register(alice, uid + "a")
    ws_id = (await alice.post("/api/workspaces", json={"name": f"ws_{uid}"})).json()["workspaceId"]
    await alice.post(f"/api/workspaces/{ws_id}/channels", json={"channelName": "x", "type": "public"})
    r = await alice.post(f"/api/workspaces/{ws_id}/channels", json={"channelName": "x", "type": "public"})
    assert r.status_code == 409


async def test_private_channel_hidden_from_non_member(make_client, uid):
    alice, bob, _, _, ws_id = await _setup_workspace_with_member(make_client, uid)

    pub_id = (await alice.post(f"/api/workspaces/{ws_id}/channels",
                               json={"channelName": "public-room", "type": "public"})).json()["channelId"]
    priv_id = (await alice.post(f"/api/workspaces/{ws_id}/channels",
                                json={"channelName": "exec", "type": "private"})).json()["channelId"]

    bob_list = (await bob.get(f"/api/workspaces/{ws_id}/channels")).json()
    ids = {c["channelId"] for c in bob_list}
    assert pub_id in ids
    assert priv_id not in ids  # private channel hidden

    # detail also 404s
    r = await bob.get(f"/api/channels/{priv_id}")
    assert r.status_code == 404


async def test_join_public_channel(make_client, uid):
    alice, bob, _, b, ws_id = await _setup_workspace_with_member(make_client, uid)
    pub_id = (await alice.post(f"/api/workspaces/{ws_id}/channels",
                               json={"channelName": "public-room", "type": "public"})).json()["channelId"]

    r = await bob.post(f"/api/channels/{pub_id}/join")
    assert r.status_code == 200

    detail = (await alice.get(f"/api/channels/{pub_id}")).json()
    assert b["userId"] in {m["userId"] for m in detail["members"]}


async def test_join_private_channel_rejected(make_client, uid):
    alice, bob, _, _, ws_id = await _setup_workspace_with_member(make_client, uid)
    priv_id = (await alice.post(f"/api/workspaces/{ws_id}/channels",
                                json={"channelName": "exec", "type": "private"})).json()["channelId"]
    r = await bob.post(f"/api/channels/{priv_id}/join")
    assert r.status_code in (403, 404)  # 404 if existence is hidden, 403 if rejected by type


async def test_channel_invite_accept_grants_visibility(make_client, uid):
    alice, bob, _, b, ws_id = await _setup_workspace_with_member(make_client, uid)
    priv_id = (await alice.post(f"/api/workspaces/{ws_id}/channels",
                                json={"channelName": "exec", "type": "private"})).json()["channelId"]

    r = await alice.post(f"/api/channels/{priv_id}/invitations", json={"username": b["username"]})
    assert r.status_code == 201

    invs = (await bob.get("/api/me/channel-invitations")).json()
    inv_id = next(i["invitationId"] for i in invs if i["channelId"] == priv_id)

    r = await bob.post(f"/api/me/channel-invitations/{inv_id}", json={"accept": True})
    assert r.status_code == 200

    # bob can now see the private channel
    r = await bob.get(f"/api/channels/{priv_id}")
    assert r.status_code == 200
