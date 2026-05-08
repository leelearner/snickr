# Snickr

A Slack-like web collaboration system for NYU CS6083, Spring 2026.
Users register, join workspaces, chat in public and private channels, send direct messages, reply in threads, and search messages.

The repo covers both project parts:

- **Part 1.** Relational schema design with ER diagram, DDL, sample data, and test queries.
- **Part 2.** Full-stack web app on top of the Part 1 schema, running on a local PostgreSQL instance during the demo. Backend is FastAPI, frontend is React.

## Repository layout

```
snickr/
├── backend/    FastAPI + asyncpg JSON API
├── frontend/   Vite + React + TypeScript SPA
├── database/   schema, migrations, seeds, sample queries
└── docs/       ER diagram, schema documentation, Part 1 report
```

| Path | Contents |
|---|---|
| `backend/` | API server. See `backend/README.md`. |
| `frontend/` | Web UI. See `frontend/how-to-run.md`. |
| `database/schema/schema.sql` | `CREATE TABLE` and index DDL |
| `database/migrations/` | Incremental schema changes, numbered `001_*` through `008_*`. Apply in numeric order. |
| `database/seeds/sample_data.sql` | Part 1 test data: 6 users, 2 workspaces, 5 channels, 4 invitations, 9 messages |
| `database/seeds/demo_seed.py` | Part 2 demo seed: 9 users, 2 workspaces, 8 channels, 41 messages including a 4-message thread, plus pending and stale invites |
| `database/seeds/test_queries.sql` | Part c queries with concrete values substituted in |
| `database/queries/queries.sql` | Parameterised `:name`-style versions of the Part c queries |
| `database/docs/test_results.md` | Expected output of every test query |
| `database/docs/test_data_diagram.md` | Diagram and design notes for the test dataset |
| `docs/ER-Diagram.drawio.svg` | ER diagram in draw.io format |
| `docs/snickr_schema_documentation.md` | Long-form schema documentation in Chinese |
| `docs/report/snickr-part1.pdf` | Part 1 submission report |
| `docs/report/snickr-part2.md` | Part 2 design report (Database, Backend, Session Logs) |
| `docs/session-logs/` | Session log transcript, screenshots, demo guide, and run scripts |

## Quick start

The three components are independent. For local development, run them in this order: database, backend, frontend.

### 1. Database

The default deployment is a local PostgreSQL instance on the demo laptop. The same SQL also runs unchanged on a Supabase-hosted instance if a remote backend is preferred.

Set up a fresh local database:

```bash
createdb snickr
psql -d snickr -f database/schema/schema.sql
for m in database/migrations/*.sql; do psql -d snickr -f "$m"; done
psql -d snickr -f database/seeds/sample_data.sql   # optional Part 1 seed
```

Migrations must be applied in numeric order. Each one is idempotent so re-running is safe.

For the Part 2 demo, run the Python seed instead of `sample_data.sql`. It wipes the data tables, keeps the lookup tables, and loads the realistic dataset documented in `docs/session-logs/DEMO_GUIDE.md`:

```bash
conda activate snickr
python database/seeds/demo_seed.py
```

If neither seed is loaded, seed the lookup tables manually:

```sql
INSERT INTO roles (name) VALUES ('admin'), ('member');
INSERT INTO status (type) VALUES ('pending'), ('accepted'), ('declined');
INSERT INTO channeltype (name) VALUES ('public'), ('private'), ('direct');
```

### 2. Backend on port 8000

```bash
cd backend
cp .env.example .env             # paste DATABASE_URL and SESSION_SECRET
conda create -n snickr python=3.11 -y
conda activate snickr
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Verify:

```bash
curl http://127.0.0.1:8000/api/health
# {"ok": true, "db": "..."}
```

Interactive API explorer: http://127.0.0.1:8000/docs

### 3. Frontend on port 5173

```bash
cd frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173/.

Vite proxies `/api/*` to the backend on `127.0.0.1:8000`, so the browser only ever talks to Vite. No CORS or cookie-host setup is needed. See `frontend/how-to-run.md` for troubleshooting.

## Tests

End-to-end pytest suite covering Part c.1 through c.7, security guards, message edits and deletes, and thread replies:

```bash
cd backend
conda activate snickr
pytest
```

51 tests, all passing.

## Tech stack

| Layer | Stack |
|---|---|
| Database | PostgreSQL, run locally for the demo or on Supabase as a remote alternative |
| Backend | FastAPI, asyncpg, Pydantic, bcrypt, Starlette `SessionMiddleware` |
| Frontend | Vite, React, TypeScript, TailwindCSS |

## Further reading

- Schema overview, ER diagram, and design rationale: `docs/report/snickr-part1.pdf`
- Database and backend design, endpoints, stored procedures, transactions, security, threads, session logs: `docs/report/snickr-part2.md`
- Live demo script with seeded credentials and feature-by-feature walkthrough: `docs/session-logs/DEMO_GUIDE.md`
- Backend layout and conventions: `backend/README.md`
- Frontend run instructions: `frontend/how-to-run.md`
- Frontend routes, page and API mapping, visual style: `frontend/SNICKR_FRONTEND_DESIGN.md`
