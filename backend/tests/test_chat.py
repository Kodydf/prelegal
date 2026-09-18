import json
import os
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import llm
from app.main import create_app
from app.nda import NdaFields, NdaPatch, apply_patch

EMPTY_PATCH = {
    "purpose": None, "effectiveDate": None, "mndaTermType": None, "mndaTermYears": None,
    "confidentialityTermType": None, "confidentialityTermYears": None, "governingLaw": None,
    "jurisdiction": None, "modifications": None, "partyOne": None, "partyTwo": None,
}
BODY = {
    "messages": [{"role": "user", "content": "We are Acme and Globex"}],
    "fields": NdaFields().model_dump(by_alias=True),
}


def fake_completion(reply="Hi!", **patch):
    """Build a stand-in for litellm.completion returning a structured ChatTurn as JSON."""
    content = json.dumps({"reply": reply, "fields": {**EMPTY_PATCH, **patch}})
    calls = []

    def completion(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    completion.calls = calls
    return completion


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    with TestClient(create_app()) as c:
        yield c


def test_apply_patch_only_changes_non_null_values():
    fields = NdaFields(governing_law="Texas")
    patch = NdaPatch.model_validate({**EMPTY_PATCH, "jurisdiction": "Austin, Texas"})
    result = apply_patch(fields, patch)
    assert result.governing_law == "Texas"
    assert result.jurisdiction == "Austin, Texas"


def test_apply_patch_merges_party_fields():
    fields = NdaFields()
    fields.party_one.company = "Acme"
    patch = NdaPatch.model_validate({**EMPTY_PATCH, "partyOne": {
        "printName": "Ann", "title": None, "company": None, "noticeAddress": None, "date": None}})
    result = apply_patch(fields, patch)
    assert result.party_one.print_name == "Ann"
    assert result.party_one.company == "Acme"  # untouched
    assert result.party_two.print_name == ""


def test_chat_returns_reply_and_merged_fields(client, monkeypatch):
    fake = fake_completion(
        "Great, who signs for Acme?",
        governingLaw="Delaware",
        partyOne={"printName": None, "title": None, "company": "Acme", "noticeAddress": None, "date": None},
    )
    monkeypatch.setattr(llm, "completion", fake)
    response = client.post("/api/chat", json=BODY)
    assert response.status_code == 200
    data = response.json()
    assert data["reply"] == "Great, who signs for Acme?"
    assert data["fields"]["governingLaw"] == "Delaware"
    assert data["fields"]["partyOne"]["company"] == "Acme"
    assert data["fields"]["mndaTermType"] == "expires"  # unchanged default, camelCase on the wire


def test_chat_sends_cerebras_provider_and_current_fields(client, monkeypatch):
    fake = fake_completion()
    monkeypatch.setattr(llm, "completion", fake)
    client.post("/api/chat", json=BODY)
    call = fake.calls[0]
    assert call["model"] == "openrouter/openai/gpt-oss-120b"
    assert call["extra_body"] == {"provider": {"order": ["cerebras"]}}
    assert call["response_format"] is llm.ChatTurn
    assert call["messages"][0]["role"] == "system"
    assert "governingLaw" in call["messages"][0]["content"]
    assert call["messages"][-1] == {"role": "user", "content": "We are Acme and Globex"}


def test_chat_503_without_api_key(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("OpenRouter_API_Key", raising=False)
    with TestClient(create_app()) as c:
        assert c.post("/api/chat", json=BODY).status_code == 503


def test_chat_accepts_mixed_case_env_key(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.setenv("OpenRouter_API_Key", "from-dotenv")
    monkeypatch.setattr(llm, "completion", fake_completion())
    with TestClient(create_app()) as c:
        assert c.post("/api/chat", json=BODY).status_code == 200
    assert os.environ["OPENROUTER_API_KEY"] == "from-dotenv"


def test_chat_502_when_llm_fails(client, monkeypatch):
    def boom(**_):
        raise RuntimeError("provider exploded")

    monkeypatch.setattr(llm, "completion", boom)
    response = client.post("/api/chat", json=BODY)
    assert response.status_code == 502
    assert "exploded" not in response.text


def test_chat_502_on_malformed_model_output(client, monkeypatch):
    bad = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="not json"))])
    monkeypatch.setattr(llm, "completion", lambda **_: bad)
    assert client.post("/api/chat", json=BODY).status_code == 502


@pytest.mark.parametrize("body", [
    {**BODY, "messages": []},
    {**BODY, "messages": [{"role": "system", "content": "x"}]},
    {"messages": BODY["messages"]},
])
def test_chat_rejects_invalid_requests(client, body):
    assert client.post("/api/chat", json=body).status_code == 422


@pytest.mark.live
@pytest.mark.skipif(
    not (os.environ.get("OPENROUTER_API_KEY") or os.environ.get("OpenRouter_API_Key")),
    reason="needs an OpenRouter key",
)
def test_live_llm_extracts_fields():
    turn = llm.chat_turn(
        [llm.ChatMessage(role="user", content="Draft an NDA between Acme Corp and Globex Inc, governed by Delaware law.")],
        NdaFields(),
    )
    assert turn.reply
    assert turn.fields.governing_law and "Delaware" in turn.fields.governing_law
