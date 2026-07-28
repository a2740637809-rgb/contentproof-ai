# Content Intelligence Lab V4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补全项目生命周期、完整示例、真实轨迹、方案对比和多模型配置，同时压缩全站无效留白。

**Architecture:** 继续使用 FastAPI、SQLAlchemy、SQLite、React 和 React Query。项目管理、模型配置和示例初始化都通过 `/api/v2` REST 接口；前端以现有工作区导航为基础增加回收站与模型中心，不引入通用聊天框架。

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy, Pydantic, React, TypeScript, React Query, Vitest, Playwright.

## Global Constraints

- 默认本地运行。
- API Key 不进入浏览器持久化存储或 API 响应。
- 所有新增行为先写失败测试。
- 不上传 GitHub。
- 不显示虚构准确率、耗时、Token 或成本。

---

### Task 1: 项目生命周期

**Files:**
- Modify: `backend/app/v2_models.py`
- Modify: `backend/app/v2_api.py`
- Modify: `backend/tests/test_v2_research_api.py`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Produces: `PATCH /api/v2/projects/{id}`, `POST /archive`, `POST /restore`, `DELETE /projects/{id}`.

- [ ] 写项目重命名、归档、恢复和级联删除的失败测试。
- [ ] 运行 `py -3.12 -m pytest backend/tests/test_v2_research_api.py -q`，确认接口因不存在而失败。
- [ ] 增加生命周期字段与项目管理接口。
- [ ] 增加项目卡操作菜单、归档筛选和删除确认。
- [ ] 运行后端与 `npm test -- --run src/App.test.tsx`，确认通过。

### Task 2: 幂等完整示例

**Files:**
- Modify: `backend/app/v2_api.py`
- Modify: `backend/tests/test_v2_research_api.py`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Produces: `POST /api/v2/demo/bootstrap`，返回 `{project_id, created}`。

- [ ] 写连续调用两次只产生一个完整示例的失败测试。
- [ ] 实现示例项目、8 条评论、分析、主题确认和 Brief 初始化。
- [ ] 在首页和空状态加入“加载完整示例”。
- [ ] 验证轨迹与方案对比能够立即显示。

### Task 3: 可操作运行轨迹与方案对比

**Files:**
- Modify: `backend/app/v2_api.py`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: `POST /projects/{id}/analysis`, `GET /analysis-runs`, `GET /benchmark`.

- [ ] 写空状态触发分析与示例加载的前端失败测试。
- [ ] 将轨迹空状态改为含操作按钮的紧凑面板。
- [ ] 将方案对比空状态改为含分析入口的紧凑面板。
- [ ] 增加运行后查询失效与自动跳转。
- [ ] 验证真实数据渲染，不添加写死成绩。

### Task 4: 模型中心

**Files:**
- Modify: `backend/app/v2_models.py`
- Modify: `backend/app/v2_api.py`
- Modify: `backend/tests/test_v2_research_api.py`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Produces: `GET/POST/PATCH /api/v2/model-profiles`, `POST /api/v2/model-profiles/{id}/test`.

- [ ] 写模型配置 CRUD、密钥不回传和连接测试的失败测试。
- [ ] 新增 `ModelProfile`，保存 provider、base_url、model、embedding_model、secret_env、enabled。
- [ ] 实现 Ollama 与 OpenAI-compatible 的模型列表探测。
- [ ] 增加模型中心页面、连接状态和环境变量说明。
- [ ] 运行前后端测试。

### Task 5: 密度与空状态重构

**Files:**
- Modify: `frontend/src/styles.css`
- Modify: `frontend/e2e/visual-v3.mjs`

**Interfaces:**
- Produces: desktop/laptop/mobile screenshots and overflow assertions.

- [ ] 把首页常规板块间距收敛到 56–76px。
- [ ] 把技术路径压缩为紧凑流程条。
- [ ] 限制空状态高度并增加上下文动作。
- [ ] 优化项目卡密度、菜单触控尺寸和移动端布局。
- [ ] 运行视觉脚本并逐张检查截图。

### Task 6: 全量验收

**Files:**
- Verify only.

- [ ] 运行 `py -3.12 -m pytest -q`。
- [ ] 运行 `npm test -- --run`。
- [ ] 运行 `npm run build`。
- [ ] 运行 `node e2e/visual-v3.mjs`。
- [ ] 运行 `git diff --check` 并确认未上传 GitHub。
