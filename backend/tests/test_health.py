from fastapi.testclient import TestClient

from app.main import create_app


def test_health_reports_api_database_and_ollama_ready(monkeypatch):
    monkeypatch.setattr(
        "app.api.health.OllamaProvider.list_models",
        lambda self: ["qwen2:1.5b", "qwen2.5:0.5b"],
    )
    response = TestClient(create_app()).get("/api/health")

    assert response.status_code == 200
    assert response.json()["database"] == "ok"
    assert response.json()["ollama"] == {
        "status": "ready",
        "models": ["qwen2:1.5b", "qwen2.5:0.5b"],
        "selected": "qwen2:1.5b",
    }


def test_health_explains_how_to_start_unavailable_ollama(monkeypatch):
    def unavailable(self):
        raise ConnectionError("connection refused")

    monkeypatch.setattr("app.api.health.OllamaProvider.list_models", unavailable)
    response = TestClient(create_app()).get("/api/health")

    assert response.status_code == 200
    assert response.json()["ollama"]["status"] == "unavailable"
    assert response.json()["ollama"]["action"] == "运行 ollama serve"

