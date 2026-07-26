from fastapi import APIRouter

from app.db import check_database

router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "database": check_database()}

