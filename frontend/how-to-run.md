# How to Run the Snickr Frontend

## Prerequisites

- Node.js 18 or newer
- npm
- The Snickr FastAPI backend running on `http://127.0.0.1:8000`

The frontend is a Vite + React + TypeScript app.

## Install Dependencies

From the repository root:

```bash
cd frontend
npm install
```

## Configure the API URL

For local development, use:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

This project includes a local example:

```bash
cp .env.example .env.local
```

The frontend and backend hosts should match consistently. If you open the frontend at `http://127.0.0.1:5173`, use `http://127.0.0.1:8000` for the API. Mixing `localhost` and `127.0.0.1` can prevent the browser from sending the `snickr_session` cookie correctly.

## Start the Backend

In a separate terminal:

```bash
cd backend
conda activate snickr
uvicorn app.main:app --reload --port 8000
```

Check that it is healthy:

```bash
curl http://127.0.0.1:8000/api/health
```

Expected response:

```json
{"ok": true, "db": "..."}
```

## Start the Frontend

In another terminal:

```bash
cd frontend
npm run dev -- --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:5173/
```

## Build Check

Run this before submitting or demoing:

```bash
cd frontend
npm run build
```

The build command runs TypeScript checks and creates a production bundle in `dist/`.

## Common Issues

### Register or login works, but `/api/auth/me` returns 401

Use one host consistently:

- frontend: `http://127.0.0.1:5173`
- backend: `http://127.0.0.1:8000`
- `VITE_API_BASE_URL=http://127.0.0.1:8000`

Then clear site data or use a private browser window.

### CORS error or `Disallowed CORS origin`

Make sure the backend `.env` allows the frontend origin:

```text
FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

Restart the backend after changing `.env`.

### API requests fail

Confirm the backend is running:

```bash
curl http://127.0.0.1:8000/api/health
```

Also confirm the frontend has the correct API base URL in `.env.local`.
