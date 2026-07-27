import { useMemo, useState } from "react";
import { analyzeEvidence, createBrief, type Brief, type EvidenceItem, type Signal } from "./lib/analyzer";
import "./styles.css";

const starterEvidence: EvidenceItem[] = [
  { id: "E-001", channel: "访谈", text: "生成很快，但内容像模板，放在哪个账号都一样。" },
  { id: "E-002", channel: "客服", text: "最怕事实写错，也看不到这句话到底来自哪里。" },
  { id: "E-003", channel: "问卷", text: "模型失败以后整个流程只能重新来。" },
  { id: "E-004", channel: "社群", text: "希望把平台版本和审核记录一次导出。" },
  { id: "E-005", channel: "访谈", text: "未发布素材不能离开电脑，隐私是底线。" },
];

type View = "desk" | "signals" | "brief";

function Brand() {
  return (
    <div className="brand" aria-label="SignalProof Studio">
      <span className="brand-glyph" aria-hidden="true"><i /><i /><i /></span>
      <span><strong>SignalProof</strong><small>STUDIO / LOCAL-FIRST</small></span>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>("desk");
  const [evidence, setEvidence] = useState(starterEvidence);
  const [draft, setDraft] = useState("");
  const [channel, setChannel] = useState("访谈");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [status, setStatus] = useState("等待分析");

  const selected = useMemo(
    () => signals.find((signal) => signal.id === selectedId) ?? signals[0],
    [selectedId, signals],
  );

  const addEvidence = () => {
    if (!draft.trim()) return;
    setEvidence((items) => [
      ...items,
      { id: `E-${String(items.length + 1).padStart(3, "0")}`, channel, text: draft.trim() },
    ]);
    setDraft("");
    setStatus("证据已更新，等待重新分析");
  };

  const runAnalysis = () => {
    const result = analyzeEvidence(evidence);
    setSignals(result.signals);
    setSelectedId(result.signals[0]?.id ?? "");
    setStatus(`浏览器规则基线 · ${result.signals.length} 个信号`);
    setView("signals");
  };

  const buildBrief = () => {
    if (!selected) return;
    setBrief(createBrief(selected));
    setView("brief");
  };

  return (
    <div className="app">
      <a className="skip-link" href="#workspace">跳到工作区</a>
      <aside className="rail">
        <Brand />
        <nav aria-label="项目流程">
          <button className={view === "desk" ? "active" : ""} onClick={() => setView("desk")}>
            <span>01</span>证据工作台
          </button>
          <button className={view === "signals" ? "active" : ""} onClick={() => setView("signals")} disabled={!signals.length}>
            <span>02</span>信号地图
          </button>
          <button className={view === "brief" ? "active" : ""} onClick={() => setView("brief")} disabled={!brief}>
            <span>03</span>内容简报
          </button>
        </nav>
        <div className="rail-note">
          <span className="pulse" />
          <div><strong>本地演示模式</strong><small>数据不会离开浏览器</small></div>
        </div>
      </aside>

      <main id="workspace">
        <header className="workspace-header">
          <div>
            <span className="eyebrow">PROJECT / PUBLIC CASE 001</span>
            <h2>内容团队反馈洞察</h2>
          </div>
          <div className="run-state"><span>{status}</span><b>{evidence.length} 条证据</b></div>
        </header>

        {view === "desk" && (
          <section className="desk">
            <div className="hero">
              <span className="eyebrow">EVIDENCE → SIGNAL → BRIEF</span>
              <h1>从零散反馈，<br />到有证据的内容简报。</h1>
              <p>不是让 AI 替代编辑判断，而是把每个结论与原始证据连在一起，让团队知道该相信什么、为什么相信。</p>
            </div>

            <div className="desk-grid">
              <section className="panel capture">
                <div className="panel-title"><span>INPUT / 01</span><h3>加入一条真实反馈</h3></div>
                <label>反馈渠道
                  <select value={channel} onChange={(event) => setChannel(event.target.value)}>
                    <option>访谈</option><option>客服</option><option>问卷</option><option>评论</option><option>社群</option>
                  </select>
                </label>
                <label>反馈内容
                  <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="粘贴用户原话；手机号和邮箱会在分析时自动脱敏。" />
                </label>
                <button className="action" onClick={addEvidence}>加入证据</button>
              </section>

              <section className="panel evidence-stack">
                <div className="panel-title"><span>SOURCE LOG / {evidence.length}</span><h3>证据清单</h3></div>
                <div className="evidence-scroll">
                  {evidence.map((item) => (
                    <article key={item.id}>
                      <div><code>{item.id}</code><span>{item.channel}</span><button aria-label={`删除 ${item.id}`} onClick={() => setEvidence((items) => items.filter((entry) => entry.id !== item.id))}>×</button></div>
                      <p>{item.text}</p>
                    </article>
                  ))}
                </div>
                <button className="primary" onClick={runAnalysis}>分析 {evidence.length} 条证据 <span>→</span></button>
              </section>
            </div>
          </section>
        )}

        {view === "signals" && (
          <section className="signal-workspace">
            <div className="section-intro">
              <div><span className="eyebrow">TRACEABLE CLUSTERING / RULE BASELINE</span><h1>证据如何汇聚成信号</h1></div>
              <p>置信度来自公开可检查的关键词命中与证据数量，不代表业务价值，也不是模型主观评分。</p>
            </div>
            <div className="signal-grid">
              <div className="source-column">
                <span className="column-label">原始证据</span>
                {evidence.map((item) => (
                  <article key={item.id} className={selected?.evidence.some((entry) => entry.id === item.id) ? "linked" : ""}>
                    <code>{item.id}</code><p>{item.text}</p><span>{item.channel}</span>
                  </article>
                ))}
              </div>
              <div className="signal-column">
                <span className="column-label">候选信号</span>
                {signals.map((signal) => (
                  <button key={signal.id} className={selected?.id === signal.id ? "selected" : ""} onClick={() => setSelectedId(signal.id)}>
                    <span>{signal.id} · {signal.evidence.length} 条证据</span>
                    <strong>{signal.theme}</strong>
                    <small>规则置信度 {Math.round(signal.confidence * 100)}%</small>
                  </button>
                ))}
              </div>
              {selected && (
                <aside className="inspector">
                  <span className="eyebrow">REVIEW / HUMAN IN CONTROL</span>
                  <h2>{selected.theme}</h2>
                  <p className="rationale">{selected.rationale}</p>
                  <dl><div><dt>证据</dt><dd>{selected.evidence.length} 条</dd></div><div><dt>渠道</dt><dd>{new Set(selected.evidence.map((item) => item.channel)).size} 个</dd></div></dl>
                  <h3>建议行动</h3><p>{selected.action}</p>
                  <div className="trace-list">{selected.evidence.map((item) => <span key={item.id}>原始证据 {item.id}</span>)}</div>
                  <button className="primary" onClick={buildBrief}>生成内容简报 <span>→</span></button>
                </aside>
              )}
            </div>
          </section>
        )}

        {view === "brief" && brief && selected && (
          <section className="brief-workspace">
            <div className="section-intro">
              <div><span className="eyebrow">EDITORIAL BRIEF / HUMAN REVIEW</span><h1>内容简报</h1></div>
              <button className="quiet" onClick={() => setView("signals")}>返回信号地图</button>
            </div>
            <div className="brief-layout">
              <article className="brief-document">
                <div className="document-meta"><span>DRAFT / NOT PUBLISHED</span><span>{brief.evidenceIds.length} 个证据引用</span></div>
                <label>简报标题<input value={brief.title} onChange={(event) => setBrief({ ...brief, title: event.target.value })} /></label>
                <label>需要解决的问题<textarea value={brief.problem} onChange={(event) => setBrief({ ...brief, problem: event.target.value })} /></label>
                <label>目标使用者<textarea value={brief.audience} onChange={(event) => setBrief({ ...brief, audience: event.target.value })} /></label>
                <label>内容切入角度<textarea value={brief.angle} onChange={(event) => setBrief({ ...brief, angle: event.target.value })} /></label>
                <div className="criteria"><span>发布前检查</span>{brief.acceptanceCriteria.map((item) => <label key={item}><input type="checkbox" />{item}</label>)}</div>
              </article>
              <aside className="brief-evidence">
                <span className="column-label">原始证据 / {brief.evidenceIds.length}</span>
                {selected.evidence.map((item) => <article key={item.id}><div><code>{item.id}</code><span>{item.channel}</span></div><p>{item.text}</p></article>)}
                <p className="honesty-note"><b>结果边界</b> 当前公开演示使用规则基线。它能提供可重复、可追溯的分组，但不能替代真实用户研究或编辑判断。</p>
              </aside>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
