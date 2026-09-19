import logging
import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from app import api_auth, api_drafts, llm, store
from app.api_auth import current_user
from app.chat import ChatRequest, ChatResponse, run_turn, validate_draft
from app.db import get_db, reset_db
from app.documents import DocumentDetail, DocumentSummary, get_document, list_documents, load_documents

logger = logging.getLogger(__name__)

DEFAULT_STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def lifespan(_: FastAPI):
    reset_db()
    load_documents()  # parse every template up front so a broken one fails at startup
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Prelegal", lifespan=lifespan)
    app.include_router(api_auth.router)
    app.include_router(api_drafts.router)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/documents", response_model=list[DocumentSummary])
    def documents() -> list[DocumentSummary]:
        return list_documents()

    @app.get("/api/documents/{document_id}", response_model=DocumentDetail)
    def document(document_id: str) -> DocumentDetail:
        found = get_document(document_id)
        if found is None:
            raise HTTPException(status_code=404, detail="Unknown document.")
        return found

    @app.post("/api/chat", response_model=ChatResponse, response_model_by_alias=True)
    def chat(
        request: ChatRequest,
        user: store.User = Depends(current_user),
        db: sqlite3.Connection = Depends(get_db),
    ) -> ChatResponse:
        try:
            current = validate_draft(request.document_id, request.values)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        if request.draft_id is not None and store.get_draft(db, user.id, request.draft_id) is None:
            raise HTTPException(status_code=404, detail="Document not found.")
        try:
            reply, selected, values = run_turn(request, current)
        except llm.LLMUnavailable as exc:
            raise HTTPException(status_code=503, detail="The AI assistant is not configured.") from exc
        except Exception as exc:
            logger.exception("Chat completion failed")
            raise HTTPException(status_code=502, detail="The AI assistant is unavailable right now.") from exc

        draft_id = None
        if selected is not None:  # nothing worth saving until a document has been chosen
            transcript = [m.model_dump() for m in request.messages] + [{"role": "assistant", "content": reply}]
            saved = store.save_draft(db, user.id, request.draft_id, selected.id, values, transcript)
            draft_id = saved.id if saved else None
        return ChatResponse(
            reply=reply, document_id=selected.id if selected else None, values=values, draft_id=draft_id
        )

    # Registered last so /api routes take precedence over the static catch-all.
    static_dir = Path(os.environ.get("PRELEGAL_STATIC_DIR", DEFAULT_STATIC_DIR))
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
    return app


app = create_app()
