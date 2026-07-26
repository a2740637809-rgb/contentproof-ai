from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.db import Base
from app.models import (
    ContentTask,
    HumanReview,
    PromptVersion,
    SourceRecord,
    WorkflowRun,
)
from app.services.demo_seed import seed_demo_project


def test_demo_seed_is_complete_and_idempotent():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        first_id = seed_demo_project(session)
        second_id = seed_demo_project(session)

        assert first_id == second_id
        assert session.scalar(select(func.count(ContentTask.id))) == 1
        assert session.scalar(select(func.count(SourceRecord.id))) == 4
        assert session.scalar(select(func.count(PromptVersion.id))) == 2
        assert session.scalar(select(func.count(WorkflowRun.id))) == 2
        assert session.scalar(select(func.count(HumanReview.id))) == 2


def test_demo_reset_only_replaces_demo_rows(client):
    regular = client.post(
        "/api/tasks",
        json={
            "title": "用户任务",
            "content_type": "新闻",
            "target_platform": "公众号",
            "audience": "公众",
            "tone": "准确",
            "min_words": 100,
            "max_words": 500,
            "banned_phrases": [],
        },
    ).json()

    first = client.post("/api/demo/reset")
    second = client.post("/api/demo/reset")

    assert first.status_code == second.status_code == 200
    assert first.json()["label"] == "演示数据"
    assert first.json()["task_id"] == second.json()["task_id"]
    assert client.get(f"/api/tasks/{regular['id']}").status_code == 200
    tasks = client.get("/api/tasks").json()
    assert len(tasks) == 2
