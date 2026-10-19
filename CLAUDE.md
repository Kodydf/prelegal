#Prelegal Project

##Overview 

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.  The user can ... AI chat in order to establish what document they want and how to fill in the fields.  The available documents are convered in the catalog.json file in the project root, included here: 

@catalog.json

Current state: a V1 technical foundation (frontend + FastAPI backend + temporary SQLite DB, Dockerised) with a fake login. All 11 template documents are supported, drafted through an AI chat that guides the user. See "Implementation Status" at the end.  

##Developent Process 

When instructed to build a feature: 
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues. 
4. Submit a PR using your github tools. 
5. Update the PR with any comments or requests for changes. 
6. Repeat until the PR is approved.

##AI Design

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the `openrouter/openai/gpt-oss-120b` model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document. 

##Technical Design 
The entire project should be packaged into a Docker container. 
The database should use SQLLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.  
The backend should be in the backend/ and be a uv project, using FastAPI. The frontend should be in the frontend/ Consider statically building the frontend and serving it via FastAPI, if that will work.  There should be scripts in scripts/ for: 
```bash
# Mac
scripts/start-mac.sh  #Start
scripts/stop-mac.sh   #Stop

#Linux
scripts/start-linux.sh  #Start
scripts/stop-linux.sh   #Stop

#Windows
scripts/start-win.sh    #Start
scripts/stop-win.sh     #Stop
```
The per-platform scripts are thin wrappers around scripts/start.sh and scripts/stop.sh. PowerShell equivalents exist for Windows: scripts/start-win.ps1 and scripts/stop-win.ps1.

Backend available at http://localhost:8000

##Color Scheme 

Use the following color scheme in the frontend:

Primary: Navy #003366

Secondary: Gold #FFD700

Accent: Silver #C0C0C0

Background: White #FFFFFF

Text: Black #000000

##Implementation Status

Done (KAN-4, V1 foundation, merged to main):
- backend/: uv FastAPI project (app/main.py, app/db.py). Serves `/api/health` and the static frontend on port 8000. Env overrides: `PRELEGAL_DB_PATH`, `PRELEGAL_STATIC_DIR`. Run with a single uvicorn worker, since the DB reset happens at startup.
- SQLite is deleted and recreated at every startup with an empty `users` table (id, email, password_hash, created_at). No sign up or sign in logic yet.
- frontend/: Next.js statically exported (`output: "export"` to `out/`). Fake login (`components/AuthGate.tsx`, `lib/auth.ts`): any email or none is accepted and remembered in localStorage, with a header Sign out button. No real authentication. Navy/gold/silver theme applied everywhere, and dark mode removed.
- Dockerfile (multi-stage: Node builds the frontend, Python/uv runs the backend) and .dockerignore. The `.env` file is not baked into the image and is passed at runtime with `--env-file`.
- scripts/ start and stop scripts for all platforms. Verified working with Docker on Windows.
- Tests: `cd backend && uv run pytest` and `cd frontend && npm test` (vitest, files in frontend/tests/).

Done (KAN-5, AI chat): a stateless `POST /api/chat` where the browser holds the conversation and draft; LiteLLM -> OpenRouter -> Cerebras (`openrouter/openai/gpt-oss-120b`) with Structured Outputs, 30s timeout + 1 retry. `.env` names the key `OpenRouter_API_Key`; `llm._ensure_api_key` maps it to `OPENROUTER_API_KEY`. Use `reasoning_effort` (the Cerebras skill's `reasoning_efforts` is a typo). Chat state lives in the browser only (refresh resets it), and the chat needs the backend, so it does not work under `next dev`.

Done (KAN-6, all document types):
- All 11 templates are supported (the NDA cover page is generated, not read from `templates/Mutual-NDA-coverpage.md`). Each document = a generated cover page (key terms + signature block) followed by the verbatim standard terms.
- backend/app/terms.py parses a template into `TermsBlock`s (title / numbered item / paragraph; spans stripped, `**bold**` kept). backend/app/definitions.py is hand-written data: per document, the party roles and key-term fields (with hints and defaults) taken from the variables each template references. backend/app/documents.py loads catalog + definitions + terms once at startup (fails fast). Test `test_every_variable_a_template_references_has_a_field` catches template/definition drift. To add a document: template + catalog.json entry + a definition.
- `GET /api/documents` and `GET /api/documents/{id}` (definition + parsed terms). Env override `PRELEGAL_CONTENT_DIR` (the Docker image puts `catalog.json` and `templates/` in `/app/content`).
- `POST /api/chat` takes `{messages, documentId, values}` and returns `{reply, documentId, values}`. Values are a flat key -> string map (party fields are `<party>_company|name|title|address|date`). The model returns `{reply, documentId, updates:[{key,value}]}`; `documentId: null` means no change. chat.py `apply_turn` drops unknown ids/keys and oversized values (500 chars, 2000 for long fields); switching documents resets the draft to defaults. `run_turn` re-runs the turn once after a document is chosen so the model sees that document's field keys and records what the user already said. 422 on invalid drafts, 503 without an API key, 502 on model failure.
- The system prompt (llm.py) lists the catalog, guides step by step (parties, key terms, then signer details), declines unsupported documents and offers the closest one, forbids filling `_name` from a company name, and asks for plain text. The server turns literal backslash-n sequences in replies (the model sometimes double-escapes newlines) into real newlines.
- frontend: `types/document.ts`, `lib/document-model.ts` (one block model shared by `DocumentPreview` and the PDF in `lib/pdf/DocumentPdf.tsx`), `DraftingApp.tsx` (empty state, loads the definition when the AI picks a document, Start over), `ChatPanel.tsx`. The old NDA-specific types, preview and PDF were deleted.
- Tests: pytest (LLM mocked; `live`-marked tests call the real model when a key is set) and vitest, including real PDF generation.

Done (KAN-7, accounts, saved documents, polish):
- Auth (backend/app/api_auth.py, security.py, store.py): `POST /api/auth/signup|signin|signout`, `GET /api/auth/me`. Email + password (min 8, max 128), stdlib scrypt hashes, server-side sessions whose sha256 is stored, sent as an HttpOnly SameSite=Lax cookie (`prelegal_session`, 7 days; `PRELEGAL_COOKIE_SECURE=1` adds Secure). Sign-in errors are generic and timing-equalised. `/api/chat` and `/api/drafts` require sign-in; `/api/documents` and `/api/health` are public.
- Saved documents: `drafts` table (document id, values JSON, messages JSON) scoped by user id everywhere; other users' drafts are 404. `/api/chat` takes an optional `draftId` and auto-saves via `persist_turn` once a document is chosen (409 at 100 drafts per user, checked before spending a model call). Requests may carry up to 200 messages, the client sends the latest 100, the model sees the latest 40, and 100 are saved. `GET /api/drafts`, `GET|DELETE /api/drafts/{id}`.
- The DB is still recreated on every server start, so accounts, sessions and drafts vanish on restart (intended for now). Store functions commit explicitly, because FastAPI runs dependency cleanup after the response is sent. In tests, entering `TestClient(create_app())` again resets the shared DB: make a second client with `TestClient(client.app)` instead.
- Frontend: `AuthScreen` + `AuthGate` (session check, global 401 handler in `lib/api.ts`), `AppHeader` nav, `MyDocuments` (list, open/resume, two-step delete with focus handling), `PlatformApp` shell and footer, `ui.tsx` (shared button/alert/focus-ring styles). Navy focus rings on white surfaces (gold only on the navy header). The disclaimer wording lives in `lib/disclaimer.ts`: notice on the document and PDF, static fixed footer on every PDF page, reminder by the download button, app footer, sign-in screen.
- PDF gotcha: a `render` function (page numbers) in a fixed footer makes react-pdf crash on the longest documents, so the footer is static text. Test PDFs against the real templates when touching `lib/pdf/DocumentPdf.tsx`.
- Not visually verified in a browser: the phone-width sign-in layout and the signed-in screens (browser automation must not create accounts or type passwords).

Not done yet: rate limiting on sign-up/sign-in and a concurrency cap on chat (the sync endpoints share one thread pool), email verification and password reset.

Notes:
- The GitHub CLI is installed at `C:\Program Files\GitHub CLI\gh.exe` and logged in as Kodydf; it may not be on the PATH of an already-running session, so call it by full path. Use it to open and merge PRs.
- `.gitattributes` forces LF line endings on `*.sh` and `Dockerfile`. Keep this, since CRLF breaks them in Linux and Mac containers.
- Run the backend with a single uvicorn worker: the SQLite reset happens at startup.
