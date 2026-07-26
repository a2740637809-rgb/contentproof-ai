from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Evaluation, HumanReview, WorkflowRun

router = APIRouter(prefix="/api/evaluations", tags=["evaluations"])


def evaluation_dict(evaluation: Evaluation, session: Session) -> dict:
    run = session.get(WorkflowRun, evaluation.run_id)
    review = session.scalar(
        select(HumanReview)
        .where(HumanReview.run_id == evaluation.run_id)
        .order_by(HumanReview.id.desc())
    )
    return {
        "id": evaluation.id,
        "run_id": evaluation.run_id,
        "task_id": run.task_id if run else None,
        "prompt_version_id": run.prompt_version_id if run else None,
        "model_name": run.model_name if run else None,
        "total": evaluation.total_score,
        "dimensions": evaluation.scores,
        "advisory": evaluation.advisory,
        "human_decision": review.decision if review else None,
    }


@router.get("")
def list_evaluations(
    task_id: int | None = None,
    session: Session = Depends(get_session),
) -> list[dict]:
    statement = select(Evaluation).order_by(Evaluation.id.desc())
    if task_id is not None:
        statement = statement.join(WorkflowRun).where(WorkflowRun.task_id == task_id)
    evaluations = session.scalars(statement).all()
    return [evaluation_dict(item, session) for item in evaluations]


@router.get("/{evaluation_id}")
def get_evaluation(
    evaluation_id: int, session: Session = Depends(get_session)
) -> dict:
    evaluation = session.get(Evaluation, evaluation_id)
    if evaluation is None:
        raise HTTPException(404, "evaluation not found")
    return evaluation_dict(evaluation, session)
