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
| `tests/`                | (TBD) integration tests against a Supabase test DB |
| `.env.example`          | Template; copy to `.env` (gitignored) |

The API contract lives at <http://localhost:8000/docs> while the server is running — FastAPI generates it from the Pydantic models and route signatures, so it never drifts from the code.

## Design notes

- **SQL injection defense.** Every query is parameterized with asyncpg's `$1, $2, ...` placeholders. asyncpg uses Postgres's native PREPARE protocol — the SQL text and parameter values travel separately, so user input cannot be interpreted as SQL.
- **XSS defense.** Out of scope for the JSON API; the React frontend escapes output by default. Backend stores raw text.
- **Sessions.** Starlette's `SessionMiddleware` sets a signed (itsdangerous) cookie containing `{ user_id: ... }`. The cookie is `httpOnly` + `sameSite=lax`. No server-side session table needed for the basic flow.
- **camelCase.** Postgres lowercases identifiers, so SQL aliases each column at query time: `SELECT workspaceID AS "workspaceId"`. Pydantic models use the same names so the JSON shape matches.
- **Transactions.** Multi-statement operations use `async with conn.transaction():` — the asyncpg equivalent of `BEGIN`/`COMMIT`/`ROLLBACK`.
- **Auto API docs.** FastAPI generates `/docs` (Swagger UI) and `/redoc` from the type hints — the single source of truth for the frontend contract.
