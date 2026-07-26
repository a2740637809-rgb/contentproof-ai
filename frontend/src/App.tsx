import { FormEvent, useMemo, useState } from "react";
import { DemoRepository } from "./demoRepository";
import type { Mode, Page, Run, Source, Step } from "./types";
import "./styles.css";

const labels: Record<Page, string> = {
  dashboard: "实验总览", sources: "事实来源", workflow: "内容工作流",
  experiments: "提示词实验", evaluations: "质量评测", review: "人工终审",
};
const dimensionNames: Record<string, string> = {
  factual_accuracy: "事实准确性", structure: "结构完整性", readability: "可读性",
  platform_fit: "平台适配", risk_control: "风险控制",
};

export default function App() {
  const repo = useMemo(() => new DemoRepository(), []);
  const [mode, setMode] = useState<Mode | null>(null);
  const [page, setPage] = useState<Page>("dashboard");
  const [task, setTask] = useState(repo.task);
  const [run, setRun] = useState<Run | null>(null);
  const [toast, setToast] = useState("");
  const [review, setReview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2400); };
  if (!mode) return <ConnectionGate onSelect={setMode} />;

  const execute = async () => {
    setBusy(true); notify(mode === "demo" ? "正在运行演示工作流" : "正在提交本地模型");
    if (mode === "demo") {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      const next = await repo.run(); setRun(next); setTask({ ...repo.task });
      notify("四个步骤已完成");
    } else {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/health");
        if (!response.ok) throw new Error();
        notify("本地服务连接成功，请在任务中创建运行");
      } catch { notify("未连接本地服务：请运行后端与 ollama serve"); }
    }
    setBusy(false);
  };
  const addSource = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const source = await repo.addSource({
      title: String(data.get("title")), url: String(data.get("url")),
      excerpt: String(data.get("excerpt")), status: "pending", facts: [],
    });
    setTask({ ...repo.task }); notify(`来源“${source.title}”已保存`); event.currentTarget.reset();
  };
  const reset = async () => { await repo.reset(); setTask({ ...repo.task }); setRun(null); setReview(null); notify("演示数据已重置"); };

  return (
    <div className="product-shell">
      <aside className="nav-panel">
        <div className="brand"><span>CP</span><div><small>内容证据台</small><strong>ContentProof</strong></div></div>
        <nav aria-label="产品导航">{(Object.keys(labels) as Page[]).map((key, index) =>
          <button key={key} className={page === key ? "active" : ""} onClick={() => setPage(key)}>
            <i>0{index + 1}</i>{labels[key]}
          </button>)}</nav>
        <div className="mode-card"><b>{mode === "demo" ? "演示数据" : "本地模型"}</b><small>{mode === "demo" ? "浏览器内运行，不上传内容" : "FastAPI + Ollama"}</small></div>
      </aside>
      <main className="main-panel">
        <header><div><p className="eyebrow">AI CONTENT QUALITY LAB</p><h1>{labels[page]}</h1><p>{task.title}</p></div><div className="header-actions"><button onClick={reset}>重置演示</button><span>{mode === "demo" ? "演示数据" : "本地模型"}</span></div></header>
        {page === "dashboard" && <Dashboard task={task} onStart={() => setPage("workflow")} />}
        {page === "sources" && <Sources task={task} onSubmit={addSource} />}
        {page === "workflow" && <Workflow run={run ?? task.runs[0] ?? null} busy={busy} onRun={execute} />}
        {page === "experiments" && <Experiments />}
        {page === "evaluations" && <Evaluations />}
        {page === "review" && <Review decision={review} onReview={(value) => { setReview(value); notify("审核决定已保存"); }} onExport={() => downloadEvidence(task, run)} />}
      </main>
      {toast && <div role="status" className="toast">{toast}</div>}
    </div>
  );
}

function ConnectionGate({ onSelect }: { onSelect: (mode: Mode) => void }) {
  return <main className="gate"><p className="eyebrow">LOCAL-FIRST / EVIDENCE-DRIVEN</p><h1>让 AI 内容的每个结论<br />都有来源、评测与人工决定。</h1><p>面向内容团队的质量实验室：从事实卡片到提示词对照、模型评测和终审证据包。</p><div className="gate-options"><button onClick={() => onSelect("demo")}><b>立即体验示例</b><span>无需安装，完整走通产品流程</span></button><button onClick={() => onSelect("live")}><b>连接本地模型</b><span>FastAPI + Ollama，数据留在设备</span></button></div></main>;
}
function Dashboard({ task, onStart }: { task: DemoRepository["task"]; onStart: () => void }) {
  return <><section className="metrics"><article><span>来源卡片</span><b>{task.sources.length}</b><small>{task.sources.filter(s => s.status === "verified").length} 条已核验</small></article><article><span>实验运行</span><b>{Math.max(task.runs.length, 2)}</b><small>Prompt v2 较 v1 +9.5</small></article><article><span>当前质量</span><b>88.0</b><small>模型辅助评分</small></article><article><span>人工决定</span><b>1/2</b><small>仍有一条待终审</small></article></section><section className="card hero-card"><div><p className="eyebrow">PRODUCT PROBLEM</p><h2>AI 写得快，但团队无法证明它为什么可信。</h2><p>ContentProof 把来源、生成轨迹、硬规则、模型评分和人工决定串成同一条证据链。</p><button className="primary" onClick={onStart}>运行完整证据工作流</button></div><ol><li><b>01</b>公开来源转事实卡</li><li><b>02</b>提示词版本可对照</li><li><b>03</b>每一步输出可追踪</li><li><b>04</b>人工终审可导出</li></ol></section></>;
}
function Sources({ task, onSubmit }: { task: DemoRepository["task"]; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="two-col"><section className="card"><h2>来源库</h2>{task.sources.map(source => <article className="source" key={source.id}><div><span className={`pill ${source.status}`}>{source.status === "verified" ? "已核验" : "待核验"}</span><h3>{source.title}</h3><p>{source.excerpt}</p></div><a href={source.url} target="_blank" rel="noreferrer">查看原始页面 ↗</a></article>)}</section><form className="card form-card" onSubmit={onSubmit}><h2>添加公开来源</h2><label>来源标题<input name="title" required /></label><label>原始链接<input name="url" type="url" required /></label><label>短摘要<textarea name="excerpt" maxLength={180} required /></label><p className="rights">仅保存公开元数据、链接和短摘要，不复制全文与原图。</p><button className="primary">保存来源</button></form></div>;
}
function Workflow({ run, busy, onRun }: { run: Run | null; busy: boolean; onRun: () => void }) {
  const steps: Step[] = run?.steps ?? ["facts", "outline", "draft", "adapt"].map(name => ({ name, status: "pending", output_json: {}, error: "" }));
  return <><section className="card action-bar"><div><h2>来源到成稿</h2><p>每步立即落库；下游失败不会抹掉已完成证据。</p></div><button className="primary" disabled={busy} onClick={onRun}>{busy ? "正在执行…" : "运行工作流"}</button></section><section className="step-grid">{steps.map((step, index) => <article className={`card step ${step.status}`} key={step.name}><span>0{index + 1}</span><h3>{{ facts: "事实抽取", outline: "内容提纲", draft: "初稿生成", adapt: "平台改写" }[step.name]}</h3><b>{step.status === "completed" ? "已完成" : step.status === "failed" ? "失败" : "等待中"}</b><small>{step.elapsed_ms ? `${step.elapsed_ms} ms` : "尚未运行"}</small><pre>{String(step.output_json.text ?? "运行后显示结构化输出")}</pre></article>)}</section></>;
}
function Experiments() { return <section className="card"><div className="section-title"><div><h2>提示词 A/B 实验</h2><p>同一数据集、同一模型，只改变提示词约束。</p></div><span className="pill verified">2 个版本</span></div><div className="experiment"><b>评测项</b><b>Prompt v1</b><b>Prompt v2</b><b>变化</b><b>人工决定</b></div><div className="experiment"><span>端午反诈活动稿</span><span>78.5</span><span>88.0</span><strong>+9.5</strong><span>接受 v2</span></div><div className="experiment"><span>数字与机构核验</span><span>82.0</span><span>91.0</span><strong>+9.0</strong><span>通过</span></div></section>; }
function Evaluations() { const evaluation = new DemoRepository().evaluation; return <section className="evaluation-grid"><article className="score-card"><p>QUALITY GATE</p><strong>{evaluation.total}</strong><span>/ 100</span><small>模型辅助评分，仅供参考</small></article>{Object.entries(evaluation.dimensions).map(([name, item]) => <article className="card dimension" key={name}><div><h3>{dimensionNames[name]}</h3><b>{item.score}</b></div><progress max="100" value={item.score} /><p>{item.reason}</p><ul>{item.evidence.map(e => <li key={e}>{e}</li>)}</ul></article>)}</section>; }
function Review({ decision, onReview, onExport }: { decision: string | null; onReview: (value: string) => void; onExport: () => void }) { return <div className="two-col"><section className="card"><h2>终稿预览</h2><textarea defaultValue="端午将至，常德一场安全宣传活动把反诈与禁毒知识融入节日互动。" /><p className="rights">人工决定始终高于模型评分。</p></section><section className="card review-actions"><h2>人工终审</h2><p>当前决定：<b>{decision ?? "待审核"}</b></p><button onClick={() => onReview("accepted")}>接受终稿</button><button onClick={() => onReview("modified")}>修改后接受</button><button onClick={() => onReview("rejected")}>退回重做</button><button className="primary" onClick={onExport}>导出证据 JSON</button></section></div>; }
function downloadEvidence(task: DemoRepository["task"], run: Run | null) { const blob = new Blob([JSON.stringify({ mode: "demo", task, run, evaluation: new DemoRepository().evaluation }, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "contentproof-evidence.json"; link.click(); URL.revokeObjectURL(link.href); }
