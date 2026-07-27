import { describe, expect, it } from "vitest";
import { analyzeEvidence, createBrief } from "./analyzer";

describe("browser rules baseline", () => {
  it("groups feedback and keeps every source trace", () => {
    const result = analyzeEvidence([
      { id: "E-001", channel: "访谈", text: "最怕事实错误，也看不到来源。" },
      { id: "E-002", channel: "评论", text: "希望每个结论都能核实出处。" },
    ]);

    expect(result.mode).toBe("browser-rules");
    expect(result.signals[0].theme).toBe("事实可信");
    expect(result.signals[0].evidence.map((item) => item.id)).toEqual([
      "E-001",
      "E-002",
    ]);
    expect(result.signals[0].confidence).toBeGreaterThan(0);
  });

  it("creates a brief only from the selected signal evidence", () => {
    const [signal] = analyzeEvidence([
      { id: "E-001", channel: "访谈", text: "内容没有来源，事实无法核实。" },
    ]).signals;

    const brief = createBrief(signal);

    expect(brief.evidenceIds).toEqual(["E-001"]);
    expect(brief.acceptanceCriteria).toContain("每个关键结论必须链接到原始证据");
  });
});
