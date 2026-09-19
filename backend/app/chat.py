"""Chat request/response models and the logic that applies a model turn to the draft."""

import logging

from pydantic import Field

from app.documents import DocumentDetail, get_document, max_length
from app import llm
from app.llm import ChatMessage, ChatTurn
from app.schemas import CamelModel

logger = logging.getLogger(__name__)

MAX_MESSAGES = 60


class ChatRequest(CamelModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_MESSAGES)
    document_id: str | None = None
    values: dict[str, str] = {}


class ChatResponse(CamelModel):
    reply: str
    document_id: str | None
    values: dict[str, str]


def validate_draft(document_id: str | None, values: dict[str, str]) -> DocumentDetail | None:
    """Check the client's draft against the document definition; raises ValueError if it doesn't fit."""
    if document_id is None:
        if values:
            raise ValueError("values require a documentId")
        return None
    document = get_document(document_id)
    if document is None:
        raise ValueError(f"unknown document {document_id!r}")
    fields = document.field_map()
    for key, value in values.items():
        if key not in fields:
            raise ValueError(f"unknown field {key!r}")
        if len(value) > max_length(fields[key]):
            raise ValueError(f"field {key!r} is too long")
    return document


def apply_turn(
    document: DocumentDetail | None, values: dict[str, str], turn: ChatTurn
) -> tuple[DocumentDetail | None, dict[str, str]]:
    """Apply the model's turn: maybe switch documents (starting from defaults), then set updated values.

    The model is untrusted: unknown document ids, unknown field keys and over-long values are
    dropped rather than stored.
    """
    if turn.document_id and (document is None or turn.document_id != document.id):
        switched = get_document(turn.document_id)
        if switched is None:
            logger.warning("Model chose unknown document %r; ignoring", turn.document_id)
        else:
            document, values = switched, switched.defaults()

    values = dict(values)
    if document is None:
        return None, values

    fields = document.field_map()
    for update in turn.updates:
        field = fields.get(update.key)
        if field is None:
            logger.warning("Model updated unknown field %r; ignoring", update.key)
        elif len(update.value) > max_length(field):
            logger.warning("Model value for %r is too long; ignoring", update.key)
        else:
            values[update.key] = update.value.strip()
    return document, values


def run_turn(request: ChatRequest, current: DocumentDetail | None) -> tuple[str, DocumentDetail | None, dict[str, str]]:
    """Run one conversation turn and return (reply, document, values).

    When the model picks a document, it didn't yet know that document's field keys, so it couldn't
    record anything the user already said. Run the turn once more with the new document's fields.
    """
    turn = llm.chat_turn(request.messages, current, request.values)
    document, values = apply_turn(current, request.values, turn)
    if document is not current and document is not None:
        turn = llm.chat_turn(request.messages, document, values, just_selected=True)
        # Only field updates from the second pass; a further document switch is ignored.
        document, values = apply_turn(document, values, turn.model_copy(update={"document_id": None}))
    return turn.reply, document, values
