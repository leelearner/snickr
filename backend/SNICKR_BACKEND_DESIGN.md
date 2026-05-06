# Snickr Backend Design Report

## 1. Overview

The Snickr backend is the program that sits between a standard web browser and the relational database designed in Project 1. A user opens the React frontend in a browser, fills in a form or clicks a link, and the frontend issues an HTTP request to this backend. The backend authenticates the request, runs one or more SQL statements or stored procedures against the Postgres database hosted on Supabase, and returns a JSON document that the frontend renders. All operations described in the project requirements, namely registering an account, creating workspaces and channels, posting messages, responding to invitations, browsing accessible content, and searching messages, are implemented through this single JSON HTTP API.

This document explains how the backend is organised, why each major decision was made, and how the system addresses the four requirements that the assignment singles out for explicit discussion: protection against SQL injection, protection against cross-site scripting, transactional handling of concurrent users, and bookmarkable URLs with proper session state.

## 2. Technology Choices

The backend is written in Python 3.11 using the FastAPI web framework, with `asyncpg` as the Postgres driver, `bcrypt` for password hashing, and Starlette's `SessionMiddleware` for signed cookie sessions. The persistence layer is plain PostgreSQL hosted on Supabase, accessed through Supabase's session pooler so that connections survive serverless-style scaling.

FastAPI was chosen for three reasons. First, it generates an interactive API explorer at `/docs` from the same Pydantic models that validate requests and responses, which removes any drift between the implementation and the documented API contract. Second, its dependency-injection mechanism makes it natural to require an authenticated user on a route by writing `user_id: int = Depends(current_user_id)`, so authentication checks are visible in every route signature rather than buried in middleware. Third, the team already had stronger familiarity with FastAPI than with Node, Java, or PHP, which lowered the risk of subtle bugs in the demo path.

`asyncpg` was selected because it speaks the native Postgres binary protocol and only accepts parameterised queries through its `$1, $2, ...` placeholder syntax. There is no string-substitution mode that would let a developer accidentally interpolate user input into SQL. This makes the SQL injection guarantee structural rather than convention-based.

Sessions are kept in a signed cookie rather than in a server-side store. The cookie is named `snickr_session`, marked `httpOnly` and `sameSite=lax`, and contains only a small dictionary that currently holds the user's numeric identifier. This choice keeps the backend stateless apart from its database connection pool, which simplifies local development and reflects the demo deployment where a single laptop runs everything.

## 3. Application Architecture

A request enters FastAPI and passes through two pieces of middleware. `CORSMiddleware` permits only the origins listed in `FRONTEND_ORIGIN`. In ordinary development the React dev server proxies `/api/*` to the backend so requests are same-origin from the browser's point of view, and the CORS list only matters when a developer chooses to call the backend directly from another host. `SessionMiddleware` reads and writes the signed `snickr_session` cookie. After middleware, FastAPI dispatches to a router under `app/api/v1/`. There is one router file per resource group, namely `auth.py`, `workspaces.py`, `channels.py`, and `messages.py`, and a small `deps.py` that holds the shared `current_user_id` dependency.

Each handler depends on `get_conn`, which leases an `asyncpg.Connection` from a single pool created during the FastAPI lifespan. Because asyncpg leases one connection per request, every query inside a handler runs on the same connection, and therefore inside the same transactional context if the handler chooses to open one. The pool is configured with `statement_cache_size=0` so that the same SQL can be reissued through Supabase's pooled connection without prepared-statement name clashes.

Pydantic v2 models live in `app/schemas/` and describe both the request payloads and the response shapes. Field length limits in these models mirror the schema constraints, so a 31-character username is rejected at validation time before it ever reaches Postgres. The same models drive the OpenAPI document at `/docs`, which serves as the canonical API reference for the frontend developer. JSON field names are camelCase, while Postgres lowercases identifiers, so each query aliases its columns at the SQL layer with statements such as `SELECT workspaceID AS "workspaceId"`. Aliasing in SQL rather than through a global middleware keeps the SQL readable and makes it possible to map every JSON field back to its query.

## 4. API Design

The API is exposed under the `/api` prefix and is organised by resource. There are five high-level groups: authentication endpoints under `/api/auth`, workspace-centric endpoints under `/api/workspaces`, channel and direct-message endpoints under `/api/channels` and `/api/workspaces/{id}/channels`, message endpoints under `/api/channels/{id}/messages`, and a global search endpoint under `/api/search`. A separate `/api/me` group exposes invitation lists and accept-or-decline actions for the current user. The full endpoint inventory is summarised below.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create a user and start a session |
| POST | `/api/auth/login` | Verify password and start a session |
| POST | `/api/auth/logout` | Clear the session cookie |
| GET | `/api/auth/me` | Return the current user's profile |
| PATCH | `/api/auth/me` | Update email, display name, or password |
| GET | `/api/workspaces` | List workspaces I belong to |
| POST | `/api/workspaces` | Create a workspace and become its first admin |
| GET | `/api/workspaces/{id}` | Workspace details and member list |
| POST | `/api/workspaces/{id}/invitations` | Invite a user by username |
| GET | `/api/workspaces/{id}/stale-channel-invites` | Channel invites unanswered for over five days |
| DELETE | `/api/workspaces/{id}/members/{userId}` | Remove a member |
| PATCH | `/api/workspaces/{id}/members/{userId}/role` | Promote or demote a member |
| GET | `/api/workspaces/admins` | All admins across the workspaces I belong to |
| GET | `/api/me/workspace-invitations` | Pending workspace invitations addressed to me |
| POST | `/api/me/workspace-invitations/{id}` | Accept or decline a workspace invitation |
| GET | `/api/workspaces/{id}/channels` | Channels visible to me in a workspace |
| POST | `/api/workspaces/{id}/channels` | Create a public or private channel |
| POST | `/api/workspaces/{id}/direct-messages` | Open or reuse a direct-message channel |
| GET | `/api/channels/{id}` | Channel details and member list |
| POST | `/api/channels/{id}/join` | Self-join a public channel |
| POST | `/api/channels/{id}/invitations` | Invite a member to a channel |
| GET | `/api/me/channel-invitations` | Pending channel invitations addressed to me |
| POST | `/api/me/channel-invitations/{id}` | Accept or decline a channel invitation |
| GET | `/api/channels/{id}/messages` | Channel timeline in chronological order |
| POST | `/api/channels/{id}/messages` | Post a message |
| GET | `/api/users/{id}/messages` | All messages posted by a user, with workspace and channel context |
| GET | `/api/search?q=` | Substring search across messages I can see |

Two design principles run through this list. The first is that visibility is enforced at the SQL level, not at the route level. For example, the channel timeline endpoint joins the messages back to `channelmember` filtered by the caller's user identifier, so even if a user guesses a channel identifier they cannot see its messages without being a member. The second is that responses are shaped to match how the frontend renders them. Each message row carries the poster's display name and username so the frontend does not need a second round-trip to look the user up.

## 5. Database Access Strategy

Every query that takes user input passes that input through `asyncpg`'s `$1, $2, ...` placeholders. There is no place in the codebase where user text is concatenated into a SQL string, no f-string interpolation of user input, and no manual escaping. Even the `LIKE` patterns used by the search endpoint wrap their bound values rather than their query strings, so a search for `100%` does not leak its percent sign into the SQL grammar. Because the project requirements highlight stored procedures and prepared statements as acceptable mitigations, the design relies on both. asyncpg uses Postgres's extended-query protocol, which prepares each query and binds its arguments through the binary protocol; this is the database-side equivalent of a prepared statement.

Two operations are pushed entirely into the database as stored procedures, defined in `database/migrations/002_stored_procedures.sql`. The first, `create_channel_for_member`, atomically verifies that the caller is a member of the workspace, inserts the channel, and inserts the channel-membership row that makes the creator a participant. The second, `accept_workspace_invitation`, atomically validates the invitation, flips its status to accepted, and inserts the corresponding workspace-membership row. Both procedures take typed arguments and return typed values, and both are invoked through `SELECT create_channel_for_member($1, $2, $3, $4)` style calls so that even the procedure call goes through asyncpg's parameter binding. This addresses the assignment's request to use stored procedures where appropriate, and concentrates the trickiest atomic operations behind a single SQL function the database will execute as one unit.

Multi-statement writes that do not warrant a stored procedure run inside `async with conn.transaction()` blocks. Workspace creation inserts the workspace row, the admin membership row, and the default `general` channel inside one transaction, so the workspace either appears with all three pieces or not at all. Member removal first deletes the user's channel memberships in the workspace and then deletes the workspace-membership row, again inside one transaction, so a removed user cannot end up with channel rows that point at a workspace they no longer belong to. Direct-message channel creation upserts the channel and inserts both members in one transaction, so a partial outcome where one of the two participants is added without the other is impossible. The full list of transactional operations is enumerated in Section 7.

## 6. Security

The assignment specifically asks for protection against SQL injection and cross-site scripting. Both are addressed by structural choices rather than ad-hoc filtering.

SQL injection is prevented because every query and every stored-procedure invocation passes user input through asyncpg's parameter binding. The Postgres extended-query protocol treats those bound values as data, never as SQL grammar, so even input that looks like SQL keywords cannot escape its placeholder. There is no codepath where user text is substituted into a SQL string. Pydantic validation enforces type and length limits at the HTTP boundary, which means by the time a value reaches the SQL layer it is already known to be a string of bounded length, an integer, or `None`. The combination of Pydantic at the boundary, asyncpg at the database driver, and stored procedures with typed arguments for the most sensitive multi-step operations gives a layered defence in depth.

Cross-site scripting is prevented at the rendering boundary. The backend stores user-submitted text exactly as it was received and never tries to escape or strip HTML at write time. The React frontend renders all user-submitted content as React text using the `whitespace-pre-wrap` CSS rule and never uses `dangerouslySetInnerHTML`. Because React text nodes always escape angle brackets and other markup characters, an injected `<script>` tag in a message becomes the literal four characters of text rather than an executable script. This split is intentional. Storing raw text means the database holds the user's actual input for audit and search, and rendering through React means a single audit point in the frontend covers every place messages can appear. Output sanitisation is therefore handled at exactly one layer rather than scattered across many endpoints.

Authentication is implemented with `bcrypt`-hashed passwords and signed cookie sessions. The login endpoint and the unknown-user response share the same generic error message so an attacker cannot enumerate valid usernames by comparing responses. Authorisation is enforced inside every protected handler. The `current_user_id` dependency reads the user identifier from the signed session cookie and rejects unauthenticated requests with HTTP 401 before the handler runs. Each handler then re-checks workspace or channel membership at the SQL level. Private and direct channels return HTTP 404 to non-members rather than HTTP 403, so even the existence of a private channel is hidden from users who are not invited to it. The last-admin check protects the workspace from accidentally losing all administrative access by refusing to remove or demote the only remaining admin.

CORS is configured through Starlette's built-in middleware. Only the origins listed in `FRONTEND_ORIGIN` are allowed, and `allow_credentials=True` lets the session cookie travel on cross-origin requests when the developer chooses to bypass Vite's proxy. In ordinary development the proxy keeps requests same-origin, which means CORS does not enter the picture at all and the cookie is exchanged without any browser cross-site relaxation.

## 7. Concurrency Control and Transactions

Multiple users use the system at the same time, so any operation that touches more than one row needs to be safe under concurrent execution. The backend addresses this by running multi-statement writes inside Postgres transactions, so each write either commits as a unit or is rolled back as a unit, and by trusting Postgres's MVCC-based isolation for everything else.

The transactional operations are:

- Workspace creation. Inserts the workspace row, an admin-role membership row for the creator, and a default `general` channel created through `create_channel_for_member`.
- Direct-message channel creation. Upserts the channel under a deterministic name and inserts both participants as members.
- Member removal. Deletes the user's memberships in all channels of the workspace and then deletes the workspace-membership row.
- Channel-invitation response. Updates `channelinvitation.status_type` and, on accept, inserts the channel-membership row.
- Workspace-invitation decline. Reads the invitation status and updates it inside one transaction so concurrent accept and decline calls cannot both succeed.

Workspace-invitation acceptance goes one step further and uses the `accept_workspace_invitation` stored procedure described in Section 5. The procedure runs inside the database as a single statement from the application's point of view, and Postgres serialises the read of the invitation status, the update to `accepted`, and the insert into `workspacemember` so two users who race to accept the same invitation cannot both succeed.

The last-admin guard is a read-then-write pattern that performs a count of admins followed by a decision to allow or refuse the operation. Under the demo workload this is correct, because the only way to interleave two attempts to demote the last admin is for two admins to demote each other simultaneously, which is fine in either order. A stricter implementation would lock the relevant rows with `SELECT ... FOR UPDATE` inside the same transaction; this is listed as a future improvement in Section 11.

## 8. Session Management and Bookmarkable URLs

The assignment notes that session state and URL design deserve thought. The Snickr backend keeps session state in a signed cookie and uses URLs only to address content. The session cookie is a JSON document signed with the secret key in `SESSION_SECRET`, marked `httpOnly` and `sameSite=lax`, and given a seven-day expiry. It currently carries only the user's numeric identifier, but additional fields could be added without changing the cookie's structure. Because the cookie is signed rather than encrypted, the user could in principle inspect its contents, which is acceptable for a user identifier.

URLs encode position in the data. A workspace lives at `/api/workspaces/{id}` and the corresponding frontend page lives at `/app/workspaces/{id}`. A channel lives at `/api/channels/{id}` and at `/app/workspaces/{id}/channels/{id}`. A search result page lives at `/app/search?q={query}`. None of these URLs encode the user's identity, so the same URL points at the same conceptual resource for every user, and the backend decides at request time whether the caller is allowed to see it. This makes every workspace page, every channel page, and every search result page bookmarkable. A user who copies the URL of a channel and pastes it into a new browser session will land on the login page, log in, and be redirected back to the same channel.

## 9. Schema Refinements from Project 1

Three migrations live in `database/migrations/`. The first, `001_widen_password.sql`, widens `users.password` from `VARCHAR(30)` to `VARCHAR(255)` so that bcrypt hashes fit. The Project 1 schema sized the column for plaintext passwords because the schema-design phase did not yet specify the hashing strategy. The second, `002_stored_procedures.sql`, adds the two stored procedures discussed above. The third, `003_message_time_eastern.sql`, records `messages.posted_time` in the `America/New_York` timezone so that timestamps in the UI agree with the wall-clock time at the demo location without per-request timezone conversion. These are the only intentional differences between the Project 1 schema and the schema the Project 2 backend runs against, and each is small enough to be reviewed in a few lines of SQL.

## 10. Testing

The backend ships with a pytest suite under `backend/tests/`. There are four files: `test_auth.py` covers registration, login, logout, profile retrieval, and the duplicate-email and duplicate-username paths; `test_workspaces.py` covers workspace creation, member listing, invitation flow, role changes, and the last-admin guard; `test_channels.py` covers channel creation through the stored procedure, public-channel join, channel invitations, and direct-message creation; `test_messages_and_search.py` covers posting, reading, user-history, and search across visible messages. Each test exercises the running FastAPI application through its HTTP surface and uses an actual Postgres database, so the tests verify both the application code and the SQL it issues. The tests can be run with `pytest` from the `backend/` directory after activating the conda environment.

## 11. Limitations and Future Work

The backend covers all functional requirements set out in the assignment, but several enhancements would push it closer to a production-grade collaboration system. Real-time delivery of new messages currently relies on the frontend re-fetching the channel timeline; a WebSocket push would remove that polling round-trip. Messages cannot be edited or deleted, and there is no support for file attachments, reactions, threads, or pins, all of which are common in production chat systems. Channels cannot be renamed or archived once created. Administrative actions are not audit-logged. Login and registration are not rate-limited, which leaves them open to credential-stuffing attempts. The last-admin check could be made strictly serialisable by adding `SELECT ... FOR UPDATE` to the count step. None of these gaps affect the assignment's stated requirements, but each is a natural next step if the system were to move beyond a course project.
