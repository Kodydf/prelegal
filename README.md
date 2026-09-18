# prelegal
A platform for drafting common legal agreements

**Status:** 🚧 In progress — expected completion by 2026-09-24.

## Architecture (V1 foundation)

- `frontend/` — Next.js (statically exported to `out/`), Tailwind. Currently the Mutual NDA creator behind a fake login screen (no real authentication yet).
- `backend/` — FastAPI (uv project). Serves `/api/*` and the static frontend on port 8000. SQLite is recreated from scratch on every start (`users` table only for now).
- `Dockerfile` — multi-stage build: builds the frontend, then packages it with the backend.

## Run

Requires Docker. The app is served at http://localhost:8000.

| OS      | Start                    | Stop                    |
|---------|--------------------------|-------------------------|
| Mac     | `scripts/start-mac.sh`   | `scripts/stop-mac.sh`   |
| Linux   | `scripts/start-linux.sh` | `scripts/stop-linux.sh` |
| Windows | `scripts/start-win.sh` (Git Bash) or `scripts/start-win.ps1` | `scripts/stop-win.sh` or `scripts/stop-win.ps1` |

## Test

```bash
cd backend && uv run pytest      # backend
cd frontend && npm test          # frontend
```
