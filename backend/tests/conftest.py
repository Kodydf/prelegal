import pytest


@pytest.fixture(autouse=True)
def isolated_paths(tmp_path, monkeypatch):
    monkeypatch.setenv("PRELEGAL_DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("PRELEGAL_STATIC_DIR", str(tmp_path / "static"))
    return tmp_path
