export function TaskEditor() {
  return (
    <section className="editor-card" aria-labelledby="task-title">
      <div className="section-heading">
        <div>
          <span className="utility-label">BRIEF / 001</span>
          <h2 id="task-title">任务录入</h2>
        </div>
        <span className="status-pill">草稿已保存</span>
      </div>
      <div className="field-grid">
        <label>
          内容主题
          <input defaultValue="端午反诈与禁毒宣传活动稿" />
        </label>
        <label>
          目标平台
          <select defaultValue="常德融媒客户端">
            <option>常德融媒客户端</option>
            <option>微信公众号</option>
            <option>视频口播</option>
          </select>
        </label>
      </div>
      <label>
        已核验事实
        <textarea
          aria-label="已核验事实"
          defaultValue={"• 活动主题包含反诈与禁毒\n• 节点为端午节\n• 来源：常德融媒公开报道"}
        />
      </label>
      <div className="source-strip">
        <span className="source-seal">来源已核验</span>
        <a href="https://appimg.cdyee.com/app/template/displayTemplate/news/newsDetail/30533/3156167.html">
          cdyee.com / 3156167 ↗
        </a>
        <small>仅保存元数据与短摘要</small>
      </div>
    </section>
  );
}
