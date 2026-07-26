import type { Evaluation, Task } from "./types";

export const seedTask: Task = {
  id: 1, title: "端午反诈与禁毒内容实验", content_type: "活动新闻",
  target_platform: "常德融媒客户端", audience: "常德市民", tone: "准确、清晰、克制",
  min_words: 300, max_words: 700, status: "demo",
  sources: [
    { id: 1, title: "“反诈+禁毒”遇上端午节", url: "https://appimg.cdyee.com/app/template/displayTemplate/news/newsDetail/30533/3156167.html", excerpt: "端午主题活动将反诈、禁毒与安全宣传结合。", status: "verified", facts: [{ text: "活动主题包含反诈、禁毒与端午节", status: "verified" }] },
    { id: 2, title: "常德市新媒体协会成立", url: "https://appimg.cdyee.com/app/template/displayTemplate/news/newsDetail/30492/3155984.html", excerpt: "新媒体协会成立，网络作品征集活动同步启动。", status: "verified", facts: [{ text: "网络作品征集活动同步启动", status: "verified" }] },
    { id: 3, title: "银发人才闪耀校园艺术节", url: "https://appimg.cdyee.com/app/template/displayTemplate/news/newsDetail/20012/3156338.html", excerpt: "报道聚焦银发人才参与校园文化艺术节。", status: "pending", facts: [] },
  ],
  runs: [],
};
export const seedEvaluation: Evaluation = {
  id: 1, run_id: 1, total: 88, human_decision: null,
  dimensions: {
    factual_accuracy: { score: 92, reason: "关键事实均可回溯到来源卡片。", evidence: ["反诈、禁毒、端午三个主题与来源一致"] },
    structure: { score: 88, reason: "导语、现场、提示层次完整。", evidence: ["信息顺序符合活动新闻阅读习惯"] },
    readability: { score: 86, reason: "句式简洁，信息密度适中。", evidence: ["无明显冗余段落"] },
    platform_fit: { score: 84, reason: "适合融媒客户端快速阅读。", evidence: ["导语直接呈现活动亮点"] },
    risk_control: { score: 94, reason: "未发现禁用词和无来源数字。", evidence: ["硬规则检查通过"] },
  },
};
