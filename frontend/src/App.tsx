import { useMemo, useState } from "react";
import "./styles.css";

type View = "signals" | "brief" | "experiment";
const feedback = [
  { id: "F001", channel: "访谈", quote: "生成得很快，但内容像模板，放到哪个账号都一样。" },
  { id: "F002", channel: "客服", quote: "最怕事实写错，也看不到这句话到底从哪里来的。" },
  { id: "F003", channel: "问卷", quote: "模型一慢或者失败，整个流程就只能重新来。" },
  { id: "F004", channel: "社群", quote: "希望把多个平台版本和审核记录一次导出。" },
  { id: "F005", channel: "访谈", quote: "未发布素材不能离开电脑，隐私是底线。" },
];
const clusters = [
  { name: "事实可信", count: 8, score: 92, evidence: ["F002", "F009", "F013"], color: "coral" },
  { name: "表达同质化", count: 6, score: 81, evidence: ["F001", "F006"], color: "amber" },
  { name: "流程韧性", count: 4, score: 68, evidence: ["F003"], color: "blue" },
  { name: "协作交付", count: 3, score: 57, evidence: ["F004"], color: "violet" },
  { name: "本地隐私", count: 3, score: 53, evidence: ["F005"], color: "green" },
];

export default function App() {
  const [view, setView] = useState<View>("signals");
  const [selected, setSelected] = useState("事实可信");
  const active = useMemo(() => clusters.find((item) => item.name === selected) ?? clusters[0], [selected]);
  const createBrief = () => { setSelected("事实可信"); setView("brief"); };

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">跳到主要内容</a>
    <header className="topbar">
      <a className="brand" href="#main-content" aria-label="SignalProof 首页" translate="no"><span className="brand-mark" aria-hidden="true"><i/><i/><i/></span><span>SignalProof <b>Studio</b></span></a>
      <nav aria-label="主要导航">
        <button className={view === "signals" ? "active" : ""} onClick={() => setView("signals")}>信号</button>
        <button className={view === "brief" ? "active" : ""} onClick={() => setView("brief")}>简报</button>
        <button className={view === "experiment" ? "active" : ""} onClick={() => setView("experiment")}>实验</button>
      </nav>
      <span className="demo-badge" translate="no"><i aria-hidden="true"/> PUBLIC DEMO</span>
    </header>
    {view === "signals" && <main id="main-content">
      <section className="hero">
        <div><p className="kicker">AUDIENCE SIGNAL → CONTENT DECISION</p><h1>把用户声音变成<br/><em>可验证</em>的内容决策。</h1><p className="hero-copy">从零散评论中识别真实痛点，保留每条原话证据，再把最高价值的信号推进为可评测的内容实验。</p>
          <div className="hero-actions"><button className="primary" onClick={createBrief}>从最高机会创建内容简报 <span>↗</span></button><a href="#river">查看信号地图 ↓</a></div>
        </div>
        <aside className="snapshot"><p>本次分析 / RUN 024</p><strong>24</strong><span>条原始反馈</span><dl><div><dt>5</dt><dd>主题信号</dd></div><div><dt>3</dt><dd>反馈渠道</dd></div><div><dt>100%</dt><dd>可追溯</dd></div></dl></aside>
      </section>
      <section className="river-section" id="river">
        <div className="section-heading"><div><p className="kicker">SIGNAL CARTOGRAPHY</p><h2>信号河流</h2></div><p>线条越宽，出现频次越高；节点分值综合频次、负面情绪与业务影响。点击节点查看证据。</p></div>
        <div className="river-layout">
          <div className="feedback-stack" aria-label="原始反馈">{feedback.map((item) => <article key={item.id}><div><code>{item.id}</code><span>{item.channel}</span></div><p>“{item.quote}”</p></article>)}</div>
          <div className="flow-map" aria-label="反馈聚类信号图">
            <svg viewBox="0 0 460 440" role="img" aria-label="反馈流向五个内容机会">
              <path className="flow coral" d="M0 45 C155 45 165 74 300 74"/><path className="flow amber" d="M0 126 C145 126 176 148 300 148"/><path className="flow blue" d="M0 207 C155 207 164 222 300 222"/><path className="flow violet" d="M0 288 C155 288 172 296 300 296"/><path className="flow green" d="M0 369 C150 369 176 370 300 370"/>
              {clusters.map((cluster,index) => <g key={cluster.name} className={`node ${cluster.color} ${selected === cluster.name ? "selected" : ""}`}><circle cx="340" cy={74+index*74} r={selected === cluster.name ? 35 : 28}/><text x="340" y={79+index*74} textAnchor="middle">{cluster.score}</text></g>)}
            </svg>
            <div className="cluster-labels">{clusters.map(cluster => <button key={cluster.name} onClick={() => setSelected(cluster.name)}><b>{cluster.name}</b><span>{cluster.count} 次提及</span></button>)}</div>
          </div>
          <aside className={`evidence-panel ${active.color}`}><p className="kicker">SELECTED SIGNAL</p><div className="signal-score"><strong>{active.score}</strong><span>/ 100<br/>机会分</span></div><h3>{active.name}</h3><p>用户需要的不只是更快生成，而是能解释“为什么可信”的内容工作流。</p><div className="evidence-list">{active.evidence.map(id => <span key={id}>证据 {id}</span>)}</div><button onClick={createBrief}>创建内容简报 →</button></aside>
        </div>
      </section>
    </main>}
    {view === "brief" && <main className="workspace" id="main-content">
      <div className="workspace-title"><div><p className="kicker">OPPORTUNITY → BRIEF</p><h1>内容机会简报</h1></div><span className="success">✓ 简报已创建</span></div>
      <div className="brief-grid">
        <section className="brief-card lead"><span className="index">01 / PROBLEM</span><h2>内容生产提速后，团队仍无法证明 AI 输出为什么可信。</h2><p>目标不是再做一个写作按钮，而是让来源、提示词、评测与人工决策形成完整证据链。</p></section>
        <section className="brief-card"><span className="index">02 / AUDIENCE</span><h3>内容运营与编辑团队</h3><p>高频生产、多平台交付，同时承担事实准确与品牌风险。</p></section>
        <section className="brief-card"><span className="index">03 / EVIDENCE</span><h3>证据 F002</h3><blockquote>“最怕事实写错，也看不到这句话到底从哪里来的。”</blockquote><a href="#evidence">查看原始上下文 ↗</a></section>
        <section className="brief-card"><span className="index">04 / HYPOTHESIS</span><h3>如果每个结论都显示来源与评测理由，用户会更愿意进入人工终审。</h3><p>成功指标：事实准确性 ≥ 90，来源覆盖率 = 100%，人工接受率提升。</p></section>
      </div>
      <div className="workspace-actions"><button onClick={() => setView("signals")}>← 返回信号地图</button><button className="primary" onClick={() => setView("experiment")}>进入内容实验 ↗</button></div>
    </main>}
    {view === "experiment" && <main className="workspace" id="main-content">
      <div className="workspace-title"><div><p className="kicker">BRIEF → EVALUATION</p><h1>内容实验</h1></div><span className="run-label">RUN / 024</span></div>
      <section className="experiment-board"><div className="experiment-head"><span>同一任务与事实集</span><b>Prompt A / 基线</b><b>Prompt B / 证据约束</b></div><div className="experiment-row"><span>事实准确性</span><strong>76</strong><strong className="winner">94 <i>+18</i></strong></div><div className="experiment-row"><span>来源覆盖率</span><strong>40%</strong><strong className="winner">100% <i>+60</i></strong></div><div className="experiment-row"><span>平台适配</span><strong>82</strong><strong>88 <i>+6</i></strong></div><div className="experiment-row decision"><span>人工决策</span><p>退回：缺少出处</p><p className="accepted">接受 B：证据完整</p></div></section>
      <aside className="trace-note"><span>可复现记录</span><p>数据集 DS-024 · 模型 qwen2.5:7b · 温度 0.2 · 评测规则 EV-03</p></aside>
      <div className="workspace-actions"><button onClick={() => setView("brief")}>← 返回简报</button><button className="primary" onClick={() => setView("signals")}>完成决策闭环 ✓</button></div>
    </main>}
  </div>;
}
