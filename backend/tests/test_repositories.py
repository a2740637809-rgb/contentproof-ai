from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db import Base
from app.repositories import PromptRepository, TaskRepository
from app.schemas import PromptCreate, TaskCreate


def make_session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def test_task_repository_creates_a_task():
    with make_session() as session:
        task = TaskRepository(session).create_task(
            TaskCreate(
                title="端午反诈活动稿",
                content_type="活动新闻",
                target_platform="常德融媒",
                audience="常德市民",
                tone="准确、清晰",
                min_words=400,
                max_words=700,
                banned_phrases=["据网传"],
            )
        )

        assert task.id is not None
        assert task.status == "draft"


def test_prompt_versions_are_append_only():
    with make_session() as session:
        repository = PromptRepository(session)
        v1 = repository.create_version(
            PromptCreate(name="draft", step="draft", template="版本一")
        )
        v2 = repository.create_version(
            PromptCreate(name="draft", step="draft", template="版本二")
        )

        assert (v1.version, v2.version) == (1, 2)
        assert v1.template == "版本一"
