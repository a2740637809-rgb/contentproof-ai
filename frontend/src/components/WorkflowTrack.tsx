const steps = [
  ["事实抽取", "已完成", "12 秒"],
  ["内容提纲", "已完成", "8 秒"],
  ["初稿生成", "运行中", "本地模型"],
  ["平台改写", "等待中", "—"],
];

export function WorkflowTrack() {
  return (
    <section className="workflow-card" aria-labelledby="workflow-title">
      <div className="section-heading">
        <div>
          <span className="utility-label">TRACE / RUN-024</span>
          <h2 id="workflow-title">工作流轨迹</h2>
        </div>
        <button className="ghost-button">查看运行记录</button>
      </div>
      <div className="workflow-line">
        {steps.map(([name, status, meta], index) => (
          <article className={`workflow-step step-${index}`} key={name}>
            <span className="step-index">{index + 1}</span>
            <div><strong>{name}</strong><small>{meta}</small></div>
            <span className="step-state">{status}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
