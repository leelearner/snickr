import pytest

from tests.conftest import register

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _two_member_channel(make_client, uid):
    """Returns (alice, bob, alice_user, bob_user, ws_id, channel_id)."""
    alice = await make_client()
    bob = await make_client()
    a = await register(alice, uid + "a")
    b = await register(bob, uid + "b")
    ws_id = (await alice.post("/api/workspaces", json={"name": f"ws_{uid}"})).json()["workspaceId"]
    await alice.post(f"/api/workspaces/{ws_id}/invitations", json={"username": b["username"]})
    inv_id = (await bob.get("/api/me/workspace-invitations")).json()[0]["invitationId"]
    await bob.post(f"/api/me/workspace-invitations/{inv_id}", json={"accept": True})
    ch_id = (await alice.post(f"/api/workspaces/{ws_id}/channels",
                              json={"channelName": "project", "type": "public"})).json()["channelId"]
    await bob.post(f"/api/channels/{ch_id}/join")
    return alice, bob, a, b, ws_id, ch_id


async def test_post_and_list_messages(make_client, uid):
    """c.5 — chronological listing."""
    alice, bob, _, _, _, ch_id = await _two_member_channel(make_client, uid)
    await alice.post(f"/api/channels/{ch_id}/messages", json={"content": "first"})
    await bob.post(f"/api/channels/{ch_id}/messages", json={"content": "second"})

    msgs = (await alice.get(f"/api/channels/{ch_id}/messages")).json()
    assert [m["content"] for m in msgs] == ["first", "second"]


async def test_non_member_cannot_post_or_read(make_client, uid):
    alice = await make_client()
    bob = await make_client()
    await register(alice, uid + "a")
    await register(bob, uid + "b")  # not in workspace
    ws_id = (await alice.post("/api/workspaces", json={"name": f"ws_{uid}"})).json()["workspaceId"]
    ch_id = (await alice.post(f"/api/workspaces/{ws_id}/channels",
                              json={"channelName": "project", "type": "public"})).json()["channelId"]

    # bob can't post
    r = await bob.post(f"/api/channels/{ch_id}/messages", json={"content": "sneak"})
    assert r.status_code == 403

    # bob can't read (privacy: 404, not 403)
    r = await bob.get(f"/api/channels/{ch_id}/messages")
    assert r.status_code == 404


async def test_user_messages_list(make_client, uid):
    """c.6 — every message a user has posted, across channels."""
    alice, _, a, _, _, ch_id = await _two_member_channel(make_client, uid)
    await alice.post(f"/api/channels/{ch_id}/messages", json={"content": "hello world"})
    await alice.post(f"/api/channels/{ch_id}/messages", json={"content": "another one"})

    msgs = (await alice.get(f"/api/users/{a['userId']}/messages")).json()
    contents = {m["content"] for m in msgs}
    assert "hello world" in contents
    assert "another one" in contents


async def test_search_respects_membership(make_client, uid):
    """c.7 — search results filtered by what the caller can see."""
    alice = await make_client()
    bob = await make_client()
    a = await register(alice, uid + "a")
    b = await register(bob, uid + "b")

    ws_id = (await alice.post("/api/workspaces", json={"name": f"ws_{uid}"})).json()["workspaceId"]
    await alice.post(f"/api/workspaces/{ws_id}/invitations", json={"username": b["username"]})
    inv_id = (await bob.get("/api/me/workspace-invitations")).json()[0]["invitationId"]
    await bob.post(f"/api/me/workspace-invitations/{inv_id}", json={"accept": True})

    pub_id = (await alice.post(f"/api/workspaces/{ws_id}/channels",
                               json={"channelName": "project", "type": "public"})).json()["channelId"]
    priv_id = (await alice.post(f"/api/workspaces/{ws_id}/channels",
                                json={"channelName": "exec", "type": "private"})).json()["channelId"]

    await bob.post(f"/api/channels/{pub_id}/join")

    needle = f"perpx_{uid}"  # unique keyword scoped to this test
    await alice.post(f"/api/channels/{pub_id}/messages",
                     json={"content": f"{needle} in public"})
    await alice.post(f"/api/channels/{priv_id}/messages",
                     json={"content": f"{needle} in private"})

    alice_hits = (await alice.get(f"/api/search?q={needle}")).json()
    bob_hits = (await bob.get(f"/api/search?q={needle}")).json()

    assert {m["content"] for m in alice_hits} == {f"{needle} in public", f"{needle} in private"}
    # bob is only in the public project channel; he must not see the private message even though it matches.
    assert {m["content"] for m in bob_hits} == {f"{needle} in public"}
