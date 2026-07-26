import json
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import (
    ContentTask,
    Evaluation,
    HumanReview,
    PromptVersion,
    SourceRecord,
    WorkflowRun,
    WorkflowStep,
)

DATA_DIR = Path(__file__).resolve().parents[3] / "data"
STEP_NAMES = ["facts", "outline", "draft", "adapt"]


def _load_json(filename: str) -> list[dict]:
    return json.loads((DATA_DIR / filename).read_text(encoding="utf-8"))


def _delete_demo_rows(session: Session) -> None:
    task_ids = list(
        session.scalars(
            select(ContentTask.id).where(ContentTask.status == "demo")
        ).all()
    )
    if not task_ids:
        return
    run_ids = list(
        session.scalars(
            select(WorkflowRun.id).where(WorkflowRun.task_id.in_(task_ids))
        ).all()
    )
    if run_ids:
        session.execute(delete(Evaluation).where(Evaluation.run_id.in_(run_ids)))
        session.execute(delete(HumanReview).where(HumanReview.run_id.in_(run_ids)))
        session.execute(delete(WorkflowStep).where(WorkflowStep.run_id.in_(run_ids)))
        session.execute(delete(WorkflowRun).where(WorkflowRun.id.in_(run_ids)))
    session.execute(delete(SourceRecord).where(SourceRecord.task_id.in_(task_ids)))
    session.execute(delete(ContentTask).where(ContentTask.id.in_(task_ids)))
    session.commit()


def reset_demo_project(session: Session) -> int:
    _delete_demo_rows(session)
    return seed_demo_project(session)


def seed_demo_project(session: Session) -> int:
    existing = session.scalar(
        select(ContentTask).where(ContentTask.status == "demo")
    )
    if existing is not None:
        return existing.id

    task = ContentTask(
        title="端午反诈与禁毒内容实验",
        content_type="活动新闻",
        target_platform="常德融媒客户端",
        audience="常德市民",
        tone="准确、清晰、克制",
        min_words=300,
        max_words=700,
        banned_phrases=["据网传", "疑似"],
        status="demo",
    )
    session.add(task)
    session.flush()

    samples = _load_json("public_samples.json")
    for index, sample in enumerate(samples):
        status = "verified" if index < 3 else "pending"
        session.add(
            SourceRecord(
                task_id=task.id,
                title=sample["title"],
                url=sample["url"],
                excerpt=sample["excerpt"],
                facts=[
                    {
                        "text": sample["excerpt"].removeprefix("公开页面显示："),
                        "status": status,
                    }
                ],
                status=status,
            )
        )

    prompts = []
    for item in _load_json("prompt_versions.json"):
        prompt = session.scalar(
            select(PromptVersion).where(
                PromptVersion.name == item["name"],
                PromptVersion.version == item["version"],
            )
        )
        if prompt is None:
            prompt = PromptVersion(**item)
            session.add(prompt)
        prompts.append(prompt)
    session.flush()

    run_specs = [
        (
            prompts[0],
            78.5,
            "modified",
            "初稿事实完整，但平台导语较弱。",
            "端午活动把反诈、禁毒知识融入互动宣传。",
        ),
        (
            prompts[1],
            88.0,
            "accepted",
            "事实、结构与平台表达均达到发布标准。",
            "端午将至，常德一场安全宣传活动把反诈与禁毒知识融入节日互动。",
        ),
    ]
    for prompt, score, decision, notes, final_text in run_specs:
        run = WorkflowRun(
            task_id=task.id,
            prompt_version_id=prompt.id,
            model_name="qwen2:1.5b",
            status="completed",
        )
        session.add(run)
        session.flush()
        outputs = {
            "facts": {"facts": ["活动主题包含反诈、禁毒与端午节"]},
            "outline": {"sections": ["活动背景", "现场互动", "安全提示"]},
            "draft": {"text": final_text},
            "adapt": {"text": final_text},
        }
        for position, name in enumerate(STEP_NAMES):
            session.add(
                WorkflowStep(
                    run_id=run.id,
                    name=name,
                    position=position,
                    status="completed",
                    input_json={"source": "演示数据"},
                    output_json=outputs[name],
                )
            )
        scores = {
            "factual_accuracy": score + 4,
            "structure": score,
            "readability": score - 2,
            "platform_fit": score - 3,
            "risk_control": score + 2,
        }
        session.add(
            Evaluation(
                run_id=run.id,
                scores=scores,
                total_score=score,
                advisory=True,
            )
        )
        session.add(
            HumanReview(
                run_id=run.id,
                decision=decision,
                reason_tags=["事实可靠", "平台适配"],
                notes=notes,
                final_text=final_text,
            )
        )

    session.commit()
    return task.id
