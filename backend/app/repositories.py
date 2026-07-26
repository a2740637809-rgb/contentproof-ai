from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ContentTask, PromptVersion
from app.schemas import PromptCreate, TaskCreate


class TaskRepository:
    def __init__(self, session: Session):
        self.session = session

    def create_task(self, data: TaskCreate) -> ContentTask:
        task = ContentTask(**data.model_dump())
        self.session.add(task)
        self.session.commit()
        self.session.refresh(task)
        return task


class PromptRepository:
    def __init__(self, session: Session):
        self.session = session

    def create_version(self, data: PromptCreate) -> PromptVersion:
        existing = self.session.scalar(
            select(PromptVersion).where(
                PromptVersion.name == data.name,
                PromptVersion.template == data.template,
            )
        )
        if existing is not None:
            return existing
        latest = self.session.scalar(
            select(func.max(PromptVersion.version)).where(
                PromptVersion.name == data.name
            )
        )
        prompt = PromptVersion(**data.model_dump(), version=(latest or 0) + 1)
        self.session.add(prompt)
        self.session.commit()
        self.session.refresh(prompt)
        return prompt
