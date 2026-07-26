from app.services.workflow import WorkflowMachine
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.db import Base
from app.models import ContentTask, PromptVersion, SourceRecord, WorkflowRun, WorkflowStep
from app.providers.base import ModelResult
from app.services.workflow import PersistentWorkflowService


def test_retry_starts_at_failed_step_and_keeps_completed_outputs():
    machine = WorkflowMachine(["facts", "outline", "draft", "adapt"])
    machine.complete("facts", {"facts": ["活动共100人参与"]})
    machine.fail("outline", "invalid json")

    retry = machine.retry_plan()

    assert retry == ["outline", "draft", "adapt"]
    assert machine.output("facts") == {"facts": ["活动共100人参与"]}


class FakeProvider:
    def generate(self, request):
        return ModelResult(
            text='{"text":"已核验输出"}',
            data={"text": "已核验输出"},
            model="fake",
            elapsed_ms=1,
        )


def test_persistent_workflow_completes_and_stores_each_step():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        task = ContentTask(
            title="测试任务",
            content_type="新闻",
            target_platform="融媒客户端",
            audience="市民",
            tone="准确",
            min_words=10,
            max_words=100,
        )
        prompt = PromptVersion(
            name="draft", step="draft", version=1, template="只依据事实写稿"
        )
        session.add_all([task, prompt])
        session.flush()
        source = SourceRecord(
            task_id=task.id,
            title="公开来源",
            url="https://example.com",
            excerpt="活动已经举行。",
        )
        run = WorkflowRun(
            task_id=task.id,
            prompt_version_id=prompt.id,
            model_name="fake",
        )
        session.add_all([source, run])
        session.flush()
        session.add_all(
            WorkflowStep(run_id=run.id, name=name, position=position)
            for position, name in enumerate(["facts", "outline", "draft", "adapt"])
        )
        session.commit()

        result = PersistentWorkflowService(session, FakeProvider()).execute(run.id)

        steps = session.scalars(
            select(WorkflowStep).where(WorkflowStep.run_id == run.id)
        ).all()
        assert result.status == "completed"
        assert all(step.status == "completed" for step in steps)
        assert all(step.output_json == {"text": "已核验输出"} for step in steps)
