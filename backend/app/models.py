from datetime import datetime, timezone

from sqlalchemy import ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ContentTask(Base):
    __tablename__ = "content_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    content_type: Mapped[str]
    target_platform: Mapped[str]
    audience: Mapped[str]
    tone: Mapped[str]
    min_words: Mapped[int]
    max_words: Mapped[int]
    banned_phrases: Mapped[list[str]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(default="draft")
    created_at: Mapped[datetime] = mapped_column(default=utc_now)


class SourceRecord(Base):
    __tablename__ = "source_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("content_tasks.id"))
    title: Mapped[str]
    url: Mapped[str]
    excerpt: Mapped[str] = mapped_column(Text)
    facts: Mapped[list[dict]] = mapped_column(JSON, default=list)


class PromptVersion(Base):
    __tablename__ = "prompt_versions"
    __table_args__ = (UniqueConstraint("name", "version"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    step: Mapped[str]
    version: Mapped[int]
    template: Mapped[str] = mapped_column(Text)
    change_note: Mapped[str] = mapped_column(default="")
    created_at: Mapped[datetime] = mapped_column(default=utc_now)


class WorkflowRun(Base):
    __tablename__ = "workflow_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("content_tasks.id"))
    prompt_version_id: Mapped[int] = mapped_column(ForeignKey("prompt_versions.id"))
    model_name: Mapped[str]
    status: Mapped[str] = mapped_column(default="pending")


class WorkflowStep(Base):
    __tablename__ = "workflow_steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("workflow_runs.id"))
    name: Mapped[str]
    position: Mapped[int]
    status: Mapped[str] = mapped_column(default="pending")
    input_json: Mapped[dict] = mapped_column(JSON, default=dict)
    output_json: Mapped[dict] = mapped_column(JSON, default=dict)
    error: Mapped[str] = mapped_column(default="")


class Evaluation(Base):
    __tablename__ = "evaluations"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("workflow_runs.id"))
    scores: Mapped[dict] = mapped_column(JSON)
    total_score: Mapped[float]
    advisory: Mapped[bool] = mapped_column(default=True)


class HumanReview(Base):
    __tablename__ = "human_reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("workflow_runs.id"))
    decision: Mapped[str]
    reason_tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    notes: Mapped[str] = mapped_column(Text, default="")
    final_text: Mapped[str] = mapped_column(Text, default="")
