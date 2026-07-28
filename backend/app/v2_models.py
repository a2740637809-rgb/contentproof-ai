from datetime import datetime, timezone

from sqlalchemy import ForeignKey, JSON, LargeBinary, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ResearchProject(Base):
    __tablename__ = "research_projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    goal: Mapped[str] = mapped_column(Text)
    stage: Mapped[str] = mapped_column(default="draft", index=True)
    lifecycle: Mapped[str] = mapped_column(default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now)


class ResearchSource(Base):
    __tablename__ = "research_sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("research_projects.id"), index=True)
    kind: Mapped[str] = mapped_column(default="manual")
    url: Mapped[str] = mapped_column(default="")
    title: Mapped[str] = mapped_column(default="")
    body: Mapped[str] = mapped_column(Text, default="")
    author: Mapped[str] = mapped_column(default="")
    published_at: Mapped[str] = mapped_column(default="")
    article_status: Mapped[str] = mapped_column(default="not_requested")
    comments_status: Mapped[str] = mapped_column(default="not_requested")
    warnings: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)


class ResearchComment(Base):
    __tablename__ = "research_comments"
    __table_args__ = (UniqueConstraint("project_id", "content_hash"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("research_projects.id"), index=True)
    source_id: Mapped[int | None] = mapped_column(
        ForeignKey("research_sources.id"), nullable=True, index=True
    )
    raw_text: Mapped[str] = mapped_column(Text)
    cleaned_text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(default="included", index=True)
    exclusion_reasons: Mapped[list[str]] = mapped_column(JSON, default=list)
    pii_flags: Mapped[list[str]] = mapped_column(JSON, default=list)
    content_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(default=utc_now)


class AnalysisRunV2(Base):
    __tablename__ = "analysis_runs_v2"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("research_projects.id"), index=True)
    status: Mapped[str] = mapped_column(default="pending", index=True)
    step: Mapped[str] = mapped_column(default="queued")
    embedding_model: Mapped[str] = mapped_column(default="rules-preview")
    clustering_method: Mapped[str] = mapped_column(default="semantic-preview")
    labeling_model: Mapped[str] = mapped_column(default="deterministic")
    error: Mapped[str] = mapped_column(default="")
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)


class CommentEmbedding(Base):
    __tablename__ = "comment_embeddings"
    __table_args__ = (UniqueConstraint("comment_id", "model_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("research_comments.id"), index=True)
    model_name: Mapped[str] = mapped_column(String(120))
    dimensions: Mapped[int]
    vector: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)


class ResearchTheme(Base):
    __tablename__ = "research_themes"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("research_projects.id"), index=True)
    analysis_run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs_v2.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    summary: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(default="pending_review", index=True)
    cluster_label: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)


class ThemeMembership(Base):
    __tablename__ = "theme_memberships"
    __table_args__ = (UniqueConstraint("theme_id", "comment_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    theme_id: Mapped[int] = mapped_column(ForeignKey("research_themes.id"), index=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("research_comments.id"), index=True)


class ReviewEvent(Base):
    __tablename__ = "review_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("research_projects.id"), index=True)
    theme_id: Mapped[int | None] = mapped_column(
        ForeignKey("research_themes.id"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(40))
    before: Mapped[dict] = mapped_column(JSON, default=dict)
    after: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)


class ResearchBrief(Base):
    __tablename__ = "research_briefs"
    __table_args__ = (UniqueConstraint("project_id", "version"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("research_projects.id"), index=True)
    version: Mapped[int]
    title: Mapped[str] = mapped_column(String(240))
    audience: Mapped[str] = mapped_column(Text)
    problem: Mapped[str] = mapped_column(Text)
    angle: Mapped[str] = mapped_column(Text)
    outline: Mapped[list[str]] = mapped_column(JSON, default=list)
    risks: Mapped[list[str]] = mapped_column(JSON, default=list)
    evidence_comment_ids: Mapped[list[int]] = mapped_column(JSON, default=list)
    theme_ids: Mapped[list[int]] = mapped_column(JSON, default=list)
    generation_mode: Mapped[str] = mapped_column(default="deterministic_fallback")
    created_at: Mapped[datetime] = mapped_column(default=utc_now)


class ModelProfile(Base):
    __tablename__ = "model_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    provider: Mapped[str] = mapped_column(String(40))
    base_url: Mapped[str] = mapped_column(default="")
    model: Mapped[str] = mapped_column(default="")
    embedding_model: Mapped[str] = mapped_column(default="")
    secret_env: Mapped[str] = mapped_column(default="")
    enabled: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
