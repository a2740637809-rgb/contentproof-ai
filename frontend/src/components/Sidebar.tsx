const navigation = ["当前任务", "事实来源", "提示词版本", "评测报告"];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand-mark" aria-hidden="true">CP</div>
      <div>
        <span className="utility-label">内容证据台</span>
        <strong className="brand-name">ContentProof</strong>
      </div>
      <nav aria-label="工作台导航">
        {navigation.map((item, index) => (
          <button className={index === 0 ? "active" : ""} key={item}>
            <span>0{index + 1}</span>{item}
          </button>
        ))}
      </nav>
      <div className="runtime">
        <i />
        <div><strong>本地运行</strong><small>数据不离开设备</small></div>
      </div>
    </aside>
  );
}
