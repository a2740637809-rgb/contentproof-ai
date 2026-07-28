const project = {
  id: 9001,
  name: "端午报道评论研究",
  goal: "找到读者真正关心、值得继续解释的问题",
  stage: "brief",
  lifecycle: "active",
  comment_count: 8,
  created_at: "2026-06-10T09:00:00Z",
  updated_at: "2026-06-10T09:05:00Z",
};

const comments = [
  "活动什么时候开始报名？",
  "报名入口在哪里，手机上能操作吗？",
  "老人也可以参加吗，需要家属陪同吗？",
  "参加活动需要准备身份证吗？",
  "现场有没有停车的位置？",
  "外地游客能不能报名？",
  "建议把时间、地点和报名方式一次说清楚。",
  "加微信领取福利",
].map((raw_text, index) => ({
  id: index + 1,
  raw_text,
  cleaned_text: raw_text,
  status: index === 7 ? "excluded" : "included",
  exclusion_reasons: index === 7 ? ["疑似推广信息"] : [],
  pii_flags: [],
}));

let themes = [
  { id: 101, name: "参与流程不清晰", summary: "读者集中追问报名时间、入口与所需材料。", status: "confirmed", comment_ids: [1, 2, 4, 6, 7], cluster_label: 0 },
  { id: 102, name: "适用人群与陪同要求", summary: "老人与外地参与者希望确认资格和陪同规则。", status: "confirmed", comment_ids: [3, 6], cluster_label: 1 },
  { id: 103, name: "现场交通信息", summary: "读者需要停车与到场指引。", status: "pending_review", comment_ids: [5], cluster_label: 2 },
];

const run = {
  id: 301,
  status: "completed",
  model: "public-demo/rules-v1",
  method: "TF-IDF + K-Means",
  steps: [
    { key: "collect", label: "采集 Agent", status: "completed", metrics: { received: 8 } },
    { key: "clean", label: "整理 Agent", status: "completed", metrics: { included: 7, excluded: 1 } },
    { key: "cluster", label: "洞察 Agent", status: "completed", metrics: { themes: 3 } },
    { key: "verify", label: "核查 Agent", status: "completed", metrics: { evidence_links: 8, evidence_coverage: 1 } },
  ],
  metrics: { comments: 8, included: 7, themes: 3, evidence_coverage: 1, human_confirmation_rate: 0.67 },
  human_gate: { required: true, confirmed: 2, pending: 1 },
};

const brief = {
  id: 401,
  version: 1,
  title: "端午活动怎么参加：时间、入口与材料一次说清",
  audience: "计划参与活动的本地居民、老人家庭与外地游客",
  problem: "报名流程分散，读者难以快速确认自己是否符合条件以及如何参加。",
  angle: "以读者高频问题为结构，用清单形式给出可核验的参与指南。",
  outline: ["报名时间与入口", "参与资格和陪同要求", "所需材料与现场交通", "发布前向主办方核对的信息"],
  risks: ["评论只能证明读者提出了问题，活动规则仍需向主办方核验。"],
  evidence_comment_ids: [1, 2, 3, 4, 5, 6, 7],
  theme_ids: [101, 102],
  generation_mode: "public_demo",
};

const benchmark = {
  sample_size: 7,
  strategies: {
    keyword: { label: "关键词归类", themes: 2, evidence_coverage: 0.71, human_confirmation_rate: 0.5 },
    semantic: { label: "语义聚类 + 人工审阅", model: "public-demo/rules-v1", themes: 3, evidence_coverage: 1, human_confirmation_rate: 0.67 },
  },
  note: "公开演示使用固定样本，用于展示评测方法，不代表真实业务提升。",
};

const profiles = [
  { id: 1, name: "公开演示规则基线", provider: "rules", base_url: "browser", model: "rules-v1", embedding_model: "TF-IDF", secret_env: "", secret_configured: false, enabled: true },
];

export async function publicDemoApi(path: string, init?: RequestInit): Promise<unknown> {
  await new Promise((resolve) => setTimeout(resolve, 120));
  const method = init?.method ?? "GET";
  if (path === "/v2/projects" && method === "GET") return { items: [project] };
  if (path.startsWith("/v2/projects?lifecycle=")) return { items: [] };
  if (path === "/v2/demo/bootstrap") return { project_id: project.id, created: false };
  if (path === `/v2/projects/${project.id}`) return project;
  if (path === `/v2/projects/${project.id}/comments`) return { items: comments, total: comments.length };
  if (path === `/v2/projects/${project.id}/themes`) return { items: themes };
  if (path === `/v2/projects/${project.id}/analysis-runs`) return { items: [run] };
  if (path === `/v2/projects/${project.id}/benchmark`) return benchmark;
  if (path === `/v2/projects/${project.id}/briefs`) return { items: [brief] };
  if (path === `/v2/projects/${project.id}/analysis`) return { ...run, themes };
  if (path === "/v2/model-profiles") return { items: profiles };
  if (/^\/v2\/model-profiles\/\d+\/test$/.test(path)) return { ok: true, message: "公开演示规则基线可用", models: ["rules-v1"] };
  const themeMatch = path.match(/^\/v2\/themes\/(\d+)$/);
  if (themeMatch && method === "PATCH") {
    const changes = JSON.parse(String(init?.body ?? "{}"));
    themes = themes.map((item) => item.id === Number(themeMatch[1]) ? { ...item, ...changes } : item);
    return themes.find((item) => item.id === Number(themeMatch[1]));
  }
  if (/^\/v2\/projects\/\d+\/(archive|trash|restore)$/.test(path)) return project;
  throw new Error("公开演示模式暂不支持这项写入操作，请在 GitHub 下载本地完整版。");
}
