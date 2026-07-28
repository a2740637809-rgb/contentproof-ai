import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useDropzone } from "react-dropzone";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft, ArrowRight, BookOpenText, Bot, BrainCircuit, Check, ChevronRight,
  Archive, CircleAlert, ClipboardCheck, Cpu, Database, Download, FileSearch, FileText,
  FolderKanban, Link2, LoaderCircle, LockKeyhole, Mail, Menu, Play,
  MoreHorizontal, Plus, RotateCcw, Search, ShieldCheck, Sparkles, Trash2, Upload, X,
  Settings2,
} from "lucide-react";
import clsx from "clsx";
import {
  analyzeProject, api, createBrief, importManual, importSpreadsheet, importWeb,
  type AnalysisRun, type Benchmark, type Brief, type Comment, type ModelProfile, type Project, type Theme,
} from "./api";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

type WorkspaceView = "overview" | "import" | "data" | "review" | "runs" | "benchmark" | "models" | "brief";

const viewMeta = {
  overview: { label: "研究概览", icon: FolderKanban },
  import: { label: "来源导入", icon: Link2 },
  data: { label: "数据检查", icon: Database },
  review: { label: "洞察审阅", icon: FileSearch },
  runs: { label: "运行轨迹", icon: Cpu },
  benchmark: { label: "方案对比", icon: Sparkles },
  models: { label: "模型中心", icon: Settings2 },
  brief: { label: "内容 Brief", icon: BookOpenText },
} as Record<WorkspaceView, { label: string; icon: typeof Database }>;

function App() {
  return <QueryClientProvider client={queryClient}><ResearchApp /></QueryClientProvider>;
}

function ResearchApp() {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [view, setView] = useState<WorkspaceView>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<{ items: Project[] }>("/v2/projects"),
  });

  if (!projectId) {
    return (
      <ProjectHome
        projects={projects.data?.items ?? []}
        loading={projects.isLoading}
        error={projects.isError}
        onOpen={(id) => { setProjectId(id); setView("overview"); }}
      />
    );
  }

  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <WorkspaceRail
        view={view}
        onView={(next) => { setView(next); setMobileNav(false); }}
        onHome={() => setProjectId(null)}
        open={mobileNav}
      />
      <main className="workspace-main" id="main-content">
        <header className="mobile-header">
          <button className="icon-button" onClick={() => setMobileNav(true)} aria-label="打开导航"><Menu /></button>
          <Brand compact />
          <span className="local-pill"><i />本地</span>
        </header>
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <Workspace projectId={projectId} view={view} onView={setView} />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={clsx("brand-v2", compact && "compact")}>
      <span className="brand-mark"><i /><i /><i /></span>
      <span><strong>Content Intelligence</strong>{!compact && <small>EDITORIAL RESEARCH LAB</small>}</span>
    </div>
  );
}

function ProjectHome({
  projects, loading, error, onOpen,
}: { projects: Project[]; loading: boolean; error: boolean; onOpen: (id: number) => void }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [projectMenu, setProjectMenu] = useState<number | null>(null);
  const [managing, setManaging] = useState(false);
  const [activeEvidence, setActiveEvidence] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const archived = useQuery({
    queryKey: ["projects", "archived"],
    queryFn: () => api<{ items: Project[] }>("/v2/projects?lifecycle=archived"),
    enabled: managing,
  });
  const trashed = useQuery({
    queryKey: ["projects", "trashed"],
    queryFn: () => api<{ items: Project[] }>("/v2/projects?lifecycle=trashed"),
    enabled: managing,
  });
  const saveProject = async () => {
    if (!name.trim() || !goal.trim()) return;
    setSaving(true);
    try {
      const project = await api<Project>("/v2/projects", { method: "POST", body: JSON.stringify({ name, goal }) });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      onOpen(project.id);
    } finally { setSaving(false); }
  };
  const loadDemo = async () => {
    setDemoLoading(true);
    try {
      const result = await api<{ project_id: number }>("/v2/demo/bootstrap", { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      onOpen(result.project_id);
    } finally { setDemoLoading(false); }
  };
  const changeLifecycle = async (projectId: number, action: "archive" | "trash" | "restore") => {
    await api(`/v2/projects/${projectId}/${action}`, { method: "POST" });
    setProjectMenu(null);
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
  };
  const deleteForever = async (project: Project) => {
    if (!window.confirm(`永久删除“${project.name}”？此操作无法撤销。`)) return;
    await api(`/v2/projects/${project.id}?permanent=true`, { method: "DELETE" });
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
  };
  return (
    <div className="project-home">
      <header className="home-header">
        <Brand />
        <nav className="home-meta" aria-label="首页导航">
          <a href="#guide">使用指南</a><a href="#agents">Agent 工作流</a>
          <a href="https://github.com/a2740637809-rgb" target="_blank" rel="noreferrer"><Link2 />GitHub</a>
        </nav>
      </header>
      <section className="home-hero">
        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="kicker"><ShieldCheck />证据优先 · 本地运行</span>
          <h1>从读者原话<br />到下一篇选题</h1>
          <p><span>从零散评论中发现读者真正关心的问题</span><span>让每一条内容判断都有原话可查</span></p>
          <div className="hero-actions">
            <button className="button primary" onClick={() => projects[0] ? onOpen(projects[0].id) : setCreating(true)}>
              {projects.length ? "继续研究" : "建立第一项研究"}<ArrowRight />
            </button>
            <a className="hero-link" href="#method">查看方法 <span aria-hidden="true">↓</span></a>
          </div>
        </motion.div>
        <motion.div
          className="signal-field"
          aria-label="评论聚合为洞察的过程演示"
          onPointerMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            setTilt({
              x: ((event.clientY - bounds.top) / bounds.height - .5) * -4,
              y: ((event.clientX - bounds.left) / bounds.width - .5) * 5,
            });
          }}
          onPointerLeave={() => setTilt({ x: 0, y: 0 })}
          style={{ rotateX: tilt.x, rotateY: tilt.y }}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.18, duration: 0.65 }}
        >
          <div className="signal-caption"><span>LIVE EVIDENCE MAP</span><span>08 条读者原话</span></div>
          <div className="signal-canvas">
            <div className="signal-pixels" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--i": index } as React.CSSProperties} />)}
            </div>
            {[["什么时候报名？", "s1"], ["入口在哪里？", "s2"], ["需要准备什么？", "s3"], ["老人能参加吗？", "s4"], ["有没有具体时间？", "s5"]].map(([text, name], index) => (
              <motion.button
                className={clsx("signal-chip", name)}
                key={name}
                type="button"
                aria-pressed={activeEvidence === index}
                onClick={() => setActiveEvidence(index)}
                initial={{ opacity: 0, x: index % 2 ? 18 : -18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: .35 + index * .09 }}
              >{text}</motion.button>
            ))}
            <motion.div className="signal-core" animate={{ scale: [1, 1.035, 1] }} transition={{ duration: 3, repeat: Infinity }}>
              <small>读者主题</small><strong>参与流程不清晰</strong><em>5 条证据</em>
            </motion.div>
            <i className="orbit orbit-a" /><i className="orbit orbit-b" />
          </div>
          <AnimatePresence mode="wait">
            <motion.p className="signal-evidence-note" key={activeEvidence} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
              原话 #{String(activeEvidence + 1).padStart(2, "0")} · 已归入“参与流程不清晰”，点击中心主题可继续审阅
            </motion.p>
          </AnimatePresence>
          <div className="signal-result"><span><i />证据已关联</span><strong>可信度 0.86</strong></div>
        </motion.div>
      </section>
      <section className="method-section" id="method">
        <div className="method-intro">
          <span className="index-no">NOT ANOTHER WRITING BOT</span>
          <h2>不是替你写，<br />而是帮你判断写什么</h2>
          <p>普通写作工具从提示词开始。这里从读者证据开始，先看清问题，再形成选题。</p>
        </div>
        <div className="method-flow" aria-label="产品方法">
          {[
            ["输入", "收集文章与公开评论", "保留来源、原文和时间信息"],
            ["判断", "发现重复出现的问题", "机器聚类，人来确认或驳回"],
            ["输出", "形成有证据的内容 Brief", "标题、受众和提纲均可追溯"],
          ].map(([label, title, detail], index) => (
            <article key={label}>
              <span><i>{index + 1}</i>{label}</span><h3>{title}</h3><p>{detail}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="agent-section" id="agents">
        <div className="section-lead">
          <span className="index-no">HUMAN-IN-THE-LOOP / 人机协作</span>
          <h2>四个 Agent，一次可审阅的研究</h2>
          <p>每个 Agent 只负责一个明确任务。运行过程、使用模型和证据均可查看，关键结论必须经过人工确认。</p>
        </div>
        <div className="agent-console">
          <div className="agent-rail">
            {[
              [FileSearch, "采集 Agent", "来源与正文", "completed"],
              [Database, "整理 Agent", "去重与隐私", "completed"],
              [BrainCircuit, "洞察 Agent", "语义聚类", "running"],
              [ClipboardCheck, "核查 Agent", "证据覆盖", "queued"],
            ].map(([Icon, title, detail, status], index) => {
              const AgentIcon = Icon as typeof Database;
              return <article className={clsx("agent-node", status)} key={title as string}>
                <span className="agent-icon"><AgentIcon /></span>
                <div><small>0{index + 1}</small><strong>{title as string}</strong><p>{detail as string}</p></div>
                <em>{status === "completed" ? "完成" : status === "running" ? "运行中" : "等待"}</em>
              </article>;
            })}
          </div>
          <div className="agent-trace">
            <div className="trace-head"><span>RUN / 2026-07-28-001</span><b><i />本地执行</b></div>
            <div className="trace-stage">
              <span>洞察 Agent 正在工作</span>
              <h3>把 8 条评论整理成候选主题</h3>
              <div className="trace-code">
                <p><em>MODEL</em><strong>bge-small-zh-v1.5</strong></p>
                <p><em>METHOD</em><strong>Embedding + K-Means</strong></p>
                <p><em>INPUT</em><strong>8 条可分析评论</strong></p>
              </div>
              <div className="trace-progress"><motion.i animate={{ width: ["42%", "74%", "61%"] }} transition={{ duration: 4, repeat: Infinity }} /></div>
              <p className="trace-note">AI 只生成候选主题，不自动替代编辑判断</p>
            </div>
          </div>
        </div>
      </section>
      <section className="proof-case" aria-labelledby="proof-case-title">
        <div className="proof-case-copy">
          <span className="index-no">REAL CASE / 真实案例</span>
          <h2 id="proof-case-title">从 8 条原话到 1 份内容方案</h2>
          <p>示例不是模型凭空生成的答案。每个主题都保留评论编号，编辑可以逐条返回原文确认。</p>
          <div className="proof-metrics">
            <div><strong>8</strong><span>条公开评论</span></div>
            <div><strong>3</strong><span>个候选主题</span></div>
            <div><strong>5</strong><span>条证据关联</span></div>
            <div><strong>1</strong><span>份内容 Brief</span></div>
          </div>
        </div>
        <div className="proof-chain" aria-label="证据回查示例">
          <div className="proof-question">
            <small>READER VOICE / C-002</small>
            <blockquote>“报名入口在哪里？”</blockquote>
          </div>
          <div className="proof-link"><i /><span>语义关联 0.91</span><i /></div>
          <div className="proof-result">
            <small>CONFIRMED THEME / T-01</small>
            <h3>参与流程不清晰</h3>
            <p>选题建议：用一篇指南集中解释报名时间、入口和所需材料。</p>
            <span><ShieldCheck />已关联 5 条原话</span>
          </div>
        </div>
      </section>
      <section className="guide-section" id="guide">
        <div className="section-lead">
          <span className="index-no">QUICK START / 使用指南</span>
          <h2>五分钟完成第一次研究</h2>
          <p>不配置付费 API 也能体验完整流程。示例数据和规则基线开箱即用，本地模型属于可选增强。</p>
        </div>
        <div className="guide-grid">
          {[
            [Link2, "导入资料", "粘贴公开链接、评论，或上传 CSV / XLSX。"],
            [Bot, "运行 Agent", "清洗、聚类、核查依次执行，过程不再是黑箱。"],
            [Check, "人工审阅", "确认、驳回、合并或拆分 AI 提出的候选主题。"],
            [Download, "导出方案", "生成附带评论证据和风险提示的内容 Brief。"],
          ].map(([Icon, title, copy], index) => {
            const GuideIcon = Icon as typeof Database;
            return <article key={title as string}><span>0{index + 1}</span><GuideIcon /><h3>{title as string}</h3><p>{copy as string}</p></article>;
          })}
        </div>
        <div className="guide-cta">
          <div><Play /><span><strong>无需模型配置</strong><small>使用内置示例先走通整个研究流程</small></span></div>
          <button className="button primary" onClick={() => projects[0] ? onOpen(projects[0].id) : setCreating(true)}>开始体验 <ArrowRight /></button>
        </div>
      </section>
      <section className="architecture-section" aria-labelledby="architecture-title">
        <div className="architecture-head">
          <div className="section-lead">
            <span className="index-no">SYSTEM / 技术路径</span>
            <h2 id="architecture-title">每个结论如何回到原话</h2>
            <p>不是输入一句话直接获得答案，而是一条可以检查、回退和复现的研究链路。</p>
          </div>
          <dl className="architecture-principles" aria-label="系统设计原则">
            <div><dt>TRACEABLE</dt><dd>原话可回查</dd></div>
            <div><dt>REVERSIBLE</dt><dd>判断可回退</dd></div>
            <div><dt>REPRODUCIBLE</dt><dd>过程可复现</dd></div>
          </dl>
        </div>
        <div className="architecture-flow">
          {[
            [Database, "资料层", "文章、评论、表格"],
            [Bot, "处理层", "清洗、脱敏、去重"],
            [BrainCircuit, "分析层", "Embedding、聚类"],
            [ClipboardCheck, "判断层", "人工确认、证据核查"],
            [BookOpenText, "输出层", "有证据的 Brief"],
          ].map(([Icon, title, detail], index) => {
            const FlowIcon = Icon as typeof Database;
            return <article key={title as string}><span>{String(index + 1).padStart(2, "0")}</span><FlowIcon /><strong>{title as string}</strong><small>{detail as string}</small></article>;
          })}
        </div>
      </section>
      <section className="trust-section">
        <div><LockKeyhole /><span><small>PRIVATE BY DEFAULT</small><strong>数据默认留在本机</strong></span></div>
        <div><Cpu /><span><small>LOCAL MODEL READY</small><strong>支持 Ollama 与 Qwen</strong></span></div>
        <div><ShieldCheck /><span><small>EVIDENCE FIRST</small><strong>结论必须返回原话</strong></span></div>
      </section>
      <section className="project-index">
        <div className="section-heading">
          <div><span className="index-no">INDEX / 研究档案</span><h2>继续一项真实研究</h2></div>
          <div className="section-actions">
            <button className="button secondary" disabled={demoLoading} onClick={loadDemo}>
              {demoLoading ? <LoaderCircle className="spin" /> : <Play />}加载完整示例
            </button>
            <button className="button secondary" onClick={() => setManaging(true)}>项目管理</button>
            <button className="button primary" onClick={() => setCreating(true)}><Plus />新建研究</button>
          </div>
        </div>
        {loading && <LoadingState label="正在读取本地研究档案" />}
        {error && <ErrorState title="无法连接本地服务" detail="请启动 FastAPI 后端，再刷新页面。" />}
        {!loading && !error && projects.length === 0 && (
          <EmptyState title="还没有研究项目" detail="通过 API 创建项目后，它会出现在这里。" />
        )}
        <div className="project-grid">
          {projects.map((project, index) => (
            <article className="project-card" key={project.id}>
              <div className="project-card-top">
                <span>CASE {String(index + 1).padStart(2, "0")}</span>
                <div className="project-card-controls">
                  <StageBadge stage={project.stage} />
                  <button className="icon-button compact" aria-label={`项目操作：${project.name}`} onClick={() => setProjectMenu(projectMenu === project.id ? null : project.id)}><MoreHorizontal /></button>
                  {projectMenu === project.id && (
                    <div className="project-menu">
                      <button onClick={() => changeLifecycle(project.id, "archive")}><Archive />归档研究</button>
                      <button className="danger" onClick={() => changeLifecycle(project.id, "trash")}><Trash2 />移入回收站</button>
                    </div>
                  )}
                </div>
              </div>
              <h3>{project.name}</h3>
              <p>{project.goal}</p>
              <div className="project-card-foot">
                <span>{project.comment_count ?? "—"} 条评论</span>
                <button className="text-action" onClick={() => onOpen(project.id)}>打开研究 <ArrowRight /></button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <footer className="home-footer">
        <div className="footer-brand"><Brand /><p>让内容判断回到真实证据</p><span><i />本地运行 · 数据默认不离开设备</span></div>
        <div className="author-card"><span>作者 / 张作朋</span><strong>AI 应用与内容运营</strong><a href="mailto:a2740637809@gmail.com"><Mail />联系作者 · a2740637809@gmail.com</a></div>
        <div className="footer-stack"><span>PROJECT STACK</span><strong>React + FastAPI</strong><small>Embedding · K-Means · Ollama</small><em>Apache 2.0</em></div>
        <nav className="footer-links" aria-label="页脚导航"><a href="#guide">使用指南</a><a href="#agents">Agent 工作流</a><a href="https://github.com/a2740637809-rgb" target="_blank" rel="noreferrer">查看 GitHub <ArrowRight /></a></nav>
        <div className="footer-bottom"><span>CONTENT INTELLIGENCE LAB</span><span>Evidence before generation</span><span>© 2026 张作朋</span></div>
      </footer>
      {creating && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setCreating(false)}>
          <section className="tool-modal" role="dialog" aria-modal="true" aria-labelledby="create-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div><span>NEW RESEARCH DOSSIER</span><h2 id="create-title">新建内容研究</h2></div>
              <button className="icon-button" aria-label="关闭" onClick={() => setCreating(false)}><X /></button>
            </div>
            <label htmlFor="project-name">研究名称</label>
            <input id="project-name" name="project_name" autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：端午报道评论研究…" />
            <label htmlFor="project-goal">这次要解决的问题</label>
            <input id="project-goal" name="project_goal" autoComplete="off" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="例如：找到读者最需要解释的问题…" />
            <p className="modal-note">先写清楚问题，再导入文章与评论。项目数据只保存在本机。</p>
            <div className="modal-actions">
              <button className="button secondary" onClick={() => setCreating(false)}>取消</button>
              <button className="button primary" disabled={saving || !name.trim() || !goal.trim()} onClick={saveProject}>{saving ? <LoaderCircle className="spin" /> : <Plus />}创建并开始</button>
            </div>
          </section>
        </div>
      )}
      {managing && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setManaging(false)}>
          <section className="tool-modal project-manager" role="dialog" aria-modal="true" aria-labelledby="manager-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div><span>PROJECT LIFECYCLE</span><h2 id="manager-title">项目管理</h2></div>
              <button className="icon-button" aria-label="关闭" onClick={() => setManaging(false)}><X /></button>
            </div>
            <div className="manager-section">
              <h3><Archive />已归档 <span>{archived.data?.items.length ?? 0}</span></h3>
              {(archived.data?.items ?? []).map((project) => (
                <article key={project.id}><div><strong>{project.name}</strong><small>{project.goal}</small></div><button className="text-action" onClick={() => changeLifecycle(project.id, "restore")}><RotateCcw />恢复</button></article>
              ))}
              {!archived.isLoading && !archived.data?.items.length && <p>没有已归档项目</p>}
            </div>
            <div className="manager-section danger-zone">
              <h3><Trash2 />回收站 <span>{trashed.data?.items.length ?? 0}</span></h3>
              {(trashed.data?.items ?? []).map((project) => (
                <article key={project.id}><div><strong>{project.name}</strong><small>{project.goal}</small></div><span><button className="text-action" onClick={() => changeLifecycle(project.id, "restore")}><RotateCcw />恢复</button><button className="text-action danger" onClick={() => deleteForever(project)}><Trash2 />永久删除</button></span></article>
              ))}
              {!trashed.isLoading && !trashed.data?.items.length && <p>回收站为空</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function WorkspaceRail({
  view, onView, onHome, open,
}: { view: WorkspaceView; onView: (view: WorkspaceView) => void; onHome: () => void; open: boolean }) {
  return (
    <>
      {open && <button className="rail-scrim" onClick={() => onView(view)} aria-label="关闭导航" />}
      <aside className={clsx("workspace-rail", open && "open")}>
        <div className="rail-top">
          <Brand />
          <button className="rail-close" onClick={() => onView(view)} aria-label="关闭导航"><X /></button>
        </div>
        <button className="back-home" onClick={onHome}><ArrowLeft />全部研究</button>
        <nav aria-label="研究流程">
          {(Object.entries(viewMeta) as [WorkspaceView, typeof viewMeta.overview][]).map(([key, meta], index) => {
            const Icon = meta.icon;
            return (
              <button key={key} className={clsx(view === key && "active")} onClick={() => onView(key)}>
                <span className="nav-index">{String(index + 1).padStart(2, "0")}</span><Icon /><b>{meta.label}</b><ChevronRight className="nav-arrow" />
              </button>
            );
          })}
        </nav>
        <div className="rail-status"><i /><div><strong>本地工作区</strong><span>SQLite · Ollama · Private</span></div></div>
      </aside>
    </>
  );
}

function Workspace({ projectId, view, onView }: { projectId: number; view: WorkspaceView; onView: (view: WorkspaceView) => void }) {
  const project = useQuery({ queryKey: ["project", projectId], queryFn: () => api<Project>(`/v2/projects/${projectId}`) });
  const comments = useQuery({ queryKey: ["comments", projectId], queryFn: () => api<{ items: Comment[]; total: number }>(`/v2/projects/${projectId}/comments`) });
  const themes = useQuery({ queryKey: ["themes", projectId], queryFn: () => api<{ items: Theme[] }>(`/v2/projects/${projectId}/themes`) });
  const briefs = useQuery({ queryKey: ["briefs", projectId], queryFn: () => api<{ items: Brief[] }>(`/v2/projects/${projectId}/briefs`) });
  const [localThemes, setLocalThemes] = useState<Theme[]>([]);
  const [activeBrief, setActiveBrief] = useState<Brief | null>(null);

  useEffect(() => { if (themes.data) setLocalThemes(themes.data.items); }, [themes.data]);
  useEffect(() => { if (briefs.data?.items[0]) setActiveBrief(briefs.data.items[0]); }, [briefs.data]);

  if (project.isLoading) return <LoadingState label="正在打开研究档案" />;
  if (!project.data) return <ErrorState title="研究项目不存在" detail="返回项目首页后重新选择。" />;
  const data = project.data;

  const common = { project: data, comments: comments.data?.items ?? [], themes: localThemes };
  return (
    <>
      {view === "overview" && <OverviewPage {...common} onView={onView} />}
      {view === "import" && <ImportPage project={data} onDone={() => { queryClient.invalidateQueries({ queryKey: ["comments", projectId] }); onView("data"); }} />}
      {view === "data" && <DataPage {...common} onView={onView} />}
      {view === "runs" && <RunTracePage project={data} />}
      {view === "benchmark" && <BenchmarkPage project={data} />}
      {view === "models" && <ModelCenterPage project={data} />}
      {view === "review" && (
        <ReviewPage
          {...common}
          onThemes={setLocalThemes}
          onBrief={(brief) => {
            queryClient.setQueryData(["briefs", projectId], { items: [brief] });
            setActiveBrief(brief);
            onView("brief");
          }}
        />
      )}
      {view === "brief" && <BriefPage project={data} comments={common.comments} brief={activeBrief ?? briefs.data?.items[0] ?? null} />}
    </>
  );
}

function PageHeader({ project, eyebrow, title, actions }: { project: Project; eyebrow: string; title: string; actions?: React.ReactNode }) {
  return (
    <header className="page-header">
      <div><span className="page-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{project.name} · {project.goal}</p></div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

function OverviewPage({ project, comments, themes, onView }: { project: Project; comments: Comment[]; themes: Theme[]; onView: (view: WorkspaceView) => void }) {
  const included = comments.filter((item) => item.status === "included").length;
  const confirmed = themes.filter((item) => item.status === "confirmed").length;
  return (
    <div className="page-wrap">
      <PageHeader project={project} eyebrow="RESEARCH DOSSIER / 研究档案" title="今天需要做出的编辑判断" />
      <section className="decision-banner">
        <div><span>当前任务</span><h2>{project.goal}</h2></div>
        <button className="button primary" onClick={() => onView(comments.length ? "review" : "import")}>{comments.length ? "继续审阅洞察" : "开始导入资料"}<ArrowRight /></button>
      </section>
      <section className="metric-strip">
        <div><span>原始评论</span><strong>{comments.length}</strong><small>所有导入记录</small></div>
        <div><span>可分析</span><strong>{included}</strong><small>排除重复与噪声后</small></div>
        <div><span>候选主题</span><strong>{themes.length}</strong><small>AI 提议，等待判断</small></div>
        <div><span>已确认</span><strong>{confirmed}</strong><small>可进入内容 Brief</small></div>
      </section>
      <section className="process-board">
        <div className="section-heading"><div><span className="index-no">WORKFLOW / 工作流</span><h2>每一步都留下证据</h2></div></div>
        {(["import", "data", "review", "brief"] as WorkspaceView[]).map((step, index) => {
          const meta = viewMeta[step]; const Icon = meta.icon;
          const done = index === 0 ? comments.length > 0 : index === 1 ? included > 0 : index === 2 ? confirmed > 0 : false;
          return (
            <button className="process-row" key={step} onClick={() => onView(step)}>
              <span className="process-index">{String(index + 1).padStart(2, "0")}</span><Icon />
              <div><strong>{meta.label}</strong><small>{["获得正文与公开评论", "核对去重、脱敏和排除结果", "确认、合并或拆分候选主题", "生成并导出写作方案"][index]}</small></div>
              <span className={clsx("process-state", done && "done")}>{done ? <><Check />已完成</> : "待处理"}</span><ChevronRight />
            </button>
          );
        })}
      </section>
    </div>
  );
}

function RunTracePage({ project }: { project: Project }) {
  const runs = useQuery({
    queryKey: ["analysis-runs", project.id],
    queryFn: () => api<{ items: AnalysisRun[] }>(`/v2/projects/${project.id}/analysis-runs`),
  });
  const runAnalysis = useMutation({
    mutationFn: () => analyzeProject(project.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["analysis-runs", project.id] });
      await queryClient.invalidateQueries({ queryKey: ["benchmark", project.id] });
    },
  });
  const run = runs.data?.items[0];
  return (
    <div className="page-wrap">
      <PageHeader project={project} eyebrow="AGENT TRACE / 运行轨迹" title="AI 如何得出这些主题" />
      {runs.isLoading && <LoadingState label="正在读取 Agent 运行记录" />}
      {!runs.isLoading && !run && (
        <EmptyState
          title="还没有运行记录"
          detail="先导入评论，再运行分析；系统会保存每个 Agent 的输入、结果和评测指标。"
          actions={<button className="button primary" disabled={runAnalysis.isPending} onClick={() => runAnalysis.mutate()}>{runAnalysis.isPending ? <LoaderCircle className="spin" /> : <Play />}运行当前分析</button>}
        />
      )}
      {run && (
        <>
          <section className="run-summary">
            <div><span>运行编号</span><strong>RUN-{String(run.id).padStart(4, "0")}</strong></div>
            <div><span>分析模型</span><strong>{run.model}</strong></div>
            <div><span>聚类方法</span><strong>{run.method}</strong></div>
            <div><span>人工状态</span><strong>{run.human_gate.pending ? "等待人工确认" : "审阅完成"}</strong></div>
          </section>
          <section className="run-layout">
            <div className="run-timeline">
              {run.steps.map((step, index) => (
                <article key={step.key}>
                  <span className={clsx("run-dot", step.status)}>{index + 1}</span>
                  <div><small>{step.label}</small><h3>{["获取研究资料", "清洗与隐私检查", "生成候选主题", "检查证据覆盖"][index]}</h3>
                    <dl>{Object.entries(step.metrics).map(([key, value]) => <div key={key}><dt>{metricLabel(key)}</dt><dd>{formatMetric(key, value)}</dd></div>)}</dl>
                  </div>
                  <em>{step.status === "completed" ? "已完成" : step.status === "attention" ? "需关注" : step.status}</em>
                </article>
              ))}
            </div>
            <aside className="evaluation-panel">
              <span>QUALITY GATE / 质量门槛</span>
              <h2>这次分析能否进入编辑审阅？</h2>
              <div className="coverage-ring" style={{ "--coverage": `${run.metrics.evidence_coverage * 100}%` } as React.CSSProperties}>
                <strong>{Math.round(run.metrics.evidence_coverage * 100)}%</strong><small>证据覆盖率</small>
              </div>
              <dl>
                <div><dt>可分析评论</dt><dd>{run.metrics.included}</dd></div>
                <div><dt>候选主题</dt><dd>{run.metrics.themes}</dd></div>
                <div><dt>人工确认率</dt><dd>{Math.round(run.metrics.human_confirmation_rate * 100)}%</dd></div>
              </dl>
              <p><ShieldCheck />系统只检查主题是否有原话支持，不能替代事实核验和最终编辑判断。</p>
            </aside>
          </section>
        </>
      )}
    </div>
  );
}

function ModelCenterPage({ project }: { project: Project }) {
  const [result, setResult] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", provider: "ollama", base_url: "http://127.0.0.1:11434",
    model: "", embedding_model: "", secret_env: "",
  });
  const profiles = useQuery({
    queryKey: ["model-profiles"],
    queryFn: () => api<{ items: ModelProfile[] }>("/v2/model-profiles"),
  });
  const testConnection = async (id: number) => {
    setResult("正在测试连接…");
    const response = await api<{ ok: boolean; message: string; models: string[] }>(`/v2/model-profiles/${id}/test`, { method: "POST" });
    setResult(`${response.message}${response.models.length ? ` · ${response.models.slice(0, 3).join("、")}` : ""}`);
  };
  const saveProfile = async () => {
    await api("/v2/model-profiles", {
      method: "POST",
      body: JSON.stringify({ ...form, enabled: true }),
    });
    setShowForm(false);
    await queryClient.invalidateQueries({ queryKey: ["model-profiles"] });
  };
  return (
    <div className="page-wrap">
      <PageHeader project={project} eyebrow="MODEL CENTER / 模型中心" title="选择谁来完成分析" actions={<button className="button primary" onClick={() => setShowForm((value) => !value)}><Plus />接入模型</button>} />
      <section className="model-intro">
        <div><LockKeyhole /><strong>密钥不进入浏览器</strong><span>只填写环境变量名称，真实密钥由后端读取</span></div>
        <p>支持内置规则、Ollama 与 OpenAI 兼容接口。DeepSeek、OpenRouter 和多数自建网关都可通过兼容接口接入。</p>
      </section>
      {showForm && (
        <section className="model-form">
          <label>配置名称<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：本地 Qwen…" /></label>
          <label>服务类型<select value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value, base_url: event.target.value === "ollama" ? "http://127.0.0.1:11434" : "" })}><option value="ollama">Ollama</option><option value="openai_compatible">OpenAI 兼容接口</option></select></label>
          <label>服务地址<input type="url" value={form.base_url} onChange={(event) => setForm({ ...form, base_url: event.target.value })} placeholder="https://api.example.com/v1…" /></label>
          <label>模型名称<input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder="例如：qwen2.5:7b…" /></label>
          <label>密钥环境变量<input value={form.secret_env} onChange={(event) => setForm({ ...form, secret_env: event.target.value.toUpperCase() })} placeholder="CONTENT_LAB_API_KEY…" /></label>
          <button className="button primary" disabled={!form.name || !form.base_url} onClick={saveProfile}>保存配置</button>
        </section>
      )}
      <section className="model-grid">
        {(profiles.data?.items ?? []).map((profile) => (
          <article key={profile.id}>
            <header><span>{profile.provider.replace("_", " ")}</span><em className={profile.enabled ? "online" : ""}>{profile.enabled ? "已启用" : "已停用"}</em></header>
            <h2>{profile.name}</h2>
            <dl><div><dt>生成模型</dt><dd>{profile.model || "自动发现"}</dd></div><div><dt>Embedding</dt><dd>{profile.embedding_model || "沿用默认"}</dd></div><div><dt>密钥</dt><dd>{profile.secret_configured ? "已配置" : profile.secret_env ? "等待环境变量" : "无需密钥"}</dd></div></dl>
            <button className="button secondary" onClick={() => testConnection(profile.id)}>测试连接</button>
          </article>
        ))}
      </section>
      {result && <p className="connection-result" aria-live="polite">{result}</p>}
    </div>
  );
}

function BenchmarkPage({ project }: { project: Project }) {
  const benchmark = useQuery({
    queryKey: ["benchmark", project.id],
    queryFn: () => api<Benchmark>(`/v2/projects/${project.id}/benchmark`),
  });
  const runAnalysis = useMutation({
    mutationFn: () => analyzeProject(project.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["analysis-runs", project.id] });
      await queryClient.invalidateQueries({ queryKey: ["benchmark", project.id] });
    },
  });
  const strategies = Object.entries(benchmark.data?.strategies ?? {});

  return (
    <div className="page-wrap">
      <PageHeader project={project} eyebrow="METHOD BENCHMARK / 方案对比" title="哪种分析方法更值得采用" />
      {benchmark.isLoading && <LoadingState label="正在用当前项目数据计算对比结果" />}
      {benchmark.data?.sample_size === 0 && (
        <EmptyState
          title="还没有可对比的样本"
          detail="导入评论并运行一次分析后，这里会把关键词基线与语义分析方案放在同一组真实数据上比较。"
          actions={<button className="button primary" disabled={runAnalysis.isPending} onClick={() => runAnalysis.mutate()}>{runAnalysis.isPending ? <LoaderCircle className="spin" /> : <Play />}生成对比结果</button>}
        />
      )}
      {benchmark.data && benchmark.data.sample_size > 0 && (
        <>
          <section className="benchmark-intro">
            <div>
              <span>OBSERVED SAMPLE</span>
              <strong>{benchmark.data.sample_size}</strong>
              <small>条当前项目评论</small>
            </div>
            <p>同一批数据分别经过简单关键词归类和当前语义分析流程，比较主题发现、证据覆盖与人工确认情况。</p>
          </section>
          <section className="benchmark-grid">
            {strategies.map(([key, strategy], index) => (
              <article className={clsx("benchmark-card", index === strategies.length - 1 && "featured")} key={key}>
                <header>
                  <span>{index === 0 ? "BASELINE / 基线" : "CURRENT / 当前方案"}</span>
                  {index === strategies.length - 1 && <em>当前采用</em>}
                </header>
                <h2>{strategy.label}</h2>
                <p>{strategy.model ? `模型：${strategy.model}` : "不调用语义模型，仅按关键词匹配"}</p>
                <dl>
                  <div><dt>发现主题</dt><dd>{strategy.themes}</dd></div>
                  <div><dt>证据覆盖率</dt><dd>{Math.round(strategy.evidence_coverage * 100)}%</dd></div>
                  <div><dt>人工确认率</dt><dd>{Math.round(strategy.human_confirmation_rate * 100)}%</dd></div>
                </dl>
                <div className="benchmark-bar">
                  <i style={{ width: `${strategy.evidence_coverage * 100}%` }} />
                </div>
              </article>
            ))}
          </section>
          <aside className="benchmark-note"><CircleAlert />{benchmark.data.note}</aside>
        </>
      )}
    </div>
  );
}

function metricLabel(key: string) {
  return ({ received: "收到记录", included: "可分析", excluded: "已排除", themes: "主题", evidence_links: "证据关联", evidence_coverage: "证据覆盖率" } as Record<string, string>)[key] ?? key;
}

function formatMetric(key: string, value: number) {
  return key.includes("coverage") ? `${Math.round(value * 100)}%` : value;
}

function ImportPage({ project, onDone }: { project: Project; onDone: () => void }) {
  const [mode, setMode] = useState<"web" | "paste" | "file">("web");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [receipt, setReceipt] = useState<{ article_status: string; comments_status: string; created: number; duplicates: number; warnings: string[] } | null>(null);
  const [error, setError] = useState("");
  const webMutation = useMutation({ mutationFn: () => importWeb(project.id, url), onSuccess: setReceipt, onError: (e) => setError(String(e)) });
  const manualMutation = useMutation({ mutationFn: () => importManual(project.id, text.split(/\r?\n/).filter(Boolean)), onSuccess: setReceipt, onError: (e) => setError(String(e)) });
  const fileMutation = useMutation({ mutationFn: (file: File) => importSpreadsheet(project.id, file), onSuccess: setReceipt, onError: (e) => setError(String(e)) });
  const dropzone = useDropzone({ accept: { "text/csv": [".csv"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] }, maxFiles: 1, onDropAccepted: ([file]) => fileMutation.mutate(file) });
  const busy = webMutation.isPending || manualMutation.isPending || fileMutation.isPending;
  return (
    <div className="page-wrap">
      <PageHeader project={project} eyebrow="SOURCE INTAKE / 来源导入" title="先确认拿到了什么，再开始分析" />
      <div className="import-layout">
        <section className="import-studio">
          <div className="mode-switch" role="tablist">
            <button className={clsx(mode === "web" && "active")} onClick={() => setMode("web")}><Link2 />公开链接</button>
            <button className={clsx(mode === "paste" && "active")} onClick={() => setMode("paste")}><FileText />粘贴评论</button>
            <button className={clsx(mode === "file" && "active")} onClick={() => setMode("file")}><Upload />表格上传</button>
          </div>
          {mode === "web" && <div className="import-form"><label>公开文章链接<input name="source_url" type="url" autoComplete="off" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/article…" /></label><p>系统分别报告正文和评论状态；无法访问的评论不会被伪装为成功。</p><button className="button primary" disabled={!url || busy} onClick={() => webMutation.mutate()}>{busy ? <LoaderCircle className="spin" /> : <Search />}提取公开内容</button></div>}
          {mode === "paste" && <div className="import-form"><label>每行一条评论<textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={"什么时候可以报名？\n报名入口在哪里？\n老人可以参加吗？"} /></label><button className="button primary" disabled={!text.trim() || busy} onClick={() => manualMutation.mutate()}>{busy ? <LoaderCircle className="spin" /> : <Plus />}导入评论</button></div>}
          {mode === "file" && <div {...dropzone.getRootProps()} className={clsx("dropzone", dropzone.isDragActive && "active")}><input {...dropzone.getInputProps()} /><Upload /><h3>拖入 CSV 或 XLSX</h3><p>文件不超过 10MB，评论列命名为“评论”或“comment”。</p><button className="button secondary" type="button">选择文件</button></div>}
          {error && <div className="inline-error"><CircleAlert />{error}</div>}
        </section>
        <aside className="source-receipt">
          <span className="receipt-label">SOURCE RECEIPT / 来源回执</span>
          {!receipt ? <div className="receipt-empty"><FileSearch /><p>完成一次导入后，这里会分别显示正文、评论、重复项和警告。</p></div> : (
            <>
              <div className="receipt-status"><span>正文</span><b className={receipt.article_status === "success" || receipt.article_status === "provided" ? "success" : ""}>{statusText(receipt.article_status)}</b></div>
              <div className="receipt-status"><span>评论</span><b className={receipt.comments_status === "success" ? "success" : "warning"}>{statusText(receipt.comments_status)}</b></div>
              <div className="receipt-counts"><div><strong>{receipt.created}</strong><span>新增评论</span></div><div><strong>{receipt.duplicates}</strong><span>重复跳过</span></div></div>
              {receipt.warnings.map((warning) => <p className="receipt-warning" key={warning}><CircleAlert />{warning}</p>)}
              <button className="button primary full" onClick={onDone}>检查导入数据<ArrowRight /></button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function DataPage({ project, comments, onView }: { project: Project; comments: Comment[]; themes: Theme[]; onView: (view: WorkspaceView) => void }) {
  const [filter, setFilter] = useState<"all" | "included" | "excluded">("all");
  const visible = useMemo(
    () => comments.filter((item) => filter === "all" || item.status === filter),
    [comments, filter],
  );
  const column = createColumnHelper<Comment>();
  const columns = useMemo(() => [
    column.accessor("id", { header: "编号", cell: (info) => `C-${String(info.getValue()).padStart(3, "0")}` }),
    column.accessor("raw_text", { header: "原始评论", cell: (info) => <span className="comment-cell">{info.getValue()}</span> }),
    column.accessor("cleaned_text", { header: "清洗结果" }),
    column.accessor("status", { header: "状态", cell: (info) => <StatusPill status={info.getValue()} /> }),
    column.display({
      id: "actions",
      header: "操作",
      cell: ({ row }) => row.original.status === "excluded"
        ? <button className="table-action" onClick={async () => { await api(`/v2/comments/${row.original.id}/restore`, { method: "POST" }); await queryClient.invalidateQueries({ queryKey: ["comments", project.id] }); }}>恢复分析</button>
        : <span className="table-muted">已纳入</span>,
    }),
  ], [project.id]);
  const table = useReactTable({ data: visible, columns, getCoreRowModel: getCoreRowModel() });
  return (
    <div className="page-wrap wide">
      <PageHeader project={project} eyebrow="DATA REVIEW / 数据检查" title="被排除的内容，仍然可以找回来" actions={<button className="button primary" disabled={!comments.some((item) => item.status === "included")} onClick={() => onView("review")}>进入洞察审阅<ArrowRight /></button>} />
      <div className="data-toolbar">
        <div className="segmented">{(["all", "included", "excluded"] as const).map((key) => <button key={key} className={clsx(filter === key && "active")} onClick={() => setFilter(key)}>{key === "all" ? "全部" : key === "included" ? "可分析" : "待排除"} <span>{comments.filter((item) => key === "all" || item.status === key).length}</span></button>)}</div>
        <span className="data-note"><ShieldCheck />原始文本与清洗文本分开保存</span>
      </div>
      <div className="table-shell">
        <table>
          <thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead>
          <tbody>{table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
        </table>
        {!visible.length && <EmptyState title="这个筛选下没有评论" detail="切换筛选条件查看其他记录。" />}
      </div>
    </div>
  );
}

function ReviewPage({
  project, comments, themes, onThemes, onBrief,
}: { project: Project; comments: Comment[]; themes: Theme[]; onThemes: (themes: Theme[]) => void; onBrief: (brief: Brief) => void }) {
  const [selectedId, setSelectedId] = useState(themes[0]?.id ?? 0);
  const [tool, setTool] = useState<"merge" | "split" | null>(null);
  const [toolName, setToolName] = useState("");
  const [mergeTarget, setMergeTarget] = useState(0);
  const [splitComments, setSplitComments] = useState<number[]>([]);
  const selected = themes.find((item) => item.id === selectedId) ?? themes[0];
  const [busy, setBusy] = useState(false);
  const selectedComments = selected ? comments.filter((item) => selected.comment_ids.includes(item.id)) : [];
  const updateTheme = async (status: "confirmed" | "rejected") => {
    if (!selected) return;
    setBusy(true);
    try {
      const updated = await api<Theme>(`/v2/themes/${selected.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      onThemes(themes.map((item) => item.id === updated.id ? updated : item));
    } finally { setBusy(false); }
  };
  const run = async () => {
    setBusy(true);
    try {
      const result = await analyzeProject(project.id);
      onThemes(result.themes);
      setSelectedId(result.themes[0]?.id ?? 0);
    } finally { setBusy(false); }
  };
  const generate = async () => {
    setBusy(true);
    try { onBrief(await createBrief(project.id)); } finally { setBusy(false); }
  };
  const applyTool = async () => {
    if (!selected || !toolName.trim()) return;
    setBusy(true);
    try {
      if (tool === "merge" && mergeTarget) {
        await api<Theme>(`/v2/themes/${selected.id}/merge`, {
          method: "POST",
          body: JSON.stringify({ source_theme_ids: [mergeTarget], name: toolName }),
        });
      }
      if (tool === "split" && splitComments.length) {
        await api<Theme>(`/v2/themes/${selected.id}/split`, {
          method: "POST",
          body: JSON.stringify({ comment_ids: splitComments, name: toolName }),
        });
      }
      const refreshed = await api<{ items: Theme[] }>(`/v2/projects/${project.id}/themes`);
      onThemes(refreshed.items);
      setSelectedId(refreshed.items[0]?.id ?? 0);
      setTool(null);
      setToolName("");
      setMergeTarget(0);
      setSplitComments([]);
    } finally { setBusy(false); }
  };
  const confirmed = themes.filter((item) => item.status === "confirmed").length;
  return (
    <div className="page-wrap review-page">
      <PageHeader project={project} eyebrow="HUMAN REVIEW / 人工审阅" title="AI提出候选，人决定什么值得相信" actions={<button className="button primary" disabled={!confirmed || busy} onClick={generate}>{busy ? <LoaderCircle className="spin" /> : <Sparkles />}生成内容 Brief</button>} />
      {!themes.length ? (
        <section className="analysis-launch"><Sparkles /><span>SEMANTIC ANALYSIS</span><h2>用本地语义模型发现读者问题</h2><p>Embedding负责寻找意思相近的评论；模型只负责给主题命名。所有结果都需要人工确认。</p><button className="button primary" disabled={busy} onClick={run}>{busy ? <LoaderCircle className="spin" /> : <Sparkles />}开始语义分析</button></section>
      ) : (
        <div className="review-grid">
          <section className="theme-list">
            <div className="pane-title"><span>候选主题</span><b>{themes.length}</b></div>
            {themes.map((theme) => <button key={theme.id} onClick={() => setSelectedId(theme.id)} className={clsx("theme-card", selected?.id === theme.id && "selected")}><span className="theme-card-top"><StatusPill status={theme.status} /><em>{theme.comment_ids.length} 条</em></span><strong>{theme.name}</strong><small>{theme.summary}</small></button>)}
          </section>
          <section className="evidence-pane">
            <div className="pane-title"><span>原始证据</span><b>{selectedComments.length}</b></div>
            {selectedComments.map((comment) => <article className="evidence-card" key={comment.id}><div><code>C-{String(comment.id).padStart(3, "0")}</code><StatusPill status={comment.status} /></div><p>{comment.raw_text}</p>{comment.cleaned_text !== comment.raw_text && <small>脱敏后：{comment.cleaned_text}</small>}</article>)}
          </section>
          <aside className="theme-inspector">
            {selected && <>
              <span className="inspector-label">EDITORIAL DECISION</span>
              <input className="theme-name-input" name="theme_name" autoComplete="off" aria-label="主题名称" value={selected.name} onChange={(e) => onThemes(themes.map((item) => item.id === selected.id ? { ...item, name: e.target.value } : item))} onBlur={async (event) => { const updated = await api<Theme>(`/v2/themes/${selected.id}`, { method: "PATCH", body: JSON.stringify({ name: event.target.value }) }); onThemes(themes.map((item) => item.id === updated.id ? updated : item)); }} />
              <p>{selected.summary}</p>
              <dl><div><dt>证据覆盖</dt><dd>{selected.comment_ids.length} 条原始评论</dd></div><div><dt>当前状态</dt><dd>{themeStatusText(selected.status)}</dd></div></dl>
              <div className="inspector-actions">
                <button className="button primary full" disabled={busy || selected.status === "confirmed"} onClick={() => updateTheme("confirmed")}><Check />确认主题</button>
                <button className="button secondary full" disabled={busy || selected.status === "rejected"} onClick={() => updateTheme("rejected")}><X />驳回主题</button>
              </div>
              <div className="review-tools">
                <button disabled={themes.length < 2} title={themes.length < 2 ? "至少需要两个主题" : "把其他主题合并到当前主题"} onClick={() => { setTool("merge"); setToolName(selected.name); }}><Database />合并</button>
                <button disabled={selectedComments.length < 2} title={selectedComments.length < 2 ? "至少需要两条评论" : "从当前主题拆出新主题"} onClick={() => { setTool("split"); setToolName("新的子主题"); }}><FileSearch />拆分</button>
                <button title="重新执行语义分析" onClick={run}><RotateCcw />重新分析</button>
              </div>
            </>}
          </aside>
        </div>
      )}
      {tool && selected && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setTool(null)}>
          <section className="tool-modal" role="dialog" aria-modal="true" aria-labelledby="tool-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div><span>EDITORIAL OPERATION</span><h2 id="tool-title">{tool === "merge" ? "合并候选主题" : "拆分证据主题"}</h2></div>
              <button className="icon-button" aria-label="关闭" onClick={() => setTool(null)}><X /></button>
            </div>
            <label htmlFor="tool-name">新主题名称</label>
            <input id="tool-name" name="theme_name" autoComplete="off" value={toolName} onChange={(event) => setToolName(event.target.value)} />
            {tool === "merge" ? (
              <>
                <label htmlFor="merge-target">要并入当前主题的候选</label>
                <select id="merge-target" value={mergeTarget} onChange={(event) => setMergeTarget(Number(event.target.value))}>
                  <option value={0}>选择一个主题…</option>
                  {themes.filter((theme) => theme.id !== selected.id).map((theme) => <option value={theme.id} key={theme.id}>{theme.name}（{theme.comment_ids.length} 条）</option>)}
                </select>
              </>
            ) : (
              <fieldset>
                <legend>选择要拆出的原始评论</legend>
                {selectedComments.map((comment) => (
                  <label className="check-row" key={comment.id}>
                    <input type="checkbox" checked={splitComments.includes(comment.id)} onChange={(event) => setSplitComments(event.target.checked ? [...splitComments, comment.id] : splitComments.filter((id) => id !== comment.id))} />
                    <span><code>C-{String(comment.id).padStart(3, "0")}</code>{comment.raw_text}</span>
                  </label>
                ))}
              </fieldset>
            )}
            <p className="modal-note">操作会写入审阅历史，原始评论不会被删除。</p>
            <div className="modal-actions">
              <button className="button secondary" onClick={() => setTool(null)}>取消</button>
              <button className="button primary" disabled={busy || !toolName.trim() || (tool === "merge" ? !mergeTarget : !splitComments.length)} onClick={applyTool}>{busy ? <LoaderCircle className="spin" /> : <Check />}确认{tool === "merge" ? "合并" : "拆分"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function BriefPage({ project, comments, brief }: { project: Project; comments: Comment[]; brief: Brief | null }) {
  const [draft, setDraft] = useState<Brief | null>(brief);
  useEffect(() => setDraft(brief), [brief]);
  if (!draft) return <div className="page-wrap"><PageHeader project={project} eyebrow="EDITORIAL BRIEF / 内容方案" title="先确认洞察，再生成 Brief" /><EmptyState title="还没有内容 Brief" detail="回到洞察审阅，确认至少一个主题后生成。" /></div>;
  const evidence = comments.filter((item) => draft.evidence_comment_ids.includes(item.id));
  return (
    <div className="page-wrap brief-page">
      <PageHeader project={project} eyebrow={`EDITORIAL BRIEF / VERSION ${draft.version}`} title="把读者问题变成可以开写的方案" actions={<div className="export-actions"><a className="button secondary" href={`${import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api"}/v2/briefs/${draft.id}/export/markdown`}><Download />Markdown</a><a className="button primary" href={`${import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api"}/v2/briefs/${draft.id}/export/docx`}><Download />Word</a></div>} />
      <div className="brief-grid">
        <article className="brief-paper">
          <div className="paper-folio"><span>DRAFT / 待编辑</span><span>{draft.generation_mode === "deterministic_fallback" ? "规则回退生成" : "本地模型生成"}</span></div>
          <label>建议选题<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
          <label>目标读者<textarea value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value })} /></label>
          <label>需要解决的问题<textarea value={draft.problem} onChange={(e) => setDraft({ ...draft, problem: e.target.value })} /></label>
          <label>内容角度<textarea value={draft.angle} onChange={(e) => setDraft({ ...draft, angle: e.target.value })} /></label>
          <section className="outline-block"><span>文章结构</span>{draft.outline.map((item, index) => <div key={`${item}-${index}`}><b>{String(index + 1).padStart(2, "0")}</b><input value={item} onChange={(e) => setDraft({ ...draft, outline: draft.outline.map((value, i) => i === index ? e.target.value : value) })} /></div>)}</section>
          <section className="risk-block"><CircleAlert /><div><strong>发布前风险检查</strong>{draft.risks.map((risk) => <p key={risk}>{risk}</p>)}</div></section>
        </article>
        <aside className="brief-evidence-v2"><div className="pane-title"><span>证据侧栏</span><b>{evidence.length} 条原始评论</b></div>{evidence.map((comment) => <article key={comment.id}><code>C-{String(comment.id).padStart(3, "0")}</code><p>{comment.raw_text}</p></article>)}<div className="evidence-rule"><ShieldCheck /><p><strong>证据边界</strong>评论证明读者提出了什么问题，不能替代事实核验和权威来源。</p></div></aside>
      </div>
    </div>
  );
}

function StageBadge({ stage }: { stage: string }) { return <span className="stage-badge">{({ draft: "草稿", imported: "已导入", review: "待审阅", brief: "已成稿" } as Record<string, string>)[stage] ?? stage}</span>; }
function StatusPill({ status }: { status: string }) { return <span className={clsx("status-pill", status)}>{status === "included" ? "可分析" : status === "excluded" ? "待排除" : themeStatusText(status)}</span>; }
function themeStatusText(status: string) { return status === "confirmed" ? "已确认" : status === "rejected" ? "已驳回" : "待确认"; }
function statusText(status: string) { return ({ success: "成功", provided: "已提供", unavailable: "不可访问", failed: "失败", not_requested: "未请求", not_attempted: "未尝试" } as Record<string, string>)[status] ?? status; }
function LoadingState({ label }: { label: string }) { return <div className="state-card"><LoaderCircle className="spin" /><h3>{label}</h3><p>正在读取本地数据，请稍候。</p></div>; }
function ErrorState({ title, detail }: { title: string; detail: string }) { return <div className="state-card error"><CircleAlert /><h3>{title}</h3><p>{detail}</p></div>; }
function EmptyState({ title, detail, actions }: { title: string; detail: string; actions?: ReactNode }) {
  return <div className="empty-state"><FileText /><h3>{title}</h3><p>{detail}</p>{actions && <div className="empty-actions">{actions}</div>}</div>;
}

export default App;
