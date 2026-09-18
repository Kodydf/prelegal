import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import Field

from app import llm
from app.db import reset_db
from app.nda import CamelModel, NdaFields, apply_patch

MAX_MESSAGES = 60

DEFAULT_STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def lifespan(_: FastAPI):
    reset_db()
    yield


class ChatRequest(CamelModel):
    messages: list[llm.ChatMessage] = Field(min_length=1, max_length=MAX_MESSAGES)
    fields: NdaFields


class ChatResponse(CamelModel):
    reply: str
    fields: NdaFields


def create_app() -> FastAPI:
    app = FastAPI(title="Prelegal", lifespan=lifespan)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/chat", response_model=ChatResponse, response_model_by_alias=True)
    def chat(request: ChatRequest) -> ChatResponse:
        try:
            turn = llm.chat_turn(request.messages, request.fields)
        except llm.LLMUnavailable as exc:
            raise HTTPException(status_code=503, detail="The AI assistant is not configured.") from exc
        except Exception as exc:
            raise HTTPException(status_code=502, detail="The AI assistant is unavailable right now.") from exc
        return ChatResponse(reply=turn.reply, fields=apply_patch(request.fields, turn.fields))

    # Registered last so /api routes take precedence over the static catch-all.
    static_dir = Path(os.environ.get("PRELEGAL_STATIC_DIR", DEFAULT_STATIC_DIR))
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
    return app


app = create_app()
