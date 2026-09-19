"""A signed-in user's saved documents. Everything is scoped to the current user; others' drafts are 404."""

import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from app import store
from app.api_auth import current_user
from app.db import get_db
from app.documents import get_document
from app.llm import ChatMessage
from app.schemas import CamelModel

router = APIRouter(prefix="/api/drafts", tags=["drafts"])


class DraftSummary(CamelModel):
    id: int
    document_id: str
    document_name: str
    parties: list[str]  # company names filled in so far, for a recognisable title
    updated_at: str


class DraftDetail(CamelModel):
    id: int
    document_id: str
    values: dict[str, str]
    messages: list[ChatMessage]
    updated_at: str


def summarize(draft: store.Draft) -> DraftSummary:
    document = get_document(draft.document_id)
    companies = (
        [draft.values.get(f"{party.key}_company", "").strip() for party in document.parties] if document else []
    )
    return DraftSummary(
        id=draft.id,
        document_id=draft.document_id,
        document_name=document.name if document else draft.document_id,
        parties=[name for name in companies if name],
        updated_at=draft.updated_at,
    )


@router.get("", response_model=list[DraftSummary], response_model_by_alias=True)
def list_drafts(user: store.User = Depends(current_user), db: sqlite3.Connection = Depends(get_db)):
    return [summarize(d) for d in store.list_drafts(db, user.id)]


@router.get("/{draft_id}", response_model=DraftDetail, response_model_by_alias=True)
def get_draft(draft_id: int, user: store.User = Depends(current_user), db: sqlite3.Connection = Depends(get_db)):
    draft = store.get_draft(db, user.id, draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return DraftDetail(
        id=draft.id,
        document_id=draft.document_id,
        values=draft.values,
        messages=[ChatMessage(**m) for m in draft.messages],
        updated_at=draft.updated_at,
    )


@router.delete("/{draft_id}", status_code=204)
def delete_draft(draft_id: int, user: store.User = Depends(current_user), db: sqlite3.Connection = Depends(get_db)):
    if not store.delete_draft(db, user.id, draft_id):
        raise HTTPException(status_code=404, detail="Document not found.")
