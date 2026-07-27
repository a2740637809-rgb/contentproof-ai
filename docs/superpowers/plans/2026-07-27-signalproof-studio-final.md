# SignalProof Studio Final Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a credible, local-first AI content insight product that turns traceable source material into reviewable audience signals and an editable content brief.

**Architecture:** React/Vite provides a project-based evidence workspace backed by FastAPI, SQLAlchemy and SQLite. The analysis layer exposes a deterministic rules baseline and optional Ollama enhancement behind one typed API; every generated claim retains source evidence and every human decision is persisted.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Playwright, FastAPI, SQLAlchemy, SQLite, Ollama, pytest.

## Global Constraints

- Keep SignalProof Studio focused on one job: evidence-to-brief.
- No hard-coded product scores or untraceable outcome claims.
- The product must remain useful without Ollama through deterministic fallback.
- Every feature change follows red-green-refactor and gets an independently testable commit.
- Resume files are out of scope.
- Public examples use only permitted excerpts, metadata and source links.

---

### Task 1: Baseline and repository identity

**Files:**
- Modify: `backend/pyproject.toml`
- Modify: `frontend/package.json`
- Delete: `frontend/pnpm-lock.yaml`
- Modify: `README.md`
- Modify: `.env.example`
- Create: `LICENSE`
- Create: `CONTRIBUTING.md`
- Create: `CHANGELOG.md`

**Interfaces:**
- Produces: one SignalProof name, npm package workflow, documented runtime requirements.

- [ ] Install declared Python 3.12 development dependencies.
- [ ] Run the existing backend and frontend suites and record the baseline.
- [ ] Add repository-contract tests that reject legacy product names and fake metrics in public surfaces.
- [ ] Rename package metadata and documentation to SignalProof Studio.
- [ ] Remove the duplicate pnpm lock and unused frontend modules after import checks.
- [ ] Run backend tests, frontend tests and production build.
- [ ] Commit the verified repository identity cleanup.

### Task 2: Typed end-to-end workspace API

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/schemas.py`
- Split: `backend/app/api/tasks.py`
- Create: `backend/app/api/projects.py`
- Create: `backend/app/api/sources.py`
- Create: `backend/app/services/project_service.py`
- Create: `backend/app/services/source_service.py`
- Modify: `frontend/src/api.ts`
- Create: `frontend/src/features/projects/*`
- Test: `backend/tests/test_projects.py`
- Test: `backend/tests/test_sources.py`
- Test: `frontend/src/features/projects/projects.test.tsx`

**Interfaces:**
- Produces: `Project`, `SourceDocument`, typed CRUD endpoints and client functions.

- [ ] Write failing API tests for project creation, source import, validation and persistence.
- [ ] Implement the minimum models, schemas and services required by those tests.
- [ ] Write failing frontend tests for creating a project and importing text/CSV/JSON/Markdown.
- [ ] Implement typed client calls and project workspace UI.
- [ ] Add invalid-file, empty-source and duplicate-submit tests.
- [ ] Run focused tests, then full suites and build.
- [ ] Commit the verified workspace slice.

### Task 3: Resumable analysis pipeline

**Files:**
- Modify: `backend/app/services/workflow.py`
- Create: `backend/app/services/pipeline.py`
- Create: `backend/app/services/run_service.py`
- Create: `backend/app/api/runs.py`
- Create: `frontend/src/features/runs/*`
- Test: `backend/tests/test_pipeline.py`
- Test: `backend/tests/test_runs.py`
- Test: `frontend/src/features/runs/runs.test.tsx`

**Interfaces:**
- Produces: `AnalysisRun`, `RunStep`, retry/resume endpoints and observable progress states.

- [ ] Write failing tests for eight ordered steps, failure persistence, retry and resume.
- [ ] Implement the pipeline with idempotent step transitions.
- [ ] Write failing UI tests for progress, failure reason, retry and completed states.
- [ ] Connect the UI to real run endpoints with polling cancellation.
- [ ] Verify an interrupted run resumes without repeating completed steps.
- [ ] Run full suites and commit.

### Task 4: Explainable signal engine

**Files:**
- Refactor: `backend/app/services/signals.py`
- Create: `backend/app/services/analyzers/base.py`
- Create: `backend/app/services/analyzers/rules.py`
- Create: `backend/app/services/analyzers/semantic.py`
- Create: `backend/app/services/analyzers/ollama.py`
- Create: `backend/app/services/evidence.py`
- Create: `frontend/src/features/signals/*`
- Test: `backend/tests/test_analyzers.py`
- Test: `frontend/src/features/signals/signals.test.tsx`

**Interfaces:**
- Produces: `Signal`, `EvidenceLink`, `AnalyzerMode`, confidence and explanation fields.

- [ ] Write failing contract tests shared by all analyzer modes.
- [ ] Implement deterministic rule baseline with traceable evidence.
- [ ] Implement optional semantic and Ollama adapters with structured output validation.
- [ ] Implement explicit fallback when enhanced modes are unavailable.
- [ ] Write UI tests for evidence drawers, confidence explanations and source navigation.
- [ ] Run full suites and commit.

### Task 5: Human review and brief editor

**Files:**
- Create: `backend/app/services/review_service.py`
- Create: `backend/app/services/brief_service.py`
- Create: `backend/app/api/reviews.py`
- Create: `backend/app/api/briefs.py`
- Create: `frontend/src/features/review/*`
- Create: `frontend/src/features/briefs/*`
- Test: `backend/tests/test_reviews.py`
- Test: `backend/tests/test_briefs.py`
- Test: `frontend/src/features/briefs/briefs.test.tsx`

**Interfaces:**
- Produces: persisted rename, merge, split, reject and priority decisions; evidence-linked editable brief.

- [ ] Write failing tests for every review decision and audit entry.
- [ ] Implement review persistence and recomputation rules.
- [ ] Write failing tests for brief generation using only accepted signals.
- [ ] Implement editable brief sections with evidence citations and autosave.
- [ ] Add before/after diff and export tests.
- [ ] Run full suites and commit.

### Task 6: Evaluation and benchmark

**Files:**
- Create: `data/evaluation/signalproof-v1.jsonl`
- Create: `data/evaluation/README.md`
- Create: `backend/app/evaluation/metrics.py`
- Create: `backend/app/evaluation/runner.py`
- Create: `scripts/run_benchmark.py`
- Create: `docs/evaluation.md`
- Test: `backend/tests/test_evaluation.py`

**Interfaces:**
- Produces: 50+ stratified cases and per-mode quality, traceability, latency and edit metrics.

- [ ] Define deterministic schema and multidimensional pass gates.
- [ ] Add at least 50 licensed/synthetic labeled cases across four difficulty levels.
- [ ] Write failing metric tests for exact match, evidence coverage and edit distance.
- [ ] Implement the benchmark runner and machine-readable report.
- [ ] Run rules baseline; run optional enhanced modes only when available.
- [ ] Document limitations and at least three failures without fabricated comparisons.
- [ ] Commit dataset, evaluator and verified baseline report.

### Task 7: Product information architecture and visual system

**Files:**
- Refactor: `frontend/src/App.tsx`
- Create: `frontend/src/app/*`
- Create: `frontend/src/components/*`
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/global.css`
- Create: `frontend/src/features/demo/*`
- Test: `frontend/src/App.test.tsx`
- Test: `frontend/e2e/core-flow.spec.ts`

**Interfaces:**
- Produces: project center, source desk, signal map, brief editor, run/evaluation view and guided case.

- [ ] Establish the “editorial investigation desk” token system and evidence-flow signature interaction.
- [ ] Write failing navigation and core-flow UI tests.
- [ ] Build responsive shells, semantic focus order, empty/loading/error states and reduced motion behavior.
- [ ] Implement source-to-signal visual tracing, review interactions and brief diff.
- [ ] Review screenshots at desktop, laptop and mobile widths; fix visual hierarchy defects.
- [ ] Run unit, E2E, accessibility-oriented checks and build.
- [ ] Commit the verified interface.

### Task 8: Case study, open-source presentation and release

**Files:**
- Create: `data/examples/changde-media-case/*`
- Create: `docs/case-study.md`
- Rewrite: `README.md`
- Create: `docs/assets/*`
- Modify: `.github/workflows/*`
- Create: `.github/ISSUE_TEMPLATE/*`
- Modify: `docs/deployment.md`

**Interfaces:**
- Produces: reproducible public case, architecture diagram, screenshots/GIF, one-command setup and release artifacts.

- [ ] Build one permission-safe end-to-end case with source metadata and failure decisions.
- [ ] Capture polished real-state screenshots and a 15–30 second core-flow recording.
- [ ] Rewrite README around problem, evidence, workflow, benchmark, architecture, setup and limitations.
- [ ] Add CI gates for backend tests, frontend tests and build.
- [ ] Verify fresh install, no-model fallback and Ollama-enhanced path when available.
- [ ] Deploy the verified saved build and inspect production status.
- [ ] Re-score the project from product, AI, content and full-stack interviewer perspectives.
- [ ] Commit and create release notes only after every required gate passes.

