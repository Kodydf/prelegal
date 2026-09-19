# prelegal
A platform for drafting common legal agreements

**Status:** 🚧 In progress — expected completion by 2026-09-24.

## Architecture (V1 foundation)

- `frontend/` — Next.js (statically exported to `out/`), Tailwind. A drafting assistant for all 11 supported agreement types (Mutual NDA, Cloud Service Agreement, Design Partner, SLA, Professional Services, DPA, Software License, Partnership, BAA, Pilot, AI Addendum): a chat with an AI on the left guides you through the document and fills in a live preview on the right, which can be downloaded as a PDF. If you ask for something we can't generate, the assistant says so and offers the closest supported document. Sits behind a fake login screen (no real authentication yet).
- `backend/` — FastAPI (uv project). Serves `/api/*` (including `POST /api/chat`, which calls the LLM) and the static frontend on port 8000. SQLite is recreated from scratch on every start (`users` table only for now).
- `templates/` and `catalog.json` — the Common Paper legal templates. `backend/app/definitions.py` lists, per document, the party roles and key-term fields the assistant collects (the templates hold only the legal text); `backend/app/terms.py` parses the templates. A generated cover page plus the verbatim standard terms make up each document. To add a document: add its template and catalog entry, then a definition.
- `Dockerfile` — multi-stage build: builds the frontend, then packages it with the backend.

## Run

Requires Docker. The app is served at http://localhost:8000.

The AI chat needs an OpenRouter API key in a `.env` file at the repo root (`OpenRouter_API_Key=...` or `OPENROUTER_API_KEY=...`); the start scripts pass it to the container. Without it the app runs but the chat shows "The AI assistant is not configured." The chat only works when the page is served by the backend (Docker, or `uvicorn` in `backend/`), not by `next dev`, because the frontend is a static export with no `/api` proxy. The first request after a container starts can take a few seconds (LiteLLM import).

| OS      | Start                    | Stop                    |
|---------|--------------------------|-------------------------|
| Mac     | `scripts/start-mac.sh`   | `scripts/stop-mac.sh`   |
| Linux   | `scripts/start-linux.sh` | `scripts/stop-linux.sh` |
| Windows | `scripts/start-win.sh` (Git Bash) or `scripts/start-win.ps1` | `scripts/stop-win.sh` or `scripts/stop-win.ps1` |

## Test

```bash
cd backend && uv run pytest      # backend (LLM is mocked; tests marked `live` call the real model when a key is set)
cd frontend && npm test          # frontend
```
