import { useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useDropzone } from "react-dropzone";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft, ArrowRight, BookOpenText, Check, ChevronRight, CircleAlert,
  Database, Download, FileSearch, FileText, FolderKanban, Link2, LoaderCircle,
  Menu, Plus, RotateCcw, Search, ShieldCheck, Sparkles, Upload, X,
} from "lucide-react";
import clsx from "clsx";
import {
  analyzeProject, api, createBrief, importManual, importSpreadsheet, importWeb,
  type Brief, type Comment, type Project, type Theme,
} from "./api";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

type WorkspaceView = "overview" | "import" | "data" | "review" | "brief";

const viewMeta: Record<WorkspaceView, { label: string; icon: typeof Database }> = {
  overview: { label: "研究概览", icon: FolderKanban },
  import: { label: "来源导入", icon: Link2 },
  data: { label: "数据检查", icon: Database },
  review: { label: "洞察审阅", icon: FileSearch },
  brief: { label: "内容 Brief", icon: BookOpenText },
};

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
  const saveProject = async () => {
    if (!name.trim() || !goal.trim()) return;
    setSaving(true);
    try {
      const project = await api<Project>("/v2/projects", { method: "POST", body: JSON.stringify({ name, goal }) });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      onOpen(project.id);
    } finally { setSaving(false); }
  };
  return (
    <div className="project-home">
      <header className="home-header">
        <Brand />
        <div className="home-meta"><span>LOCAL-FIRST</span><span>V2 / RESEARCH BUILD</span></div>
      </header>
      <section className="home-hero">
        <div className="hero-copy">
          <span className="kicker"><ShieldCheck />证据优先 · 本地运行</span>
          <h1>从读者原话，<br />到下一篇选题。</h1>
          <p>把公开文章下的零散评论整理成可审阅的读者主题，再生成每条判断都能返回原文的内容方案。</p>
        </div>
        <div className="hero-proof" aria-label="产品工作流">
          <div className="proof-line"><span>输入</span><b>文章与评论</b><em>01</em></div>
          <div className="proof-line active"><span>判断</span><b>语义聚类 + 人工审阅</b><em>02</em></div>
          <div className="proof-line"><span>输出</span><b>有证据的内容 Brief</b><em>03</em></div>
        </div>
      </section>
      <section className="project-index">
        <div className="section-heading">
          <div><span className="index-no">INDEX / 研究档案</span><h2>继续一项真实研究</h2></div>
          <button className="button secondary" onClick={() => setCreating(true)}><Plus />新建研究</button>
        </div>
        {loading && <LoadingState label="正在读取本地研究档案" />}
        {error && <ErrorState title="无法连接本地服务" detail="请启动 FastAPI 后端，再刷新页面。" />}
        {!loading && !error && projects.length === 0 && (
          <EmptyState title="还没有研究项目" detail="通过 API 创建项目后，它会出现在这里。" />
        )}
        <div className="project-grid">
          {projects.map((project, index) => (
            <article className="project-card" key={project.id}>
              <div className="project-card-top"><span>CASE {String(index + 1).padStart(2, "0")}</span><StageBadge stage={project.stage} /></div>
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
      <footer className="home-footer"><span>AI 发现候选，人负责最终判断。</span><span>数据默认不离开设备</span></footer>
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
  const visible = comments.filter((item) => filter === "all" || item.status === filter);
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
function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="empty-state"><FileText /><h3>{title}</h3><p>{detail}</p></div>; }

export default App;
