from fastapi import APIRouter

from app.config import get_settings
from app.db import check_database
from app.providers.ollama import OllamaProvider

router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict:
    settings = get_settings()
    provider = OllamaProvider(settings.ollama_base_url, settings.ollama_model)
    try:
        models = provider.list_models()
        ollama = {
            "status": "ready",
            "models": models,
            "selected": settings.ollama_model,
        }
    except Exception as exc:
        ollama = {
            "status": "unavailable",
            "models": [],
            "selected": settings.ollama_model,
            "error": str(exc),
            "action": "运行 ollama serve",
        }
    return {"status": "ok", "database": check_database(), "ollama": ollama}

