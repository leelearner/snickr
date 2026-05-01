# Snickr Backend API

Base URL: `http://localhost:8000`

All endpoints under `/api`. JSON in, JSON out. Field names are **camelCase**.

Authentication is via a signed session cookie (`snickr_session`). After `POST /api/auth/login`, subsequent requests must include the cookie. With Vite's `server.proxy` setup the cookie is automatic.

> Tip: an interactive version of this document is auto-generated at `/docs` while the server is running.

## Conventions

- Success responses: HTTP 200 (or 201 on create) with a JSON body.
- Error responses: HTTP 4xx / 5xx with `{ "detail": "<message>" }` (FastAPI's default error shape).
- Timestamps are ISO 8601 strings in UTC.
- IDs are integers.

## Status — work in progress

Endpoints are added here **before** they are implemented. If the docs disagree with the running server, the running server wins — open an issue.

---

## Health

### `GET /api/health`

No auth. Returns `{ "ok": true, "db": "<timestamp>" }` if the backend can reach Supabase.

---

## Auth

### `POST /api/auth/register`

Register a new user. On success the response body is the new user **and** the session cookie is set, so the client is logged in immediately.

**Body**
```json
{ "email": "alice@acme.com", "username": "alice", "nickname": "Ali", "password": "..." }
```
- `nickname` is optional.
- `email` and `username` must be globally unique.
- Implements project query (c.1).

**201 Created**
```json
{
  "userId": 7,
  "email": "alice@acme.com",
  "username": "alice",
  "nickname": "Ali",
  "createdTime": "2026-04-30T12:34:56.000Z"
}
```

**400** — validation failure (Pydantic response shape). **409** — email or username already in use.

---

### `POST /api/auth/login`

**Body**
```json
{ "username": "alice", "password": "..." }
```

**200 OK** — same shape as `UserOut` (without `createdTime`). Sets the session cookie.

**401** — invalid credentials. (Same message whether the username is wrong or the password is wrong, to avoid leaking user existence.)

---

### `POST /api/auth/logout`

No body. Clears the session. Always returns `{ "ok": true }`.

---

### `GET /api/auth/me`

Returns the currently logged-in user. **Frontend should call this on app load** to discover whether the user is logged in.

**200 OK**
```json
{
  "userId": 7,
  "email": "alice@acme.com",
  "username": "alice",
  "nickname": "Ali",
  "createdTime": "2026-04-30T12:34:56.000Z"
}
```

**401** — not authenticated.

## Workspaces

_(to be added)_

## Channels

_(to be added)_

## Messages

_(to be added)_

## Search

_(to be added)_

## Invitations

_(to be added)_
