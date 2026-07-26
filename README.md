# SignalProof Studio

> 把零散的用户声音，变成有原话证据、可评测、可复现的内容决策。

[在线体验](https://a2740637809-rgb.github.io/contentproof-ai/) · [产品设计](docs/superpowers/specs/2026-07-27-signalproof-flagship-design.md) · [系统架构](docs/architecture.md) · [研究依据](docs/benchmark-research.md)

![SignalProof Studio：信号河流](docs/assets/signalproof-desktop.png)

## 为什么做

AI 写作工具解决了“生成更快”，却没有解决内容团队更昂贵的问题：用户到底在抱怨什么？哪一个最值得优先解决？一条内容结论来自哪项证据？Prompt 改版是真的更好，还是看起来更顺眼？

SignalProof 把原先分散的 VoiceMap 反馈洞察与 ContentProof 内容评测合并为一个产品闭环：

```text
反馈/评论 → 隐私脱敏 → 可解释聚类 → 机会评分 → 内容简报
                                            ↓
人工决策 ← 对照评测 ← Prompt 实验 ← 事实来源
    └────────────────── 回流为下一轮信号
```

## 核心能力

- **信号分析**：按主题、频次、负面情绪与业务影响形成机会排序。
- **原话追溯**：每个聚类保留 `F002` 这类证据 ID，不把摘要冒充用户原话。
- **简报生成**：把最高机会转换成问题、受众、证据、假设与成功指标。
- **内容实验**：固定任务与事实集，对照 Prompt A/B 的准确性、来源覆盖率与平台适配。
- **人工终审**：模型只辅助评分，最终接受、修改或退回由人决定。
- **本地优先**：FastAPI + SQLite + Ollama；公开演示无需密钥。

## 90 秒体验

1. 打开[在线演示](https://a2740637809-rgb.github.io/contentproof-ai/)。
2. 在“信号河流”切换机会节点，查看对应原话证据。
3. 创建内容简报，进入内容实验。
4. 对比基线 Prompt 与证据约束 Prompt，完成人工决策闭环。

## 本地运行

```bash
cd frontend
npm install
npm run dev
```

后端与本地模型：

```bash
ollama serve
ollama pull qwen2.5:7b
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\pip install -e ".[dev]"
.\.venv\Scripts\uvicorn app.main:app --reload
```

`POST /api/signals/analyze` 接收多渠道反馈，返回脱敏证据、信号聚类、机会分与内容简报。

## 技术取舍

| 选择 | 原因 |
|---|---|
| React + TypeScript + SVG | 信号地图可交互、可访问、无需重型图形依赖 |
| FastAPI + Pydantic | 聚类与简报结构可验证，接口自动生成文档 |
| 确定性规则 + 可选 LLM | 演示可复现；模型不可用时核心链路仍工作 |
| SQLite + Ollama | 未发布素材与运行轨迹可留在设备 |
| Pytest + Vitest + Playwright | 覆盖服务、组件、桌面与手机完整路径 |

## 验证

```bash
cd backend && python -m pytest tests -q
cd ../frontend
npm test -- --run
npm run build
npm run test:e2e
```

当前边界：单机产品原型，不包含账号、计费、多人实时协作与自动发布。示例反馈为产品演示数据，不代表真实统计研究。

## Roadmap

- CSV/JSON 反馈导入与大样本虚拟化
- 聚类合并、拆分与人工命名
- 评测数据集版本管理与失败样本回归
- 脱敏证据包导出与分享

欢迎通过 Issue 提交真实的内容运营痛点、失败样本或产品建议。
