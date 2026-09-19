import pytest


@pytest.fixture(autouse=True)
def isolated_paths(tmp_path, monkeypatch):
    monkeypatch.setenv("PRELEGAL_DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("PRELEGAL_STATIC_DIR", str(tmp_path / "static"))
    return tmp_path


def sign_up(client, email="user@example.com", password="correct horse"):
    """Register and sign in a user; the TestClient keeps the session cookie."""
    response = client.post("/api/auth/signup", json={"email": email, "password": password})
    assert response.status_code == 201, response.text
    return client
