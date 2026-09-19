import sqlite3
from contextlib import closing
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app import store
from app.api_auth import SESSION_COOKIE
from app.db import get_db_path
from app.main import create_app
from app.security import hash_password, hash_token, verify_password
from tests.conftest import sign_up

CREDS = {"email": "Ann@Example.com", "password": "correct horse"}


@pytest.fixture
def client():
    with TestClient(create_app()) as c:
        yield c


# --- Password hashing --------------------------------------------------------------------------


def test_password_hash_verifies_and_is_salted():
    first, second = hash_password("s3cret-pass"), hash_password("s3cret-pass")
    assert first != second  # random salt
    assert first.startswith("scrypt$") and "s3cret-pass" not in first
    assert verify_password("s3cret-pass", first)
    assert not verify_password("wrong", first)


@pytest.mark.parametrize("stored", ["", "garbage", "scrypt$x$y", "md5$1$2$3$aa$bb", "scrypt$16384$8$1$zz$zz"])
def test_verify_password_rejects_malformed_hashes(stored):
    assert verify_password("anything", stored) is False


# --- Sign up -----------------------------------------------------------------------------------


def test_signup_creates_account_and_signs_in(client):
    response = client.post("/api/auth/signup", json=CREDS)
    assert response.status_code == 201
    assert response.json() == {"email": "ann@example.com"}  # normalised to lower case
    assert client.get("/api/auth/me").json() == {"email": "ann@example.com"}


def test_session_cookie_is_httponly_and_samesite(client):
    header = client.post("/api/auth/signup", json=CREDS).headers["set-cookie"].lower()
    assert f"{SESSION_COOKIE}=" in header
    assert "httponly" in header and "samesite=lax" in header and "path=/" in header


def test_password_is_stored_hashed_and_token_only_as_a_hash(client):
    client.post("/api/auth/signup", json=CREDS)
    token = client.cookies.get(SESSION_COOKIE)
    with closing(sqlite3.connect(get_db_path())) as conn:
        (password_hash,) = conn.execute("SELECT password_hash FROM users").fetchone()
        (token_hash,) = conn.execute("SELECT token_hash FROM sessions").fetchone()
    assert "correct horse" not in password_hash and password_hash.startswith("scrypt$")
    assert token_hash == hash_token(token) and token not in token_hash


def test_duplicate_email_is_409_case_insensitively(client):
    client.post("/api/auth/signup", json=CREDS)
    other = client.post("/api/auth/signup", json={"email": "ANN@example.com", "password": "another-pass"})
    assert other.status_code == 409


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "not-an-email", "password": "correct horse"},
        {"email": "a@b", "password": "correct horse"},
        {"email": "ann@example.com", "password": "short"},
        {"email": "ann@example.com", "password": "x" * 129},
        {"email": "ann@example.com"},
    ],
)
def test_signup_validation(client, payload):
    assert client.post("/api/auth/signup", json=payload).status_code == 422


# --- Sign in / out -----------------------------------------------------------------------------


def test_signin_with_correct_password(client):
    client.post("/api/auth/signup", json=CREDS)
    client.post("/api/auth/signout")
    assert client.get("/api/auth/me").status_code == 401

    response = client.post("/api/auth/signin", json={"email": " ANN@example.com ", "password": "correct horse"})
    assert response.status_code == 200
    assert client.get("/api/auth/me").json() == {"email": "ann@example.com"}


def test_wrong_password_and_unknown_email_give_the_same_error(client):
    client.post("/api/auth/signup", json=CREDS)
    client.post("/api/auth/signout")
    wrong = client.post("/api/auth/signin", json={"email": "ann@example.com", "password": "nope nope nope"})
    unknown = client.post("/api/auth/signin", json={"email": "nobody@example.com", "password": "nope nope nope"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {"detail": "Invalid email or password."}
    assert client.get("/api/auth/me").status_code == 401


def test_signout_ends_the_session_on_the_server(client):
    client.post("/api/auth/signup", json=CREDS)
    token = client.cookies.get(SESSION_COOKIE)
    assert client.post("/api/auth/signout").status_code == 204
    # Replaying the old cookie must not work. (Same app, so the database is not reset underneath us.)
    other = TestClient(client.app)
    other.cookies.set(SESSION_COOKIE, token)
    assert other.get("/api/auth/me").status_code == 401


def test_signout_without_a_session_is_fine(client):
    assert client.post("/api/auth/signout").status_code == 204


def test_me_requires_a_session_and_rejects_a_forged_cookie(client):
    assert client.get("/api/auth/me").status_code == 401
    client.cookies.set(SESSION_COOKIE, "forged-token")
    assert client.get("/api/auth/me").status_code == 401


def test_expired_sessions_are_rejected(client):
    client.post("/api/auth/signup", json=CREDS)
    with closing(sqlite3.connect(get_db_path())) as conn:
        past = (store._now() - timedelta(minutes=1)).isoformat(timespec="seconds")
        conn.execute("UPDATE sessions SET expires_at = ?", (past,))
        conn.commit()
    assert client.get("/api/auth/me").status_code == 401


def test_two_users_have_independent_sessions(client):
    other = TestClient(client.app)
    sign_up(client, "a@example.com")
    sign_up(other, "b@example.com")
    assert client.get("/api/auth/me").json()["email"] == "a@example.com"
    assert other.get("/api/auth/me").json()["email"] == "b@example.com"


def test_chat_requires_sign_in(client):
    body = {"messages": [{"role": "user", "content": "hi"}]}
    assert client.post("/api/chat", json=body).status_code == 401
    assert client.get("/api/drafts").status_code == 401


def test_public_endpoints_stay_public(client):
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/documents").status_code == 200
