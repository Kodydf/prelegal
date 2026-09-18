"""LLM access: LiteLLM -> OpenRouter -> Cerebras, with Structured Outputs."""

import os
from datetime import date
from typing import Literal

from litellm import completion

from app.nda import CamelModel, NdaFields, NdaPatch

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}


class LLMUnavailable(Exception):
    """No API key is configured."""


class ChatMessage(CamelModel):
    role: Literal["user", "assistant"]
    content: str


class ChatTurn(CamelModel):
    """The model's structured response for one conversation turn."""

    reply: str
    fields: NdaPatch


SYSTEM_PROMPT = """You are Prelegal's drafting assistant. You help a user complete a Mutual Non-Disclosure \
Agreement (Common Paper standard terms) through friendly, freeform conversation.

Today's date is {today}.

The document has these fields:
- purpose: how Confidential Information may be used
- effectiveDate: when the MNDA starts
- mndaTermType: "expires" (after mndaTermYears years) or "continues" (until terminated)
- confidentialityTermType: "years" (confidentialityTermYears years) or "perpetuity"
- governingLaw: the US state whose law governs (e.g. "Delaware")
- jurisdiction: the courts' location (e.g. "New Castle, Delaware")
- modifications: optional changes to the standard terms
- partyOne / partyTwo: printName, title, company, noticeAddress (email or postal), date

Current values (empty string = not yet provided):
{current}

Rules:
- Ask about the document first if the user hasn't said what they need. This assistant can only draft a \
Mutual NDA; if they want another document type, say so politely and offer the Mutual NDA.
- Ask one or two focused questions at a time about missing fields. Never interrogate with a long list.
- In `fields`, return only values the user actually gave or clearly agreed to in this conversation; use \
null for everything else. Never invent names, companies, addresses or other facts. You may propose a \
sensible default (e.g. a 1-year term) and set it once the user accepts.
- A party's `date` is the date they sign; only set it if the user says when they sign, not from the effective date.
- Write dates as plain text like "September 18, 2026". Resolve relative dates ("today", "next Monday") \
using today's date.
- Keep replies short and warm. When all key fields are filled, say the document is ready and can be \
downloaded as a PDF from the preview panel. You give drafting help, not legal advice.
"""


def _ensure_api_key() -> None:
    """The .env file uses `OpenRouter_API_Key`; LiteLLM reads `OPENROUTER_API_KEY`."""
    if os.environ.get("OPENROUTER_API_KEY"):
        return
    key = os.environ.get("OpenRouter_API_Key")
    if not key:
        raise LLMUnavailable("OPENROUTER_API_KEY is not set")
    os.environ["OPENROUTER_API_KEY"] = key


def chat_turn(messages: list[ChatMessage], fields: NdaFields) -> ChatTurn:
    _ensure_api_key()
    system = SYSTEM_PROMPT.format(
        today=date.today().strftime("%B %d, %Y"),
        current=fields.model_dump_json(by_alias=True, indent=2),
    )
    response = completion(
        model=MODEL,
        messages=[{"role": "system", "content": system}]
        + [{"role": m.role, "content": m.content} for m in messages],
        response_format=ChatTurn,
        reasoning_effort="low",
        extra_body=EXTRA_BODY,
    )
    return ChatTurn.model_validate_json(response.choices[0].message.content)
