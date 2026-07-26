from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
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
    TaskCreate,
)
from app.services.evaluator import EvaluationService
from app.services.reports import render_csv_rows, render_markdown_report
from app.services.rules import RuleEngine

router = APIRouter(prefix="/api/tasks", tags=["tasks"])
runs_router = APIRouter(prefix="/api/runs", tags=["runs"])


@router.post("", status_code=201)
def create_task(data: TaskCreate, session: Session = Depends(get_session)) -> dict:
    task = TaskRepository(session).create_task(data)
    return {"id": task.id, "title": task.title, "status": task.status}


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
    return {"id": source.id, "task_id": source.task_id}


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
        "status": run.status,
        "steps": [
            {"name": step.name, "status": step.status, "error": step.error}
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
    rules = RuleEngine().evaluate(
        data.text,
        data.required_facts,
        task.banned_phrases,
        task.min_words,
        task.max_words,
    )
    result = EvaluationService().combine(rules, data.model_scores)
    session.add(
        Evaluation(
            run_id=run_id,
            scores=result.scores,
            total_score=result.total,
            advisory=True,
        )
    )
    session.commit()
    return result.model_dump()


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
