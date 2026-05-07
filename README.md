# Snickr

A Slack-like web collaboration system for NYU CS6083, Spring 2026.
Users register, join workspaces, chat in public and private channels, send direct messages, and search messages.

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
| `database/migrations/` | Incremental schema changes, numbered `001_*` through `006_*`. Apply in numeric order. |
| `database/seeds/sample_data.sql` | Test data: 6 users, 2 workspaces, 5 channels, 4 invitations, 9 messages |
| `database/seeds/test_queries.sql` | Part c queries with concrete values substituted in |
| `database/queries/queries.sql` | Parameterised `:name`-style versions of the Part c queries |
| `database/docs/test_results.md` | Expected output of every test query |
| `database/docs/test_data_diagram.md` | Diagram and design notes for the test dataset |
| `docs/ER-Diagram.drawio.svg` | ER diagram in draw.io format |
| `docs/snickr_schema_documentation.md` | Long-form schema documentation in Chinese |
| `docs/report/snickr-part1.pdf` | Part 1 submission report |

## Quick start

The three components are independent. For local development, run them in this order: database, backend, frontend.

### 1. Database

The default deployment is a local PostgreSQL instance on the demo laptop. The same SQL also runs unchanged on a Supabase-hosted instance if a remote backend is preferred.

Set up a fresh local database:

```bash
createdb snickr
psql -d snickr -f database/schema/schema.sql
psql -d snickr -f database/migrations/001_widen_password.sql
psql -d snickr -f database/migrations/002_stored_procedures.sql
psql -d snickr -f database/migrations/003_message_time_eastern.sql
psql -d snickr -f database/migrations/004_mentions.sql
psql -d snickr -f database/migrations/005_message_edit.sql
psql -d snickr -f database/migrations/006_message_system_kind.sql
psql -d snickr -f database/seeds/sample_data.sql   # optional, loads test data and seeds lookup tables
```

Migrations must be applied in numeric order. Each one is idempotent so re-running is safe.

If `sample_data.sql` is skipped, seed the lookup tables manually:

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

End-to-end pytest suite covering Part c.1 through c.7 and security guards:

```bash
cd backend
conda activate snickr
pytest
```

## Tech stack

| Layer | Stack |
|---|---|
| Database | PostgreSQL, run locally for the demo or on Supabase as a remote alternative |
| Backend | FastAPI, asyncpg, Pydantic, bcrypt, Starlette `SessionMiddleware` |
| Frontend | Vite, React, TypeScript, TailwindCSS |

## Further reading

- Schema overview, ER diagram, and design rationale: `docs/report/snickr-part1.pdf`
- Backend layout and conventions: `backend/README.md`
- Database and backend design, endpoints, stored procedures, transactions, security: `docs/report/snickr-part2.md`
- Frontend run instructions: `frontend/how-to-run.md`
- Frontend routes, page and API mapping, visual style: `frontend/SNICKR_FRONTEND_DESIGN.md`
