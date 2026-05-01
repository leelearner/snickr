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

_(to be added)_

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
