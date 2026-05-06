# How to Run the Snickr Frontend

## Prerequisites

- Node.js 18 or newer
- npm
- The Snickr FastAPI backend running on `http://127.0.0.1:8000`

The frontend is a Vite + React + TypeScript app. Vite proxies `/api/*` to the backend, so the browser only ever talks to Vite at `:5173`. There is no CORS or cookie-host configuration to worry about.

## Install Dependencies

```bash
cd frontend
npm install
```

## Start the Backend

In a separate terminal:

```bash
cd backend
conda activate snickr
uvicorn app.main:app --reload --port 8000
```

Sanity check:

```bash
curl http://127.0.0.1:8000/api/health
# {"ok": true, "db": "..."}
```

## Start the Frontend

In another terminal:

```bash
cd frontend
npm run dev
```

Open:

```
http://127.0.0.1:5173/
```

`localhost:5173` also works because Vite is bound to `127.0.0.1` and the proxy makes host names interchangeable from the browser's perspective.

## Build Check

Run before submitting or demoing:

```bash
cd frontend
npm run build
```

The build runs TypeScript checks and produces a production bundle in `dist/`.

## Common Issues

### Vite starts but the page never loads

Confirm Vite is bound to IPv4. `vite.config.ts` sets `server.host = "127.0.0.1"` so this should be automatic. If you see Vite say it is listening on `[::1]:5173`, the config did not take effect, restart `npm run dev`.

### `/api/...` requests 502 from Vite

The backend is not running on `127.0.0.1:8000`, or it is bound to a different host. Re-run the backend start commands above and confirm `curl http://127.0.0.1:8000/api/health` returns 200.

### Need to point at a different backend host

Set `VITE_API_BASE_URL` in `frontend/.env.local`, for example `VITE_API_BASE_URL=http://10.0.0.42:8000`. This bypasses the proxy and makes the frontend call that URL directly. Cookies will only flow if the remote backend's CORS and cookie settings cooperate.
