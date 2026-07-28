import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const project = {
  id: 1,
  name: "端午报道评论研究",
  goal: "寻找下一篇解释型报道的选题",
  stage: "review",
  comment_count: 6,
};

const comments = [
  { id: 1, raw_text: "什么时候可以报名？", cleaned_text: "什么时候可以报名？", status: "included", exclusion_reasons: [], pii_flags: [] },
  { id: 2, raw_text: "报名入口在哪里？", cleaned_text: "报名入口在哪里？", status: "included", exclusion_reasons: [], pii_flags: [] },
  { id: 3, raw_text: "广告加微信abc", cleaned_text: "广告加微信abc", status: "excluded", exclusion_reasons: ["advertisement"], pii_flags: [] },
];

const themes = [
  { id: 7, name: "报名与参与", summary: "读者集中询问报名入口和参与条件。", status: "pending_review", comment_ids: [1, 2], cluster_label: 0 },
];

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.endsWith("/api/v2/projects") && method === "GET") return json({ items: [project] });
    if (url.endsWith("/api/v2/projects/1") && method === "GET") return json(project);
    if (url.endsWith("/api/v2/projects/1/comments")) return json({ items: comments, total: comments.length });
    if (url.endsWith("/api/v2/projects/1/themes")) return json({ items: themes });
    if (url.endsWith("/api/v2/projects/1/analysis-runs")) return json({
      items: [{
        id: 9, status: "completed", model: "bge-small-zh-v1.5", method: "kmeans",
        steps: [
          { key: "collect", label: "采集 Agent", status: "completed", metrics: { received: 3 } },
          { key: "clean", label: "整理 Agent", status: "completed", metrics: { included: 2, excluded: 1 } },
          { key: "cluster", label: "洞察 Agent", status: "completed", metrics: { themes: 1, evidence_links: 2 } },
          { key: "verify", label: "核查 Agent", status: "completed", metrics: { evidence_coverage: 1 } },
        ],
        metrics: { comments: 3, included: 2, themes: 1, evidence_coverage: 1, human_confirmation_rate: 0 },
        human_gate: { required: true, confirmed: 0, pending: 1 },
      }],
    });
    if (url.endsWith("/api/v2/projects/1/benchmark")) return json({
      sample_size: 8,
      strategies: {
        keyword_baseline: {
          label: "关键词基线",
          themes: 2,
          evidence_coverage: 0.5,
          human_confirmation_rate: 0,
        },
        latest_analysis: {
          label: "当前分析",
          model: "qwen2:1.5b",
          themes: 3,
          evidence_coverage: 1,
          human_confirmation_rate: 0.67,
        },
      },
      note: "结果来自当前项目数据，不代表通用模型准确率。",
    });
    if (url.endsWith("/api/v2/model-profiles") && method === "GET") return json({
      items: [{
        id: 1, name: "本地规则基线", provider: "rules", base_url: "",
        model: "deterministic-v1", embedding_model: "browser-rules",
        secret_env: "", secret_configured: false, enabled: true,
      }],
    });
    if (url.endsWith("/api/v2/model-profiles/1/test") && method === "POST") {
      return json({ ok: true, models: ["deterministic-v1"], message: "内置规则可用" });
    }
    if (url.endsWith("/api/v2/demo/bootstrap") && method === "POST") {
      return json({ project_id: 1, created: false }, 200);
    }
    if (url.endsWith("/api/v2/projects/1/briefs") && method === "GET") return json({ items: [] });
    if (url.endsWith("/api/v2/themes/7") && method === "PATCH") {
      return json({ ...themes[0], status: "confirmed" });
    }
    if (url.endsWith("/api/v2/projects/1/briefs") && method === "POST") {
      return json({
        id: 11,
        version: 1,
        title: "活动参与指南",
        audience: "准备参与活动的读者",
        problem: "报名信息不够清晰",
        angle: "逐项回答读者问题",
        outline: ["报名时间", "报名入口", "参与条件"],
        risks: ["发布前核验活动信息"],
        evidence_comment_ids: [1, 2],
        theme_ids: [7],
        generation_mode: "deterministic_fallback",
      }, 201);
    }
    return json({ detail: `unhandled ${method} ${url}` }, 404);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Content Intelligence Lab", () => {
  it("presents an editorial research product instead of a decorative dashboard", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: /从读者原话.*到下一篇选题/ })).toBeInTheDocument();
    expect(screen.getByText("证据优先 · 本地运行")).toBeInTheDocument();
    expect(screen.getByText("让每一条内容判断都有原话可查")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "四个 Agent，一次可审阅的研究" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "五分钟完成第一次研究" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "从 8 条原话到 1 份内容方案" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "每个结论如何回到原话" })).toBeInTheDocument();
    expect(screen.getByText("React + FastAPI")).toBeInTheDocument();
    expect(screen.getByText("Apache 2.0")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /a2740637809@gmail.com/ })).toHaveAttribute(
      "href",
      "mailto:a2740637809@gmail.com",
    );
    expect(screen.queryByText(/综合评分/)).not.toBeInTheDocument();
  });

  it("reviews evidence, confirms a theme, and produces a linked brief", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /打开研究/ }));
    fireEvent.click(await screen.findByRole("button", { name: /洞察审阅/ }));
    expect((await screen.findAllByText("读者集中询问报名入口和参与条件。")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "确认主题" }));
    await waitFor(() => expect(screen.getAllByText("已确认").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "生成内容 Brief" }));
    expect(await screen.findByDisplayValue("活动参与指南")).toBeInTheDocument();
    expect(screen.getByText("2 条原始评论")).toBeInTheDocument();
  });

  it("shows a real analysis trace instead of a decorative agent diagram", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /打开研究/ }));
    fireEvent.click(await screen.findByRole("button", { name: /运行轨迹/ }));
    expect(await screen.findByRole("heading", { name: "AI 如何得出这些主题" })).toBeInTheDocument();
    expect(screen.getByText("bge-small-zh-v1.5")).toBeInTheDocument();
    expect(screen.getAllByText("证据覆盖率").length).toBeGreaterThan(0);
    expect(screen.getByText("等待人工确认")).toBeInTheDocument();
  });

  it("compares analysis strategies using observed project data", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "继续研究" }));
    fireEvent.click(await screen.findByRole("button", { name: /方案对比/ }));
    expect(await screen.findByRole("heading", { name: "哪种分析方法更值得采用" })).toBeInTheDocument();
    expect(screen.getByText("关键词基线")).toBeInTheDocument();
    expect(screen.getByText("当前分析")).toBeInTheDocument();
    expect(screen.getByText("结果来自当前项目数据，不代表通用模型准确率。")).toBeInTheDocument();
  });

  it("opens model center and verifies a configured provider", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "继续研究" }));
    fireEvent.click(await screen.findByRole("button", { name: /模型中心/ }));
    expect(await screen.findByRole("heading", { name: "选择谁来完成分析" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "测试连接" }));
    expect(await screen.findByText(/内置规则可用/)).toBeInTheDocument();
  });

  it("offers a complete example and project lifecycle controls", async () => {
    render(<App />);
    expect(await screen.findByRole("button", { name: "加载完整示例" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /项目操作/ }));
    expect(screen.getByRole("button", { name: "归档研究" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "移入回收站" })).toBeInTheDocument();
  });
});
