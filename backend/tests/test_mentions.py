import pytest

from tests.conftest import register

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _three_member_channel(make_client, uid):
    """Returns (alice, bob, carol, a, b, c, ws_id, ch_id) with all three in the channel."""
    alice = await make_client()
    bob = await make_client()
    carol = await make_client()
    a = await register(alice, uid + "a")
    b = await register(bob, uid + "b")
    c = await register(carol, uid + "c")

    ws_id = (await alice.post("/api/workspaces", json={"name": f"ws_{uid}"})).json()["workspaceId"]
    for invitee in (b, c):
        await alice.post(
            f"/api/workspaces/{ws_id}/invitations", json={"username": invitee["username"]}
        )
    inv_b = (await bob.get("/api/me/workspace-invitations")).json()[0]["invitationId"]
    inv_c = (await carol.get("/api/me/workspace-invitations")).json()[0]["invitationId"]
    await bob.post(f"/api/me/workspace-invitations/{inv_b}", json={"accept": True})
    await carol.post(f"/api/me/workspace-invitations/{inv_c}", json={"accept": True})

    ch_id = (
        await alice.post(
            f"/api/workspaces/{ws_id}/channels", json={"channelName": "team", "type": "public"}
        )
    ).json()["channelId"]
    await bob.post(f"/api/channels/{ch_id}/join")
    await carol.post(f"/api/channels/{ch_id}/join")
    return alice, bob, carol, a, b, c, ws_id, ch_id


async def test_mention_creates_inbox_entry(make_client, uid):
    alice, bob, _, a, b, _, _, ch_id = await _three_member_channel(make_client, uid)
    await alice.post(
        f"/api/channels/{ch_id}/messages", json={"content": f"hey @{b['username']} look at this"}
    )

    inbox = (await bob.get("/api/me/mentions")).json()
    assert len(inbox) == 1
    assert inbox[0]["postedByUsername"] == a["username"]
    assert b["username"] in inbox[0]["content"]
    assert inbox[0]["channelId"] == ch_id


async def test_mentioning_non_channel_member_is_silently_dropped(make_client, uid):
    """Carol is in the workspace but not in the channel; mentioning her must not insert a row."""
    alice = await make_client()
    bob = await make_client()
    carol = await make_client()
    await register(alice, uid + "a")
    b = await register(bob, uid + "b")
    c = await register(carol, uid + "c")

    ws_id = (await alice.post("/api/workspaces", json={"name": f"ws_{uid}"})).json()["workspaceId"]
    for invitee in (b, c):
        await alice.post(
            f"/api/workspaces/{ws_id}/invitations", json={"username": invitee["username"]}
        )
    inv_b = (await bob.get("/api/me/workspace-invitations")).json()[0]["invitationId"]
    inv_c = (await carol.get("/api/me/workspace-invitations")).json()[0]["invitationId"]
    await bob.post(f"/api/me/workspace-invitations/{inv_b}", json={"accept": True})
    await carol.post(f"/api/me/workspace-invitations/{inv_c}", json={"accept": True})

    # Private channel, only alice and bob
    ch_id = (
        await alice.post(
            f"/api/workspaces/{ws_id}/channels", json={"channelName": "exec", "type": "private"}
        )
    ).json()["channelId"]
    # Invite bob to the channel
    await alice.post(f"/api/channels/{ch_id}/invitations", json={"username": b["username"]})
    cinv = (await bob.get("/api/me/channel-invitations")).json()[0]["invitationId"]
    await bob.post(f"/api/me/channel-invitations/{cinv}", json={"accept": True})

    # Alice mentions carol who is not a channel member
    await alice.post(
        f"/api/channels/{ch_id}/messages", json={"content": f"private @{c['username']} note"}
    )

    assert (await carol.get("/api/me/mentions")).json() == []


async def test_editing_message_resyncs_mentions(make_client, uid):
    alice, bob, carol, _, b, c, _, ch_id = await _three_member_channel(make_client, uid)
    posted = (
        await alice.post(
            f"/api/channels/{ch_id}/messages", json={"content": f"hi @{b['username']}"}
        )
    ).json()
    assert len((await bob.get("/api/me/mentions")).json()) == 1
    assert (await carol.get("/api/me/mentions")).json() == []

    # Replace bob's mention with carol's
    await alice.patch(
        f"/api/channels/{ch_id}/messages/{posted['messageId']}",
        json={"content": f"actually @{c['username']}"},
    )

    assert (await bob.get("/api/me/mentions")).json() == []
    assert len((await carol.get("/api/me/mentions")).json()) == 1


async def test_deleting_message_clears_mention(make_client, uid):
    alice, bob, _, _, b, _, _, ch_id = await _three_member_channel(make_client, uid)
    posted = (
        await alice.post(
            f"/api/channels/{ch_id}/messages", json={"content": f"@{b['username']} ping"}
        )
    ).json()
    assert len((await bob.get("/api/me/mentions")).json()) == 1

    await alice.delete(f"/api/channels/{ch_id}/messages/{posted['messageId']}")
    assert (await bob.get("/api/me/mentions")).json() == []


async def test_join_inserts_system_message_and_kind_join_for_creator(make_client, uid):
    """When bob joins alice's public channel, alice should get a kind=join inbox entry."""
    alice = await make_client()
    bob = await make_client()
    a = await register(alice, uid + "a")
    b = await register(bob, uid + "b")

    ws_id = (await alice.post("/api/workspaces", json={"name": f"ws_{uid}"})).json()["workspaceId"]
    await alice.post(f"/api/workspaces/{ws_id}/invitations", json={"username": b["username"]})
    inv_b = (await bob.get("/api/me/workspace-invitations")).json()[0]["invitationId"]
    await bob.post(f"/api/me/workspace-invitations/{inv_b}", json={"accept": True})

    ch_id = (
        await alice.post(
            f"/api/workspaces/{ws_id}/channels", json={"channelName": "team", "type": "public"}
        )
    ).json()["channelId"]
    await bob.post(f"/api/channels/{ch_id}/join")

    msgs = (await alice.get(f"/api/channels/{ch_id}/messages")).json()
    join_msgs = [m for m in msgs if m.get("systemKind") == "join"]
    assert len(join_msgs) == 1
    assert join_msgs[0]["postedBy"] == b["userId"]
    assert join_msgs[0]["content"] == "joined the channel"

    inbox = (await alice.get("/api/me/mentions")).json()
    join_inbox = [m for m in inbox if m["kind"] == "join"]
    assert len(join_inbox) == 1
    assert join_inbox[0]["channelId"] == ch_id
    assert join_inbox[0]["postedByUsername"] == b["username"]
    _ = a  # silence unused


async def test_system_message_cannot_be_edited_or_deleted(make_client, uid):
    alice = await make_client()
    bob = await make_client()
    await register(alice, uid + "a")
    b = await register(bob, uid + "b")

    ws_id = (await alice.post("/api/workspaces", json={"name": f"ws_{uid}"})).json()["workspaceId"]
    await alice.post(f"/api/workspaces/{ws_id}/invitations", json={"username": b["username"]})
    inv_b = (await bob.get("/api/me/workspace-invitations")).json()[0]["invitationId"]
    await bob.post(f"/api/me/workspace-invitations/{inv_b}", json={"accept": True})

    ch_id = (
        await alice.post(
            f"/api/workspaces/{ws_id}/channels", json={"channelName": "team", "type": "public"}
        )
    ).json()["channelId"]
    await bob.post(f"/api/channels/{ch_id}/join")

    msgs = (await alice.get(f"/api/channels/{ch_id}/messages")).json()
    join_id = next(m["messageId"] for m in msgs if m.get("systemKind") == "join")

    # bob is the "posted_by" of the system message but should still be blocked
    r = await bob.patch(f"/api/channels/{ch_id}/messages/{join_id}", json={"content": "ha"})
    assert r.status_code == 403
    r = await bob.delete(f"/api/channels/{ch_id}/messages/{join_id}")
    assert r.status_code == 403


async def test_dm_message_creates_kind_dm_inbox(make_client, uid):
    alice = await make_client()
    bob = await make_client()
    await register(alice, uid + "a")
    b = await register(bob, uid + "b")

    ws_id = (await alice.post("/api/workspaces", json={"name": f"ws_{uid}"})).json()["workspaceId"]
    await alice.post(f"/api/workspaces/{ws_id}/invitations", json={"username": b["username"]})
    inv_b = (await bob.get("/api/me/workspace-invitations")).json()[0]["invitationId"]
    await bob.post(f"/api/me/workspace-invitations/{inv_b}", json={"accept": True})

    dm_id = (
        await alice.post(
            f"/api/workspaces/{ws_id}/direct-messages", json={"targetUserId": b["userId"]}
        )
    ).json()["channelId"]
    await alice.post(f"/api/channels/{dm_id}/messages", json={"content": "hi"})

    inbox = (await bob.get("/api/me/mentions")).json()
    dms = [m for m in inbox if m["kind"] == "dm"]
    assert len(dms) == 1
    assert dms[0]["channelId"] == dm_id
    assert dms[0]["channelType"] == "direct"
