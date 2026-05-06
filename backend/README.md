# Snickr backend

FastAPI and asyncpg JSON API on top of the Postgres schema in `../database/`.

The React frontend lives in the sibling `../frontend/` directory.

## Quick start

```bash
cd backend
cp .env.example .env
# edit .env: paste the Supabase DATABASE_URL and a random SESSION_SECRET

conda create -n snickr python=3.11 -y
conda activate snickr
pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000
```

After the first setup, day-to-day use is just:

```bash
cd backend
conda activate snickr
uvicorn app.main:app --reload --port 8000
```

Then in another terminal:

```bash
curl http://localhost:8000/api/health
# {"ok": true, "db": "..."}
```

Interactive API explorer:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Layout

| Path | Purpose |
|---|---|
| `app/main.py` | FastAPI entry, middleware, route mounts, lifespan |
| `app/core/config.py` | Settings loaded from `.env` |
| `app/core/security.py` | Password hashing helpers |
| `app/db/session.py` | `asyncpg` pool and `get_conn` dependency |
| `app/api/v1/` | Routers: `auth.py`, `workspaces.py`, `channels.py`, `messages.py`, `deps.py` |
| `app/schemas/` | Pydantic request and response models |
| `.env.example` | Template, copy to `.env`, gitignored |

API contract: http://localhost:8000/docs, auto-generated from Pydantic models.

## Design notes

- **SQL injection.** Parameterized queries via asyncpg `$1, $2, ...`.
- **XSS.** Frontend's responsibility. Backend stores raw text.
- **Sessions.** Signed cookie via Starlette's `SessionMiddleware`, `httpOnly`, `sameSite=lax`.
- **camelCase.** SQL aliases each column at query time, e.g. `SELECT workspaceID AS "workspaceId"`.
- **Transactions.** Multi-statement operations use `async with conn.transaction():`.
