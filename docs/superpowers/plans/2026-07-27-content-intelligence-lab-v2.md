# Content Intelligence Lab V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first editorial research application that imports public article comments, cleans them, discovers semantic themes, lets a human correct the themes, and produces evidence-linked content briefs.

**Architecture:** Keep React/Vite and FastAPI, replace the prototype domain with a versioned research domain, and persist every long-running step in SQLite. Use optional adapters for webpage extraction and Ollama, while retaining manual/file import and deterministic fallbacks so the main workflow remains demonstrable without cloud credentials.

**Tech Stack:** React 18, TypeScript, Vite, React Router, TanStack Query/Table, Radix UI primitives, dnd-kit, Motion, FastAPI, SQLAlchemy 2, Alembic, SQLite, Pydantic 2, sentence-transformers, scikit-learn, HDBSCAN, Ollama, pandas/openpyxl, python-docx, pytest, Vitest, Playwright.

## Global Constraints

- Do not upload or push changes to GitHub.
- Preserve the existing Git history and keep the old database as a backup.
- The complete workflow must run locally on Windows with 16 GB RAM and integrated graphics.
- Default LLM must use an already installed Ollama model; larger models remain optional.
- Raw imported text must never be overwritten by cleaned text.
- Every generated insight and brief claim must retain evidence comment IDs.
- AI-generated themes begin as `pending_review`; only `confirmed` themes may enter a brief.
- No decorative scores, fabricated user outcomes, or claims that inaccessible comments were scraped.
- Every primary action must expose loading, success, empty, disabled, and failure states.
- Desktop and mobile critical paths must pass Playwright tests.

---

## Delivery slices

1. Foundation and imports
2. Semantic analysis
3. Human review
4. Brief generation and export
5. Visual system, end-to-end validation, and project handoff

### Task 1: Replace the prototype domain with the V2 research schema

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/0001_content_intelligence_v2.py`
- Create: `backend/app/domain/enums.py`
- Create: `backend/app/domain/models.py`
- Modify: `backend/app/db.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_v2_schema.py`

**Interfaces:**
- Produces: SQLAlchemy models `Project`, `Source`, `Comment`, `ImportRun`, `AnalysisRun`, `CommentEmbedding`, `Theme`, `ThemeComment`, `ReviewEvent`, `Brief`, `BriefEvidence`.
- Produces: enums `ProjectStage`, `RunStatus`, `CommentStatus`, `ThemeStatus`.

- [ ] Write schema tests proving raw/clean text coexist, analysis runs are versioned, and evidence foreign keys reject nonexistent comments.
- [ ] Run `py -3.12 -m pytest backend/tests/test_v2_schema.py -q` and verify failure because V2 models do not exist.
- [ ] Add the V2 models and initial Alembic migration with indexes on project, run, status, content hash, and evidence joins.
- [ ] Replace `ensure_prototype_columns()` with Alembic startup guidance; retain the old SQLite file under a timestamped backup name.
- [ ] Run the schema test and full backend suite; expect all tests to pass.
- [ ] Commit only schema, migration, and schema tests.

### Task 2: Implement project management and three import paths

**Files:**
- Create: `backend/app/projects/schemas.py`
- Create: `backend/app/projects/repository.py`
- Create: `backend/app/projects/service.py`
- Create: `backend/app/projects/router.py`
- Create: `backend/app/imports/contracts.py`
- Create: `backend/app/imports/manual.py`
- Create: `backend/app/imports/spreadsheet.py`
- Create: `backend/app/imports/web.py`
- Create: `backend/app/imports/service.py`
- Create: `backend/app/imports/router.py`
- Modify: `backend/app/config.py`
- Modify: `backend/app/main.py`
- Modify: `backend/pyproject.toml`
- Test: `backend/tests/test_projects_api.py`
- Test: `backend/tests/test_imports_api.py`

**Interfaces:**
- Consumes: V2 models from Task 1.
- Produces: `POST/GET/PATCH/DELETE /api/v2/projects`.
- Produces: `POST /api/v2/projects/{id}/imports/manual`, `/spreadsheet`, and `/web`.
- Produces: `FetchResult(article, comments, article_status, comments_status, warnings)`.

- [ ] Write API tests for creating/listing projects, manual import, CSV/XLSX column mapping, web partial success, unsupported files, and duplicate imports.
- [ ] Run the focused tests and verify expected 404/import failures.
- [ ] Implement multipart uploads under 10 MB, explicit column mapping, and content hashes scoped to each project.
- [ ] Implement a no-key webpage adapter using `trafilatura`; implement an optional Firecrawl HTTP adapter selected only when `FIRECRAWL_API_KEY` is configured.
- [ ] Persist article and comment outcomes separately so article success cannot imply comment success.
- [ ] Run focused and full backend tests; expect all tests to pass.
- [ ] Commit project and import behavior.

### Task 3: Build reversible data cleaning

**Files:**
- Create: `backend/app/cleaning/rules.py`
- Create: `backend/app/cleaning/service.py`
- Create: `backend/app/comments/schemas.py`
- Create: `backend/app/comments/router.py`
- Test: `backend/tests/test_cleaning.py`
- Test: `backend/tests/test_comments_api.py`

**Interfaces:**
- Consumes: imported `Comment` rows.
- Produces: `CleaningDecision(cleaned_text, status, reasons, pii_flags)`.
- Produces: comment list/filter, bulk exclude, and restore endpoints.

- [ ] Write failing tests for duplicate detection, phone/email masking, emoji-only comments, short but meaningful questions, advertising patterns, exclusion, and restoration.
- [ ] Run tests and verify failures because cleaning modules do not exist.
- [ ] Implement pure cleaning functions first, then persist decisions without modifying `raw_text`.
- [ ] Add paginated/filterable comment APIs and reversible bulk actions.
- [ ] Run focused and full backend tests.
- [ ] Commit cleaning and comment review behavior.

### Task 4: Implement persistent, restart-safe analysis runs

**Files:**
- Create: `backend/app/analysis/contracts.py`
- Create: `backend/app/analysis/embeddings.py`
- Create: `backend/app/analysis/clustering.py`
- Create: `backend/app/analysis/labeling.py`
- Create: `backend/app/analysis/service.py`
- Create: `backend/app/analysis/worker.py`
- Create: `backend/app/analysis/router.py`
- Modify: `backend/app/config.py`
- Modify: `backend/app/main.py`
- Modify: `backend/pyproject.toml`
- Test: `backend/tests/test_embeddings.py`
- Test: `backend/tests/test_clustering.py`
- Test: `backend/tests/test_analysis_runs.py`

**Interfaces:**
- Consumes: included comments from Task 3.
- Produces: `EmbeddingProvider.embed(texts) -> list[list[float]]`.
- Produces: `Clusterer.cluster(vectors) -> list[int]`, where `-1` means unclassified.
- Produces: analysis endpoints to start, inspect, retry, and cancel runs.

- [ ] Write failing tests for embedding cache reuse, normalized vectors, semantically related fixtures, unclassified comments, insufficient data, step persistence, and retrying only a failed step.
- [ ] Run focused tests and verify expected failures.
- [ ] Implement `BAAI/bge-small-zh-v1.5` with lazy local loading and a deterministic test provider.
- [ ] Implement agglomerative clustering for small datasets and HDBSCAN for larger datasets; preserve `-1` as unclassified.
- [ ] Implement Ollama structured theme labeling with evidence ID validation and installed-model discovery; default to `qwen2:1.5b` on this machine.
- [ ] Implement a separate local worker process command and persisted step states; interrupted `running` jobs become retryable on startup.
- [ ] Run focused tests, benchmark fixtures, and the full backend suite.
- [ ] Commit the semantic analysis pipeline.

### Task 5: Implement human review operations and audit history

**Files:**
- Create: `backend/app/review/schemas.py`
- Create: `backend/app/review/service.py`
- Create: `backend/app/review/router.py`
- Test: `backend/tests/test_theme_review.py`

**Interfaces:**
- Consumes: candidate themes and memberships from Task 4.
- Produces: rename, merge, split, move-comment, reject, confirm endpoints.
- Produces: immutable `ReviewEvent` records with before/after JSON.

- [ ] Write failing tests for every review operation, invalid cross-project evidence, preserving source analysis, and audit history.
- [ ] Run tests and verify the review endpoints are absent.
- [ ] Implement transactions so each review operation either fully succeeds or makes no change.
- [ ] Enforce that rejected or pending themes cannot be used in a brief.
- [ ] Run focused and full backend tests.
- [ ] Commit review operations.

### Task 6: Implement evidence-linked briefs and real exports

**Files:**
- Create: `backend/app/briefs/schemas.py`
- Create: `backend/app/briefs/prompts.py`
- Create: `backend/app/briefs/service.py`
- Create: `backend/app/briefs/exporters.py`
- Create: `backend/app/briefs/router.py`
- Test: `backend/tests/test_briefs.py`
- Test: `backend/tests/test_exports.py`

**Interfaces:**
- Consumes: confirmed themes only.
- Produces: versioned brief JSON with claim-level theme/comment evidence.
- Produces: Markdown and DOCX byte streams.

- [ ] Write failing tests for confirmed-theme enforcement, nonexistent evidence rejection, version creation, section-only regeneration, Markdown contents, and DOCX opening successfully.
- [ ] Run focused tests and verify failures.
- [ ] Implement structured Ollama generation and deterministic fallback templates that are explicitly labeled as fallback.
- [ ] Validate every generated evidence ID before persistence.
- [ ] Implement editable versions and real Markdown/DOCX downloads.
- [ ] Run focused and full backend tests.
- [ ] Commit brief and export behavior.

### Task 7: Establish the frontend application shell and design system

**Files:**
- Create: `frontend/src/app/router.tsx`
- Create: `frontend/src/app/query-client.ts`
- Create: `frontend/src/app/AppShell.tsx`
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/base.css`
- Create: `frontend/src/styles/components.css`
- Create: `frontend/src/components/ui/*`
- Create: `frontend/src/components/feedback/*`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/package.json`
- Delete after replacement: `frontend/src/styles.css`
- Test: `frontend/src/app/AppShell.test.tsx`

**Interfaces:**
- Produces: route shell for projects, imports, cleaning, analysis, review, and brief.
- Produces: accessible Dialog, Drawer, Tooltip, Toast, Button, Field, EmptyState, ErrorState, Skeleton.

- [ ] Write failing tests for keyboard navigation, route titles, mobile drawer, focus return, loading, error, and reduced-motion behavior.
- [ ] Run Vitest and verify the new shell does not exist.
- [ ] Add React Router, TanStack Query/Table, Radix primitives, dnd-kit, Motion, Lucide, react-dropzone, and `clsx`.
- [ ] Implement the “editorial evidence desk” design tokens: warm paper, near-black ink, cobalt signal blue, vermilion warning, strong Chinese editorial typography, hairline grids, and restrained motion.
- [ ] Implement responsive shell and feedback primitives using Radix behavior with custom styling; avoid stock shadcn page templates.
- [ ] Run tests, production build, and accessibility smoke checks.
- [ ] Commit the application shell and design system.

### Task 8: Build project, import, and data-check experiences

**Files:**
- Create: `frontend/src/features/projects/*`
- Create: `frontend/src/features/imports/*`
- Create: `frontend/src/features/comments/*`
- Create: `frontend/src/lib/api-client.ts`
- Create: `frontend/src/lib/generated-types.ts`
- Test: `frontend/src/features/projects/projects.test.tsx`
- Test: `frontend/src/features/imports/imports.test.tsx`
- Test: `frontend/src/features/comments/comments.test.tsx`

**Interfaces:**
- Consumes: Task 2 and Task 3 APIs.
- Produces: project cards, three-mode import studio, extraction receipt, TanStack comment table, reversible exclusion tray.

- [ ] Write failing interaction tests for project creation, partial web extraction, file mapping, duplicate reporting, filtering, exclusion, restoration, empty states, and API failures.
- [ ] Run tests and verify the pages are absent.
- [ ] Implement OpenAPI-aligned API types and TanStack Query mutations with visible progress and retries only for server failures.
- [ ] Build the import page around a clear “source receipt” rather than a generic upload card.
- [ ] Build a dense but readable comment table with keyboard selection, filters, pinned status column, and reversible exclusion tray.
- [ ] Run Vitest, build, and targeted Playwright flows.
- [ ] Commit foundation pages.

### Task 9: Build analysis, review, and brief workspaces

**Files:**
- Create: `frontend/src/features/analysis/*`
- Create: `frontend/src/features/review/*`
- Create: `frontend/src/features/briefs/*`
- Test: `frontend/src/features/analysis/analysis.test.tsx`
- Test: `frontend/src/features/review/review.test.tsx`
- Test: `frontend/src/features/briefs/briefs.test.tsx`

**Interfaces:**
- Consumes: Task 4, Task 5, and Task 6 APIs.
- Produces: persisted analysis timeline, evidence/theme triage board, accessible drag/move controls, audit trail, evidence-linked brief editor, real downloads.

- [ ] Write failing tests for persisted progress, failed-step retry, unclassified comments, rename/merge/split/move/reject/confirm, evidence navigation, regeneration, and downloads.
- [ ] Run tests and verify the workspaces are absent.
- [ ] Implement 2-second status polling that stops in terminal states; do not add WebSockets.
- [ ] Implement dnd-kit pointer and keyboard movement plus explicit menu alternatives so drag is never the only control.
- [ ] Implement a three-pane review desk on desktop and staged drill-down on mobile.
- [ ] Implement the brief editor with evidence gutters, version history, unsaved-change protection, and export feedback.
- [ ] Run Vitest, production build, and desktop/mobile Playwright flows.
- [ ] Commit analysis, review, and brief workspaces.

### Task 10: Create the real case, evaluation, and visual acceptance pack

**Files:**
- Create: `data/examples/editorial-comments/*`
- Create: `data/evaluation/clustering-gold.jsonl`
- Create: `scripts/evaluate_clustering.py`
- Create: `docs/design-references.md`
- Create: `docs/architecture-v2.md`
- Create: `docs/user-guide.md`
- Create: `docs/assets/v2/*`
- Modify: `README.md`
- Modify: `frontend/e2e/demo-flow.spec.ts`
- Test: `backend/tests/test_evaluation_v2.py`

**Interfaces:**
- Produces: a clearly labeled synthetic/public demonstration dataset, reproducible clustering report, design-source ledger, architecture docs, and final screenshots.

- [ ] Write failing evaluation tests that require deterministic fixtures and published failure examples.
- [ ] Create a public/synthetic editorial-comment dataset without fabricated performance claims.
- [ ] Implement clustering metrics and publish precision/recall-style grouping measures plus failures and hardware/runtime notes.
- [ ] Record visual references from Awwwards and implementation references from Radix, TanStack Table, dnd-kit, Motion, and react-dropzone, including exactly what was and was not borrowed.
- [ ] Run the complete product and capture 1440 px desktop plus 390 px mobile screenshots of real states.
- [ ] Inspect the actual screenshots for hierarchy, clipping, overflow, fake data, unusable controls, and inconsistent spacing; fix defects with regression tests.
- [ ] Run backend tests, frontend tests, Playwright desktop/mobile, build, audit, migration-from-empty, and local-model smoke tests.
- [ ] Commit the verified local release without pushing it.

## Final verification

Run from the repository root:

```powershell
py -3.12 -m pytest -q
py -3.12 scripts/evaluate_clustering.py
```

Run from `frontend`:

```powershell
npm test -- --run
npm run build
npm run test:e2e
npm audit --audit-level=moderate
```

Acceptance requires:

- All commands exit 0.
- A fresh database migrates successfully.
- The complete example flow works after browser refresh.
- All visible controls have real behavior or an honest disabled reason.
- Desktop and mobile screenshots pass visual inspection.
- No GitHub push or deployment occurs.
