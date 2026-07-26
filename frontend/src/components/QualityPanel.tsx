const dimensions = [
  ["事实准确性", 90],
  ["结构完整性", 84],
  ["可读性", 78],
  ["平台适配", 76],
  ["风险控制", 92],
];

export function QualityPanel() {
  return (
    <aside className="quality-panel">
      <div className="quality-header">
        <span className="utility-label">QUALITY GATE</span>
        <span className="advisory-dot">建议</span>
      </div>
      <div className="score-lockup">
        <strong>84.0</strong><span>/ 100</span>
      </div>
      <p className="advisory-copy">模型辅助评分，仅供参考</p>
      <div className="score-list">
        {dimensions.map(([name, score]) => (
          <div className="score-row" key={name}>
            <div><span>{name}</span><strong>{score}</strong></div>
            <progress max="100" value={score} />
          </div>
        ))}
      </div>
      <div className="rule-check">
        <span>✓</span>
        <div><strong>硬性规则通过</strong><small>事实、禁用语、篇幅均符合</small></div>
      </div>
      <button className="primary-button">提交人工终审</button>
      <button className="secondary-button">导出评测报告</button>
    </aside>
  );
}
