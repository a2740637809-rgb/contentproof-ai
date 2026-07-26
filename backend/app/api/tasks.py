from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db import SessionLocal, get_session
from app.models import (
    ContentTask,
    Evaluation,
    HumanReview,
    SourceRecord,
    WorkflowRun,
    WorkflowStep,
)
from app.repositories import TaskRepository
from app.schemas import (
    EvaluationPayload,
    HumanReviewCreate,
    RunCreate,
    SourceCreate,
    SourceUpdate,
    TaskCreate,
    TaskUpdate,
)
from app.services.evaluator import EvaluationService
from app.services.reports import render_csv_rows, render_markdown_report
from app.services.rules import RuleEngine
from app.services.workflow import PersistentWorkflowService
from app.providers.ollama import OllamaProvider
from app.providers.base import ModelRequest
from app.config import get_settings

router = APIRouter(prefix="/api/tasks", tags=["tasks"])
runs_router = APIRouter(prefix="/api/runs", tags=["runs"])


def task_dict(task: ContentTask) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "content_type": task.content_type,
        "target_platform": task.target_platform,
        "audience": task.audience,
        "tone": task.tone,
        "min_words": task.min_words,
        "max_words": task.max_words,
        "banned_phrases": task.banned_phrases,
        "status": task.status,
        "created_at": task.created_at,
    }


def source_dict(source: SourceRecord) -> dict:
    return {
        "id": source.id,
        "task_id": source.task_id,
        "title": source.title,
        "url": source.url,
        "excerpt": source.excerpt,
        "facts": source.facts,
        "status": source.status,
    }


def run_dict(run: WorkflowRun) -> dict:
    return {
        "id": run.id,
        "task_id": run.task_id,
        "prompt_version_id": run.prompt_version_id,
        "model_name": run.model_name,
        "status": run.status,
        "started_at": run.started_at,
        "completed_at": run.completed_at,
        "elapsed_ms": run.elapsed_ms,
    }


@router.get("")
def list_tasks(session: Session = Depends(get_session)) -> list[dict]:
    tasks = session.scalars(
        select(ContentTask).order_by(ContentTask.created_at.desc(), ContentTask.id.desc())
    ).all()
    return [task_dict(task) for task in tasks]


@router.post("", status_code=201)
def create_task(data: TaskCreate, session: Session = Depends(get_session)) -> dict:
    task = TaskRepository(session).create_task(data)
    return task_dict(task)


@router.get("/{task_id}")
def get_task(task_id: int, session: Session = Depends(get_session)) -> dict:
    task = session.get(ContentTask, task_id)
    if task is None:
        raise HTTPException(404, "task not found")
    sources = session.scalars(
        select(SourceRecord)
        .where(SourceRecord.task_id == task_id)
        .order_by(SourceRecord.id)
    ).all()
    runs = session.scalars(
        select(WorkflowRun)
        .where(WorkflowRun.task_id == task_id)
        .order_by(WorkflowRun.id.desc())
    ).all()
    return {
        **task_dict(task),
        "sources": [source_dict(source) for source in sources],
        "runs": [run_dict(run) for run in runs],
    }


@router.patch("/{task_id}")
def update_task(
    task_id: int, data: TaskUpdate, session: Session = Depends(get_session)
) -> dict:
    task = session.get(ContentTask, task_id)
    if task is None:
        raise HTTPException(404, "task not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    if task.max_words < task.min_words:
        raise HTTPException(422, "max_words must be greater than or equal to min_words")
    session.commit()
    session.refresh(task)
    return task_dict(task)


@router.delete("/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    force: bool = False,
    session: Session = Depends(get_session),
) -> Response:
    task = session.get(ContentTask, task_id)
    if task is None:
        raise HTTPException(404, "task not found")
    run_ids = list(
        session.scalars(
            select(WorkflowRun.id).where(WorkflowRun.task_id == task_id)
        ).all()
    )
    if run_ids and not force:
        raise HTTPException(409, "task owns runs; pass force=true to delete")
    if run_ids:
        session.execute(delete(Evaluation).where(Evaluation.run_id.in_(run_ids)))
        session.execute(delete(HumanReview).where(HumanReview.run_id.in_(run_ids)))
        session.execute(delete(WorkflowStep).where(WorkflowStep.run_id.in_(run_ids)))
        session.execute(delete(WorkflowRun).where(WorkflowRun.id.in_(run_ids)))
    session.execute(delete(SourceRecord).where(SourceRecord.task_id == task_id))
    session.delete(task)
    session.commit()
    return Response(status_code=204)


@router.post("/{task_id}/sources", status_code=201)
def create_source(
    task_id: int, data: SourceCreate, session: Session = Depends(get_session)
) -> dict:
    if session.get(ContentTask, task_id) is None:
        raise HTTPException(404, "task not found")
    source = SourceRecord(task_id=task_id, **data.model_dump())
    session.add(source)
    session.commit()
    session.refresh(source)
    return source_dict(source)


@router.patch("/{task_id}/sources/{source_id}")
def update_source(
    task_id: int,
    source_id: int,
    data: SourceUpdate,
    session: Session = Depends(get_session),
) -> dict:
    source = session.scalar(
        select(SourceRecord).where(
            SourceRecord.id == source_id, SourceRecord.task_id == task_id
        )
    )
    if source is None:
        raise HTTPException(404, "source not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(source, field, value)
    session.commit()
    session.refresh(source)
    return source_dict(source)


@router.delete("/{task_id}/sources/{source_id}", status_code=204)
def delete_source(
    task_id: int, source_id: int, session: Session = Depends(get_session)
) -> Response:
    source = session.scalar(
        select(SourceRecord).where(
            SourceRecord.id == source_id, SourceRecord.task_id == task_id
        )
    )
    if source is None:
        raise HTTPException(404, "source not found")
    session.delete(source)
    session.commit()
    return Response(status_code=204)


@router.post("/{task_id}/runs", status_code=201)
def create_run(
    task_id: int, data: RunCreate, session: Session = Depends(get_session)
) -> dict:
    if session.get(ContentTask, task_id) is None:
        raise HTTPException(404, "task not found")
    run = WorkflowRun(task_id=task_id, **data.model_dump())
    session.add(run)
    session.flush()
    for position, name in enumerate(["facts", "outline", "draft", "adapt"]):
        session.add(WorkflowStep(run_id=run.id, name=name, position=position))
    session.commit()
    return {"id": run.id, "status": run.status}


@runs_router.get("/{run_id}")
def get_run(run_id: int, session: Session = Depends(get_session)) -> dict:
    run = session.get(WorkflowRun, run_id)
    if run is None:
        raise HTTPException(404, "run not found")
    steps = session.scalars(
        select(WorkflowStep)
        .where(WorkflowStep.run_id == run_id)
        .order_by(WorkflowStep.position)
    ).all()
    return {
        "id": run.id,
        "task_id": run.task_id,
        "prompt_version_id": run.prompt_version_id,
        "model_name": run.model_name,
        "status": run.status,
        "steps": [
            {
                "name": step.name,
                "position": step.position,
                "status": step.status,
                "input_json": step.input_json,
                "output_json": step.output_json,
                "error": step.error,
                "started_at": step.started_at,
                "completed_at": step.completed_at,
                "elapsed_ms": step.elapsed_ms,
            }
            for step in steps
        ],
    }


@runs_router.post("/{run_id}/retry")
def retry_run(run_id: int, session: Session = Depends(get_session)) -> dict:
    failed = session.scalar(
        select(WorkflowStep)
        .where(WorkflowStep.run_id == run_id, WorkflowStep.status == "failed")
        .order_by(WorkflowStep.position)
    )
    if failed is None:
        raise HTTPException(409, "run has no failed step")
    failed.status = "pending"
    failed.error = ""
    session.commit()
    return {"run_id": run_id, "retry_from": failed.name}


def execute_run_background(run_id: int) -> None:
    settings = get_settings()
    provider = OllamaProvider(
        base_url=settings.ollama_base_url,
        model=settings.ollama_model,
    )
    with SessionLocal() as session:
        try:
            PersistentWorkflowService(session, provider).execute(run_id)
        except Exception:
            return


@runs_router.post("/{run_id}/execute", status_code=202)
def execute_run(
    run_id: int,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
) -> dict:
    run = session.get(WorkflowRun, run_id)
    if run is None:
        raise HTTPException(404, "run not found")
    if run.status in {"queued", "running"}:
        raise HTTPException(409, "run is already active")
    run.status = "queued"
    session.commit()
    background_tasks.add_task(execute_run_background, run_id)
    return {"id": run.id, "status": "queued"}


@runs_router.post("/{run_id}/steps/{step_name}/retry", status_code=202)
def retry_step(
    run_id: int,
    step_name: str,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
) -> dict:
    run = session.get(WorkflowRun, run_id)
    if run is None:
        raise HTTPException(404, "run not found")
    step = session.scalar(
        select(WorkflowStep).where(
            WorkflowStep.run_id == run_id, WorkflowStep.name == step_name
        )
    )
    if step is None:
        raise HTTPException(404, "step not found")
    if step.status != "failed":
        raise HTTPException(409, "step is not failed")
    downstream = session.scalars(
        select(WorkflowStep).where(
            WorkflowStep.run_id == run_id,
            WorkflowStep.position >= step.position,
        )
    ).all()
    for item in downstream:
        item.status = "pending"
        item.error = ""
        item.started_at = None
        item.completed_at = None
        item.elapsed_ms = None
        if item.position > step.position:
            item.input_json = {}
            item.output_json = {}
    run.status = "queued"
    session.commit()
    background_tasks.add_task(execute_run_background, run_id)
    return {"id": run.id, "status": "queued", "retry_from": step.name}


@runs_router.post("/{run_id}/evaluate", status_code=201)
def evaluate_run(
    run_id: int,
    data: EvaluationPayload,
    session: Session = Depends(get_session),
) -> dict:
    run = session.get(WorkflowRun, run_id)
    task = session.get(ContentTask, run.task_id) if run else None
    if task is None:
        raise HTTPException(404, "run not found")
    adapt = session.scalar(
        select(WorkflowStep).where(
            WorkflowStep.run_id == run_id, WorkflowStep.name == "adapt"
        )
    )
    text_value = data.text or (
        adapt.output_json.get("text", "") if adapt is not None else ""
    )
    sources = session.scalars(
        select(SourceRecord).where(
            SourceRecord.task_id == task.id, SourceRecord.status == "verified"
        )
    ).all()
    required_facts = data.required_facts or [
        fact["text"]
        for source in sources
        for fact in source.facts
        if fact.get("status", "verified") == "verified" and fact.get("text")
    ]
    if not text_value:
        raise HTTPException(409, "run has no completed adapt output")
    rules = RuleEngine().evaluate(
        text_value,
        required_facts,
        task.banned_phrases,
        task.min_words,
        task.max_words,
    )
    model_scores = data.model_scores
    if model_scores is None:
        settings = get_settings()
        provider = OllamaProvider(settings.ollama_base_url, settings.ollama_model)
        schema = {
            "type": "object",
            "properties": {
                name: {
                    "type": "object",
                    "properties": {
                        "score": {"type": "number"},
                        "reason": {"type": "string"},
                        "evidence": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["score", "reason", "evidence"],
                }
                for name in EvaluationService.weights
            },
            "required": list(EvaluationService.weights),
        }
        try:
            generated = provider.generate(
                ModelRequest(
                    prompt=(
                        "按五个固定维度评测以下内容。每项给0-100分、简短理由和文本证据。"
                        f"\n内容：{text_value}\n硬规则：{rules.model_dump_json()}"
                    ),
                    schema=schema,
                    temperature=0,
                )
            )
            model_scores = generated.data
        except Exception as exc:
            raise HTTPException(
                409,
                {
                    "message": "本地模型暂不可用",
                    "action": "启动 Ollama，或切换到演示模式",
                    "rule_evidence": rules.model_dump(),
                    "error": str(exc),
                },
            ) from exc
    result = EvaluationService().combine(rules, model_scores)
    session.add(
        Evaluation(
            run_id=run_id,
            scores={
                name: value.model_dump()
                for name, value in result.dimensions.items()
            },
            total_score=result.total,
            advisory=True,
        )
    )
    session.commit()
    return result.model_dump()


@runs_router.get("/{run_id}/evidence.json")
def export_evidence(run_id: int, session: Session = Depends(get_session)) -> dict:
    run = session.get(WorkflowRun, run_id)
    task = session.get(ContentTask, run.task_id) if run else None
    if task is None:
        raise HTTPException(404, "run not found")
    prompt = session.get(PromptVersion, run.prompt_version_id)
    sources = session.scalars(
        select(SourceRecord).where(SourceRecord.task_id == task.id)
    ).all()
    steps = session.scalars(
        select(WorkflowStep)
        .where(WorkflowStep.run_id == run_id)
        .order_by(WorkflowStep.position)
    ).all()
    evaluation = session.scalar(
        select(Evaluation).where(Evaluation.run_id == run_id)
    )
    review = session.scalar(
        select(HumanReview).where(HumanReview.run_id == run_id)
    )
    return {
        "task": task_dict(task),
        "sources": [source_dict(source) for source in sources],
        "prompt": {
            "id": prompt.id,
            "name": prompt.name,
            "version": prompt.version,
            "template": prompt.template,
        }
        if prompt
        else None,
        "run": get_run(run_id, session),
        "evaluation": {
            "id": evaluation.id,
            "total": evaluation.total_score,
            "dimensions": evaluation.scores,
            "advisory": evaluation.advisory,
        }
        if evaluation
        else None,
        "review": {
            "decision": review.decision,
            "reason_tags": review.reason_tags,
            "notes": review.notes,
            "final_text": review.final_text,
        }
        if review
        else None,
    }


@runs_router.post("/{run_id}/reviews", status_code=201)
def review_run(
    run_id: int,
    data: HumanReviewCreate,
    session: Session = Depends(get_session),
) -> dict:
    if session.get(WorkflowRun, run_id) is None:
        raise HTTPException(404, "run not found")
    review = HumanReview(run_id=run_id, **data.model_dump())
    session.add(review)
    session.commit()
    session.refresh(review)
    return {"id": review.id, "decision": review.decision}


@runs_router.get("/{run_id}/report.md")
def export_report(run_id: int, session: Session = Depends(get_session)) -> Response:
    run = session.get(WorkflowRun, run_id)
    task = session.get(ContentTask, run.task_id) if run else None
    evaluation = session.scalar(select(Evaluation).where(Evaluation.run_id == run_id))
    review = session.scalar(select(HumanReview).where(HumanReview.run_id == run_id))
    if not task or not evaluation or not review:
        raise HTTPException(409, "run is not ready for export")
    body = render_markdown_report(
        task.title, evaluation.total_score, evaluation.scores, review.decision
    )
    return Response(body, media_type="text/markdown; charset=utf-8")


@router.get("/{task_id}/experiments.csv")
def export_experiments(
    task_id: int, session: Session = Depends(get_session)
) -> Response:
    runs = session.scalars(
        select(WorkflowRun).where(WorkflowRun.task_id == task_id)
    ).all()
    rows = []
    for run in runs:
        evaluation = session.scalar(
            select(Evaluation).where(Evaluation.run_id == run.id)
        )
        if evaluation:
            rows.append(
                {
                    "run_id": run.id,
                    "prompt_version_id": run.prompt_version_id,
                    "model": run.model_name,
                    "total_score": evaluation.total_score,
                }
            )
    return Response(render_csv_rows(rows), media_type="text/csv; charset=utf-8")
