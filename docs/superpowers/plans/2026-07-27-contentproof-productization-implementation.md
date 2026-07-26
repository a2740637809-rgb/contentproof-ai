# ContentProof AI Productization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn ContentProof AI from a static portfolio mockup into a public demo and locally runnable AI content-quality laboratory with a complete source-to-report workflow.

**Architecture:** The FastAPI backend becomes the source of truth for local mode, exposing complete task, source, prompt, run, evaluation, review, dashboard, and export APIs. The React frontend consumes a shared `ContentProofRepository` interface with two implementations: an in-browser demo repository backed by seeded JSON and a live HTTP repository backed by FastAPI and Ollama.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy 2, SQLite, httpx, pytest, React 18, TypeScript, Vite, Vitest, Testing Library, Ollama, static hosting

## Global Constraints

- Every visible button must perform a real action or display a specific disabled reason.
- Demo results must be labelled `演示数据`; live Ollama results must be labelled `本地模型`.
- Public fixtures may contain metadata, source links, short excerpts, and original annotations only.
- The public demo must not call the visitor's Ollama or persist sensitive content remotely.
- Prompt versions are immutable; editing creates a new version.
- Completed workflow-step outputs survive downstream failures and retries.
- Model-assisted scores are advisory and never replace deterministic checks or human review.
- Desktop and 390px mobile layouts must complete core flows without horizontal scrolling.
- Do not add authentication, multi-tenancy, a general drag-and-drop graph editor, a plugin marketplace, cloud billing, automatic publishing, or arbitrary full-page scraping.

---

## Planned File Structure

```text
backend/app/
  api/
    dashboard.py          # Aggregate project metrics
    tasks.py              # Task/source/run/review CRUD and exports
    prompts.py            # Prompt list and append-only versions
  services/
    demo_seed.py          # Idempotent complete demo project
    workflow.py           # Persisted execution and retries
    evaluator.py          # Scores plus evidence and explanations
  schemas.py              # Typed request/response contracts
frontend/src/
  App.tsx                 # Boot, mode selection and page shell
  api.ts                  # Live HTTP repository
  demoRepository.ts       # Browser demo repository
  repository.ts           # Shared repository interface
  seed.ts                 # Typed demo snapshot
  state.tsx               # App provider and action state
  types.ts                # Frontend domain contracts
  components/
    AppShell.tsx
    ConnectionGate.tsx
    ToastRegion.tsx
  pages/
    DashboardPage.tsx
    SourcesPage.tsx
    WorkflowPage.tsx
    ExperimentsPage.tsx
    EvaluationsPage.tsx
    ReviewPage.tsx
  test/
    fixtures.ts
e2e/
  demo-flow.spec.ts
docs/
  deployment.md
  user-guide.md
```

---

### Task 1: Complete Read Models and CRUD API Contracts

**Files:**
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/api/tasks.py`
- Modify: `backend/app/api/prompts.py`
- Create: `backend/app/api/dashboard.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_api.py`

**Interfaces:**
- Consumes: existing SQLAlchemy entities and `get_session()`
- Produces: `GET /api/dashboard`, task/source list-detail-update-delete routes, `GET /api/prompts`, `GET /api/runs/{id}` with step outputs

- [ ] **Step 1: Add failing API read-model tests**

Append tests that create two tasks, a source, two prompt versions, and a run, then assert:

```python
def test_product_read_models(client):
    task = create_task(client, title="端午内容实验")
    source = client.post(
        f"/api/tasks/{task['id']}/sources",
        json={
            "title": "公开来源",
            "url": "https://example.com/source",
            "excerpt": "活动主题包含反诈与禁毒。",
            "facts": [{"text": "活动主题包含反诈与禁毒", "status": "verified"}],
        },
    ).json()

    tasks = client.get("/api/tasks").json()
    detail = client.get(f"/api/tasks/{task['id']}").json()
    updated_source = client.patch(
        f"/api/tasks/{task['id']}/sources/{source['id']}",
        json={"status": "verified"},
    ).json()
    dashboard = client.get("/api/dashboard").json()

    assert tasks[0]["title"] == "端午内容实验"
    assert detail["sources"][0]["id"] == source["id"]
    assert updated_source["status"] == "verified"
    assert dashboard["task_count"] == 1
```

- [ ] **Step 2: Run the tests and verify the missing routes**

Run:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests/test_api.py -v
```

Expected: failures with `405` or `404` for the new GET/PATCH routes.

- [ ] **Step 3: Define explicit response and update schemas**

Add:

```python
class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    target_platform: str | None = None
    audience: str | None = None
    tone: str | None = None


class SourceUpdate(BaseModel):
    excerpt: str | None = Field(default=None, max_length=180)
    facts: list[dict] | None = None
    status: str | None = Field(
        default=None, pattern="^(verified|pending|rejected)$"
    )


class StepRead(BaseModel):
    name: str
    position: int
    status: str
    input_json: dict
    output_json: dict
    error: str


class DashboardRead(BaseModel):
    task_count: int
    run_count: int
    completed_runs: int
    failed_runs: int
    reviewed_runs: int
    average_score: float | None
```

- [ ] **Step 4: Implement list, detail, update and dashboard queries**

Use ordered SQLAlchemy selects. Task detail returns nested sources and recent runs. Run detail returns `input_json`, `output_json`, and `position` for each step. Add `PATCH` and `DELETE` routes for tasks and sources; return `409` when deleting a task that owns runs unless `force=true` is explicitly supplied. Dashboard aggregates only persisted records and returns `None` when no evaluations exist.

- [ ] **Step 5: Run backend tests**

Run:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests -q
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```powershell
git add backend/app backend/tests/test_api.py
git commit -m "feat: expose complete product read models"
```

---

### Task 2: Seed a Complete, Idempotent Demo Project

**Files:**
- Create: `backend/app/services/demo_seed.py`
- Modify: `backend/app/api/dashboard.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_demo_seed.py`
- Modify: `data/public_samples.json`
- Modify: `data/prompt_versions.json`

**Interfaces:**
- Consumes: existing public fixtures and SQLAlchemy models
- Produces: `seed_demo_project(session: Session) -> int`, `POST /api/demo/reset`

- [ ] **Step 1: Write the failing idempotency test**

```python
def test_demo_seed_is_complete_and_idempotent(session):
    first_id = seed_demo_project(session)
    second_id = seed_demo_project(session)

    assert first_id == second_id
    assert session.scalar(select(func.count(ContentTask.id))) == 1
    assert session.scalar(select(func.count(SourceRecord.id))) == 4
    assert session.scalar(select(func.count(PromptVersion.id))) == 2
    assert session.scalar(select(func.count(WorkflowRun.id))) == 2
    assert session.scalar(select(func.count(HumanReview.id))) == 2
```

- [ ] **Step 2: Run the test and verify import failure**

Run:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests/test_demo_seed.py -v
```

Expected: `ModuleNotFoundError` for `app.services.demo_seed`.

- [ ] **Step 3: Implement one coherent demo snapshot**

Create a task named `端午反诈与禁毒内容实验`, attach all four public sources, create v1/v2 runs with completed steps, persist evaluations with evidence, and persist human decisions. Use a stable task marker such as `status="demo"` and query that marker before inserting.

- [ ] **Step 4: Add reset endpoint**

`POST /api/demo/reset` deletes only rows belonging to the demo task in foreign-key-safe order, calls `seed_demo_project`, and returns:

```json
{"task_id": 1, "mode": "demo", "label": "演示数据"}
```

- [ ] **Step 5: Verify reset and idempotency**

Run:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests/test_demo_seed.py backend/tests/test_api.py -v
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```powershell
git add backend/app data backend/tests/test_demo_seed.py
git commit -m "feat: add complete resettable demo project"
```

---

### Task 3: Make Workflow Execution Observable and Retryable

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/services/workflow.py`
- Modify: `backend/app/api/tasks.py`
- Modify: `backend/app/api/health.py`
- Modify: `backend/tests/test_workflow.py`
- Modify: `backend/tests/test_ollama.py`

**Interfaces:**
- Consumes: `ModelProvider.generate()`, persisted run and step records
- Produces: `POST /api/runs/{id}/execute` returning `202`, `POST /api/runs/{id}/steps/{name}/retry`, Ollama diagnostics

- [ ] **Step 1: Write failing execution-state tests**

Test that execution:

- marks the run `running` before generation;
- persists each completed step immediately;
- marks one step and the run `failed` on provider failure;
- retries from a named failed step;
- preserves prior completed outputs.

```python
assert [step.status for step in steps] == [
    "completed", "failed", "pending", "pending"
]
assert steps[0].output_json == {"text": "已核验事实"}
```

- [ ] **Step 2: Add timing and model metadata**

Add nullable `started_at`, `completed_at`, and `elapsed_ms` columns to `WorkflowRun` and `WorkflowStep`. For this local prototype, update table creation logic and tests without introducing Alembic migration history.

- [ ] **Step 3: Implement background execution**

Use FastAPI `BackgroundTasks` for the local single-user release. The request sets the run to `queued`, returns `202`, and a new `SessionLocal` executes the run. Do not reuse the request session inside the background function.

```python
@runs_router.post("/{run_id}/execute", status_code=202)
def execute_run(run_id: int, background_tasks: BackgroundTasks, ...):
    mark_run_queued(session, run_id)
    background_tasks.add_task(execute_run_background, run_id)
    return {"id": run_id, "status": "queued"}
```

- [ ] **Step 4: Add model diagnostics**

Extend `/api/health` to return:

```json
{
  "status": "ok",
  "database": "ok",
  "ollama": {
    "status": "ready",
    "models": ["qwen2:1.5b", "qwen2.5:0.5b"],
    "selected": "qwen2:1.5b"
  }
}
```

On connection failure return `status: "unavailable"` plus the exact local start command, while keeping the HTTP response `200`.

- [ ] **Step 5: Run workflow and provider tests**

Run:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests/test_workflow.py backend/tests/test_ollama.py backend/tests/test_health.py -v
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```powershell
git add backend/app backend/tests
git commit -m "feat: add observable background workflow runs"
```

---

### Task 4: Generate Evaluation Evidence and Complete Exports

**Files:**
- Modify: `backend/app/services/rules.py`
- Modify: `backend/app/services/evaluator.py`
- Modify: `backend/app/services/reports.py`
- Modify: `backend/app/api/tasks.py`
- Create: `backend/app/api/evaluations.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_evaluator.py`
- Modify: `backend/tests/test_reports.py`

**Interfaces:**
- Consumes: final workflow text, task constraints, required facts, `ModelProvider`
- Produces: evidence-rich evaluation payload, Markdown/CSV/JSON downloads

- [ ] **Step 1: Write failing evidence tests**

```python
assert result.dimensions["factual_accuracy"].score == 90
assert result.dimensions["factual_accuracy"].reason
assert result.rule_evidence["missing_facts"] == []
assert result.label == "模型辅助评分，仅供参考"
```

- [ ] **Step 2: Replace score-only result with typed dimensions**

Define:

```python
class DimensionResult(BaseModel):
    score: float
    reason: str
    evidence: list[str] = Field(default_factory=list)


class EvaluationResult(BaseModel):
    dimensions: dict[str, DimensionResult]
    total: float
    rule_passed: bool
    rule_evidence: dict
    advisory: bool = True
    label: str = "模型辅助评分，仅供参考"
```

Reject missing reasons and unknown dimensions.

- [ ] **Step 3: Generate advisory dimensions from the configured provider**

Change `POST /api/runs/{id}/evaluate` to derive the final text from the completed `adapt` step and required facts from verified source cards. `EvaluationService.evaluate_run()` executes deterministic rules first, then asks `ModelProvider` for the five typed dimension scores, reasons, and evidence. Tests inject a fake provider; the frontend never submits invented scores.

If Ollama is unavailable, return `409` with action `启动 Ollama，或切换到演示模式`. Preserve the existing rule result so the user can inspect it before retrying.

- [ ] **Step 4: Add evaluation list/detail endpoints**

- `GET /api/evaluations?task_id={id}`
- `GET /api/evaluations/{id}`

Return run, prompt version, model, total, dimensions, rule evidence and human decision.

- [ ] **Step 5: Add JSON evidence export**

`GET /api/runs/{id}/evidence.json` returns task constraints, sources, prompt, workflow trace, evaluation and review. It must omit full article text and credentials.

- [ ] **Step 6: Run evaluation and report tests**

Run:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests/test_evaluator.py backend/tests/test_reports.py backend/tests/test_api.py -v
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```powershell
git add backend/app backend/tests
git commit -m "feat: add evidence-rich evaluations and exports"
```

---

### Task 5: Introduce the Dual-Mode Frontend Data Layer

**Files:**
- Rewrite: `frontend/src/types.ts`
- Rewrite: `frontend/src/api.ts`
- Create: `frontend/src/repository.ts`
- Create: `frontend/src/demoRepository.ts`
- Create: `frontend/src/seed.ts`
- Create: `frontend/src/state.tsx`
- Create: `frontend/src/components/ConnectionGate.tsx`
- Create: `frontend/src/components/ToastRegion.tsx`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: Task 1-4 API contracts
- Produces: `ContentProofRepository`, `LiveRepository`, `DemoRepository`, `useContentProof()`

- [ ] **Step 1: Write failing mode-selection tests**

```tsx
render(<App />);
expect(screen.getByRole("button", { name: "立即体验示例" })).toBeEnabled();
expect(screen.getByRole("button", { name: "连接本地模型" })).toBeEnabled();

await user.click(screen.getByRole("button", { name: "立即体验示例" }));
expect(await screen.findByText("演示数据")).toBeInTheDocument();
```

- [ ] **Step 2: Define the repository contract**

```ts
export interface ContentProofRepository {
  getHealth(): Promise<Health>;
  getDashboard(): Promise<Dashboard>;
  listTasks(): Promise<TaskSummary[]>;
  getTask(id: number): Promise<TaskDetail>;
  createTask(input: TaskInput): Promise<TaskDetail>;
  addSource(taskId: number, input: SourceInput): Promise<Source>;
  listPrompts(): Promise<PromptVersion[]>;
  createPrompt(input: PromptInput): Promise<PromptVersion>;
  createRun(taskId: number, input: RunInput): Promise<Run>;
  executeRun(runId: number): Promise<Run>;
  getRun(runId: number): Promise<Run>;
  retryStep(runId: number, step: string): Promise<Run>;
  evaluateRun(runId: number): Promise<Evaluation>;
  reviewRun(runId: number, input: ReviewInput): Promise<Review>;
  resetDemo(): Promise<TaskDetail>;
}
```

- [ ] **Step 3: Implement `LiveRepository`**

Use the existing `api<T>()` helper, add `download(path, filename)`, and normalize backend errors into:

```ts
export class ProductError extends Error {
  constructor(
    message: string,
    readonly action: string,
    readonly status?: number,
  ) { super(message); }
}
```

- [ ] **Step 4: Implement `DemoRepository`**

Keep mutable demo state in memory and `localStorage`. Simulate 300-700ms latency, support all repository methods, and label every generated run and evaluation `mode: "demo"`. `resetDemo()` restores the typed seed snapshot.

- [ ] **Step 5: Add app state and toast feedback**

`ContentProofProvider` owns mode, repository, selected task/run, loading action, error, and toasts. Actions must expose specific pending labels such as `正在运行事实提取`.

- [ ] **Step 6: Run frontend tests**

Run:

```powershell
cd frontend
npm test
```

Expected: mode-selection and existing rendering tests pass.

- [ ] **Step 7: Commit**

```powershell
git add frontend/src
git commit -m "feat: add demo and live frontend repositories"
```

---

### Task 6: Build Six Functional Product Pages

**Files:**
- Rewrite: `frontend/src/App.tsx`
- Create: `frontend/src/components/AppShell.tsx`
- Rewrite: `frontend/src/components/Sidebar.tsx`
- Create: `frontend/src/pages/DashboardPage.tsx`
- Create: `frontend/src/pages/SourcesPage.tsx`
- Create: `frontend/src/pages/WorkflowPage.tsx`
- Create: `frontend/src/pages/ExperimentsPage.tsx`
- Create: `frontend/src/pages/EvaluationsPage.tsx`
- Create: `frontend/src/pages/ReviewPage.tsx`
- Rewrite: `frontend/src/styles.css`
- Create: `frontend/src/test/fixtures.ts`
- Create: `frontend/src/pages/ProductPages.test.tsx`

**Interfaces:**
- Consumes: `useContentProof()` and `ContentProofRepository`
- Produces: complete create-run-evaluate-review-export user flow

- [ ] **Step 1: Write interaction tests before page implementation**

Cover:

```tsx
await user.click(screen.getByRole("button", { name: "新建内容实验" }));
await user.type(screen.getByLabelText("内容主题"), "社区反诈活动");
await user.click(screen.getByRole("button", { name: "保存任务" }));
expect(await screen.findByText("任务已保存")).toBeInTheDocument();
```

Also test source creation, run execution, step retry, experiment filtering, review submission, report download, disabled reasons, empty states, and error recovery.

- [ ] **Step 2: Implement the first-run gate and app shell**

The gate explains both modes in plain Chinese. The shell uses six navigation items and displays the current mode, connection status and selected model. Use semantic buttons and headings; do not use clickable `div` elements.

- [ ] **Step 3: Implement dashboard and source library**

Dashboard cards are derived from repository data. Sources page provides a real form, status filters, source links, fact-card editing, and rights notices. Empty state action opens the source form.

- [ ] **Step 4: Implement workflow page**

The page creates a run, starts execution, polls every second while status is `queued` or `running`, renders input/output/error/timing per step, and enables retry only on failed steps.

- [ ] **Step 5: Implement experiments and evaluations**

Experiments page renders one row/card per evaluation case, prompt columns, score delta, rule status and human decision. Evaluations page shows reasons and evidence for each dimension rather than a static score sidebar.

- [ ] **Step 6: Implement human review and exports**

Review page supports accepted/modified/rejected, reason tags, notes, and final-text editing. Download actions use real Blob downloads in live mode and generated files in demo mode.

- [ ] **Step 7: Apply the revised visual system**

Keep the existing navy/cyan evidence-desk identity, but remove the permanent quality sidebar. Use:

- ink `#162541`
- cyan `#238B9D`
- paper `#F5F8FB`
- border `#C7D2DE`
- success `#18775E`
- danger `#A34336`

The signature element is a source-to-decision evidence rail shown on task detail and report screens. At 390px, navigation becomes a bottom bar and experiment tables become stacked cards.

- [ ] **Step 8: Run tests and production build**

Run:

```powershell
cd frontend
npm test
npm run build
```

Expected: all interaction tests pass and Vite builds without TypeScript errors.

- [ ] **Step 9: Commit**

```powershell
git add frontend
git commit -m "feat: build functional content quality laboratory"
```

---

### Task 7: Add Browser-Level Demo Flow Verification

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/playwright.config.ts`
- Create: `frontend/e2e/demo-flow.spec.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: built frontend and `DemoRepository`
- Produces: verified public-demo workflow in Chromium

- [ ] **Step 1: Add Playwright dependency and script**

Add:

```json
"scripts": {
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

and `@playwright/test` to dev dependencies.

- [ ] **Step 2: Write the end-to-end scenario**

```ts
test("visitor completes the demo evidence workflow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "立即体验示例" }).click();
  await page.getByRole("link", { name: "内容工作流" }).click();
  await page.getByRole("button", { name: "运行示例工作流" }).click();
  await expect(page.getByText("四个步骤已完成")).toBeVisible();
  await page.getByRole("link", { name: "人工审核" }).click();
  await page.getByRole("button", { name: "接受终稿" }).click();
  await expect(page.getByText("审核决定已保存")).toBeVisible();
});
```

- [ ] **Step 3: Run desktop and mobile projects**

Configure Chromium at `1440x1000` and mobile Chromium at `390x844`.

Run:

```powershell
cd frontend
npx playwright install chromium
npm run test:e2e
```

Expected: both projects pass with no horizontal-overflow assertion failures.

- [ ] **Step 4: Commit**

```powershell
git add frontend .gitignore
git commit -m "test: cover complete public demo flow"
```

---

### Task 8: Publish the Static Demo and Rewrite Open-Source Handoff

**Files:**
- Modify: `README.md`
- Create: `docs/user-guide.md`
- Create: `docs/deployment.md`
- Create: `CONTRIBUTING.md`
- Create: `.env.example`
- Modify: `docs/architecture.md`
- Modify: `docs/demo-script.md`

**Interfaces:**
- Consumes: production frontend build and verified demo flow
- Produces: public demo URL, 30-second local start, contribution path

- [ ] **Step 1: Add environment example**

```dotenv
VITE_API_BASE=http://127.0.0.1:8000/api
CONTENTPROOF_DATABASE_URL=sqlite:///./contentproof.db
CONTENTPROOF_OLLAMA_BASE_URL=http://127.0.0.1:11434
CONTENTPROOF_OLLAMA_MODEL=qwen2:1.5b
```

- [ ] **Step 2: Rewrite README as a product landing page**

The first screen must include:

- one-sentence value proposition;
- public demo link;
- `npm install && npm run dev` demo command;
- local Ollama command;
- complete product screenshot or GIF;
- six-feature matrix;
- demo/live mode comparison;
- architecture diagram;
- privacy and rights explanation;
- roadmap and contribution link.

- [ ] **Step 3: Add user and deployment guides**

`docs/user-guide.md` documents one demo flow and one live flow. `docs/deployment.md` documents static demo deployment and local backend configuration without secrets.

- [ ] **Step 4: Deploy static demo**

Build `frontend/dist`, configure the production site to serve the SPA, and deploy the exact tested commit. The production URL must open directly in demo mode or present the two-mode gate without a broken backend request.

- [ ] **Step 5: Run final verification**

Run:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests -q
cd frontend
npm test
npm run build
npm run test:e2e
cd ..
git diff --check
git status --short
```

Expected: all suites pass, build succeeds, no whitespace errors, and only intended documentation/deployment files remain.

- [ ] **Step 6: Capture and inspect final screenshots**

Capture desktop and 390px mobile full-page screenshots from the deployed build. Confirm no clipped controls, fake values, horizontal scrolling, missing labels, or dead buttons.

- [ ] **Step 7: Commit and push**

```powershell
git add README.md docs CONTRIBUTING.md .env.example
git commit -m "docs: publish ContentProof product handoff"
git push origin master
```
