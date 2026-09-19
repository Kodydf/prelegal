"""SQL for users, sessions and drafts. Every draft query is scoped to a user id."""

import json
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.security import hash_token

SESSION_LIFETIME = timedelta(days=7)


def _now() -> datetime:
    return datetime.now(UTC)


def _iso(moment: datetime) -> str:
    return moment.isoformat(timespec="seconds")


# --- Users and sessions ----------------------------------------------------------------------


@dataclass
class User:
    id: int
    email: str


class EmailTaken(Exception):
    pass


def create_user(db: sqlite3.Connection, email: str, password_hash: str) -> User:
    try:
        cursor = db.execute("INSERT INTO users (email, password_hash) VALUES (?, ?)", (email, password_hash))
    except sqlite3.IntegrityError as exc:
        raise EmailTaken(email) from exc
    return User(id=cursor.lastrowid, email=email)


def find_user_with_hash(db: sqlite3.Connection, email: str) -> tuple[User, str] | None:
    row = db.execute("SELECT id, email, password_hash FROM users WHERE email = ?", (email,)).fetchone()
    return (User(row["id"], row["email"]), row["password_hash"]) if row else None


def create_session(db: sqlite3.Connection, user_id: int, token: str) -> None:
    db.execute("DELETE FROM sessions WHERE expires_at < ?", (_iso(_now()),))  # tidy up expired ones
    db.execute(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
        (hash_token(token), user_id, _iso(_now() + SESSION_LIFETIME)),
    )


def user_for_session(db: sqlite3.Connection, token: str) -> User | None:
    row = db.execute(
        "SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id "
        "WHERE s.token_hash = ? AND s.expires_at > ?",
        (hash_token(token), _iso(_now())),
    ).fetchone()
    return User(row["id"], row["email"]) if row else None


def delete_session(db: sqlite3.Connection, token: str) -> None:
    db.execute("DELETE FROM sessions WHERE token_hash = ?", (hash_token(token),))


# --- Drafts ----------------------------------------------------------------------------------


@dataclass
class Draft:
    id: int
    document_id: str
    values: dict[str, str]
    messages: list[dict[str, str]]
    updated_at: str


def _draft(row: sqlite3.Row) -> Draft:
    return Draft(
        id=row["id"],
        document_id=row["document_id"],
        values=json.loads(row["values_json"]),
        messages=json.loads(row["messages_json"]),
        updated_at=row["updated_at"],
    )


def list_drafts(db: sqlite3.Connection, user_id: int) -> list[Draft]:
    rows = db.execute("SELECT * FROM drafts WHERE user_id = ? ORDER BY updated_at DESC, id DESC", (user_id,))
    return [_draft(row) for row in rows]


def get_draft(db: sqlite3.Connection, user_id: int, draft_id: int) -> Draft | None:
    row = db.execute("SELECT * FROM drafts WHERE id = ? AND user_id = ?", (draft_id, user_id)).fetchone()
    return _draft(row) if row else None


def save_draft(
    db: sqlite3.Connection,
    user_id: int,
    draft_id: int | None,
    document_id: str,
    values: dict[str, str],
    messages: list[dict[str, str]],
) -> Draft | None:
    """Create a draft (draft_id None) or update the user's own draft. None if draft_id isn't theirs."""
    now = _iso(_now())
    values_json, messages_json = json.dumps(values), json.dumps(messages)
    if draft_id is None:
        cursor = db.execute(
            "INSERT INTO drafts (user_id, document_id, values_json, messages_json, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, document_id, values_json, messages_json, now, now),
        )
        draft_id = cursor.lastrowid
    else:
        cursor = db.execute(
            "UPDATE drafts SET document_id = ?, values_json = ?, messages_json = ?, updated_at = ? "
            "WHERE id = ? AND user_id = ?",
            (document_id, values_json, messages_json, now, draft_id, user_id),
        )
        if cursor.rowcount == 0:
            return None
    return get_draft(db, user_id, draft_id)


def delete_draft(db: sqlite3.Connection, user_id: int, draft_id: int) -> bool:
    cursor = db.execute("DELETE FROM drafts WHERE id = ? AND user_id = ?", (draft_id, user_id))
    return cursor.rowcount > 0
