# ContentProof AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally runnable AI content workflow and evaluation workbench that turns verified public writing samples into a reproducible portfolio project.

**Architecture:** A React and TypeScript single-page workbench calls a FastAPI backend. The backend persists tasks, prompt versions, workflow runs, sources, scores, and human review decisions in SQLite; it calls Ollama through a provider interface and executes an explicit resumable state machine. Deterministic checks and structured model-assisted scoring produce versioned evaluation reports.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic 2, SQLAlchemy 2, Alembic, httpx, pytest, React 18, TypeScript, Vite, Vitest, Testing Library, SQLite, Ollama

## Global Constraints

- The default model provider is local Ollama; provider-specific logic must stay behind one interface.
- The local models initially available are `qwen2:1.5b` and `qwen2.5:0.5b`.
- Model-assisted scores must be labelled as advisory.
- Workflow steps must persist independently and support retry from the failed step.
- Prompt versions are immutable; editing creates a new version.
- Public fixtures contain metadata, links, short excerpts, and original annotations only.
- Never commit full news articles, original images, local databases, model caches, or credentials.
- Public view counts are labelled as platform-displayed cumulative counts, not unique users.
- First release contains at least 20 evaluation cases and two prompt versions.
- Keep modules focused; do not introduce LangGraph, a user system, cloud billing, automatic publishing, or multi-agent orchestration.

---

## Planned File Structure

```text
backend/
  pyproject.toml
  alembic.ini
  app/
    main.py                  # FastAPI composition and route registration
    config.py                # Environment-derived settings
    db.py                    # SQLAlchemy engine and session lifecycle
    models.py                # Persistent database models
    schemas.py               # API and workflow Pydantic schemas
    repositories.py          # Persistence operations
    providers/
      base.py                # Model provider protocol and result types
      ollama.py              # Ollama HTTP implementation
    services/
      workflow.py            # Explicit resumable workflow state machine
      rules.py               # Deterministic evaluation rules
      evaluator.py           # Weighted and model-assisted evaluation
      reports.py             # Markdown and CSV exports
    api/
      health.py              # Runtime and Ollama diagnostics
      tasks.py               # Task, source, run, review endpoints
      prompts.py             # Immutable prompt version endpoints
      evaluations.py         # Evaluation and export endpoints
  tests/
    conftest.py
    test_health.py
    test_repositories.py
    test_ollama.py
    test_workflow.py
    test_rules.py
    test_evaluator.py
    test_api.py
    test_reports.py
frontend/
  package.json
  vite.config.ts
  src/
    main.tsx
    App.tsx
    api.ts
    types.ts
    styles.css
    components/
      Sidebar.tsx
      WorkflowTrack.tsx
      QualityPanel.tsx
      TaskEditor.tsx
      PromptComparison.tsx
    test/
      setup.ts
    App.test.tsx
data/
  public_samples.json
  evaluation_cases.json
  prompt_versions.json
scripts/
  seed.py
README.md
```

---

### Task 1: Backend Foundation and Runtime Diagnostics

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/app/db.py`
- Create: `backend/app/main.py`
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/health.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_health.py`

**Interfaces:**
- Produces: `Settings`, `get_settings()`, `get_session()`, `create_app()`
- Produces: `GET /api/health` returning `{"status": "ok", "database": "ok"}`
- Consumes: no earlier project code

- [ ] **Step 1: Add backend metadata and the failing health test**

```toml
# backend/pyproject.toml
[project]
name = "contentproof-ai"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
  "fastapi>=0.115,<1",
  "uvicorn[standard]>=0.30,<1",
  "pydantic-settings>=2.5,<3",
  "sqlalchemy>=2.0,<3",
  "httpx>=0.27,<1",
]

[project.optional-dependencies]
dev = [
  "pytest>=8,<9",
  "pytest-asyncio>=0.24,<1",
]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

```python
# backend/tests/test_health.py
from fastapi.testclient import TestClient

from app.main import create_app


def test_health_reports_api_and_database_ready():
    response = TestClient(create_app()).get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}
```

- [ ] **Step 2: Create the environment and verify the test fails**

Run:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m pytest tests/test_health.py -v
```

Expected: collection fails with `ModuleNotFoundError: No module named 'app.main'`.

- [ ] **Step 3: Implement settings, database lifecycle, health route, and application factory**

```python
# backend/app/config.py
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./contentproof.db"
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen2:1.5b"

    model_config = SettingsConfigDict(env_prefix="CONTENTPROOF_", env_file=".env")


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

```python
# backend/app/db.py
from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_session() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session


def check_database() -> str:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return "ok"
```

```python
# backend/app/api/health.py
from fastapi import APIRouter

from app.db import check_database

router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "database": check_database()}
```

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router


def create_app() -> FastAPI:
    app = FastAPI(title="ContentProof AI", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    return app


app = create_app()
```

- [ ] **Step 4: Run the health test**

Run:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_health.py -v
```

Expected: `1 passed`.

- [ ] **Step 5: Commit the backend foundation**

```powershell
git add backend
git commit -m "feat: add backend foundation and health diagnostics"
```

---

### Task 2: Persistent Domain Model and Immutable Prompt Versions

**Files:**
- Create: `backend/app/models.py`
- Create: `backend/app/schemas.py`
- Create: `backend/app/repositories.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_repositories.py`

**Interfaces:**
- Consumes: `Base`, `SessionLocal`
- Produces: `TaskRepository.create_task()`, `PromptRepository.create_version()`
- Produces: database entities `ContentTask`, `SourceRecord`, `PromptVersion`, `WorkflowRun`, `WorkflowStep`, `Evaluation`, `HumanReview`

- [ ] **Step 1: Write failing repository tests**

```python
# backend/tests/test_repositories.py
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db import Base
from app.repositories import PromptRepository, TaskRepository
from app.schemas import PromptCreate, TaskCreate


def make_session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def test_task_repository_creates_a_task():
    with make_session() as session:
        task = TaskRepository(session).create_task(
            TaskCreate(
                title="端午反诈活动稿",
                content_type="活动新闻",
                target_platform="常德融媒",
                audience="常德市民",
                tone="准确、清晰",
                min_words=400,
                max_words=700,
                banned_phrases=["据网传"],
            )
        )

        assert task.id is not None
        assert task.status == "draft"


def test_prompt_versions_are_append_only():
    with make_session() as session:
        repository = PromptRepository(session)
        v1 = repository.create_version(PromptCreate(name="draft", step="draft", template="版本一"))
        v2 = repository.create_version(PromptCreate(name="draft", step="draft", template="版本二"))

        assert (v1.version, v2.version) == (1, 2)
        assert v1.template == "版本一"
```

- [ ] **Step 2: Run the tests and verify missing modules**

Run:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_repositories.py -v
```

Expected: collection fails because `app.repositories` does not exist.

- [ ] **Step 3: Add API schemas**

```python
# backend/app/schemas.py
from pydantic import BaseModel, Field


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content_type: str
    target_platform: str
    audience: str
    tone: str
    min_words: int = Field(ge=1)
    max_words: int = Field(ge=1)
    banned_phrases: list[str] = []


class PromptCreate(BaseModel):
    name: str
    step: str
    template: str = Field(min_length=1)
    change_note: str = ""
```

- [ ] **Step 4: Add focused persistent models**

```python
# backend/app/models.py
from datetime import datetime

from sqlalchemy import ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


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
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


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
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


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
```

- [ ] **Step 5: Implement append-only repositories**

```python
# backend/app/repositories.py
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ContentTask, PromptVersion
from app.schemas import PromptCreate, TaskCreate


class TaskRepository:
    def __init__(self, session: Session):
        self.session = session

    def create_task(self, data: TaskCreate) -> ContentTask:
        task = ContentTask(**data.model_dump())
        self.session.add(task)
        self.session.commit()
        self.session.refresh(task)
        return task


class PromptRepository:
    def __init__(self, session: Session):
        self.session = session

    def create_version(self, data: PromptCreate) -> PromptVersion:
        latest = self.session.scalar(
            select(func.max(PromptVersion.version)).where(PromptVersion.name == data.name)
        )
        prompt = PromptVersion(**data.model_dump(), version=(latest or 0) + 1)
        self.session.add(prompt)
        self.session.commit()
        self.session.refresh(prompt)
        return prompt
```

- [ ] **Step 6: Create tables during local application startup and run tests**

Add to `backend/app/main.py`:

```python
from app.db import Base, engine


def create_app() -> FastAPI:
    Base.metadata.create_all(engine)
    app = FastAPI(title="ContentProof AI", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    return app
```

Run:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_repositories.py -v
```

Expected: `2 passed`.

- [ ] **Step 7: Commit the persistent model**

```powershell
git add backend/app backend/tests/test_repositories.py
git commit -m "feat: add persistent tasks and prompt versions"
```

---

### Task 3: Ollama Provider and Resumable Workflow

**Files:**
- Create: `backend/app/providers/__init__.py`
- Create: `backend/app/providers/base.py`
- Create: `backend/app/providers/ollama.py`
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/workflow.py`
- Create: `backend/tests/test_ollama.py`
- Create: `backend/tests/test_workflow.py`

**Interfaces:**
- Produces: `ModelProvider.generate(request: ModelRequest) -> ModelResult`
- Produces: `OllamaProvider.list_models()` and `OllamaProvider.generate()`
- Produces: `WorkflowService.start_run()` and `WorkflowService.retry_failed_step()`
- Consumes: persistent task, prompt, run, and step models

- [ ] **Step 1: Write failing provider tests**

```python
# backend/tests/test_ollama.py
import httpx

from app.providers.base import ModelRequest
from app.providers.ollama import OllamaProvider


def test_ollama_provider_parses_structured_result():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"response": '{"text":"成稿"}', "done": True})

    provider = OllamaProvider(
        base_url="http://ollama.test",
        model="qwen2:1.5b",
        transport=httpx.MockTransport(handler),
    )

    result = provider.generate(ModelRequest(prompt="写稿", schema={"type": "object"}))

    assert result.data == {"text": "成稿"}
    assert result.model == "qwen2:1.5b"
```

- [ ] **Step 2: Run the provider test and verify failure**

Run:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_ollama.py -v
```

Expected: collection fails because `app.providers.base` does not exist.

- [ ] **Step 3: Implement the provider protocol and Ollama adapter**

```python
# backend/app/providers/base.py
from typing import Protocol

from pydantic import BaseModel


class ModelRequest(BaseModel):
    prompt: str
    schema: dict
    temperature: float = 0.2


class ModelResult(BaseModel):
    text: str
    data: dict
    model: str
    elapsed_ms: int


class ModelProvider(Protocol):
    def generate(self, request: ModelRequest) -> ModelResult:
        ...
```

```python
# backend/app/providers/ollama.py
import json
from time import perf_counter

import httpx

from app.providers.base import ModelRequest, ModelResult


class OllamaProvider:
    def __init__(
        self,
        base_url: str,
        model: str,
        transport: httpx.BaseTransport | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.client = httpx.Client(transport=transport, timeout=120)

    def list_models(self) -> list[str]:
        response = self.client.get(f"{self.base_url}/api/tags")
        response.raise_for_status()
        return [item["name"] for item in response.json().get("models", [])]

    def generate(self, request: ModelRequest) -> ModelResult:
        started = perf_counter()
        response = self.client.post(
            f"{self.base_url}/api/generate",
            json={
                "model": self.model,
                "prompt": request.prompt,
                "stream": False,
                "format": request.schema,
                "options": {"temperature": request.temperature},
            },
        )
        response.raise_for_status()
        text = response.json()["response"]
        data = json.loads(text)
        return ModelResult(
            text=text,
            data=data,
            model=self.model,
            elapsed_ms=round((perf_counter() - started) * 1000),
        )
```

- [ ] **Step 4: Run the provider test**

Run:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_ollama.py -v
```

Expected: `1 passed`.

- [ ] **Step 5: Write failing workflow retry test**

```python
# backend/tests/test_workflow.py
from app.services.workflow import WorkflowMachine


def test_retry_starts_at_failed_step_and_keeps_completed_outputs():
    machine = WorkflowMachine(["facts", "outline", "draft", "adapt"])
    machine.complete("facts", {"facts": ["活动共200人参与"]})
    machine.fail("outline", "invalid json")

    retry = machine.retry_plan()

    assert retry == ["outline", "draft", "adapt"]
    assert machine.output("facts") == {"facts": ["活动共200人参与"]}
```

- [ ] **Step 6: Implement the focused state machine**

```python
# backend/app/services/workflow.py
from dataclasses import dataclass, field


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
        failed_index = next(i for i, step in enumerate(self.steps) if step.status == "failed")
        return [step.name for step in self.steps[failed_index:]]

    def output(self, name: str) -> dict:
        return self._step(name).output
```

- [ ] **Step 7: Run provider and workflow tests**

Run:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_ollama.py tests/test_workflow.py -v
```

Expected: `2 passed`.

- [ ] **Step 8: Commit model integration and workflow state**

```powershell
git add backend/app/providers backend/app/services backend/tests/test_ollama.py backend/tests/test_workflow.py
git commit -m "feat: add Ollama provider and resumable workflow"
```

---

### Task 4: Deterministic Rules and Weighted Evaluation

**Files:**
- Create: `backend/app/services/rules.py`
- Create: `backend/app/services/evaluator.py`
- Create: `backend/tests/test_rules.py`
- Create: `backend/tests/test_evaluator.py`

**Interfaces:**
- Produces: `RuleEngine.evaluate(text, facts, banned_phrases, min_words, max_words)`
- Produces: `EvaluationService.combine(rule_result, model_scores) -> EvaluationResult`
- Consumes: generated draft, fact cards, task constraints

- [ ] **Step 1: Write failing deterministic rule tests**

```python
# backend/tests/test_rules.py
from app.services.rules import RuleEngine


def test_rules_find_unsupported_required_fact_and_banned_phrase():
    result = RuleEngine().evaluate(
        text="据网传，活动在万达广场举行。",
        required_facts=["活动吸引200人参与"],
        banned_phrases=["据网传"],
        min_words=1,
        max_words=100,
    )

    assert result.missing_facts == ["活动吸引200人参与"]
    assert result.banned_hits == ["据网传"]
    assert result.passed is False
```

- [ ] **Step 2: Implement deterministic rules**

```python
# backend/app/services/rules.py
from pydantic import BaseModel


class RuleResult(BaseModel):
    word_count: int
    missing_facts: list[str]
    banned_hits: list[str]
    length_ok: bool
    passed: bool


class RuleEngine:
    def evaluate(
        self,
        text: str,
        required_facts: list[str],
        banned_phrases: list[str],
        min_words: int,
        max_words: int,
    ) -> RuleResult:
        word_count = len(text)
        missing = [fact for fact in required_facts if fact not in text]
        banned = [phrase for phrase in banned_phrases if phrase in text]
        length_ok = min_words <= word_count <= max_words
        return RuleResult(
            word_count=word_count,
            missing_facts=missing,
            banned_hits=banned,
            length_ok=length_ok,
            passed=not missing and not banned and length_ok,
        )
```

- [ ] **Step 3: Write the failing weighted-score test**

```python
# backend/tests/test_evaluator.py
from app.services.evaluator import EvaluationService
from app.services.rules import RuleResult


def test_weighted_score_uses_fixed_dimensions_and_is_advisory():
    result = EvaluationService().combine(
        rule_result=RuleResult(
            word_count=500,
            missing_facts=[],
            banned_hits=[],
            length_ok=True,
            passed=True,
        ),
        model_scores={
            "factual_accuracy": 90,
            "structure": 80,
            "readability": 70,
            "platform_fit": 60,
            "risk_control": 100,
        },
    )

    assert result.total == 81.5
    assert result.advisory is True
```

- [ ] **Step 4: Implement weighted evaluation and validation**

```python
# backend/app/services/evaluator.py
from pydantic import BaseModel, Field

from app.services.rules import RuleResult


class EvaluationResult(BaseModel):
    scores: dict[str, float]
    total: float = Field(ge=0, le=100)
    advisory: bool = True
    rule_passed: bool


class EvaluationService:
    weights = {
        "factual_accuracy": 0.35,
        "structure": 0.20,
        "readability": 0.20,
        "platform_fit": 0.15,
        "risk_control": 0.10,
    }

    def combine(self, rule_result: RuleResult, model_scores: dict[str, float]) -> EvaluationResult:
        if set(model_scores) != set(self.weights):
            raise ValueError("model score dimensions do not match the rubric")
        if any(score < 0 or score > 100 for score in model_scores.values()):
            raise ValueError("scores must be between 0 and 100")
        total = round(
            sum(model_scores[name] * weight for name, weight in self.weights.items()),
            2,
        )
        return EvaluationResult(
            scores=model_scores,
            total=total,
            advisory=True,
            rule_passed=rule_result.passed,
        )
```

- [ ] **Step 5: Run evaluation tests**

Run:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_rules.py tests/test_evaluator.py -v
```

Expected: `2 passed`.

- [ ] **Step 6: Commit the evaluation engine**

```powershell
git add backend/app/services backend/tests/test_rules.py backend/tests/test_evaluator.py
git commit -m "feat: add deterministic and weighted evaluation"
```

---

### Task 5: Task, Prompt, Run, Review, and Export APIs

**Files:**
- Create: `backend/app/api/tasks.py`
- Create: `backend/app/api/prompts.py`
- Create: `backend/app/api/evaluations.py`
- Create: `backend/app/services/reports.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/schemas.py`
- Create: `backend/tests/test_api.py`
- Create: `backend/tests/test_reports.py`

**Interfaces:**
- Produces: REST endpoints under `/api/tasks`, `/api/prompts`, `/api/runs`, `/api/evaluations`
- Produces: `render_markdown_report()` and `render_csv_rows()`
- Consumes: repositories, workflow service, evaluator, database session

- [ ] **Step 1: Write failing API contract test**

```python
# backend/tests/test_api.py
def test_create_task_and_prompt(client):
    task_response = client.post(
        "/api/tasks",
        json={
            "title": "端午反诈活动稿",
            "content_type": "活动新闻",
            "target_platform": "常德融媒",
            "audience": "常德市民",
            "tone": "准确、清晰",
            "min_words": 400,
            "max_words": 700,
            "banned_phrases": ["据网传"],
        },
    )
    prompt_response = client.post(
        "/api/prompts",
        json={"name": "draft", "step": "draft", "template": "依据事实卡片写稿"},
    )

    assert task_response.status_code == 201
    assert prompt_response.status_code == 201
    assert prompt_response.json()["version"] == 1
```

Add a client fixture:

```python
# backend/tests/conftest.py
import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client():
    with TestClient(create_app()) as test_client:
        yield test_client
```

- [ ] **Step 2: Run the API contract test**

Run:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_api.py -v
```

Expected: both POST requests return `404`.

- [ ] **Step 3: Add response and review schemas**

```python
# append to backend/app/schemas.py
class HumanReviewCreate(BaseModel):
    decision: str = Field(pattern="^(accepted|modified|rejected)$")
    reason_tags: list[str] = []
    notes: str = ""
    final_text: str = ""


class EvaluationPayload(BaseModel):
    required_facts: list[str]
    text: str
    model_scores: dict[str, float]


class SourceCreate(BaseModel):
    title: str
    url: str
    excerpt: str = Field(max_length=180)
    facts: list[dict]


class RunCreate(BaseModel):
    prompt_version_id: int
    model_name: str
```

- [ ] **Step 4: Implement task and prompt endpoints**

```python
# backend/app/api/tasks.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_session
from app.repositories import TaskRepository
from app.schemas import TaskCreate

router = APIRouter(prefix="/api/tasks", tags=["tasks"])
runs_router = APIRouter(prefix="/api/runs", tags=["runs"])


@router.post("", status_code=201)
def create_task(data: TaskCreate, session: Session = Depends(get_session)) -> dict:
    task = TaskRepository(session).create_task(data)
    return {"id": task.id, "title": task.title, "status": task.status}
```

```python
# backend/app/api/prompts.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_session
from app.repositories import PromptRepository
from app.schemas import PromptCreate

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


@router.post("", status_code=201)
def create_prompt(data: PromptCreate, session: Session = Depends(get_session)) -> dict:
    prompt = PromptRepository(session).create_version(data)
    return {
        "id": prompt.id,
        "name": prompt.name,
        "step": prompt.step,
        "version": prompt.version,
        "template": prompt.template,
    }
```

Register both routers in `backend/app/main.py`:

```python
from app.api.prompts import router as prompts_router
from app.api.tasks import router as tasks_router

app.include_router(tasks_router)
app.include_router(prompts_router)
```

- [ ] **Step 5: Write and implement report rendering**

```python
# backend/tests/test_reports.py
from app.services.reports import render_markdown_report


def test_markdown_report_labels_model_score_as_advisory():
    report = render_markdown_report(
        title="端午反诈活动稿",
        total=81.5,
        scores={"factual_accuracy": 90},
        decision="modified",
    )

    assert "模型辅助评分，仅供参考" in report
    assert "81.5" in report
```

```python
# backend/app/services/reports.py
import csv
import io


def render_markdown_report(
    title: str,
    total: float,
    scores: dict[str, float],
    decision: str,
) -> str:
    lines = [
        f"# {title} 评测报告",
        "",
        "> 模型辅助评分，仅供参考；最终判断由人工终审完成。",
        "",
        f"- 总分：{total}",
        f"- 人工决定：{decision}",
        "",
        "## 分项得分",
    ]
    lines.extend(f"- {name}: {score}" for name, score in scores.items())
    return "\n".join(lines) + "\n"


def render_csv_rows(rows: list[dict]) -> str:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(rows[0]) if rows else [])
    if rows:
        writer.writeheader()
        writer.writerows(rows)
    return output.getvalue()
```

- [ ] **Step 6: Run backend contract and report tests**

Run:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_api.py tests/test_reports.py -v
```

Expected: `2 passed`.

- [ ] **Step 7: Add source, run, evaluation, review, and export endpoints**

Add the imports and route handlers below to `backend/app/api/tasks.py`:

```python
from fastapi import HTTPException, Response
from sqlalchemy import select

from app.models import Evaluation, HumanReview, SourceRecord, WorkflowRun, WorkflowStep
from app.schemas import EvaluationPayload, HumanReviewCreate, RunCreate, SourceCreate
from app.services.evaluator import EvaluationService
from app.services.reports import render_csv_rows, render_markdown_report
from app.services.rules import RuleEngine


@router.post("/{task_id}/sources", status_code=201)
def create_source(
    task_id: int,
    data: SourceCreate,
    session: Session = Depends(get_session),
) -> dict:
    source = SourceRecord(task_id=task_id, **data.model_dump())
    session.add(source)
    session.commit()
    session.refresh(source)
    return {"id": source.id, "task_id": source.task_id}


@router.post("/{task_id}/runs", status_code=201)
def create_run(
    task_id: int,
    data: RunCreate,
    session: Session = Depends(get_session),
) -> dict:
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
        select(WorkflowStep).where(WorkflowStep.run_id == run_id).order_by(WorkflowStep.position)
    ).all()
    return {
        "id": run.id,
        "status": run.status,
        "steps": [{"name": step.name, "status": step.status, "error": step.error} for step in steps],
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
        text=data.text,
        required_facts=data.required_facts,
        banned_phrases=task.banned_phrases,
        min_words=task.min_words,
        max_words=task.max_words,
    )
    result = EvaluationService().combine(rules, data.model_scores)
    evaluation = Evaluation(
        run_id=run_id,
        scores=result.scores,
        total_score=result.total,
        advisory=True,
    )
    session.add(evaluation)
    session.commit()
    return result.model_dump()


@runs_router.post("/{run_id}/reviews", status_code=201)
def review_run(
    run_id: int,
    data: HumanReviewCreate,
    session: Session = Depends(get_session),
) -> dict:
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
        task.title,
        evaluation.total_score,
        evaluation.scores,
        review.decision,
    )
    return Response(body, media_type="text/markdown; charset=utf-8")


@router.get("/{task_id}/experiments.csv")
def export_experiments(task_id: int, session: Session = Depends(get_session)) -> Response:
    runs = session.scalars(select(WorkflowRun).where(WorkflowRun.task_id == task_id)).all()
    rows = []
    for run in runs:
        evaluation = session.scalar(select(Evaluation).where(Evaluation.run_id == run.id))
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
```

Import `ContentTask` in the route module and register both `router` and `runs_router` in `app/main.py`. Add API tests that create a task, source, prompt, and run; then assert retry returns `409` before failure, evaluation persists a score, review persists a decision, Markdown includes the advisory label, and CSV includes `total_score`.

Run:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_api.py tests/test_reports.py -v
```

Expected: all API and report tests pass.

- [ ] **Step 8: Commit the API surface**

```powershell
git add backend/app backend/tests
git commit -m "feat: expose workflow evaluation and report APIs"
```

---

### Task 6: Public Samples, Evaluation Cases, and Seeder

**Files:**
- Create: `data/public_samples.json`
- Create: `data/evaluation_cases.json`
- Create: `data/prompt_versions.json`
- Create: `scripts/seed.py`
- Create: `backend/tests/test_seed_data.py`

**Interfaces:**
- Produces: four verified public sample records, at least 20 evaluation cases, two prompt versions
- Consumes: task and prompt repositories

- [ ] **Step 1: Write failing fixture validation test**

```python
# backend/tests/test_seed_data.py
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_public_fixture_is_complete_and_does_not_embed_full_articles():
    samples = json.loads((ROOT / "data/public_samples.json").read_text(encoding="utf-8"))
    cases = json.loads((ROOT / "data/evaluation_cases.json").read_text(encoding="utf-8"))
    prompts = json.loads((ROOT / "data/prompt_versions.json").read_text(encoding="utf-8"))

    assert len(samples) == 4
    assert len(cases) >= 20
    assert len(prompts) >= 2
    assert all(len(sample["excerpt"]) <= 180 for sample in samples)
    assert all(sample["url"].startswith("https://appimg.cdyee.com/") for sample in samples)
```

- [ ] **Step 2: Run fixture validation and verify missing files**

Run:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_seed_data.py -v
```

Expected: `FileNotFoundError` for `data/public_samples.json`.

- [ ] **Step 3: Add the four verified public sample records**

Start `data/public_samples.json` with this first record, then place the next three records in the same JSON array:

```json
[
  {
    "title": "常德市老干部开展集中学习",
    "byline": "常德日报记者 邓淇月 实习记者 张作朋 通讯员 蔡胜利 文/图",
    "published_at": "2025-05-13T18:43:07+08:00",
    "source": "常德日报·常德融媒客户端",
    "url": "https://appimg.cdyee.com/app/template/displayTemplate/news/newsDetail/20000/3154149.html",
    "platform_displayed_views": 32355,
    "views_collected_at": "2026-07-26T00:00:00+08:00",
    "excerpt": "5月13日，全市老干部开展集中学习。",
    "rights_note": "Public metadata and a short excerpt only; full text and images are excluded."
  }
]
```

Add these three complete objects after the first object:

```json
[
  {
    "title": "常德市新媒体协会成立 “桃花源里 灵醒常德”网络作品征集活动、“常见MCN”同步启动",
    "byline": "常德日报记者 李张念 实习生 张作朋 文/图",
    "published_at": "2025-05-28T18:49:43+08:00",
    "source": "常德日报·常德融媒客户端",
    "url": "https://appimg.cdyee.com/app/template/displayTemplate/news/newsDetail/30492/3155984.html",
    "platform_displayed_views": 78887,
    "views_collected_at": "2026-07-26T00:00:00+08:00",
    "excerpt": "5月28日，常德市新媒体协会成立大会及相关网络作品征集活动举行。",
    "rights_note": "Public metadata and a short excerpt only; full text and images are excluded."
  },
  {
    "title": "【我们的节日·端午】“反诈+禁毒”遇上端午节 安全宣传“粽”动员",
    "byline": "常德日报记者 邓淇月 实习生 张作朋 文/图",
    "published_at": "2025-05-29T21:11:14+08:00",
    "source": "常德日报·常德融媒客户端",
    "url": "https://appimg.cdyee.com/app/template/displayTemplate/news/newsDetail/30533/3156167.html",
    "platform_displayed_views": 15065,
    "views_collected_at": "2026-07-26T00:00:00+08:00",
    "excerpt": "5月29日下午，常德市反诈中心联合市公安局禁毒支队开展安全宣传活动。",
    "rights_note": "Public metadata and a short excerpt only; full text and images are excluded."
  },
  {
    "title": "好戏连台！常德银发人才闪耀校园文化艺术节",
    "byline": "常德日报记者 邓淇月 实习生 张作朋 通讯员 尹茗 文/图",
    "published_at": "2025-05-30T18:03:45+08:00",
    "source": "常德日报·常德融媒客户端",
    "url": "https://appimg.cdyee.com/app/template/displayTemplate/news/newsDetail/20012/3156338.html",
    "platform_displayed_views": 20812,
    "views_collected_at": "2026-07-26T00:00:00+08:00",
    "excerpt": "5月30日下午，常德市老干部（老年）大学校园文化艺术节落幕。",
    "rights_note": "Public metadata and a short excerpt only; full text and images are excluded."
  }
]
```

- [ ] **Step 4: Add 20 evaluation cases and two immutable prompt versions**

Each item in `data/evaluation_cases.json` must follow:

```json
{
  "case_id": "real-3156167",
  "kind": "verified_public_sample",
  "task": {
    "content_type": "活动新闻",
    "target_platform": "地方融媒客户端",
    "audience": "常德市民",
    "tone": "准确、清晰",
    "min_words": 400,
    "max_words": 700
  },
  "required_facts": [
    "活动地点为常德万达广场",
    "活动主题包含反诈和禁毒"
  ],
  "forbidden_claims": [
    "不得虚构未提供的案件数量"
  ],
  "source_urls": [
    "https://appimg.cdyee.com/app/template/displayTemplate/news/newsDetail/30533/3156167.html"
  ]
}
```

The full file must contain four verified-sample cases, twelve public-source cases, and four explicit failure cases.

`data/prompt_versions.json` must contain:

```json
[
  {
    "name": "news_draft",
    "step": "draft",
    "version": 1,
    "change_note": "Baseline structured news draft",
    "template": "只依据事实卡片写作。缺少信息时明确标记待核验，不得补写事实。"
  },
  {
    "name": "news_draft",
    "step": "draft",
    "version": 2,
    "change_note": "Add platform, audience and source constraints",
    "template": "只依据事实卡片写作，并适配目标平台与受众。每个数字、日期、人物和机构必须来自事实卡片；缺少信息时标记待核验。"
  }
]
```

- [ ] **Step 5: Add an idempotent seeder**

```python
# scripts/seed.py
import json
from pathlib import Path

from app.db import Base, SessionLocal, engine
from app.repositories import PromptRepository
from app.schemas import PromptCreate


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    Base.metadata.create_all(engine)
    prompts = json.loads((ROOT / "data/prompt_versions.json").read_text(encoding="utf-8"))
    with SessionLocal() as session:
        repository = PromptRepository(session)
        for item in prompts:
            repository.create_version(
                PromptCreate(
                    name=item["name"],
                    step=item["step"],
                    template=item["template"],
                    change_note=item["change_note"],
                )
            )


if __name__ == "__main__":
    main()
```

Before inserting, extend `PromptRepository` with an existence check on `(name, version, template)` so rerunning the seeder does not create duplicates.

- [ ] **Step 6: Run fixture and repository tests**

Run:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_seed_data.py tests/test_repositories.py -v
```

Expected: all tests pass.

- [ ] **Step 7: Commit public fixtures**

```powershell
git add data scripts/seed.py backend/tests/test_seed_data.py backend/app/repositories.py
git commit -m "feat: add verified public samples and evaluation fixtures"
```

---

### Task 7: React Editing Workbench

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/index.html`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/api.ts`
- Create: `frontend/src/types.ts`
- Create: `frontend/src/styles.css`
- Create: `frontend/src/components/Sidebar.tsx`
- Create: `frontend/src/components/WorkflowTrack.tsx`
- Create: `frontend/src/components/QualityPanel.tsx`
- Create: `frontend/src/components/TaskEditor.tsx`
- Create: `frontend/src/components/PromptComparison.tsx`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: backend task, run, evaluation, prompt, review, and export endpoints
- Produces: editing operations desk with navigation, workflow trace, quality panel, human review, and prompt comparison

- [ ] **Step 1: Add frontend dependencies and failing workbench test**

```json
// frontend/package.json
{
  "name": "contentproof-ai-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.1",
    "vitest": "^2.1.8"
  }
}
```

```tsx
// frontend/src/App.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("ContentProof workbench", () => {
  it("shows workflow and advisory quality score", () => {
    render(<App />);

    expect(screen.getByText("ContentProof AI")).toBeInTheDocument();
    expect(screen.getByText("工作流轨迹")).toBeInTheDocument();
    expect(screen.getByText("模型辅助评分，仅供参考")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Install dependencies and verify the test fails**

Run:

```powershell
cd frontend
pnpm install
pnpm test
```

Expected: test collection fails because `src/App.tsx` does not exist.

- [ ] **Step 3: Define frontend API types and client**

```ts
// frontend/src/types.ts
export type StepStatus = "pending" | "running" | "completed" | "failed";

export interface WorkflowStep {
  name: string;
  status: StepStatus;
  elapsedMs?: number;
  error?: string;
}

export interface Evaluation {
  total: number;
  advisory: true;
  scores: Record<string, number>;
  reasons: Record<string, string>;
}
```

```ts
// frontend/src/api.ts
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    throw new Error(`API ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}
```

- [ ] **Step 4: Implement the operations desk shell**

```tsx
// frontend/src/App.tsx
import { QualityPanel } from "./components/QualityPanel";
import { Sidebar } from "./components/Sidebar";
import { TaskEditor } from "./components/TaskEditor";
import { WorkflowTrack } from "./components/WorkflowTrack";
import "./styles.css";

export default function App() {
  return (
    <main className="app-shell">
      <Sidebar />
      <section className="workspace">
        <header>
          <p className="eyebrow">AI 内容生产与质量评测工作台</p>
          <h1>ContentProof AI</h1>
        </header>
        <TaskEditor />
        <WorkflowTrack />
      </section>
      <QualityPanel />
    </main>
  );
}
```

```tsx
// frontend/src/components/Sidebar.tsx
export function Sidebar() {
  return (
    <aside className="sidebar">
      <strong>项目</strong>
      <nav>
        {["任务概览", "来源资料", "Prompt 版本", "评测报告", "项目设置"].map((item) => (
          <button key={item}>{item}</button>
        ))}
      </nav>
    </aside>
  );
}
```

```tsx
// frontend/src/components/TaskEditor.tsx
export function TaskEditor() {
  return (
    <section className="panel">
      <h2>任务录入</h2>
      <label>内容主题<input defaultValue="端午反诈活动稿" /></label>
      <label>目标平台<input defaultValue="地方融媒客户端" /></label>
      <label>事实资料<textarea aria-label="事实资料" /></label>
    </section>
  );
}
```

```tsx
// frontend/src/components/WorkflowTrack.tsx
const steps = ["事实摘要", "内容提纲", "初稿生成", "平台改写"];

export function WorkflowTrack() {
  return (
    <section className="panel">
      <h2>工作流轨迹</h2>
      {steps.map((step, index) => (
        <div className="step" key={step}>
          <span>{index + 1}</span>
          <strong>{step}</strong>
          <small>{index < 2 ? "已完成" : "待运行"}</small>
        </div>
      ))}
    </section>
  );
}
```

```tsx
// frontend/src/components/QualityPanel.tsx
export function QualityPanel() {
  return (
    <aside className="quality-panel">
      <p className="eyebrow">质量评分</p>
      <strong className="score">82</strong>
      <p>模型辅助评分，仅供参考</p>
      <dl>
        <dt>事实准确性</dt><dd>90</dd>
        <dt>结构完整性</dt><dd>84</dd>
        <dt>可读性</dt><dd>78</dd>
        <dt>平台适配</dt><dd>76</dd>
      </dl>
      <button>送交人工终审</button>
    </aside>
  );
}
```

- [ ] **Step 5: Add focused responsive styling and application entry**

```css
/* frontend/src/styles.css */
:root {
  font-family: Inter, "Microsoft YaHei", sans-serif;
  color: #17211b;
  background: #f3f1eb;
}
* { box-sizing: border-box; }
body { margin: 0; }
button, input, textarea { font: inherit; }
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 220px minmax(520px, 1fr) 300px;
}
.sidebar, .quality-panel { padding: 28px 22px; background: #10251a; color: #f8f6ef; }
.sidebar nav { display: grid; gap: 8px; margin-top: 28px; }
.sidebar button { text-align: left; border: 0; padding: 10px; color: inherit; background: transparent; }
.workspace { padding: 36px; }
.panel { background: white; border: 1px solid #dedbd2; padding: 22px; margin: 18px 0; }
label { display: grid; gap: 6px; margin: 12px 0; }
input, textarea { width: 100%; border: 1px solid #c8c5bc; padding: 10px; }
.step { display: grid; grid-template-columns: 32px 1fr auto; padding: 13px 0; border-bottom: 1px solid #ece8df; }
.score { display: block; font-size: 64px; color: #d6ff4b; }
.quality-panel dl { display: grid; grid-template-columns: 1fr auto; }
.quality-panel dd { margin: 0; }
.eyebrow { text-transform: uppercase; letter-spacing: .08em; font-size: 12px; }
@media (max-width: 960px) {
  .app-shell { grid-template-columns: 1fr; }
  .sidebar nav { grid-template-columns: repeat(3, 1fr); }
}
```

```tsx
// frontend/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
```

- [ ] **Step 6: Add Vite and Vitest configuration**

```ts
// frontend/vite.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
```

```ts
// frontend/src/test/setup.ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 7: Run frontend tests and production build**

Run:

```powershell
pnpm test
pnpm build
```

Expected: workbench test passes and Vite produces `frontend/dist`.

- [ ] **Step 8: Wire API data and Prompt comparison**

Implement `PromptComparison.tsx` to fetch two experiment results and render one row per evaluation case with columns `case`, `prompt v1`, `prompt v2`, `delta`, and `human decision`. Replace the static workflow and score data with API results. Add tests with mocked `fetch` that assert:

```tsx
expect(await screen.findByText("Prompt v1")).toBeInTheDocument();
expect(screen.getByText("+6.5")).toBeInTheDocument();
```

Run:

```powershell
pnpm test
```

Expected: all frontend tests pass.

- [ ] **Step 9: Commit the editing workbench**

```powershell
git add frontend
git commit -m "feat: add ContentProof editing workbench"
```

---

### Task 8: End-to-End Verification, Documentation, and Portfolio Assets

**Files:**
- Create: `README.md`
- Create: `docs/architecture.md`
- Create: `docs/demo-script.md`
- Create: `docs/project-retrospective.md`
- Create: `docs/resume-entry.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: complete backend, frontend, fixtures, Ollama provider, reports
- Produces: reproducible local setup, architecture explanation, demo script, retrospective, resume copy

- [ ] **Step 1: Add a full backend and frontend verification command**

Run:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -v
cd ..\frontend
pnpm test
pnpm build
```

Expected: all backend tests pass, all frontend tests pass, and the frontend build completes without TypeScript errors.

- [ ] **Step 2: Verify Ollama runtime and one real workflow case**

Run:

```powershell
ollama list
cd backend
.\.venv\Scripts\python.exe ..\scripts\seed.py
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In another PowerShell terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

Expected: health reports API and database ready; Ollama diagnostics list at least one available model. Run evaluation case `real-3156167` with both prompt versions and confirm two persisted reports.

- [ ] **Step 3: Add README with exact first-run instructions**

The README must contain:

```markdown
# ContentProof AI

AI 内容生产与质量评测工作台：用来源约束、Prompt 版本、运行追踪和人工终审，把内容生成变成可验证实验。

## Evidence

- 4 篇公开署名作品元数据
- 20+ 条评测用例
- 2 个 Prompt 版本
- 5 维质量评分
- 完整人工终审记录

## Local Run

1. Start Ollama and confirm `ollama list` returns a model.
2. Install backend dependencies from `backend/pyproject.toml`.
3. Run `python scripts/seed.py`.
4. Start FastAPI on port 8000.
5. Install frontend dependencies with `pnpm install`.
6. Start Vite with `pnpm dev`.

## Data and Rights

The repository stores public metadata, links, short excerpts, and original evaluation annotations. It does not redistribute full news articles or original images. View counts are platform-displayed cumulative counts collected on the recorded date, not unique users.
```

- [ ] **Step 4: Add architecture, demo, retrospective, and resume documents**

`docs/architecture.md` must explain the browser, API, state machine, model provider, SQLite, and report boundaries.

`docs/demo-script.md` must fit a three-minute sequence:

```text
0:00–0:25  Problem and verified samples
0:25–0:55  Task and source cards
0:55–1:25  Resumable workflow trace
1:25–2:05  Prompt version comparison
2:05–2:35  Human review and failure examples
2:35–3:00  Results, limitations, and repository evidence
```

`docs/project-retrospective.md` must separate measured results from limitations and explicitly state that small local model scores are advisory.

`docs/resume-entry.md` must contain only metrics produced by the completed evaluation run. If a metric has not been measured, omit that claim instead of inserting a placeholder.

- [ ] **Step 5: Perform credential, copyright, and artifact audit**

Run:

```powershell
git grep -n -E "sk-[A-Za-z0-9]|api[_-]?key|BEGIN PRIVATE KEY"
git ls-files | Select-String -Pattern "\.(db|sqlite|jpg|jpeg|png)$"
git status --short
```

Expected: no credentials, databases, or copied article images are tracked; only intended source changes appear.

- [ ] **Step 6: Capture real screenshots after visual inspection**

Start both services, open the workbench at desktop and narrow widths, and inspect:

- no clipped text or overlapping panels;
- readable Chinese typography;
- visible advisory-score label;
- clear failed-step and retry state;
- version comparison fits without horizontal overflow;
- public-source links open correctly.

Save only selected portfolio screenshots under `docs/assets/`. Add image captions that identify the screen and evidence shown.

- [ ] **Step 7: Run final verification**

Run:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -v
cd ..\frontend
pnpm test
pnpm build
cd ..
git diff --check
git status --short
```

Expected: all tests and builds pass, `git diff --check` prints nothing, and only intended documentation and screenshot files are uncommitted.

- [ ] **Step 8: Commit the completed portfolio**

```powershell
git add README.md docs .gitignore
git commit -m "docs: complete ContentProof portfolio handoff"
```
