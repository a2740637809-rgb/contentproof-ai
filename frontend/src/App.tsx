import { PromptComparison } from "./components/PromptComparison";
import { QualityPanel } from "./components/QualityPanel";
import { Sidebar } from "./components/Sidebar";
import { TaskEditor } from "./components/TaskEditor";
import { WorkflowTrack } from "./components/WorkflowTrack";
import "./styles.css";

export default function App() {
  return (
    <main className="app-shell">
      <Sidebar />
      <section className="workspace">
        <header className="page-header">
          <div>
            <p className="utility-label">AI CONTENT OPERATIONS / LOCAL-FIRST</p>
            <h1>ContentProof <em>AI</em></h1>
            <p className="page-lede">从公开事实，到可复现的内容生产与质量终审。</p>
          </div>
          <div className="header-meta"><span>当前模型</span><strong>qwen2:1.5b</strong></div>
        </header>
        <TaskEditor />
        <WorkflowTrack />
        <PromptComparison />
      </section>
      <QualityPanel />
    </main>
  );
}
