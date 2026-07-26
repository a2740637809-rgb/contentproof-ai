from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import PromptVersion
from app.repositories import PromptRepository
from app.schemas import PromptCreate

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


@router.get("")
def list_prompts(session: Session = Depends(get_session)) -> list[dict]:
    prompts = session.scalars(
        select(PromptVersion).order_by(PromptVersion.name, PromptVersion.version)
    ).all()
    return [
        {
            "id": prompt.id,
            "name": prompt.name,
            "step": prompt.step,
            "version": prompt.version,
            "template": prompt.template,
            "change_note": prompt.change_note,
            "created_at": prompt.created_at,
        }
        for prompt in prompts
    ]


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
