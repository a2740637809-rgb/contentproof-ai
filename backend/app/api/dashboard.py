from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import ContentTask, Evaluation, HumanReview, WorkflowRun

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard(session: Session = Depends(get_session)) -> dict:
    task_count = session.scalar(select(func.count(ContentTask.id))) or 0
    run_count = session.scalar(select(func.count(WorkflowRun.id))) or 0
    completed_runs = (
        session.scalar(
            select(func.count(WorkflowRun.id)).where(
                WorkflowRun.status == "completed"
            )
        )
        or 0
    )
    failed_runs = (
        session.scalar(
            select(func.count(WorkflowRun.id)).where(WorkflowRun.status == "failed")
        )
        or 0
    )
    reviewed_runs = (
        session.scalar(select(func.count(func.distinct(HumanReview.run_id)))) or 0
    )
    average_score = session.scalar(select(func.avg(Evaluation.total_score)))
    return {
        "task_count": task_count,
        "run_count": run_count,
        "completed_runs": completed_runs,
        "failed_runs": failed_runs,
        "reviewed_runs": reviewed_runs,
        "average_score": round(float(average_score), 2)
        if average_score is not None
        else None,
    }
