import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from app import llm
from app.chat import ChatRequest, ChatResponse, run_turn, validate_draft
from app.db import reset_db
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
    def chat(request: ChatRequest) -> ChatResponse:
        try:
            current = validate_draft(request.document_id, request.values)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        try:
            reply, selected, values = run_turn(request, current)
        except llm.LLMUnavailable as exc:
            raise HTTPException(status_code=503, detail="The AI assistant is not configured.") from exc
        except Exception as exc:
            logger.exception("Chat completion failed")
            raise HTTPException(status_code=502, detail="The AI assistant is unavailable right now.") from exc
        return ChatResponse(reply=reply, document_id=selected.id if selected else None, values=values)

    # Registered last so /api routes take precedence over the static catch-all.
    static_dir = Path(os.environ.get("PRELEGAL_STATIC_DIR", DEFAULT_STATIC_DIR))
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
    return app


app = create_app()
