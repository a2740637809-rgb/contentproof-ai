const rows = [
  { caseName: "事实完整性", v1: 78, v2: 86, delta: "+8.0", decision: "采用 v2" },
  { caseName: "平台语气", v1: 74, v2: 80.5, delta: "+6.5", decision: "人工微调" },
  { caseName: "风险控制", v1: 88, v2: 92, delta: "+4.0", decision: "采用 v2" },
];

export function PromptComparison() {
  return (
    <section className="comparison-card" aria-labelledby="comparison-title">
      <div className="section-heading">
        <div>
          <span className="utility-label">EXPERIMENT / A-B</span>
          <h2 id="comparison-title">提示词对照</h2>
        </div>
      </div>
      <div className="comparison-table" role="table">
        <div className="comparison-row comparison-head" role="row">
          <span>评测项</span><span>Prompt v1</span><span>Prompt v2</span><span>变化</span><span>人工决定</span>
        </div>
        {rows.map((row) => (
          <div className="comparison-row" role="row" key={row.caseName}>
            <strong>{row.caseName}</strong><span>{row.v1}</span><span>{row.v2}</span>
            <span className="delta">{row.delta}</span><span>{row.decision}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
