# Snickr backend

FastAPI + asyncpg JSON API on top of the Postgres schema in `../database/`.

The React frontend lives in the sibling `../frontend/` directory.

## Quick start

```bash
cd backend
cp .env.example .env
# edit .env: paste the Supabase DATABASE_URL and a random SESSION_SECRET

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000
```

Then in another terminal:

```bash
curl http://localhost:8000/api/health
# -> {"ok": true, "db": "2026-04-30T..."}
```

FastAPI also generates an interactive API explorer at:
- Swagger UI: <http://localhost:8000/docs>
- ReDoc:      <http://localhost:8000/redoc>

## Layout

| Path | Purpose |
|---|---|
| `app/main.py`           | FastAPI entry: middleware, route mounts, lifespan |
| `app/core/config.py`    | Settings loaded from `.env` (Pydantic) |
| `app/core/security.py`  | Password hashing helpers (bcrypt) |
| `app/db/session.py`     | `asyncpg` pool, lifespan hooks, `get_conn` dependency |
| `app/api/v1/`           | One router per resource: `auth.py`, `workspaces.py`, `channels.py`, `messages.py`, `search.py` |
| `app/schemas/`          | Pydantic request/response models |
| `.env.example`          | Template; copy to `.env` (gitignored) |

API contract: <http://localhost:8000/docs> (auto-generated from Pydantic models).

## Design notes

- **SQL injection.** Parameterized queries via asyncpg `$1, $2, ...` (Postgres PREPARE protocol).
- **XSS.** Frontend's job; backend stores raw text.
- **Sessions.** Signed cookie via Starlette's `SessionMiddleware` (`httpOnly`, `sameSite=lax`).
- **camelCase.** SQL aliases each column at query time: `SELECT workspaceID AS "workspaceId"`.
- **Transactions.** Multi-statement operations use `async with conn.transaction():`.
