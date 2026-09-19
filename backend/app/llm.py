"""LLM access: LiteLLM -> OpenRouter -> Cerebras, with Structured Outputs."""

import json
import os
from datetime import date
from typing import Literal

from litellm import completion
from pydantic import Field

from app.documents import DocumentDetail, list_documents
from app.schemas import CamelModel

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
TIMEOUT_SECONDS = 30
MODEL_HISTORY = 40  # the model sees the latest messages; the draft values carry everything settled so far


class LLMUnavailable(Exception):
    """No API key is configured."""


class ChatMessage(CamelModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=2000)


class FieldUpdate(CamelModel):
    key: str
    value: str


class ChatTurn(CamelModel):
    """The model's structured response for one conversation turn."""

    reply: str
    # The document being drafted after this turn. Null means "no change" (also when the user asked
    # for something we can't generate).
    document_id: str | None
    # Values learned this turn, using the field keys listed in the prompt.
    updates: list[FieldUpdate]


SYSTEM_PROMPT = """You are Prelegal's drafting assistant. You guide the user, step by step and in friendly \
plain English, through drafting a legal agreement from Common Paper's standard templates.

Today's date is {today}.

Supported documents (id: name - description):
{catalog}

{current}

How to help:
- If no document is chosen yet, ask what the user needs. Match their need to a supported document, briefly \
confirm your choice, and set documentId. If it's unclear which fits, ask one short question or describe \
the two best options.
- If the user wants something we cannot generate (for example an employment agreement, lease or will), say \
plainly that we can't generate it, name the closest supported document and why it is close, and ask whether \
they'd like that one. Do not set documentId until they agree. You give drafting help, not legal advice.
- To switch documents, set documentId to the new id; the draft starts fresh, so confirm with the user first.
- Once a document is chosen, walk through it in this order: the parties' company names, then the key terms in \
the order listed, then each party's signer details (name, title, notice address) and signing dates last. Ask \
about one to three related fields at a time, explain what each means in a sentence, and suggest a sensible \
default or example where that helps. Never dump the whole list.
- Every turn, re-read the whole conversation and record in `updates` every fact that belongs in a field that \
is still blank, even if the user said it earlier or before the document was chosen. Include only values the \
user actually gave or clearly agreed to in this conversation, using the exact keys above. Never invent \
names, addresses or other facts. A company name goes only in the `_company` field: the `_name` field is the \
name of the individual person signing, so never fill it from a company name. If the user says to skip a field, leave it blank and move on. To clear a field, set its value to \
an empty string.
- Write dates as plain text like "September 18, 2026". Resolve relative dates ("today", "next Monday") using \
today's date.
- Unless the document is complete, always end your reply with your next question, so the user knows exactly \
what to answer next.
- Keep replies short and warm. Use plain text only: no markdown, no asterisks, no headings; short lines \
starting with "- " are fine for lists.
- Wrapping up: once the key terms are covered, ask about the signer details, and say they can be left blank \
and completed by hand after downloading. When nothing important remains, say the document is ready to review \
and can be downloaded as a PDF from the preview panel, and mention any fields still blank.
"""


def _catalog_text() -> str:
    return "\n".join(f"- {d.id}: {d.name} - {d.description}" for d in list_documents())


def _current_text(document: DocumentDetail | None, values: dict[str, str], just_selected: bool) -> str:
    if document is None:
        return "No document has been chosen yet."
    lines = [f"Current document: {document.name} (documentId: {document.id})."]
    if just_selected:
        lines.append(
            "This document was only just chosen, so nothing is recorded yet. Record everything relevant the "
            "user has already said, then continue with your next question."
        )
    if document.note:
        lines.append(document.note)
    lines.append('Fields (key | label | what it is | current value, "" = not provided yet):')
    lines += [
        f"- {f.key} | {f.label} | {f.hint} | {json.dumps(values.get(f.key, ''))}"
        for f in document.all_fields()
    ]
    return "\n".join(lines)


def _ensure_api_key() -> None:
    """The .env file uses `OpenRouter_API_Key`; LiteLLM reads `OPENROUTER_API_KEY`."""
    if os.environ.get("OPENROUTER_API_KEY"):
        return
    key = os.environ.get("OpenRouter_API_Key")
    if not key:
        raise LLMUnavailable("OPENROUTER_API_KEY is not set")
    os.environ["OPENROUTER_API_KEY"] = key


def chat_turn(
    messages: list[ChatMessage],
    document: DocumentDetail | None,
    values: dict[str, str],
    *,
    just_selected: bool = False,
) -> ChatTurn:
    _ensure_api_key()
    system = SYSTEM_PROMPT.format(
        today=date.today().strftime("%B %d, %Y"),
        catalog=_catalog_text(),
        current=_current_text(document, values, just_selected),
    )
    response = completion(
        model=MODEL,
        messages=[{"role": "system", "content": system}]
        + [{"role": m.role, "content": m.content} for m in messages[-MODEL_HISTORY:]],
        response_format=ChatTurn,
        reasoning_effort="low",
        timeout=TIMEOUT_SECONDS,
        num_retries=1,
        extra_body=EXTRA_BODY,
    )
    turn = ChatTurn.model_validate_json(response.choices[0].message.content)
    # The model sometimes double-escapes newlines in structured output, leaving a literal backslash-n.
    return turn.model_copy(update={"reply": turn.reply.replace("\\n", "\n")})
