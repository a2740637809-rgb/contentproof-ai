# ContentProof AI

> 让 AI 内容的每个结论都有来源、评测与人工决定。

ContentProof AI 是面向内容团队的本地优先质量实验室。它解决的不是“再生成一篇文章”，而是 AI 内容进入真实生产后最难回答的问题：**事实从哪里来、提示词是否真的变好、模型为什么给这个分、最终由谁承担发布决定。**

[在线体验](https://a2740637809-rgb.github.io/contentproof-ai/) · [使用指南](docs/user-guide.md) · [系统设计](docs/architecture.md)

## 30 秒体验

```bash
cd frontend
npm install
npm run dev
```

打开页面后选择“立即体验示例”，无需模型或密钥即可走通来源、工作流、实验、评测与终审。

## 产品闭环

| 用户痛点 | ContentProof 的解决方式 |
|---|---|
| AI 成稿无法证明事实依据 | 来源卡片、事实状态与原始链接 |
| Prompt 修改依赖主观感觉 | 固定数据集上的版本对照与分数变化 |
| 运行失败后无法定位 | 四步轨迹、输入输出、耗时和单步重试 |
| 总分看似专业但不可解释 | 五维理由、文本证据和硬规则结果 |
| 模型替代了编辑责任 | accepted / modified / rejected 人工终审 |
| 项目演示依赖本机环境 | 浏览器演示模式 + Ollama 本地完整模式 |

## 两种运行模式

- **演示数据**：纯浏览器运行，不上传内容；适合招聘方快速体验。
- **本地模型**：FastAPI + SQLite + Ollama；提示词、运行轨迹和审核证据留在设备。

```bash
ollama serve
ollama pull qwen2:1.5b

cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\pip install -e ".[dev]"
.\.venv\Scripts\uvicorn app.main:app --reload
```

## 架构

```text
公开来源 → 事实卡 → Prompt 版本 → 持久化工作流
                                  ↓
人工终审 ← 证据导出 ← 硬规则 + 模型五维评测
```

- React + TypeScript + Vite：六个可操作产品页面和响应式交互
- FastAPI + SQLAlchemy + SQLite：任务、来源、提示词、运行、评测、审核
- Ollama：结构化本地生成与模型辅助评测
- Pytest + Vitest + Playwright：后端、组件、桌面/手机完整流程验证

## 隐私与版权

示例仅保存公开页面的元数据、原始链接、短摘要和原创标注，不复制文章全文或原图。演示模式不会请求访客本地 Ollama，也不会将用户内容发送到远程服务器。模型评分只提供建议，最终判断保留给人工审核。

## 项目边界

当前版本服务单机内容实验，不包含账号体系、多人协作、自动发布和通用拖拽编排器。明确边界让项目能围绕“内容可信度与质量闭环”持续迭代。

## 验证

```bash
cd backend
python -m pytest tests -q

cd ../frontend
npm test
npm run build
npm run test:e2e
```

## Roadmap

- 评测数据集导入与批量回归
- 更多本地模型提供方
- 评测失败样本聚类
- 可分享的脱敏证据报告

欢迎通过 Issue 提交真实内容质量场景与失败案例。
