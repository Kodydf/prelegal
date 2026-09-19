import json
import sqlite3
from contextlib import closing
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import llm, store
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


# --- Durability, history limits and the per-user cap ------------------------------------------


def test_writes_are_committed_before_the_store_call_returns():
    """A second connection must see each write immediately (cleanup after the response can't be relied on)."""
    from app.db import get_db_path, reset_db
    from app.security import hash_password

    reset_db()
    writer = sqlite3.connect(get_db_path())
    writer.row_factory = sqlite3.Row
    reader = sqlite3.connect(get_db_path())
    try:
        user = store.create_user(writer, "ann@example.com", hash_password("correct horse"))
        assert reader.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1
        store.create_session(writer, user.id, "token-1")
        assert reader.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 1
        draft = store.save_draft(writer, user.id, None, "mutual-nda", {}, [{"role": "user", "content": "hi"}])
        assert reader.execute("SELECT COUNT(*) FROM drafts").fetchone()[0] == 1
        store.delete_draft(writer, user.id, draft.id)
        assert reader.execute("SELECT COUNT(*) FROM drafts").fetchone()[0] == 0
        store.delete_session(writer, "token-1")
        assert reader.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 0
    finally:
        writer.close()
        reader.close()


def test_a_long_conversation_can_always_be_resumed_and_continued(client, monkeypatch):
    fake_calls = []

    def completion(**kwargs):
        fake_calls.append(kwargs)
        content = json.dumps({"reply": "ok", "documentId": "mutual-nda", "updates": []})
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    monkeypatch.setattr(llm, "completion", completion)
    long_history = [user_msg(f"message {i}") for i in range(200)]  # the most a request may carry
    first = chat(client, long_history, "mutual-nda", {}, None)
    assert first.status_code == 200
    draft_id = first.json()["draftId"]

    saved = client.get(f"/api/drafts/{draft_id}").json()["messages"]
    assert len(saved) == store.MAX_SAVED_MESSAGES  # only the most recent are kept
    assert saved[-1]["content"] == "ok" and saved[-2]["content"] == "message 199"

    # Resuming and continuing is fine: what the client sends back is again within the request limit.
    resumed = saved + [user_msg("one more")]
    assert chat(client, resumed, "mutual-nda", {}, draft_id).status_code == 200

    assert chat(client, [user_msg("x")] * 201, "mutual-nda", {}, draft_id).status_code == 422


def test_the_model_only_sees_the_latest_messages(client, monkeypatch):
    seen = []

    def completion(**kwargs):
        seen.append(kwargs["messages"])
        content = json.dumps({"reply": "ok", "documentId": None, "updates": []})
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    monkeypatch.setattr(llm, "completion", completion)
    chat(client, [user_msg(f"m{i}") for i in range(120)])
    sent = seen[0]
    assert sent[0]["role"] == "system"
    assert len(sent) - 1 == llm.MODEL_HISTORY
    assert sent[-1]["content"] == "m119"


def test_draft_cap_blocks_new_drafts_before_calling_the_model_but_not_updates(client, monkeypatch):
    monkeypatch.setattr(store, "MAX_DRAFTS_PER_USER", 2)
    monkeypatch.setattr(llm, "completion", scripted(("ok", "mutual-nda", {})))
    first = chat(client, [user_msg("one")]).json()["draftId"]
    chat(client, [user_msg("two")])

    calls = []
    monkeypatch.setattr(llm, "completion", lambda **kw: calls.append(kw))
    blocked = chat(client, [user_msg("three")])
    assert blocked.status_code == 409 and "limit" in blocked.json()["detail"]
    assert calls == []  # no model call was spent

    monkeypatch.setattr(llm, "completion", scripted(("ok", "mutual-nda", {})))
    assert chat(client, [user_msg("again")], "mutual-nda", {}, first).status_code == 200  # updates still work
    client.delete(f"/api/drafts/{first}")
    assert chat(client, [user_msg("three")]).status_code == 200  # room again after deleting one
