"""Seed the database with demo data for the Project 2 walkthrough.

Wipes every data table, keeps the lookup tables, then inserts a small but
realistic dataset: two workspaces, eight users, public/private/DM channels,
a few dozen messages with @mentions, one pending workspace invitation, and
one stale channel invitation older than five days.

Run with the snickr conda env active:
    python database/seeds/demo_seed.py
"""

import asyncio
import re
from datetime import timedelta
from pathlib import Path

import asyncpg
import bcrypt

ROOT = Path(__file__).resolve().parent.parent.parent
PASSWORD = "demopass1"
PASSWORD_HASH = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode()

USERS = [
    ("chess@nyu.edu", "chess", "Chess Xu"),
    ("xingyu@nyu.edu", "xingyu", "Xingyu Li"),
    ("alice@nyu.edu", "alice", "Alice Chen"),
    ("bob@nyu.edu", "bob", "Bob Garcia"),
    ("carol@nyu.edu", "carol", "Carol Patel"),
    ("dave@nyu.edu", "dave", "Dave Kim"),
    ("prof@nyu.edu", "prof", "Prof Davies"),
    ("newcomer@nyu.edu", "newcomer", "Newcomer"),
]


def load_dsn() -> str:
    for line in (ROOT / "backend" / ".env").read_text().splitlines():
        line = line.strip()
        if line.startswith("DATABASE_URL="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("DATABASE_URL not found in backend/.env")


MENTION_PATTERN = re.compile(r"@([A-Za-z0-9_.]+)")


async def post(conn, channel_id, author_id, content, ago_seconds, parent_id=None):
    """Insert a message with backdated posted_time and parse @mentions."""
    delta = timedelta(seconds=ago_seconds)
    msg_id = await conn.fetchval(
        """
        INSERT INTO messages (channelID, content, posted_time, posted_by, parent_messageID)
        VALUES ($1, $2, timezone('America/New_York', NOW() - $3::interval), $4, $5)
        RETURNING messageID
        """,
        channel_id,
        content,
        delta,
        author_id,
        parent_id,
    )
    handles = list({m.group(1) for m in MENTION_PATTERN.finditer(content)})
    if not handles:
        return msg_id
    rows = await conn.fetch(
        """
        SELECT u.userID
          FROM users u
          JOIN channelmember cm ON cm.userID = u.userID
         WHERE u.username = ANY($1::text[])
           AND cm.channelID = $2
        """,
        handles,
        channel_id,
    )
    for row in rows:
        await conn.execute(
            """
            INSERT INTO mentions (messageID, mentioned_user, created_time)
            VALUES ($1, $2, timezone('America/New_York', NOW() - $3::interval))
            ON CONFLICT (messageID, mentioned_user) DO NOTHING
            """,
            msg_id,
            row["userid"],
            delta,
        )
    return msg_id


async def post_dm(conn, channel_id, author_id, partner_id, content, ago_seconds):
    """A DM post auto-creates a mention row for the other participant."""
    delta = timedelta(seconds=ago_seconds)
    msg_id = await conn.fetchval(
        """
        INSERT INTO messages (channelID, content, posted_time, posted_by)
        VALUES ($1, $2, timezone('America/New_York', NOW() - $3::interval), $4)
        RETURNING messageID
        """,
        channel_id,
        content,
        delta,
        author_id,
    )
    await conn.execute(
        """
        INSERT INTO mentions (messageID, mentioned_user, created_time)
        VALUES ($1, $2, timezone('America/New_York', NOW() - $3::interval))
        """,
        msg_id,
        partner_id,
        delta,
    )
    return msg_id


HOURS = 3600
DAYS = 86400


async def seed():
    conn = await asyncpg.connect(load_dsn())
    try:
        async with conn.transaction():
            await conn.execute(
                """
                TRUNCATE TABLE
                  users, workspaces, workspacemember, workspaceinvitation,
                  channels, channelmember, channelinvitation, messages, mentions
                RESTART IDENTITY CASCADE
                """
            )

            uid = {}
            for email, username, nickname in USERS:
                uid[username] = await conn.fetchval(
                    """
                    INSERT INTO users (email, username, nickname, password)
                    VALUES ($1, $2, $3, $4)
                    RETURNING userID
                    """,
                    email,
                    username,
                    nickname,
                    PASSWORD_HASH,
                )

            admin_role = await conn.fetchval("SELECT roleID FROM roles WHERE name='admin'")
            member_role = await conn.fetchval("SELECT roleID FROM roles WHERE name='member'")
            pending = await conn.fetchval("SELECT statusID FROM status WHERE type='pending'")
            t_pub = await conn.fetchval("SELECT typeID FROM channeltype WHERE name='public'")
            t_priv = await conn.fetchval("SELECT typeID FROM channeltype WHERE name='private'")
            t_dm = await conn.fetchval("SELECT typeID FROM channeltype WHERE name='direct'")

            # ============= Workspace 1: NYU CS6083 =============
            ws1 = await conn.fetchval(
                """
                INSERT INTO workspaces (name, description, created_by)
                VALUES ('NYU CS6083', 'Database systems course project space', $1)
                RETURNING workspaceID
                """,
                uid["chess"],
            )

            ws1_members = [
                ("chess", admin_role),
                ("xingyu", admin_role),
                ("prof", admin_role),
                ("alice", member_role),
                ("bob", member_role),
                ("carol", member_role),
            ]
            for u, role in ws1_members:
                await conn.execute(
                    """
                    INSERT INTO workspacemember (workspaceID, userID, role, joined_time)
                    VALUES ($1, $2, $3, NOW() - INTERVAL '7 days')
                    """,
                    ws1,
                    uid[u],
                    role,
                )

            async def make_channel(ws, name, typ, creator):
                cid = await conn.fetchval(
                    """
                    INSERT INTO channels (workspaceID, channel_name, typeID, created_by,
                                          created_time, updated_time)
                    VALUES ($1, $2, $3, $4,
                            NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days')
                    RETURNING channelID
                    """,
                    ws,
                    name,
                    typ,
                    uid[creator],
                )
                return cid

            ch_general1 = await make_channel(ws1, "general", t_pub, "chess")
            ch_proj = await make_channel(ws1, "project-snickr", t_pub, "chess")
            ch_help = await make_channel(ws1, "help", t_pub, "xingyu")
            ch_office = await make_channel(ws1, "office-hours", t_priv, "prof")

            for ch in (ch_general1, ch_proj, ch_help):
                for u in ("chess", "xingyu", "alice", "bob", "carol", "prof"):
                    await conn.execute(
                        """
                        INSERT INTO channelmember (channelID, userID, joined_time)
                        VALUES ($1, $2, NOW() - INTERVAL '7 days')
                        ON CONFLICT DO NOTHING
                        """,
                        ch,
                        uid[u],
                    )

            for u in ("prof", "chess"):
                await conn.execute(
                    """
                    INSERT INTO channelmember (channelID, userID, joined_time)
                    VALUES ($1, $2, NOW() - INTERVAL '6 days')
                    ON CONFLICT DO NOTHING
                    """,
                    ch_office,
                    uid[u],
                )

            general1_msgs = [
                ("chess", "Welcome to CS6083 Spring 2026!", 6 * DAYS),
                ("prof", "Project 1 reports are due this Friday.", 5 * DAYS + 4 * HOURS),
                ("alice", "Anyone else stuck on the cardinality of channel invitations?", 5 * DAYS),
                ("bob", "@alice yeah, ping me in #help and I'll show you my draft.", 5 * DAYS - HOURS),
                ("carol", "Thanks @prof, just submitted Part 1.", 4 * DAYS),
                ("xingyu", "Reminder: Part 2 demo is May 8. Two days to go!", 30 * HOURS),
                ("chess", "@xingyu I'll seed the demo database, you finish the slides?", 28 * HOURS),
                ("xingyu", "Deal.", 27 * HOURS),
            ]
            for author, content, ago in general1_msgs:
                await post(conn, ch_general1, uid[author], content, ago)

            proj_msgs = [
                ("chess", "Backend is now FastAPI + asyncpg. Two stored procedures shipped.", 4 * DAYS),
                ("xingyu", "Frontend is Vite + React + Tailwind. Auth context wired up.", 4 * DAYS - HOURS),
                ("chess", "Mention parser ships with 004_mentions.sql. Posts containing @bob create a row in mentions.", 3 * DAYS),
                ("bob", "Confirmed @chess, the Inbox shows my mentions correctly.", 3 * DAYS - 2 * HOURS),
                ("alice", "Search across channels also works. @chess nice work on the access filter.", 3 * DAYS - 4 * HOURS),
                ("xingyu", "I added the bold/italic markdown render to messages, looks like Slack now.", 2 * DAYS),
                ("chess", "Black and flake8 are now in CI for the backend.", 36 * HOURS),
                ("chess", "ESLint and Prettier added on the frontend side too.", 35 * HOURS),
                ("xingyu", "Last todo: write the user manual section in the report.", 12 * HOURS),
            ]
            for author, content, ago in proj_msgs:
                await post(conn, ch_proj, uid[author], content, ago)

            help_msgs = [
                ("alice", "@bob I'm here. Cardinality between User and Workspace is M:N.", 5 * DAYS - 2 * HOURS),
                ("bob", "Got it. So workspacemember is the join table with a role attribute.", 5 * DAYS - 3 * HOURS),
                ("alice", "Right, role is a foreign key into the roles lookup table.", 5 * DAYS - 4 * HOURS),
                ("carol", "Do we need a separate notifications table for Project 2?", 2 * DAYS),
                ("chess", "@carol no, we reuse the mentions table for Inbox events. Three classifications: mention, dm, join.", 2 * DAYS - HOURS),
                ("carol", "Clever. Saves a table.", 2 * DAYS - 2 * HOURS),
            ]
            for author, content, ago in help_msgs:
                await post(conn, ch_help, uid[author], content, ago)

            office_msgs = [
                ("chess", "Hi Prof, can I demo on May 8 at 10am?", 4 * DAYS),
                ("prof", "Yes, 10am works. Bring the seed data and a session log.", 4 * DAYS - HOURS),
                ("chess", "Will do, thanks!", 4 * DAYS - 2 * HOURS),
            ]
            for author, content, ago in office_msgs:
                await post(conn, ch_office, uid[author], content, ago)

            # ============= Workspace 2: Roommates =============
            ws2 = await conn.fetchval(
                """
                INSERT INTO workspaces (name, description, created_by, created_time, updated_time)
                VALUES ('Roommates', 'Apartment chat', $1,
                        NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days')
                RETURNING workspaceID
                """,
                uid["alice"],
            )

            for u, role in [("alice", admin_role), ("chess", member_role), ("bob", member_role)]:
                await conn.execute(
                    """
                    INSERT INTO workspacemember (workspaceID, userID, role, joined_time)
                    VALUES ($1, $2, $3, NOW() - INTERVAL '25 days')
                    """,
                    ws2,
                    uid[u],
                    role,
                )

            ch_general2 = await make_channel(ws2, "general", t_pub, "alice")
            ch_clean = await make_channel(ws2, "cleaning", t_pub, "alice")
            ch_snacks = await make_channel(ws2, "snacks", t_priv, "alice")

            for ch in (ch_general2, ch_clean):
                for u in ("alice", "chess", "bob"):
                    await conn.execute(
                        """
                        INSERT INTO channelmember (channelID, userID, joined_time)
                        VALUES ($1, $2, NOW() - INTERVAL '25 days')
                        ON CONFLICT DO NOTHING
                        """,
                        ch,
                        uid[u],
                    )
            for u in ("alice", "chess"):
                await conn.execute(
                    """
                    INSERT INTO channelmember (channelID, userID, joined_time)
                    VALUES ($1, $2, NOW() - INTERVAL '20 days')
                    ON CONFLICT DO NOTHING
                    """,
                    ch_snacks,
                    uid[u],
                )

            ws2_msgs = [
                (ch_general2, "alice", "Trash day is Tuesday this week.", 6 * DAYS),
                (ch_general2, "bob", "Got it.", 6 * DAYS - HOURS),
                (ch_general2, "chess", "My exam ends Friday, I'll help with cleaning after.", 2 * DAYS),
                (ch_clean, "alice", "Kitchen this week, please.", 4 * DAYS),
                (ch_clean, "bob", "I'll do it Saturday.", 4 * DAYS - 2 * HOURS),
                (ch_snacks, "alice", "I bought oat milk.", 5 * DAYS),
                (ch_snacks, "chess", "thanks!", 5 * DAYS - HOURS),
                (ch_snacks, "alice", "let's not tell @bob about the cookies", 3 * DAYS),
            ]
            for ch, author, content, ago in ws2_msgs:
                await post(conn, ch, uid[author], content, ago)

            # ============= DM: chess <-> bob in CS6083 =============
            min_id, max_id = sorted([uid["chess"], uid["bob"]])
            dm_name = f"dm-{min_id}-{max_id}"
            ch_dm = await conn.fetchval(
                """
                INSERT INTO channels (workspaceID, channel_name, typeID, created_by,
                                      created_time, updated_time)
                VALUES ($1, $2, $3, $4,
                        NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days')
                RETURNING channelID
                """,
                ws1,
                dm_name,
                t_dm,
                uid["chess"],
            )
            for u in ("chess", "bob"):
                await conn.execute(
                    """
                    INSERT INTO channelmember (channelID, userID, joined_time)
                    VALUES ($1, $2, NOW() - INTERVAL '2 days')
                    """,
                    ch_dm,
                    uid[u],
                )
            dm_history = [
                ("chess", "bob", "hey, ready for tomorrow?", 14 * HOURS),
                ("bob", "chess", "yes, just pushed the last commit.", 13 * HOURS),
                ("chess", "bob", "great. see you at 10.", 12 * HOURS),
            ]
            for author, partner, content, ago in dm_history:
                await post_dm(conn, ch_dm, uid[author], uid[partner], content, ago)

            # ============= Thread example in #project-snickr =============
            thread_parent = await post(
                conn,
                ch_proj,
                uid["chess"],
                "Open question: should we let admins disband a workspace with messages still in it?",
                10 * HOURS,
            )
            await post(
                conn,
                ch_proj,
                uid["xingyu"],
                "Foreign-key cascade already removes everything cleanly. I think yes.",
                10 * HOURS - 600,
                parent_id=thread_parent,
            )
            await post(
                conn,
                ch_proj,
                uid["bob"],
                "Agreed, no need for an extra confirm step.",
                10 * HOURS - 1200,
                parent_id=thread_parent,
            )
            await post(
                conn,
                ch_proj,
                uid["alice"],
                "@chess +1 from me too.",
                10 * HOURS - 1800,
                parent_id=thread_parent,
            )

            # ============= Pending workspace invitation =============
            await conn.execute(
                """
                INSERT INTO workspaceinvitation
                  (workspaceID, invitee, inviter, invited_time, status_type)
                VALUES ($1, $2, $3, NOW() - INTERVAL '3 hours', $4)
                """,
                ws1,
                uid["dave"],
                uid["chess"],
                pending,
            )

            # ============= Stale channel invitation (>5 days, for stale-invites view) =============
            await conn.execute(
                """
                INSERT INTO channelinvitation
                  (channelID, invitee, inviter, invited_time, status_type)
                VALUES ($1, $2, $3, NOW() - INTERVAL '8 days', $4)
                """,
                ch_proj,
                uid["newcomer"],
                uid["chess"],
                pending,
            )

            # ============= Inventory =============
            counts = await conn.fetch(
                """
                SELECT 'users' AS t, COUNT(*) c FROM users
                UNION ALL SELECT 'workspaces', COUNT(*) FROM workspaces
                UNION ALL SELECT 'workspacemember', COUNT(*) FROM workspacemember
                UNION ALL SELECT 'channels', COUNT(*) FROM channels
                UNION ALL SELECT 'channelmember', COUNT(*) FROM channelmember
                UNION ALL SELECT 'messages', COUNT(*) FROM messages
                UNION ALL SELECT 'mentions', COUNT(*) FROM mentions
                UNION ALL SELECT 'workspaceinvitation (pending)', COUNT(*)
                  FROM workspaceinvitation wi JOIN status s ON s.statusID = wi.status_type
                  WHERE s.type='pending'
                UNION ALL SELECT 'channelinvitation (pending)', COUNT(*)
                  FROM channelinvitation ci JOIN status s ON s.statusID = ci.status_type
                  WHERE s.type='pending'
                ORDER BY t
                """
            )
            print(f"\nSeeded with password '{PASSWORD}' for every account.\n")
            for row in counts:
                print(f"  {row['t']:<32} {row['c']}")
            print("\nLogins to try in the demo:")
            for _, username, _ in USERS:
                print(f"  username={username}  password={PASSWORD}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
