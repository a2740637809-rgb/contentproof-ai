from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_session
from app.repositories import PromptRepository
from app.schemas import PromptCreate

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


@router.post("", status_code=201)
def create_prompt(data: PromptCreate, session: Session = Depends(get_session)) -> dict:
    prompt = PromptRepository(session).create_version(data)
    return {
        "id": prompt.id,
        "name": prompt.name,
        "step": prompt.step,
        "version": prompt.version,
        "template": prompt.template,
    }
