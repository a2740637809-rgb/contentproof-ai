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
    expect(await screen.findByRole("heading", { name: /从读者原话.*到下一篇选题。/ })).toBeInTheDocument();
    expect(screen.getByText("证据优先 · 本地运行")).toBeInTheDocument();
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
});
