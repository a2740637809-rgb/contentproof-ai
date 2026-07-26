# SignalProof 对标研究与产品取舍

研究目的不是拼装热门功能，而是回答三个问题：为什么用户需要它、什么形成技术可信度、什么让开源项目值得传播。

| 项目 | 核心痛点 | 借鉴 | SignalProof 的内化 |
|---|---|---|---|
| [Dify](https://github.com/langgenius/dify) | AI 原型难以进入生产 | 工作流、RAG、模型接入、可观测性形成完整产品 | 用“信号→简报→实验→决策”表达端到端闭环 |
| [RAGFlow](https://github.com/infiniflow/ragflow) | 低质量输入导致不可信答案 | 深度文档理解、引用溯源、可视化证据 | 每个聚类和结论保留原话证据 ID |
| [Langfuse](https://github.com/langfuse/langfuse) | LLM 运行不可观测、不可复现 | tracing、prompt、dataset、evaluation 统一管理 | 记录数据集、模型、温度与评测规则 |
| [Promptfoo](https://github.com/promptfoo/promptfoo) | Prompt 优化依赖主观印象 | 固定测试集、断言、模型与版本对照 | 同任务事实集上的 Prompt A/B 评测 |
| [TensorZero](https://github.com/tensorzero/tensorzero) | 模型实验与生产反馈脱节 | 观测、优化、实验形成数据飞轮 | 人工决策回流为下一轮信号 |
| [DeepEval](https://github.com/confident-ai/deepeval) | LLM 输出难以系统测试 | 指标、测试用例、CI 评测 | 以可重复测试替代装饰性总分 |

## 为什么这些项目容易获得关注

1. 一句话问题明确：先描述昂贵痛点，再讲技术。
2. 首屏立即看懂：截图、在线演示、短路径降低试用成本。
3. 能进入真实流程：覆盖数据、评测、运行与协作，而不只是模型展示。
4. 技术可信：测试、架构、边界与可复现命令公开。
5. 有扩展入口：Issue、Roadmap 与模块化接口让贡献者知道从哪里加入。

## 刻意没有照搬

- 不做通用拖拽工作流：会稀释内容洞察与质量闭环。
- 不制造“AI 自动洞察准确率”等虚假指标：没有真实标注集就不声称效果。
- 不把模型分数当最终决定：人工终审保留责任边界。
- 不再拆第三个浅项目：产品深度与完整因果链优先于仓库数量。
