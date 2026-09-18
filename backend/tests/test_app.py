import sqlite3
from contextlib import closing

from fastapi.testclient import TestClient

from app.db import get_db_path, reset_db
from app.main import create_app


def test_health():
    with TestClient(create_app()) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_unknown_api_route_is_404_not_frontend(isolated_paths):
    static = isolated_paths / "static"
    static.mkdir()
    (static / "index.html").write_text("<html>app</html>")
    with TestClient(create_app()) as client:
        assert client.get("/api/nope").status_code == 404


def test_serves_static_frontend(isolated_paths):
    static = isolated_paths / "static"
    static.mkdir()
    (static / "index.html").write_text("<html>app</html>")
    with TestClient(create_app()) as client:
        response = client.get("/")
    assert response.status_code == 200
    assert "app" in response.text


def test_startup_creates_users_table():
    with TestClient(create_app()):
        pass
    with closing(sqlite3.connect(get_db_path())) as conn:
        columns = [row[1] for row in conn.execute("PRAGMA table_info(users)")]
    assert columns == ["id", "email", "password_hash", "created_at"]


def test_db_is_recreated_from_scratch_on_startup():
    reset_db()
    with closing(sqlite3.connect(get_db_path())) as conn:
        conn.execute("INSERT INTO users (email, password_hash) VALUES ('a@b.c', 'x')")
        conn.commit()
    with TestClient(create_app()):
        pass
    with closing(sqlite3.connect(get_db_path())) as conn:
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
