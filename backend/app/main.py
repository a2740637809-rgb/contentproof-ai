from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.evaluations import router as evaluations_router
from app.api.dashboard import demo_router, router as dashboard_router
from app.api.prompts import router as prompts_router
from app.api.signals import router as signals_router, v2_router as signals_v2_router
from app.api.tasks import router as tasks_router
from app.api.tasks import runs_router
from app.db import Base, engine, ensure_prototype_columns
from app import models  # noqa: F401
from app import v2_models  # noqa: F401
from app.v2_api import router as content_intelligence_router


def create_app() -> FastAPI:
    Base.metadata.create_all(engine)
    ensure_prototype_columns()
    app = FastAPI(
        title="SignalProof Studio API",
        version="0.2.0",
        description="Local-first, evidence-to-brief workflow API.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(evaluations_router)
    app.include_router(dashboard_router)
    app.include_router(demo_router)
    app.include_router(tasks_router)
    app.include_router(runs_router)
    app.include_router(prompts_router)
    app.include_router(signals_router)
    app.include_router(signals_v2_router)
    app.include_router(content_intelligence_router)
    return app


app = create_app()
