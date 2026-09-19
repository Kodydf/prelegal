import json
import sqlite3
from contextlib import closing
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import llm
from app.db import get_db_path
from app.main import create_app
from tests.conftest import sign_up


def scripted(*turns):
    """A fake litellm.completion returning the given (reply, documentId, updates) turns in order."""
    remaining = list(turns)

    def completion(**_):
        reply, document_id, updates = remaining.pop(0) if len(remaining) > 1 else remaining[0]
        content = json.dumps(
            {"reply": reply, "documentId": document_id, "updates": [{"key": k, "value": v} for k, v in updates.items()]}
        )
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    return completion


def user_msg(text):
    return {"role": "user", "content": text}


@pytest.fixture
def app_client(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    with TestClient(create_app()) as c:
        yield c


@pytest.fixture
def client(app_client):
    return sign_up(app_client, "ann@example.com")


def chat(client, messages, document_id=None, values=None, draft_id=None):
    payload = {"messages": messages, "documentId": document_id, "values": values or {}, "draftId": draft_id}
    return client.post("/api/chat", json=payload)


def test_no_draft_is_saved_until_a_document_is_chosen(client, monkeypatch):
    monkeypatch.setattr(llm, "completion", scripted(("We can't do leases.", None, {})))
    data = chat(client, [user_msg("I need a lease")]).json()
    assert data["draftId"] is None
    assert client.get("/api/drafts").json() == []


def test_choosing_a_document_creates_a_draft_that_later_turns_update(client, monkeypatch):
    monkeypatch.setattr(
        llm,
        "completion",
        scripted(
            ("Pilot it is.", "pilot-agreement", {"provider_company": "Northwind Inc"}),
            ("Pilot it is.", "pilot-agreement", {"provider_company": "Northwind Inc"}),  # rerun after selection
            ("Got the customer.", None, {"customer_company": "Lee Design LLC"}),
        ),
    )
    first = chat(client, [user_msg("pilot with Lee")]).json()
    draft_id = first["draftId"]
    assert isinstance(draft_id, int)

    history = [user_msg("pilot with Lee"), {"role": "assistant", "content": first["reply"]}, user_msg("Lee Design LLC")]
    second = chat(client, history, first["documentId"], first["values"], draft_id).json()
    assert second["draftId"] == draft_id  # updated in place, not duplicated

    listing = client.get("/api/drafts").json()
    assert len(listing) == 1
    assert listing[0]["documentName"] == "Pilot Agreement"
    assert listing[0]["parties"] == ["Northwind Inc", "Lee Design LLC"]

    detail = client.get(f"/api/drafts/{draft_id}").json()
    assert detail["documentId"] == "pilot-agreement"
    assert detail["values"]["customer_company"] == "Lee Design LLC"
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant", "user", "assistant"]
    assert detail["messages"][-1]["content"] == "Got the customer."


def test_a_failed_turn_saves_nothing(client, monkeypatch):
    def boom(**_):
        raise RuntimeError("provider exploded")

    monkeypatch.setattr(llm, "completion", boom)
    assert chat(client, [user_msg("nda")]).status_code == 502
    assert client.get("/api/drafts").json() == []


def test_separate_conversations_make_separate_drafts_newest_first(client, monkeypatch):
    monkeypatch.setattr(llm, "completion", scripted(("ok", "mutual-nda", {"party1_company": "One"})))
    chat(client, [user_msg("nda")])
    monkeypatch.setattr(llm, "completion", scripted(("ok", "pilot-agreement", {"provider_company": "Two"})))
    chat(client, [user_msg("pilot")])
    names = [d["documentName"] for d in client.get("/api/drafts").json()]
    assert names == ["Pilot Agreement", "Mutual Non-Disclosure Agreement"]


def test_switching_documents_updates_the_same_draft(client, monkeypatch):
    monkeypatch.setattr(llm, "completion", scripted(("ok", "mutual-nda", {})))
    draft_id = chat(client, [user_msg("nda")]).json()["draftId"]
    monkeypatch.setattr(llm, "completion", scripted(("ok", "pilot-agreement", {})))
    values = {"purpose": "x"}
    switched = chat(client, [user_msg("actually a pilot")], "mutual-nda", values, draft_id).json()
    assert switched["draftId"] == draft_id and switched["documentId"] == "pilot-agreement"
    assert client.get(f"/api/drafts/{draft_id}").json()["documentId"] == "pilot-agreement"


def test_delete_a_draft(client, monkeypatch):
    monkeypatch.setattr(llm, "completion", scripted(("ok", "mutual-nda", {})))
    draft_id = chat(client, [user_msg("nda")]).json()["draftId"]
    assert client.delete(f"/api/drafts/{draft_id}").status_code == 204
    assert client.get("/api/drafts").json() == []
    assert client.get(f"/api/drafts/{draft_id}").status_code == 404
    assert client.delete(f"/api/drafts/{draft_id}").status_code == 404


def test_users_cannot_see_change_or_delete_each_others_drafts(app_client, monkeypatch):
    monkeypatch.setattr(llm, "completion", scripted(("ok", "mutual-nda", {"party1_company": "Secret Corp"})))
    ann = sign_up(app_client, "ann@example.com")
    draft_id = chat(ann, [user_msg("nda")]).json()["draftId"]

    # A second client on the same app (entering create_app() again would reset the shared database).
    bob = sign_up(TestClient(app_client.app), "bob@example.com")
    assert bob.get("/api/drafts").json() == []
    assert bob.get(f"/api/drafts/{draft_id}").status_code == 404
    assert bob.delete(f"/api/drafts/{draft_id}").status_code == 404
    # Nor can Bob write into Ann's draft through the chat endpoint.
    assert chat(bob, [user_msg("hi")], "mutual-nda", {}, draft_id).status_code == 404

    assert ann.get(f"/api/drafts/{draft_id}").json()["values"]["party1_company"] == "Secret Corp"


def test_unknown_draft_id_is_404_and_does_not_call_the_model(client, monkeypatch):
    calls = []
    monkeypatch.setattr(llm, "completion", lambda **kw: calls.append(kw))
    assert chat(client, [user_msg("hi")], draft_id=999).status_code == 404
    assert calls == []


def test_drafts_are_deleted_with_their_user(client, monkeypatch):
    monkeypatch.setattr(llm, "completion", scripted(("ok", "mutual-nda", {})))
    chat(client, [user_msg("nda")])
    with closing(sqlite3.connect(get_db_path())) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("DELETE FROM users")
        conn.commit()
        assert conn.execute("SELECT COUNT(*) FROM drafts").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 0


def test_database_is_reset_when_the_server_restarts(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(llm, "completion", scripted(("ok", "mutual-nda", {})))
    with TestClient(create_app()) as first:
        sign_up(first, "ann@example.com")
        chat(first, [user_msg("nda")])
        cookie = first.cookies.get("prelegal_session")
    with TestClient(create_app()) as restarted:  # a new server start recreates the database
        restarted.cookies.set("prelegal_session", cookie)
        assert restarted.get("/api/auth/me").status_code == 401
        sign_up(restarted, "ann@example.com")  # the email is free again
        assert restarted.get("/api/drafts").json() == []
