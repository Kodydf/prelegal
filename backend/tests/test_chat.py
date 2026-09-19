import json
import os
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import llm
from app.chat import ChatRequest, apply_turn, run_turn, validate_draft
from app.documents import get_document
from app.main import create_app

MSG = {"role": "user", "content": "We need a contract for our SaaS product"}


def body(document_id=None, values=None, messages=None):
    return {"messages": messages or [MSG], "documentId": document_id, "values": values or {}}


def fake_completion(reply="Hi!", document_id=None, **updates):
    """Stand-in for litellm.completion returning a structured ChatTurn as JSON."""
    content = json.dumps(
        {
            "reply": reply,
            "documentId": document_id,
            "updates": [{"key": k, "value": v} for k, v in updates.items()],
        }
    )
    calls = []

    def completion(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    completion.calls = calls
    return completion


def turn(document_id=None, **updates):
    return llm.ChatTurn(
        reply="ok",
        document_id=document_id,
        updates=[llm.FieldUpdate(key=k, value=v) for k, v in updates.items()],
    )


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    with TestClient(create_app()) as c:
        yield c


# --- apply_turn ------------------------------------------------------------------------------


def test_choosing_a_document_starts_from_defaults():
    document, values = apply_turn(None, {}, turn("mutual-nda"))
    assert document.id == "mutual-nda"
    assert values["purpose"].startswith("Evaluating whether")
    assert values["party1_company"] == ""


def test_updates_apply_to_current_document_and_keep_other_values():
    nda = get_document("mutual-nda")
    _, values = apply_turn(nda, nda.defaults(), turn(governing_law="Delaware", party1_company="Acme"))
    _, values = apply_turn(nda, values, turn("mutual-nda", party2_company="Globex"))
    assert (values["governing_law"], values["party1_company"], values["party2_company"]) == (
        "Delaware", "Acme", "Globex",
    )


def test_switching_documents_resets_the_draft():
    nda = get_document("mutual-nda")
    document, values = apply_turn(nda, {**nda.defaults(), "governing_law": "Texas"}, turn("pilot-agreement", pilot_period="60 days"))
    assert document.id == "pilot-agreement"
    assert values["pilot_period"] == "60 days"
    assert values["governing_law"] == ""
    assert "purpose" not in values


def test_null_document_id_keeps_the_current_document():
    pilot = get_document("pilot-agreement")
    document, _ = apply_turn(pilot, pilot.defaults(), turn(None, pilot_period="30 days"))
    assert document.id == "pilot-agreement"


def test_unknown_document_id_and_unknown_or_oversized_fields_are_dropped():
    nda = get_document("mutual-nda")
    document, values = apply_turn(
        nda, nda.defaults(), turn("made-up-doc", made_up_field="x", governing_law="y" * 501, purpose="New purpose")
    )
    assert document.id == "mutual-nda"
    assert "made_up_field" not in values
    assert values["governing_law"] == ""
    assert values["purpose"] == "New purpose"


def test_updates_without_a_document_are_ignored():
    document, values = apply_turn(None, {}, turn(None, governing_law="Delaware"))
    assert document is None and values == {}


def test_field_can_be_cleared_with_empty_string():
    nda = get_document("mutual-nda")
    _, values = apply_turn(nda, {**nda.defaults(), "governing_law": "Texas"}, turn(governing_law=""))
    assert values["governing_law"] == ""


# --- validate_draft --------------------------------------------------------------------------


def test_validate_draft_rejects_bad_drafts():
    with pytest.raises(ValueError):
        validate_draft(None, {"x": "y"})
    with pytest.raises(ValueError):
        validate_draft("nope", {})
    with pytest.raises(ValueError):
        validate_draft("mutual-nda", {"not_a_field": "y"})
    with pytest.raises(ValueError):
        validate_draft("mutual-nda", {"governing_law": "y" * 501})
    assert validate_draft("mutual-nda", {"governing_law": "Texas"}).id == "mutual-nda"


# --- /api/chat -------------------------------------------------------------------------------


def test_chat_picks_document_and_fills_fields(client, monkeypatch):
    fake = fake_completion(
        "Great, a Cloud Service Agreement fits. Who is the provider?",
        "cloud-service-agreement",
        provider_company="Acme Inc",
        governing_law="Delaware",
    )
    monkeypatch.setattr(llm, "completion", fake)
    response = client.post("/api/chat", json=body())
    assert response.status_code == 200
    data = response.json()
    assert data["documentId"] == "cloud-service-agreement"
    assert data["values"]["provider_company"] == "Acme Inc"
    assert data["values"]["governing_law"] == "Delaware"
    assert "provider?" in data["reply"]


def test_choosing_a_document_reruns_the_turn_with_that_documents_fields(client, monkeypatch):
    fake = fake_completion("Who is the provider?", "cloud-service-agreement", provider_company="Acme Inc")
    monkeypatch.setattr(llm, "completion", fake)
    client.post("/api/chat", json=body())
    assert len(fake.calls) == 2
    assert "No document has been chosen yet." in fake.calls[0]["messages"][0]["content"]
    second = fake.calls[1]["messages"][0]["content"]
    assert "Current document: Cloud Service Agreement" in second and "provider_company" in second
    assert "only just chosen" in second
    assert "only just chosen" not in fake.calls[0]["messages"][0]["content"]


def test_no_rerun_when_the_document_does_not_change(client, monkeypatch):
    fake = fake_completion("ok", None, governing_law="Delaware")
    monkeypatch.setattr(llm, "completion", fake)
    client.post("/api/chat", json=body("mutual-nda", {"party1_company": "Acme"}))
    assert len(fake.calls) == 1


def test_second_pass_cannot_switch_documents_again(client, monkeypatch):
    replies = iter([
        ("cloud-service-agreement", {}),
        ("pilot-agreement", {"provider_company": "Acme"}),  # second pass tries to switch again
    ])

    def completion(**kwargs):
        doc, updates = next(replies)
        content = json.dumps({"reply": "r", "documentId": doc, "updates": [{"key": k, "value": v} for k, v in updates.items()]})
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    monkeypatch.setattr(llm, "completion", completion)
    data = client.post("/api/chat", json=body()).json()
    assert data["documentId"] == "cloud-service-agreement"
    assert data["values"]["provider_company"] == "Acme"


def test_double_escaped_newlines_in_replies_become_real_newlines(client, monkeypatch):
    monkeypatch.setattr(llm, "completion", fake_completion("Noted.\\n\\n- Governing Law: Delaware"))
    reply = client.post("/api/chat", json=body("mutual-nda")).json()["reply"]
    assert reply == "Noted.\n\n- Governing Law: Delaware"


def test_chat_declines_unsupported_without_choosing_a_document(client, monkeypatch):
    monkeypatch.setattr(llm, "completion", fake_completion("We can't generate leases; the closest is..."))
    data = client.post("/api/chat", json=body()).json()
    assert data["documentId"] is None
    assert data["values"] == {}


def test_prompt_lists_catalog_current_fields_and_unsupported_guidance(client, monkeypatch):
    fake = fake_completion()
    monkeypatch.setattr(llm, "completion", fake)
    client.post("/api/chat", json=body())
    system = fake.calls[0]["messages"][0]["content"]
    assert "cloud-service-agreement: Cloud Service Agreement" in system
    assert "No document has been chosen yet." in system
    assert "closest supported document" in system
    assert "Today's date is" in system
    assert "never fill it from a company name" in " ".join(system.split())
    assert "plain text only" in system.lower()

    client.post("/api/chat", json=body("service-level-agreement", {"target_uptime": "99.9%"}))
    system = fake.calls[1]["messages"][0]["content"]
    assert "Current document: Service Level Agreement" in system
    assert '- target_uptime | Target Uptime |' in system and '"99.9%"' in system
    assert "provider_company" in system


def test_chat_sends_cerebras_provider_timeout_and_history(client, monkeypatch):
    fake = fake_completion()
    monkeypatch.setattr(llm, "completion", fake)
    client.post("/api/chat", json=body())
    call = fake.calls[0]
    assert call["model"] == "openrouter/openai/gpt-oss-120b"
    assert call["extra_body"] == {"provider": {"order": ["cerebras"]}}
    assert call["response_format"] is llm.ChatTurn
    assert call["timeout"] == llm.TIMEOUT_SECONDS and call["num_retries"] == 1
    assert call["messages"][-1] == {"role": "user", "content": MSG["content"]}


def test_chat_503_without_api_key(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("OpenRouter_API_Key", raising=False)
    with TestClient(create_app()) as c:
        assert c.post("/api/chat", json=body()).status_code == 503


def test_chat_accepts_mixed_case_env_key(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.setenv("OpenRouter_API_Key", "from-dotenv")
    monkeypatch.setattr(llm, "completion", fake_completion())
    with TestClient(create_app()) as c:
        assert c.post("/api/chat", json=body()).status_code == 200
    assert os.environ["OPENROUTER_API_KEY"] == "from-dotenv"


def test_chat_502_when_llm_fails_or_returns_garbage(client, monkeypatch):
    def boom(**_):
        raise RuntimeError("provider exploded")

    monkeypatch.setattr(llm, "completion", boom)
    response = client.post("/api/chat", json=body())
    assert response.status_code == 502 and "exploded" not in response.text

    bad = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="not json"))])
    monkeypatch.setattr(llm, "completion", lambda **_: bad)
    assert client.post("/api/chat", json=body()).status_code == 502


@pytest.mark.parametrize(
    "payload",
    [
        {**body(), "messages": []},
        {**body(), "messages": [{"role": "system", "content": "x"}]},
        {**body(), "messages": [{"role": "user", "content": "x" * 2001}]},
        body("nope"),
        body("mutual-nda", {"not_a_field": "x"}),
        body("mutual-nda", {"governing_law": "x" * 501}),
        body(None, {"governing_law": "x"}),
    ],
)
def test_chat_rejects_invalid_requests(client, monkeypatch, payload):
    monkeypatch.setattr(llm, "completion", fake_completion())
    assert client.post("/api/chat", json=payload).status_code == 422


# --- Live tests (real model; need an OpenRouter key) ------------------------------------------

needs_key = pytest.mark.skipif(
    not (os.environ.get("OPENROUTER_API_KEY") or os.environ.get("OpenRouter_API_Key")),
    reason="needs an OpenRouter key",
)


@pytest.mark.live
@needs_key
def test_live_picks_the_cloud_service_agreement_and_fills_fields_from_the_same_message():
    request = ChatRequest(
        messages=[llm.ChatMessage(role="user", content="We sell a SaaS product and need the contract for a customer. We're Acme Inc, governed by Delaware law.")],
    )
    reply, document, values = run_turn(request, None)
    assert document is not None and document.id == "cloud-service-agreement"
    assert "Acme" in values["provider_company"]
    assert "Delaware" in values["governing_law"]
    assert reply


@pytest.mark.live
@needs_key
def test_live_declines_unsupported_and_offers_closest():
    result = llm.chat_turn(
        [llm.ChatMessage(role="user", content="I need an employment agreement for a new hire.")], None, {}
    )
    assert result.document_id is None
    assert result.updates == []
    assert len(result.reply) > 40


@pytest.mark.live
@needs_key
def test_live_fills_fields_for_the_current_document():
    nda = get_document("mutual-nda")
    result = llm.chat_turn(
        [llm.ChatMessage(role="user", content="Delaware law, courts in Wilmington, Delaware. Party 1 is Northwind Inc and Party 2 is Lee Design LLC.")],
        nda,
        nda.defaults(),
    )
    updates = {u.key: u.value for u in result.updates}
    assert "Delaware" in updates.get("governing_law", "")
    assert "Northwind" in updates.get("party1_company", "")
    assert "Lee Design" in updates.get("party2_company", "")
