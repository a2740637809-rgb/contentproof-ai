from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.dashboard import router as dashboard_router
from app.api.prompts import router as prompts_router
from app.api.tasks import router as tasks_router
from app.api.tasks import runs_router
from app.db import Base, engine
from app import models  # noqa: F401


def create_app() -> FastAPI:
    Base.metadata.create_all(engine)
    app = FastAPI(title="ContentProof AI", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(dashboard_router)
    app.include_router(tasks_router)
    app.include_router(runs_router)
    app.include_router(prompts_router)
    return app


app = create_app()
