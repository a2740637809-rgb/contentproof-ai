export type EvidenceItem = {
  id: string;
  channel: string;
  text: string;
};

export type Signal = {
  id: string;
  theme: string;
  evidence: EvidenceItem[];
  confidence: number;
  rationale: string;
  action: string;
};

export type Brief = {
  title: string;
  problem: string;
  audience: string;
  evidenceIds: string[];
  angle: string;
  acceptanceCriteria: string[];
};

const THEMES = [
  {
    theme: "事实可信",
    words: ["错误", "写错", "不准", "来源", "出处", "核实", "编造", "事实"],
    action: "用来源引用和人工核验说明每个结论为什么可信。",
  },
  {
    theme: "内容辨识度",
    words: ["模板", "机械", "空洞", "一样", "同质", "标题", "可读"],
    action: "从真实受众语言提取表达角度，减少通用模板句。",
  },
  {
    theme: "流程韧性",
    words: ["慢", "失败", "重来", "卡", "等待", "恢复", "步骤"],
    action: "显示处理进度，保存中间结果并允许失败后重试。",
  },
  {
    theme: "协作交付",
    words: ["导出", "审核", "平台", "版本", "协作", "批量"],
    action: "保留审核记录，并把通过的简报导出为可交付文档。",
  },
  {
    theme: "本地隐私",
    words: ["隐私", "本地", "泄露", "敏感", "权限", "上传"],
    action: "默认在本地处理素材，并明确数据是否离开设备。",
  },
] as const;

const redact = (text: string) =>
  text
    .replace(/1[3-9]\d{9}/g, "[手机号]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[邮箱]");

export function analyzeEvidence(items: EvidenceItem[]) {
  const groups = new Map<string, { theme: string; action: string; evidence: EvidenceItem[] }>();
  for (const item of items) {
    const clean = { ...item, text: redact(item.text.trim()) };
    const ranked = THEMES.map((entry) => ({
      ...entry,
      matches: entry.words.filter((word) => clean.text.toLowerCase().includes(word)).length,
    })).sort((a, b) => b.matches - a.matches);
    const chosen = ranked[0].matches
      ? ranked[0]
      : { theme: "待人工归类", action: "补充上下文后再决定是否进入内容简报。", matches: 0 };
    const group = groups.get(chosen.theme) ?? {
      theme: chosen.theme,
      action: chosen.action,
      evidence: [],
    };
    group.evidence.push(clean);
    groups.set(chosen.theme, group);
  }

  const signals: Signal[] = [...groups.values()]
    .map((group, index) => {
      const matched = THEMES.find((entry) => entry.theme === group.theme);
      const hits = group.evidence.reduce(
        (total, item) =>
          total +
          (matched?.words.filter((word) => item.text.toLowerCase().includes(word)).length ?? 0),
        0,
      );
      return {
        id: `S-${String(index + 1).padStart(3, "0")}`,
        theme: group.theme,
        evidence: group.evidence,
        confidence: Math.min(0.95, Number((0.45 + hits * 0.08 + group.evidence.length * 0.04).toFixed(2))),
        rationale: matched
          ? `命中“${matched.words.filter((word) => group.evidence.some((item) => item.text.includes(word))).join("、")}”等可检查线索。`
          : "规则基线未命中已定义主题，需要人工判断。",
        action: group.action,
      };
    })
    .sort((a, b) => b.evidence.length - a.evidence.length || b.confidence - a.confidence);

  return { mode: "browser-rules" as const, signals };
}

export function createBrief(signal: Signal): Brief {
  return {
    title: `围绕“${signal.theme}”的内容简报`,
    problem: `${signal.evidence.length} 条原始反馈共同指向“${signal.theme}”。`,
    audience: "需要兼顾生产效率、事实准确与审核责任的内容团队",
    evidenceIds: signal.evidence.map((item) => item.id),
    angle: signal.action,
    acceptanceCriteria: [
      "每个关键结论必须链接到原始证据",
      "无法核实的信息明确标注为待确认",
      "最终内容必须经过人工审核",
    ],
  };
}
