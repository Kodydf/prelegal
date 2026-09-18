"""SQLite setup. The database is temporary: it is recreated from scratch on every startup."""

import os
import sqlite3
from contextlib import closing
from pathlib import Path

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "prelegal.db"

SCHEMA = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def get_db_path() -> Path:
    return Path(os.environ.get("PRELEGAL_DB_PATH", DEFAULT_DB_PATH))


def reset_db(path: Path | None = None) -> Path:
    """Delete any existing database file and create a fresh one with the schema."""
    path = path or get_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.unlink(missing_ok=True)
    with closing(sqlite3.connect(path)) as conn:
        conn.executescript(SCHEMA)
    return path

