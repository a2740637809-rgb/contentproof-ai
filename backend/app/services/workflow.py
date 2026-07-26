from dataclasses import dataclass, field
from time import perf_counter

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    ContentTask,
    PromptVersion,
    SourceRecord,
    WorkflowRun,
    WorkflowStep,
    utc_now,
)
from app.providers.base import ModelProvider, ModelRequest


@dataclass
class StepState:
    name: str
    status: str = "pending"
    output: dict = field(default_factory=dict)
    error: str = ""


class WorkflowMachine:
    def __init__(self, names: list[str]):
        self.steps = [StepState(name=name) for name in names]

    def _step(self, name: str) -> StepState:
        return next(step for step in self.steps if step.name == name)

    def complete(self, name: str, output: dict) -> None:
        step = self._step(name)
        step.status = "completed"
        step.output = output
        step.error = ""

    def fail(self, name: str, error: str) -> None:
        step = self._step(name)
        step.status = "failed"
        step.error = error

    def retry_plan(self) -> list[str]:
        failed_index = next(
            i for i, step in enumerate(self.steps) if step.status == "failed"
        )
        return [step.name for step in self.steps[failed_index:]]

    def output(self, name: str) -> dict:
        return self._step(name).output


class PersistentWorkflowService:
    response_schema = {
        "type": "object",
        "properties": {"text": {"type": "string"}},
        "required": ["text"],
    }

    def __init__(self, session: Session, provider: ModelProvider):
        self.session = session
        self.provider = provider

    def execute(self, run_id: int) -> WorkflowRun:
        run = self.session.get(WorkflowRun, run_id)
        if run is None:
            raise ValueError("run not found")
        task = self.session.get(ContentTask, run.task_id)
        prompt = self.session.get(PromptVersion, run.prompt_version_id)
        if task is None or prompt is None:
            raise ValueError("run references missing task or prompt")
        sources = self.session.scalars(
            select(SourceRecord).where(SourceRecord.task_id == task.id)
        ).all()
        steps = self.session.scalars(
            select(WorkflowStep)
            .where(WorkflowStep.run_id == run_id)
            .order_by(WorkflowStep.position)
        ).all()
        run.status = "running"
        run.started_at = utc_now()
        run.completed_at = None
        run.elapsed_ms = None
        self.session.commit()
        run_started = perf_counter()

        context = "\n".join(
            f"- {source.title}: {source.excerpt}" for source in sources
        )
        previous = ""
        for step in steps:
            if step.status == "completed":
                previous = step.output_json.get("text", previous)
                continue
            step.status = "running"
            step.started_at = utc_now()
            step.completed_at = None
            step.elapsed_ms = None
            step.input_json = {"source_context": context, "previous": previous}
            self.session.commit()
            step_started = perf_counter()
            instruction = self._instruction(step.name, task, prompt.template)
            try:
                result = self.provider.generate(
                    ModelRequest(
                        prompt=f"{instruction}\n\n来源：\n{context}\n\n上一步输出：\n{previous}",
                        schema=self.response_schema,
                    )
                )
            except Exception as exc:
                step.status = "failed"
                step.error = str(exc)
                step.completed_at = utc_now()
                step.elapsed_ms = round((perf_counter() - step_started) * 1000)
                run.status = "failed"
                run.completed_at = utc_now()
                run.elapsed_ms = round((perf_counter() - run_started) * 1000)
                self.session.commit()
                raise
            step.output_json = result.data
            step.status = "completed"
            step.error = ""
            step.completed_at = utc_now()
            step.elapsed_ms = result.elapsed_ms
            previous = result.data["text"]
            self.session.commit()

        run.status = "completed"
        run.completed_at = utc_now()
        run.elapsed_ms = round((perf_counter() - run_started) * 1000)
        self.session.commit()
        self.session.refresh(run)
        return run

    @staticmethod
    def _instruction(step: str, task: ContentTask, template: str) -> str:
        instructions = {
            "facts": "仅提取来源中明确出现的事实，未知信息标记为待核验。",
            "outline": "依据事实整理新闻提纲，不增加信息。",
            "draft": template,
            "adapt": f"将稿件适配到{task.target_platform}，面向{task.audience}，语气为{task.tone}。",
        }
        return instructions[step]
